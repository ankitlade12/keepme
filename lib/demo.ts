import type { IntegrityFinding } from "./types";
import { buildIntegrityResult, type IntegritySignals } from "./integrity";

export const compliantSignals: IntegritySignals = {
  garmentFidelity: 0.96,
  outsideRegion: 0.97,
  faceStability: 0.98,
  skinConsistency: 0.94,
  silhouetteStability: 0.93,
  preserveZone: 0.97,
  qualityConfidence: 0.95,
  alignmentReliable: true,
};

export const violationSignals: IntegritySignals = {
  garmentFidelity: 0.95,
  outsideRegion: 0.81,
  faceStability: 0.9,
  skinConsistency: 0.79,
  silhouetteStability: 0.92,
  preserveZone: 0.58,
  qualityConfidence: 0.92,
  criticalZoneFailed: true,
  alignmentReliable: true,
};

export const repairedSignals: IntegritySignals = {
  ...compliantSignals,
  preserveZone: 0.95,
  qualityConfidence: 0.93,
  repaired: true,
};

export const violationFindings: IntegrityFinding[] = [
  {
    code: "PRESERVE_ZONE_CHANGED",
    severity: "high",
    message: "The glasses inside your preserve zone may have changed.",
    region: { x: 0.38, y: 0.16, width: 0.24, height: 0.1 },
  },
  {
    code: "SKIN_APPEARANCE_SHIFT",
    severity: "medium",
    message: "Skin texture near the eyes differs more than expected.",
    region: { x: 0.39, y: 0.17, width: 0.22, height: 0.09 },
  },
];

export function demoResult(contractId: string, mode: "pass" | "violation" | "repaired") {
  if (mode === "violation") return buildIntegrityResult(contractId, violationSignals, violationFindings);
  if (mode === "repaired") return buildIntegrityResult(contractId, repairedSignals);
  return buildIntegrityResult(contractId, compliantSignals);
}
