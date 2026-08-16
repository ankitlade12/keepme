import "server-only";

import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { serverConfig } from "./server-config";

const devSecret = "keepme-development-receipt-secret-do-not-deploy";

function key() {
  return new TextEncoder().encode(serverConfig.RECEIPT_SIGNING_SECRET ?? devSecret);
}

export function evidenceDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function signReceipt(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "keepme-receipt+jwt" })
    .setIssuer("keepme")
    .setAudience("keepme-receipt")
    .setIssuedAt()
    .setJti(String(payload.receiptId))
    .sign(key());
}

export async function verifyReceipt(signature: string) {
  return jwtVerify(signature, key(), { issuer: "keepme", audience: "keepme-receipt" });
}
