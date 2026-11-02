import { NextRequest, NextResponse } from "next/server";
import { actor } from "@/lib/asshown/access";
import {
  ownedAsset,
  renewAsset,
  revokeAsset,
  type PrivateAsset,
} from "@/lib/asshown/assets";
import { streamArtifact } from "@/lib/object-store";
import { originAllowed } from "@/lib/security";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await actor(request);
  if (!a.user || !a.owner) return new NextResponse(null, { status: 404 });
  const row = await ownedAsset(a.owner, (await params).id);
  if (!row) return new NextResponse(null, { status: 404 });
  const asset = (row.data as PrivateAsset).original;
  try {
    const stream = await streamArtifact(asset);
    return new NextResponse(stream, {
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": 'inline; filename="private-evidence"',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!originAllowed(request))
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  const a = await actor(request);
  if (!a.user || !a.owner) return new NextResponse(null, { status: 404 });
  const row = await ownedAsset(a.owner, (await params).id);
  if (!row) return new NextResponse(null, { status: 404 });
  try {
    await revokeAsset(row);
    return NextResponse.json({ accessRevoked: true, storageDeleted: true });
  } catch {
    return NextResponse.json(
      {
        accessRevoked: true,
        storageDeleted: false,
        error: "Access revoked. Storage cleanup is queued for retry.",
      },
      { status: 503 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!originAllowed(request))
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  const a = await actor(request);
  if (!a.user || !a.owner) return new NextResponse(null, { status: 404 });
  const body = await request.json().catch(() => null);
  if (body?.consent !== true)
    return NextResponse.json(
      { error: "Confirm another 30 days of private storage." },
      { status: 400 },
    );
  const row = await ownedAsset(a.owner, (await params).id);
  if (!row) return new NextResponse(null, { status: 404 });
  try {
    await renewAsset(a.owner, row.id);
  } catch {
    return NextResponse.json(
      { error: "Evidence is no longer available." },
      { status: 409 },
    );
  }
  return NextResponse.json({ renewed: true });
}
