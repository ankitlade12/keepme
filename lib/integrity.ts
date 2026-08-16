import type { IntegrityComponent, IntegrityFinding, IntegrityResult, ResultState } from "./types";

export interface IntegritySignals {
  garmentFidelity: number;
  outsideRegion: number;
  faceStability: number;
  skinConsistency: number | null;
  silhouetteStability: number;
  preserveZone: number;
  qualityConfidence: number;
  criticalZoneFailed?: boolean;
  alignmentReliable?: boolean;
  repaired?: boolean;
}

const weights = {
  garmentFidelity: 0.15,
  outsideRegion: 0.25,
  faceStability: 0.15,
  skinConsistency: 0.1,
  silhouetteStability: 0.1,
  preserveZone: 0.25,
};

export const COMPONENT_PASS_THRESHOLD = 0.86;
export const COMPONENT_FAIL_THRESHOLD = 0.72;
export const PRESERVE_ZONE_FAIL_THRESHOLD = 0.68;

export function scoreIntegrity(signals: IntegritySignals): number {
  const skin = signals.skinConsistency ?? signals.outsideRegion;
  const weighted =
    signals.garmentFidelity * weights.garmentFidelity +
    signals.outsideRegion * weights.outsideRegion +
    signals.faceStability * weights.faceStability +
    skin * weights.skinConsistency +
    signals.silhouetteStability * weights.silhouetteStability +
    signals.preserveZone * weights.preserveZone;

  return Number((signals.qualityConfidence * weighted).toFixed(3));
}

export function decideState(signals: IntegritySignals): ResultState {
  if (signals.alignmentReliable === false || signals.qualityConfidence < 0.55) return "inconclusive";
  if (signals.garmentFidelity < 0.35 || signals.criticalZoneFailed || signals.preserveZone < PRESERVE_ZONE_FAIL_THRESHOLD) return "failed";
  const summary = scoreIntegrity(signals);
  if (
    summary < 0.78 ||
    signals.garmentFidelity < COMPONENT_PASS_THRESHOLD ||
    signals.outsideRegion < 0.8 ||
    signals.faceStability < 0.82 ||
    signals.preserveZone < COMPONENT_PASS_THRESHOLD
  ) {
    return "needs_review";
  }
  return signals.repaired ? "passed_after_repair" : "passed";
}

function component(
  id: string,
  label: string,
  score: number | null,
  detail: string,
): IntegrityComponent {
  const status = score === null ? "unavailable" : score >= COMPONENT_PASS_THRESHOLD ? "pass" : score >= COMPONENT_FAIL_THRESHOLD ? "review" : "fail";
  return { id, label, score, status, detail };
}

export function buildIntegrityResult(
  contractId: string,
  signals: IntegritySignals,
  findings: IntegrityFinding[] = [],
): IntegrityResult {
  return {
    resultId: `ir_${crypto.randomUUID().slice(0, 8)}`,
    contractId,
    state: decideState(signals),
    confidence: signals.qualityConfidence,
    summaryScore: scoreIntegrity(signals),
    components: [
      component("garment_fidelity", "Garment applied", signals.garmentFidelity, "Measured change inside the permitted garment region."),
      component("outside_region", "Outside garment", signals.outsideRegion, "Pixels beyond the permitted edit stayed stable."),
      component("face_stability", "Face geometry", signals.faceStability, "Landmark geometry remained within tolerance."),
      component(
        "skin_consistency",
        "Skin consistency",
        signals.skinConsistency,
        signals.skinConsistency === null
          ? "Skin AI was not eligible; confidence was reduced."
          : "Visible skin signals stayed consistent across both images.",
      ),
      component("silhouette_stability", "Body silhouette", signals.silhouetteStability, "Contours outside the garment allowance remained stable."),
      component("preserve_zone", "Custom preserve zone", signals.preserveZone, "The selected glasses region was checked independently."),
    ],
    findings,
    repairSupported: signals.preserveZone < COMPONENT_PASS_THRESHOLD && signals.alignmentReliable !== false,
    repaired: Boolean(signals.repaired),
    createdAt: new Date().toISOString(),
  };
}
