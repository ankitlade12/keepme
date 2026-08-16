export type ResultState =
  | "passed"
  | "passed_after_repair"
  | "needs_review"
  | "failed"
  | "inconclusive";

export type SessionStage =
  | "draft"
  | "ready"
  | "generating"
  | "verifying"
  | "result"
  | "deleted";

export type ComponentStatus = "pass" | "review" | "fail" | "unavailable";

export interface ContractProtection {
  id: "face_geometry" | "skin_appearance" | "hair" | "background" | "glasses";
  label: string;
  description: string;
  enabled: boolean;
}

export interface PreserveZone {
  zoneId: string;
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  critical: boolean;
}

export interface IdentityContract {
  contractId: string;
  contractVersion: "1.0";
  sessionId: string;
  garmentCategory: "upper_body";
  garment?: {
    id: string;
    name: string;
    source: "catalog" | "upload";
  };
  protections: ContractProtection[];
  customZones: PreserveZone[];
  thresholdProfile: "mvp_conservative_v1";
  retention: {
    original: "session_only";
    generated: "session_only";
    receipt: "user_choice";
    analytics: "anonymous_events_only";
  };
  consentedAt: string | null;
}

export interface IntegrityComponent {
  id: string;
  label: string;
  score: number | null;
  status: ComponentStatus;
  detail: string;
}

export interface IntegrityFinding {
  code:
    | "GARMENT_NOT_APPLIED"
    | "OUTSIDE_EDIT_CHANGE"
    | "FACE_GEOMETRY_SHIFT"
    | "SKIN_APPEARANCE_SHIFT"
    | "SILHOUETTE_SHIFT"
    | "PRESERVE_ZONE_CHANGED"
    | "SELECTED_OBJECT_MISSING"
    | "BACKGROUND_CHANGED"
    | "LOW_INPUT_QUALITY"
    | "ALIGNMENT_UNCERTAIN"
    | "SKIN_CHECK_UNAVAILABLE";
  severity: "low" | "medium" | "high";
  message: string;
  region?: { x: number; y: number; width: number; height: number };
}

export interface IntegrityResult {
  resultId: string;
  contractId: string;
  state: ResultState;
  confidence: number;
  summaryScore: number;
  components: IntegrityComponent[];
  findings: IntegrityFinding[];
  repairSupported: boolean;
  repaired: boolean;
  createdAt: string;
}

export interface SessionReceipt {
  receiptId: string;
  timestamp: string;
  requestedEdit: string;
  protectedItems: string[];
  state: ResultState;
  generator: "YouCam AI Clothes v3" | "KeepMe controlled demo";
  skinSignal: "YouCam Skin Analysis v2.1" | "Controlled demo signal";
  repairStatus: "not_needed" | "completed" | "not_attempted";
  retentionOutcome: "scheduled_for_deletion" | "deleted";
  contractDigest: string;
  resultDigest: string;
  signature: string;
  signatureAlgorithm: "HS256";
}
