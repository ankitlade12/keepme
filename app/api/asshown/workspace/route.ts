import type { UploadIntent } from "@/lib/asshown/staged-upload";
import {
  ownedAsset,
  revokeAsset,
  type PrivateAsset,
} from "@/lib/asshown/assets";
import { refreshCommunityEvidence } from "@/lib/asshown/community-evidence";
import type { Contribution } from "@/lib/asshown/community";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { actor } from "@/lib/asshown/access";
import { changeRecord, listRecords } from "@/lib/asshown/records";
import { evaluate, outcome } from "@/lib/asshown/policy";
import { workspaceSchema } from "@/lib/asshown/workspace";
import { originAllowed, digestToken } from "@/lib/security";
const schema = workspaceSchema.extend({ revision: z.number().int().min(0) });
export async function GET(request: NextRequest) {
  try {
    const a = await actor(request);
    const token = a.owner ? null : randomBytes(32).toString("hex");
    const owner = a.owner ?? `guest:${digestToken(token!)}`;
    const rows = await listRecords("workspace", owner);
    const response = NextResponse.json(
      {
        accountAvailable: a.accountAvailable,
        signedIn: Boolean(a.user),
        moderator: a.moderator,
        workspace: rows[0] ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
    if (token)
      response.cookies.set("asshown_guest", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 1800,
      });
    return response;
  } catch {
    return NextResponse.json(
      {
        error:
          "Saved storage is unavailable. The private browser workspace remains usable.",
      },
      { status: 503 },
    );
  }
}
export async function PUT(request: NextRequest) {
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
    const raw = await request.text();
    if (raw.length > 500000)
      return NextResponse.json(
        { error: "Workspace exceeds the storage limit." },
        { status: 413 },
      );
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid workspace data." },
        { status: 400 },
      );
    const { revision, ...data } = parsed.data;
    const community = (await listRecords("contribution")).map(
      (r) => r.data as Contribution,
    );
    data.products = refreshCommunityEvidence(data.products, community);
    for (const product of data.products)
      for (const id of product.assetIds ?? []) {
        const asset = await ownedAsset(a.owner, id);
        if (
          !a.user ||
          !asset ||
          (asset.data as PrivateAsset).productId !== product.id
        )
          return NextResponse.json(
            { error: "Saved image is unavailable or belongs to another item." },
            { status: 400 },
          );
      }
    const row = await changeRecord(
      `workspace:${a.owner}`,
      a.owner,
      "workspace",
      (current) => {
        if ((current?.revision ?? 0) !== revision)
          throw new Error("VERSION_CONFLICT");
        const previous = current
          ? workspaceSchema.parse(current.data).history
          : [];
        data.history = data.history.map(
          (record) => previous.find((old) => old.id === record.id) ?? record,
        );
        for (const record of data.history) {
          if (previous.some((old) => old.id === record.id)) continue;
          record.data.products = refreshCommunityEvidence(
            record.data.products,
            community,
          ).map((p, i) => ({ ...record.data.products[i], ...p }));
          for (const p of record.data.products) {
            p.findings = evaluate(p, record.data.requirements);
            p.outcome = outcome(p.findings);
          }
        }
        return data;
      },
      a.user ? null : new Date(Date.now() + 1800000).toISOString(),
    );
    return NextResponse.json({
      revision: row?.revision,
      saved: Boolean(a.user),
      expires: row?.expires,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          (e as Error).message === "VERSION_CONFLICT"
            ? "Saved data changed. Load it before overwriting."
            : "Workspace could not be saved.",
      },
      { status: (e as Error).message === "VERSION_CONFLICT" ? 409 : 503 },
    );
  }
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
  await changeRecord(`workspace:${a.owner}`, a.owner, "workspace", () => null);
  for (const row of await listRecords("consent", a.owner))
    await changeRecord(row.id, a.owner, "consent", () => null);
  for (const row of await listRecords("upload-intent", a.owner))
    await changeRecord(row.id, a.owner, "upload-intent", (current) =>
      current
        ? {
            ...(current.data as UploadIntent),
            revokedAt: new Date().toISOString(),
          }
        : null,
    );
  let pending = 0;
  for (const row of await listRecords("asset", a.owner)) {
    try {
      await revokeAsset(row);
    } catch {
      pending++;
    }
  }
  return NextResponse.json({ deleted: true, privateAssetsPending: pending });
}
