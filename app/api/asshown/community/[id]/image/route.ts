import { NextRequest, NextResponse } from "next/server";
import { actor } from "@/lib/asshown/access";
import { listRecords } from "@/lib/asshown/records";
import type { Contribution } from "@/lib/asshown/community";
import type { CommunityMedia } from "@/lib/asshown/community-media";
import { readArtifact } from "@/lib/object-store";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = (await params).id;
  const row = (await listRecords("contribution")).find((r) => r.id === id);
  if (!row) return new NextResponse(null, { status: 404 });
  const note = row.data as Contribution;
  if (!note.mediaId || note.status === "withdrawn" || note.status === "removed")
    return new NextResponse(null, { status: 404 });
  if (note.status !== "published" || !note.imageReviewed) {
    const a = await actor(request);
    if (a.owner !== row.owner && !a.moderator)
      return new NextResponse(null, { status: 404 });
  }
  const media = (await listRecords("community-media", row.owner)).find(
    (r) => r.id === note.mediaId,
  );
  if (!media || (media.data as CommunityMedia).revokedAt)
    return new NextResponse(null, { status: 404 });
  try {
    const image = (media.data as CommunityMedia).image;
    return new NextResponse(Buffer.from(await readArtifact(image)), {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
