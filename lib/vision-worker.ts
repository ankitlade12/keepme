import "server-only";

import type { PreserveZone } from "./types";
import { serverConfig } from "./server-config";

export interface VisionSignals {
  alignmentReliable: boolean;
  alignmentConfidence: number;
  faceLandmarkStability: number;
  silhouetteStability: number;
  segmentationConfidence: number;
}

export async function analyzeWithVisionWorker(source: Uint8Array, result: Uint8Array, customZones: PreserveZone[]): Promise<VisionSignals | null> {
  if (!serverConfig.INTEGRITY_WORKER_URL) return null;
  const response = await fetch(new URL("/v1/analyze", serverConfig.INTEGRITY_WORKER_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(serverConfig.INTEGRITY_WORKER_TOKEN ? { Authorization: `Bearer ${serverConfig.INTEGRITY_WORKER_TOKEN}` } : {}) },
    body: JSON.stringify({ source: Buffer.from(source).toString("base64"), result: Buffer.from(result).toString("base64"), customZones }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Integrity worker returned ${response.status}.`);
  const value = await response.json() as VisionSignals;
  for (const field of ["alignmentConfidence", "faceLandmarkStability", "silhouetteStability", "segmentationConfidence"] as const) {
    if (!Number.isFinite(value[field]) || value[field] < 0 || value[field] > 1) throw new Error(`Integrity worker returned invalid ${field}.`);
  }
  return value;
}
