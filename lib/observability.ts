import "server-only";

import { database, ensureDatabase } from "./database";

type EventPayload = Record<string, unknown>;

function safePayload(payload: EventPayload) {
  return Object.fromEntries(Object.entries(payload).filter(([key, value]) => value !== undefined && !/(image|token|secret|email|name|url)/i.test(key)));
}

export async function recordEvent(tenantId: string, sessionId: string | null, category: string, name: string, payload: EventPayload = {}) {
  const event = { level: "info", category, name, tenantId, sessionId, ...safePayload(payload), timestamp: new Date().toISOString() };
  console.info(JSON.stringify(event));
  const sql = database();
  if (!sql) return;
  await ensureDatabase();
  await sql`insert into keepme_events (tenant_id, session_id, category, name, payload) values (${tenantId}, ${sessionId}, ${category}, ${name}, ${sql.json(safePayload(payload) as never)})`;
}

export async function recordProviderUsage(input: { tenantId: string; sessionId: string; provider: string; operation: string; status: string; units?: number; latencyMs?: number }) {
  await recordEvent(input.tenantId, input.sessionId, "provider", input.operation, { provider: input.provider, status: input.status, units: input.units ?? 1, latencyMs: input.latencyMs });
  const sql = database();
  if (!sql) return;
  await ensureDatabase();
  await sql`insert into keepme_provider_usage (tenant_id, session_id, provider, operation, units, status, latency_ms) values (${input.tenantId}, ${input.sessionId}, ${input.provider}, ${input.operation}, ${input.units ?? 1}, ${input.status}, ${input.latencyMs ?? null})`;
}
