import { NextRequest, NextResponse } from "next/server";
import { runMaintenance } from "@/lib/maintenance";
import { validSecret } from "@/lib/security";
import { serverConfig } from "@/lib/server-config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!validSecret(serverConfig.CRON_SECRET, supplied)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json(await runMaintenance(), { headers: { "Cache-Control": "no-store" } });
}
