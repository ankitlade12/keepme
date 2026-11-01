import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actor } from "@/lib/asshown/access";
import { changeRecord, listRecords } from "@/lib/asshown/records";
import { originAllowed, consumeRateLimit } from "@/lib/security";
const schema = z.object({
  category: z.enum([
    "incorrect finding",
    "billing",
    "privacy",
    "accessibility",
  ]),
  message: z.string().min(10).max(2000),
  findingId: z.string().max(100).optional(),
});
export async function POST(request: NextRequest) {
  if (!originAllowed(request))
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  try {
    const a = await actor(request);
    if (!a.owner)
      return NextResponse.json(
        { error: "Start a workspace first." },
        { status: 401 },
      );
    const p = schema.safeParse(await request.json());
    if (!p.success)
      return NextResponse.json(
        {
          error:
            "Choose a category and describe the issue (10–2,000 characters).",
        },
        { status: 400 },
      );
    if (!(await consumeRateLimit(`support:${a.owner}`, 5, 3600)).allowed)
      return NextResponse.json(
        { error: "Please wait before filing another report." },
        { status: 429 },
      );
    const id = crypto.randomUUID();
    await changeRecord(id, a.owner, "support", () => ({
      ...p.data,
      id,
      status: "open",
      createdAt: new Date().toISOString(),
      imagesIncluded: false,
    }));
    return NextResponse.json({ id, status: "open" }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Support storage is unavailable." },
      { status: 503 },
    );
  }
}
export async function GET(request: NextRequest) {
  const a = await actor(request);
  if (!a.owner)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json(
    {
      moderator: a.moderator,
      tickets: (
        await listRecords("support", a.moderator ? undefined : a.owner)
      ).map((row) => ({
        id: row.id,
        own: row.owner === a.owner,
        data: row.data,
      })),
    },
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
      { error: "Support moderator access required." },
      { status: 403 },
    );
  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["under_review", "resolved"]),
      response: z.string().min(5).max(2000),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Select a status and write a specific resolution note." },
      { status: 400 },
    );
  const row = (await listRecords("support")).find(
    (r) => r.id === parsed.data.id,
  );
  if (!row)
    return NextResponse.json({ error: "Report unavailable." }, { status: 404 });
  await changeRecord(row.id, row.owner, "support", (current) => {
    if (!current) return null;
    const original = current.data as Record<string, unknown>;
    const audit = Array.isArray(original.audit) ? original.audit : [];
    return {
      ...original,
      status: parsed.data.status,
      response: parsed.data.response,
      audit: [
        ...audit,
        {
          at: new Date().toISOString(),
          status: parsed.data.status,
          response: parsed.data.response,
        },
      ],
    };
  });
  return NextResponse.json({ updated: true });
}
export async function DELETE(request: NextRequest) {
  if (!originAllowed(request))
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  const a = await actor(request);
  if (!a.owner)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const parsed = z
    .object({ id: z.string().uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  const row = (await listRecords("support", a.owner)).find(
    (r) => r.id === parsed.data.id,
  );
  if (!row)
    return NextResponse.json({ error: "Report unavailable." }, { status: 404 });
  await changeRecord(row.id, a.owner, "support", () => null);
  return NextResponse.json({ deleted: true });
}
