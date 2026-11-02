import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actor } from "@/lib/asshown/access";
import { changeRecord, listRecords } from "@/lib/asshown/records";
import { originAllowed } from "@/lib/security";
export async function GET(request: NextRequest) {
  const a = await actor(request);
  if (!a.moderator)
    return NextResponse.json(
      { error: "Moderator access required." },
      { status: 403 },
    );
  const row = (await listRecords("operations")).find(
    (r) => r.id === "processing-control",
  );
  return NextResponse.json(
    { control: row?.data ?? { paused: false, audit: [] } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function PATCH(request: NextRequest) {
  if (!originAllowed(request))
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  const a = await actor(request);
  if (!a.moderator)
    return NextResponse.json(
      { error: "Moderator access required." },
      { status: 403 },
    );
  const p = z
    .object({ paused: z.boolean(), reason: z.string().min(10).max(1000) })
    .safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json(
      { error: "An incident or resolution reason is required." },
      { status: 400 },
    );
  await changeRecord(
    "processing-control",
    "system:operations",
    "operations",
    (row) => {
      const old = row?.data as { audit?: unknown[] } | undefined;
      return {
        paused: p.data.paused,
        audit: [
          ...(old?.audit ?? []),
          {
            at: new Date().toISOString(),
            actor: a.owner,
            paused: p.data.paused,
            reason: p.data.reason,
          },
        ].slice(-100),
      };
    },
  );
  return NextResponse.json({ paused: p.data.paused });
}
