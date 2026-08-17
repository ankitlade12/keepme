import "server-only";

type RuntimeEnvironment = Partial<Record<
  | "NODE_ENV"
  | "KEEPME_ALLOW_EPHEMERAL"
  | "YOUCAM_API_KEY"
  | "MALWARE_SCAN_URL"
  | "MALWARE_SCAN_TOKEN"
  | "INTEGRITY_WORKER_URL"
  | "INTEGRITY_URL"
  | "INTEGRITY_WORKER_TOKEN",
  string
>>;

export interface LiveTryOnStatus {
  available: boolean;
  missing: string[];
}

export function productionSafetyRequired(environment: RuntimeEnvironment = process.env): boolean {
  return environment.NODE_ENV === "production" && environment.KEEPME_ALLOW_EPHEMERAL !== "true";
}

export function evaluateLiveTryOn(environment: RuntimeEnvironment): LiveTryOnStatus {
  const missing: string[] = [];
  if (!environment.YOUCAM_API_KEY) missing.push("YOUCAM_API_KEY");
  if (productionSafetyRequired(environment)) {
    if (!environment.MALWARE_SCAN_URL) missing.push("MALWARE_SCAN_URL");
    if (!environment.MALWARE_SCAN_TOKEN) missing.push("MALWARE_SCAN_TOKEN");
    if (!environment.INTEGRITY_WORKER_URL && !environment.INTEGRITY_URL) missing.push("INTEGRITY_WORKER_URL or INTEGRITY_URL");
    if (!environment.INTEGRITY_WORKER_TOKEN) missing.push("INTEGRITY_WORKER_TOKEN");
  }
  return { available: missing.length === 0, missing };
}

export function liveTryOnStatus(): LiveTryOnStatus {
  return evaluateLiveTryOn(process.env);
}
