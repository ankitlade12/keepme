import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { database, ensureDatabase } from "./database";

const localLimits = new Map<string, { count: number; resetsAt: number }>();

export function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function secureToken() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

export function requestFingerprint(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return digestToken(`${forwarded ?? request.headers.get("x-real-ip") ?? "local"}:${request.headers.get("user-agent") ?? "unknown"}`).slice(0, 24);
}

export function validSessionToken(storedDigest: string, supplied: string | undefined) {
  if (!supplied) return false;
  const candidate = Buffer.from(digestToken(supplied));
  const expected = Buffer.from(storedDigest);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function suppliedSessionToken(request: NextRequest) {
  return request.cookies.get("__Host-keepme_session")?.value ?? request.cookies.get("keepme_session")?.value ?? request.headers.get("x-keepme-session") ?? undefined;
}

export function originAllowed(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const expected = new URL(request.url).origin;
  return origin === expected;
}

export async function consumeRateLimit(bucket: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const sql = database();
  if (!sql) {
    const current = localLimits.get(bucket);
    if (!current || current.resetsAt <= now) {
      localLimits.set(bucket, { count: 1, resetsAt: now + windowSeconds * 1000 });
      return { allowed: true, remaining: limit - 1, retryAfter: windowSeconds };
    }
    current.count += 1;
    return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), retryAfter: Math.ceil((current.resetsAt - now) / 1000) };
  }
  await ensureDatabase();
  const resetsAt = new Date(now + windowSeconds * 1000);
  const [row] = await sql<{ count: number; resets_at: Date }[]>`
    insert into keepme_rate_limits (bucket, count, resets_at) values (${bucket}, 1, ${resetsAt})
    on conflict (bucket) do update set
      count = case when keepme_rate_limits.resets_at <= now() then 1 else keepme_rate_limits.count + 1 end,
      resets_at = case when keepme_rate_limits.resets_at <= now() then ${resetsAt} else keepme_rate_limits.resets_at end
    returning count, resets_at
  `;
  return { allowed: row.count <= limit, remaining: Math.max(0, limit - row.count), retryAfter: Math.max(1, Math.ceil((row.resets_at.getTime() - now) / 1000)) };
}
