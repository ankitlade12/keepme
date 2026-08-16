import "server-only";

import { database, ensureDatabase } from "./database";

const MIN_COHORT = 20;

export interface RetailerAnalytics {
  suppressed: boolean;
  cohort: number;
  metrics: Array<{ label: string; value: string; note: string }>;
  failures: Array<{ name: string; detail: string; value: string }>;
  providerUnits: number;
}

export async function retailerAnalytics(tenantId: string): Promise<RetailerAnalytics> {
  const sql = database();
  if (!sql) return { suppressed: true, cohort: 0, providerUnits: 0, metrics: [
    { label: "Verified useful try-ons", value: "—", note: "Connect production Postgres" },
    { label: "First-pass compliance", value: "—", note: "Minimum cohort n=20" },
    { label: "Repair success", value: "—", note: "Minimum cohort n=20" },
    { label: "Deletion success", value: "—", note: "No production events" },
  ], failures: [] };
  await ensureDatabase();
  const [counts] = await sql<{ total: number; passed: number; repaired: number; deleted: number }[]>`
    select
      count(*) filter (where category = 'integrity' and name = 'verified')::int as total,
      count(*) filter (where category = 'integrity' and name = 'verified' and payload->>'state' = 'passed')::int as passed,
      count(*) filter (where category = 'integrity' and name = 'repair_reverified' and payload->>'state' = 'passed_after_repair')::int as repaired,
      count(*) filter (where category = 'deletion' and name in ('verified', 'expired_and_verified'))::int as deleted
    from keepme_events where tenant_id = ${tenantId}
  `;
  const [usage] = await sql<{ units: number }[]>`select coalesce(sum(units), 0)::int as units from keepme_provider_usage where tenant_id = ${tenantId}`;
  const cohort = counts.total;
  if (cohort < MIN_COHORT) return { suppressed: true, cohort, providerUnits: usage.units, metrics: [
    { label: "Verified useful try-ons", value: "—", note: `Suppressed · n=${cohort}` },
    { label: "First-pass compliance", value: "—", note: "Minimum cohort n=20" },
    { label: "Repair success", value: "—", note: "Minimum cohort n=20" },
    { label: "Deletion success", value: "—", note: "Minimum cohort n=20" },
  ], failures: [] };
  const percent = (value: number, denominator = cohort) => `${(value / Math.max(1, denominator) * 100).toFixed(1)}%`;
  const findings = await sql<{ code: string; count: number }[]>`
    select finding->>'code' as code, count(*)::int as count
    from keepme_events, jsonb_array_elements(coalesce(payload->'findings', '[]'::jsonb)) finding
    where tenant_id = ${tenantId} and category = 'integrity'
    group by finding->>'code' order by count desc limit 5
  `;
  return {
    suppressed: false,
    cohort,
    providerUnits: usage.units,
    metrics: [
      { label: "Verified useful try-ons", value: percent(counts.passed + counts.repaired), note: `Production cohort · n=${cohort}` },
      { label: "First-pass compliance", value: percent(counts.passed), note: "No critical violation" },
      { label: "Repair success", value: percent(counts.repaired, Math.max(1, cohort - counts.passed)), note: "Supported regions only" },
      { label: "Verified deletions", value: String(counts.deleted), note: `${usage.units} provider units recorded` },
    ],
    failures: findings.map((finding) => ({ name: finding.code.replaceAll("_", " ").toLowerCase(), detail: "Anonymous reason code", value: percent(finding.count) })),
  };
}
