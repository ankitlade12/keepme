import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { identityContractSchema } from "@/lib/contract";
import { demoResult } from "@/lib/demo";
import { createReceipt } from "@/lib/receipt-factory";
import { repairZone, verifyLiveResult } from "@/lib/live-integrity";
import { updateSession } from "@/lib/session-store";
import { createClothesTask, getClothesTask, YouCamConfigurationError } from "@/lib/youcam";
import { authorizedSession } from "@/lib/session-auth";
import { deleteArtifacts, putArtifact, readArtifact } from "@/lib/object-store";
import { consumeRateLimit, originAllowed } from "@/lib/security";
import { recordEvent, recordProviderUsage } from "@/lib/observability";
import { serverConfig } from "@/lib/server-config";

export const dynamic = "force-dynamic";

function missing() {
  return NextResponse.json({ error: "Session not found or expired." }, { status: 404 });
}

async function demoImage(name: string) {
  return new Uint8Array(await readFile(path.join(process.cwd(), "public", "demo", name)));
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await context.params;
  if (action !== "identity-contract") return NextResponse.json({ error: "Unsupported action." }, { status: 404 });
  if (!originAllowed(request)) return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  const current = await authorizedSession(request, id);
  if (!current) return missing();
  const parsed = identityContractSchema.safeParse(await request.json());
  if (!parsed.success || parsed.data.sessionId !== id) return NextResponse.json({ error: "Invalid Identity Contract.", issues: parsed.error?.issues }, { status: 400 });
  const session = await updateSession(id, { contract: parsed.data, stage: "ready" });
  await recordEvent(current.tenantId, id, "contract", "consented", { protectionCount: parsed.data.protections.filter((item) => item.enabled).length, customZoneCount: parsed.data.customZones.length });
  return NextResponse.json({ contract: session?.contract, stage: session?.stage });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await context.params;
  if (!originAllowed(request)) return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  const session = await authorizedSession(request, id);
  if (!session) return missing();

  if (action === "generate") {
    if (!session.contract?.consentedAt) return NextResponse.json({ error: "An approved Identity Contract is required." }, { status: 409 });
    const body = await request.json().catch(() => ({})) as { sourceFileId?: string; referenceFileId?: string; demoMode?: boolean };
    const demoMode = body.demoMode ?? process.env.KEEPME_DEMO_MODE !== "false";
    if (demoMode) {
      await deleteArtifacts([session.sourceImage, session.referenceImage, session.resultImage]);
      const [sourceBytes, referenceBytes, resultBytes] = await Promise.all([
        demoImage("source-shopper.png"),
        demoImage("rust-jacket.png"),
        demoImage("controlled-glasses-violation-v5.png"),
      ]);
      const taskId = `demo_violation_${crypto.randomUUID().slice(0, 8)}`;
      const [sourceImage, referenceImage, resultImage] = await Promise.all([
        putArtifact(session.tenantId, id, "source", sourceBytes, "image/png"),
        putArtifact(session.tenantId, id, "reference", referenceBytes, "image/png"),
        putArtifact(session.tenantId, id, "result", resultBytes, "image/png"),
      ]);
      await updateSession(id, {
        stage: "generating",
        generationTaskId: taskId,
        sourceImage,
        referenceImage,
        resultImage,
        provider: "controlled_demo",
      });
      await recordEvent(session.tenantId, id, "generation", "controlled_fixture_started", { providerUnits: 0 });
      return NextResponse.json({ taskId, taskStatus: "running", provider: "controlled_demo", pollAfterMs: 800 }, { status: 202 });
    }
    const sourceFileId = body.sourceFileId ?? session.sourceFileId ?? undefined;
    const referenceFileId = body.referenceFileId ?? session.referenceFileId ?? undefined;
    if (!sourceFileId || !referenceFileId) return NextResponse.json({ error: "Live generation requires uploaded source and reference images." }, { status: 400 });
    if (session.providerTaskCount >= serverConfig.MAX_PROVIDER_TASKS_PER_SESSION) return NextResponse.json({ error: "This session reached its live-generation credit limit." }, { status: 429 });
    const budget = await consumeRateLimit(`provider:${session.tenantId}`, serverConfig.MAX_PROVIDER_TASKS_PER_HOUR, 60 * 60);
    if (!budget.allowed) return NextResponse.json({ error: "The retailer's hourly generation budget has been reached." }, { status: 429, headers: { "Retry-After": String(budget.retryAfter) } });
    const startedAt = Date.now();
    try {
      const task = await createClothesTask(sourceFileId, referenceFileId);
      await updateSession(id, { stage: "generating", generationTaskId: task.data.task_id, provider: "youcam", resultImage: null, providerTaskCount: session.providerTaskCount + 1 });
      await recordProviderUsage({ tenantId: session.tenantId, sessionId: id, provider: "youcam", operation: "clothes_v3", status: "started", latencyMs: Date.now() - startedAt });
      return NextResponse.json({ taskId: task.data.task_id, taskStatus: "running", provider: "youcam", pollAfterMs: 1500 }, { status: 202 });
    } catch (error) {
      await recordProviderUsage({ tenantId: session.tenantId, sessionId: id, provider: "youcam", operation: "clothes_v3", status: "failed_to_start", latencyMs: Date.now() - startedAt });
      const message = error instanceof YouCamConfigurationError ? error.message : "Generation provider could not start the task.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (action === "verify") {
    if (!session.contract) return NextResponse.json({ error: "Identity Contract is missing." }, { status: 409 });
    const body = await request.json().catch(() => ({})) as { fixture?: "pass" | "violation" | "repaired" };
    try {
      if (body.fixture && session.provider !== "controlled_demo") return NextResponse.json({ error: "Controlled evidence cannot be applied to a live provider result." }, { status: 400 });
      const [sourceBytes, resultBytes] = session.sourceImage && session.resultImage
        ? await Promise.all([readArtifact(session.sourceImage), readArtifact(session.resultImage)])
        : [null, null];
      const result = body.fixture
        ? demoResult(session.contract.contractId, body.fixture)
        : sourceBytes && resultBytes && session.sourceImage && session.resultImage
          ? await verifyLiveResult(session.contract, { bytes: sourceBytes, contentType: session.sourceImage.contentType }, { bytes: resultBytes, contentType: session.resultImage.contentType })
          : null;
      if (!result) return NextResponse.json({ error: "Source and generated images are required for live verification." }, { status: 409 });
      await updateSession(id, { result, stage: "result" });
      await recordEvent(session.tenantId, id, "integrity", "verified", { state: result.state, summaryScore: result.summaryScore, findingCount: result.findings.length, findings: result.findings.map((finding) => ({ code: finding.code })) });
      if (session.provider === "youcam" && result.components.some((component) => component.id === "skin_consistency" && component.score !== null)) await recordProviderUsage({ tenantId: session.tenantId, sessionId: id, provider: "youcam", operation: "skin_analysis_v2_1", status: "completed", units: 2 });
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ error: "Live integrity verification could not complete. The images remain available for retry or deletion." }, { status: 502 });
    }
  }

  if (action === "repair") {
    if (!session.result?.repairSupported || !session.contract || !session.sourceImage || !session.resultImage || !session.contract.customZones[0]) return NextResponse.json({ error: "This result does not support automatic repair." }, { status: 409 });
    try {
      if (session.provider === "controlled_demo") {
        const repairedBytes = await demoImage("verified-tryon.png");
        const resultImage = await putArtifact(session.tenantId, id, "repaired-result", repairedBytes, "image/png");
        await deleteArtifacts([session.resultImage]);
        const result = demoResult(session.contract.contractId, "repaired");
        await updateSession(id, { result, resultImage, stage: "result" });
        return NextResponse.json(result);
      }
      const findingRegion = session.result.findings.find((finding) => finding.code === "PRESERVE_ZONE_CHANGED")?.region;
      const repairTarget = findingRegion
        ? { ...session.contract.customZones[0], ...findingRegion }
        : session.contract.customZones[0];
      const [sourceBytes, resultBytes] = await Promise.all([readArtifact(session.sourceImage), readArtifact(session.resultImage)]);
      const sourceImage = { bytes: sourceBytes, contentType: session.sourceImage.contentType };
      const repairedBytes = await repairZone(sourceImage, { bytes: resultBytes, contentType: session.resultImage.contentType }, repairTarget);
      const repairedImage = { bytes: new Uint8Array(repairedBytes), contentType: "image/png" };
      const result = await verifyLiveResult(session.contract, sourceImage, repairedImage);
      result.state = result.state === "passed" ? "passed_after_repair" : result.state;
      result.repaired = true;
      const resultImage = await putArtifact(session.tenantId, id, "repaired-result", repairedImage.bytes, repairedImage.contentType);
      await deleteArtifacts([session.resultImage]);
      await updateSession(id, { result, resultImage, stage: "result" });
      await recordEvent(session.tenantId, id, "integrity", "repair_reverified", { state: result.state });
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ error: "The selected source region could not be repaired safely." }, { status: 502 });
    }
  }

  if (action === "approve") {
    if (!session.result || !session.contract || session.result.state === "failed" || session.result.state === "inconclusive") return NextResponse.json({ error: "A conclusive, non-failed verified result is required." }, { status: 409 });
    const usedYouCam = Boolean(session.generationTaskId && !session.generationTaskId.startsWith("demo_"));
    const receipt = await createReceipt(session.result.state, session.contract.protections.filter((item) => item.enabled).map((item) => item.label), session.result.repaired, usedYouCam, session.contract.garment?.name, session.contract, session.result);
    await updateSession(id, { approved: true, receipt });
    await recordEvent(session.tenantId, id, "receipt", "signed", { state: receipt.state, signatureAlgorithm: receipt.signatureAlgorithm });
    return NextResponse.json(receipt, { status: 201 });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 404 });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await context.params;
  const session = await authorizedSession(request, id);
  if (!session) return missing();

  if (action === "generation-status") {
    if (!session.generationTaskId) return NextResponse.json({ error: "No generation task exists." }, { status: 409 });
    if (session.generationTaskId.startsWith("demo_")) {
      await updateSession(id, { stage: "verifying" });
      return NextResponse.json({ taskId: session.generationTaskId, taskStatus: "success", resultUrl: `/api/v1/sessions/${id}/result-image`, provider: "controlled_demo" });
    }
    try {
      if (session.resultImage) return NextResponse.json({ taskId: session.generationTaskId, taskStatus: "success", resultUrl: `/api/v1/sessions/${id}/result-image`, provider: "youcam" });
      const task = await getClothesTask(session.generationTaskId);
      const providerResults = task.data.results;
      const providerUrl = Array.isArray(providerResults) ? providerResults[0]?.url : providerResults?.url;
      if (task.data.task_status === "success" && providerUrl) {
        const imageResponse = await fetch(providerUrl, { cache: "no-store" });
        if (!imageResponse.ok) return NextResponse.json({ error: "Generated image could not be downloaded." }, { status: 502 });
        const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
        const resultImage = await putArtifact(session.tenantId, id, "result", new Uint8Array(await imageResponse.arrayBuffer()), contentType);
        await updateSession(id, {
          resultImage,
          stage: "verifying",
        });
        await recordProviderUsage({ tenantId: session.tenantId, sessionId: id, provider: "youcam", operation: "clothes_v3", status: "completed" });
        return NextResponse.json({ taskId: session.generationTaskId, taskStatus: "success", resultUrl: `/api/v1/sessions/${id}/result-image`, provider: "youcam" });
      }
      return NextResponse.json({ taskId: session.generationTaskId, taskStatus: task.data.task_status, provider: "youcam", error: task.data.error });
    } catch {
      return NextResponse.json({ error: "Could not retrieve generation status." }, { status: 502 });
    }
  }

  if (action === "result-image") {
    if (!session.resultImage) return NextResponse.json({ error: "Generated image is unavailable." }, { status: 404 });
    const bytes = await readArtifact(session.resultImage);
    return new NextResponse(Buffer.from(bytes), {
      headers: { "Content-Type": session.resultImage.contentType, "Cache-Control": "private, no-store" },
    });
  }

  if (action === "integrity-result") {
    if (!session.result) return NextResponse.json({ error: "Verification has not completed." }, { status: 404 });
    return NextResponse.json(session.result);
  }

  if (action === "receipt") {
    if (!session.receipt) return NextResponse.json({ error: "No approved receipt exists." }, { status: 404 });
    return NextResponse.json(session.receipt);
  }

  if (action === "receipt-download") {
    if (!session.receipt) return NextResponse.json({ error: "No approved receipt exists." }, { status: 404 });
    return new NextResponse(JSON.stringify({ format: "keepme.integrity-receipt.v1", receipt: session.receipt }, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${session.receipt.receiptId}.json"`, "Cache-Control": "private, no-store" },
    });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 404 });
}
