import "server-only";

import type { IdentityContract, IntegrityResult, SessionReceipt } from "./types";
import { evidenceDigest, signReceipt } from "./receipt-signing";

export async function createReceipt(
  state: SessionReceipt["state"],
  protections: string[],
  repaired: boolean,
  youCamFixture = false,
  garmentName = "Upper-body apparel",
  contract?: IdentityContract,
  result?: IntegrityResult,
): Promise<SessionReceipt> {
  const unsigned = {
    receiptId: `KM-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    requestedEdit: `${garmentName} virtual try-on`,
    protectedItems: protections,
    state,
    generator: youCamFixture ? "YouCam AI Clothes v3" as const : "KeepMe controlled demo" as const,
    skinSignal: youCamFixture ? "YouCam Skin Analysis v2.1" as const : "Controlled demo signal" as const,
    repairStatus: repaired ? "completed" as const : state === "passed" ? "not_needed" as const : "not_attempted" as const,
    retentionOutcome: "scheduled_for_deletion" as const,
    contractDigest: evidenceDigest(contract ?? {}),
    resultDigest: evidenceDigest(result ?? {}),
    signatureAlgorithm: "HS256" as const,
  };
  return { ...unsigned, signature: await signReceipt(unsigned) };
}
