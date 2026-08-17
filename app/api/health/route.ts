import { NextResponse } from "next/server";
import { database, ensureDatabase } from "@/lib/database";
import { usingDurableObjectStorage } from "@/lib/object-store";
import { liveTryOnStatus } from "@/lib/runtime-capabilities";

export const dynamic = "force-dynamic";

export async function GET() {
  const sql = database();
  try {
    if (sql) { await ensureDatabase(); await sql`select 1`; }
    return NextResponse.json({ status: "ok", database: sql ? "connected" : "ephemeral", objectStorage: usingDurableObjectStorage() ? "durable" : "ephemeral", liveTryOn: liveTryOnStatus().available ? "ready" : "unavailable", timestamp: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded", database: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
