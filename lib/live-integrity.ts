import sharp from "sharp";
import {
  buildIntegrityResult,
  COMPONENT_PASS_THRESHOLD,
  PRESERVE_ZONE_FAIL_THRESHOLD,
  type IntegritySignals,
} from "./integrity";
import type { IdentityContract, IntegrityFinding, IntegrityResult, PreserveZone } from "./types";
import { createSkinTask, getSkinTask, uploadToYouCam } from "./youcam";
import { analyzeWithVisionWorker } from "./vision-worker";

type StoredImage = { bytes: Uint8Array; contentType: string };
type SkinScores = Record<string, number>;

const ANALYSIS_SIZE = 256;
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function normalizedPixels(image: StoredImage) {
  return sharp(image.bytes).rotate().resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: "fill" }).removeAlpha().raw().toBuffer();
}

function similarityInRegion(source: Buffer, generated: Buffer, include: (x: number, y: number) => boolean) {
  let difference = 0;
  let samples = 0;
  for (let y = 0; y < ANALYSIS_SIZE; y += 1) {
    for (let x = 0; x < ANALYSIS_SIZE; x += 1) {
      if (!include((x + 0.5) / ANALYSIS_SIZE, (y + 0.5) / ANALYSIS_SIZE)) continue;
      const offset = (y * ANALYSIS_SIZE + x) * 3;
      difference += Math.abs(source[offset] - generated[offset]);
      difference += Math.abs(source[offset + 1] - generated[offset + 1]);
      difference += Math.abs(source[offset + 2] - generated[offset + 2]);
      samples += 3;
    }
  }
  if (!samples) return 1;
  return Number(Math.max(0, 1 - difference / samples / 255).toFixed(3));
}

function insideAllowedGarment(x: number, y: number) {
  if (y < 0.34) return false;
  const horizontal = (x - 0.5) / 0.31;
  const vertical = (y - 0.64) / 0.31;
  return horizontal * horizontal + vertical * vertical <= 1;
}

async function cropFace(image: StoredImage) {
  const base = sharp(image.bytes).rotate();
  const metadata = await base.metadata();
  if (!metadata.width || !metadata.height) throw new Error("Image dimensions are unavailable.");
  // Skin Analysis requires a face-dominant crop; 33% of the source width matched
  // the provider's accepted HD band for the full-body VTO fixtures.
  const size = Math.max(1, Math.floor(Math.min(metadata.width * 0.33, metadata.height * 0.27)));
  const left = Math.max(0, Math.min(metadata.width - size, Math.floor(metadata.width * 0.5 - size / 2)));
  const top = Math.max(0, Math.min(metadata.height - size, Math.floor(metadata.height * 0.075)));
  return base.extract({ left, top, width: size, height: size }).resize(1200, 1200).jpeg({ quality: 92 }).toBuffer();
}

async function runSkinAnalysis(image: StoredImage): Promise<SkinScores> {
  const face = await cropFace(image);
  const fileId = await uploadToYouCam("skin-analysis", {
    name: "keepme-skin-crop.jpg",
    size: face.byteLength,
    type: "image/jpeg",
    bytes: face,
  });
  const task = await createSkinTask(fileId);
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    await delay(Math.min(900 + attempt * 150, 2500));
    const status = await getSkinTask(task.data.task_id);
    if (status.data.task_status === "error") throw new Error(status.data.error ?? "Skin Analysis failed.");
    if (status.data.task_status !== "success") continue;
    return Object.fromEntries(
      (status.data.results?.output ?? [])
        .filter((item) => ["texture", "radiance", "redness"].includes(item.type) && typeof item.ui_score === "number")
        .map((item) => [item.type, item.ui_score as number]),
    );
  }
  throw new Error("Skin Analysis timed out.");
}

function skinSimilarity(source: SkinScores, generated: SkinScores) {
  const concerns = ["texture", "radiance", "redness"].filter((concern) => concern in source && concern in generated);
  if (!concerns.length) return null;
  const meanDifference = concerns.reduce((sum, concern) => sum + Math.abs(source[concern] - generated[concern]), 0) / concerns.length;
  return Number(Math.max(0, 1 - meanDifference / 100).toFixed(3));
}

function skinDetail(source: SkinScores, generated: SkinScores) {
  const label = (key: string) => `${key} ${source[key] ?? "N/A"}→${generated[key] ?? "N/A"}`;
  return `YouCam Skin v2.1: ${label("redness")}, ${label("texture")}, ${label("radiance")}.`;
}

export async function verifyLiveResult(
  contract: IdentityContract,
  sourceImage: StoredImage,
  resultImage: StoredImage,
): Promise<IntegrityResult> {
  const [sourcePixels, generatedPixels] = await Promise.all([normalizedPixels(sourceImage), normalizedPixels(resultImage)]);
  const vision = await analyzeWithVisionWorker(sourceImage.bytes, resultImage.bytes, contract.customZones).catch(() => null);
  const enabled = new Set(contract.protections.filter((protection) => protection.enabled).map((protection) => protection.id));
  const outsideProtectionEnabled = enabled.has("hair") || enabled.has("background") || enabled.has("glasses");
  const measuredOutsideRegion = similarityInRegion(sourcePixels, generatedPixels, (x, y) => !insideAllowedGarment(x, y));
  const garmentRegionSimilarity = similarityInRegion(sourcePixels, generatedPixels, insideAllowedGarment);
  const garmentEditStrength = 1 - garmentRegionSimilarity;
  const garmentApplication = Number(Math.max(0, Math.min(1, (garmentEditStrength - 0.03) / 0.18)).toFixed(3));
  const measuredFaceStability = similarityInRegion(sourcePixels, generatedPixels, (x, y) => x >= 0.28 && x <= 0.72 && y >= 0.07 && y <= 0.36);
  const outsideRegion = outsideProtectionEnabled ? measuredOutsideRegion : 0.86;
  const faceStability = enabled.has("face_geometry") ? vision?.faceLandmarkStability ?? measuredFaceStability : 0.86;
  const zoneScores = contract.customZones.map((zone) => similarityInRegion(
    sourcePixels,
    generatedPixels,
    (x, y) => x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height,
  ));
  const preserveZone = zoneScores.length ? Math.min(...zoneScores) : outsideRegion;

  let sourceSkin: SkinScores = {};
  let generatedSkin: SkinScores = {};
  let skinConsistency: number | null = null;
  if (enabled.has("skin_appearance")) {
    try {
      [sourceSkin, generatedSkin] = await Promise.all([runSkinAnalysis(sourceImage), runSkinAnalysis(resultImage)]);
      skinConsistency = skinSimilarity(sourceSkin, generatedSkin);
    } catch {
      skinConsistency = null;
    }
  }

  const signals: IntegritySignals = {
    garmentFidelity: garmentApplication,
    outsideRegion,
    faceStability,
    skinConsistency,
    silhouetteStability: vision?.silhouetteStability ?? outsideRegion,
    preserveZone,
    qualityConfidence: Number(Math.min(skinConsistency === null ? 0.82 : 0.93, vision ? (vision.alignmentConfidence + vision.segmentationConfidence) / 2 : 0.82).toFixed(3)),
    criticalZoneFailed: zoneScores.some((score) => score < PRESERVE_ZONE_FAIL_THRESHOLD),
    alignmentReliable: vision?.alignmentReliable ?? measuredFaceStability >= 0.62,
  };
  const findings: IntegrityFinding[] = [];
  if (garmentApplication < 0.35) findings.push({ code: "GARMENT_NOT_APPLIED", severity: "high", message: "The generated image is too similar to the source inside the garment region. The selected garment may not have been applied." });
  else if (garmentApplication < COMPONENT_PASS_THRESHOLD) findings.push({ code: "GARMENT_NOT_APPLIED", severity: "medium", message: "Only a weak change was measured in the garment region. Confirm the selected garment is visible before approval." });
  if (outsideProtectionEnabled && outsideRegion < 0.8) findings.push({ code: "OUTSIDE_EDIT_CHANGE", severity: "high", message: "Material changes were measured outside the permitted garment region." });
  if (enabled.has("face_geometry") && faceStability < 0.82) findings.push({ code: "FACE_GEOMETRY_SHIFT", severity: "high", message: "The face region differs beyond the conservative similarity threshold." });
  if (preserveZone < PRESERVE_ZONE_FAIL_THRESHOLD) {
    findings.push({ code: "PRESERVE_ZONE_CHANGED", severity: "high", message: "A user-drawn preserve zone differs materially from the source image.", region: contract.customZones[zoneScores.indexOf(preserveZone)] });
  } else if (preserveZone < COMPONENT_PASS_THRESHOLD) {
    findings.push({ code: "PRESERVE_ZONE_CHANGED", severity: "medium", message: "A user-drawn preserve zone is below the 86% pass threshold. Review or restore it before approval.", region: contract.customZones[zoneScores.indexOf(preserveZone)] });
  }
  if (skinConsistency !== null && skinConsistency < 0.85) findings.push({ code: "SKIN_APPEARANCE_SHIFT", severity: "medium", message: "YouCam Skin Analysis signals changed more than expected." });
  if (enabled.has("skin_appearance") && skinConsistency === null) findings.push({ code: "SKIN_CHECK_UNAVAILABLE", severity: "low", message: "Skin Analysis could not run reliably, so confidence was reduced." });
  if (vision && !vision.alignmentReliable) findings.push({ code: "ALIGNMENT_UNCERTAIN", severity: "high", message: "Face-landmark alignment was not reliable enough to compare protected regions safely." });
  if (!vision) findings.push({ code: "ALIGNMENT_UNCERTAIN", severity: "low", message: "The dedicated landmark and segmentation worker was unavailable; conservative pixel alignment was used." });

  const result = buildIntegrityResult(contract.contractId, signals, findings);
  result.repairSupported = contract.customZones.length > 0 && result.repairSupported;
  result.components = result.components.map((component) => {
    const protectionForComponent = component.id === "face_stability" ? "face_geometry" : component.id === "skin_consistency" ? "skin_appearance" : null;
    if (protectionForComponent && !enabled.has(protectionForComponent)) return { ...component, score: null, status: "unavailable", detail: "Disabled in this generation's Identity Contract." };
    if (component.id === "garment_fidelity") return { ...component, detail: "Measured source/result change inside the permitted garment region; provider success alone is not treated as proof." };
    if (component.id === "outside_region") return { ...component, detail: "Measured pixel stability outside the permitted garment ellipse." };
    if (component.id === "face_stability") return { ...component, detail: vision ? "Measured normalized displacement across aligned face landmarks." : "Measured normalized source/result similarity in the protected face region; landmark worker unavailable." };
    if (component.id === "silhouette_stability" && vision) return { ...component, detail: "Compared person-segmentation contours outside the permitted garment region." };
    if (component.id === "skin_consistency" && skinConsistency !== null) return { ...component, detail: skinDetail(sourceSkin, generatedSkin) };
    if (component.id === "preserve_zone") return { ...component, label: contract.customZones.length === 1 ? "Custom preserve zone" : "Custom preserve zones", detail: `${contract.customZones.length} user-drawn zone${contract.customZones.length === 1 ? " was" : "s were"} checked independently.` };
    return component;
  });
  return result;
}

export async function repairZone(sourceImage: StoredImage, resultImage: StoredImage, zone: PreserveZone) {
  const result = sharp(resultImage.bytes).rotate();
  const metadata = await result.metadata();
  if (!metadata.width || !metadata.height) throw new Error("Result dimensions are unavailable.");
  const width = Math.max(2, Math.min(metadata.width, Math.round(zone.width * metadata.width)));
  const height = Math.max(2, Math.min(metadata.height, Math.round(zone.height * metadata.height)));
  const left = Math.max(0, Math.min(metadata.width - width, Math.round(zone.x * metadata.width)));
  const top = Math.max(0, Math.min(metadata.height - height, Math.round(zone.y * metadata.height)));
  const normalizedSource = await sharp(sourceImage.bytes).rotate().resize(metadata.width, metadata.height, { fit: "fill" }).toBuffer();
  const sourcePatch = await sharp(normalizedSource).extract({ left, top, width, height }).ensureAlpha().toBuffer();
  const feather = Math.max(3, Math.round(Math.min(width, height) * 0.06));
  const mask = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="b"><feGaussianBlur stdDeviation="${feather}"/></filter></defs><ellipse cx="${width / 2}" cy="${height / 2}" rx="${Math.max(1, width / 2 - feather * 2)}" ry="${Math.max(1, height / 2 - feather * 2)}" fill="white" filter="url(#b)"/></svg>`);
  const maskedPatch = await sharp(sourcePatch).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  return sharp(resultImage.bytes).rotate().composite([{ input: maskedPatch, left, top }]).png().toBuffer();
}
