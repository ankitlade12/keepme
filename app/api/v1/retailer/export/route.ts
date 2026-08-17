import { NextResponse } from "next/server";
import { retailerAuthorized } from "@/lib/session-auth";
import { retailerAnalytics } from "@/lib/retailer-analytics";

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET() {
  const access = await retailerAuthorized();
  if (!access.authorized) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const analytics = await retailerAnalytics(access.tenantId ?? "public");
  const rows = [
    ["metric", "value", "note"],
    ...analytics.metrics.map((metric) => [metric.label, metric.value, metric.note]),
    ["provider units", analytics.providerUnits, "server-recorded operations"],
    ...analytics.failures.map((failure) => [`reason: ${failure.name}`, failure.value, failure.detail]),
  ];
  return new NextResponse(rows.map((row) => row.map(csvCell).join(",")).join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=keepme-integrity-aggregate.csv", "Cache-Control": "private, no-store" } });
}
