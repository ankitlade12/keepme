import { NextRequest, NextResponse } from "next/server";
import { actor } from "@/lib/asshown/access";
import { originAllowed, consumeRateLimit } from "@/lib/security";
import { sanitizeImage } from "@/lib/upload-security";
import { preflightImage } from "@/lib/vision-worker";
import {
  putArtifact,
  deleteArtifacts,
  type ArtifactRef,
} from "@/lib/object-store";
import { changeRecord } from "@/lib/asshown/records";
import type { CommunityMedia } from "@/lib/asshown/community-media";
export async function POST(request: NextRequest) {
  if (!originAllowed(request))
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  const a = await actor(request);
  if (!a.user || !a.owner)
    return NextResponse.json(
      { error: "Sign in to contribute." },
      { status: 401 },
    );
  if (process.env.ASSHOWN_COMMUNITY_ENABLED !== "true")
    return NextResponse.json(
      { error: "Contributions are paused." },
      { status: 503 },
    );
  if (!(await consumeRateLimit(`community-media:${a.owner}`, 6, 86400)).allowed)
    return NextResponse.json(
      { error: "Daily photo-contribution allowance reached." },
      { status: 429 },
    );
  if (Number(request.headers.get("content-length") ?? 0) > 11 * 1024 * 1024)
    return NextResponse.json(
      { error: "Image exceeds 10 MB." },
      { status: 413 },
    );
  let image: ArtifactRef | undefined;
  try {
    const form = await request.formData();
    if (
      form.get("consent") !== "true" ||
      form.get("redactionReviewed") !== "true"
    )
      return NextResponse.json(
        {
          error: "Review the redacted preview and confirm publication consent.",
        },
        { status: 400 },
      );
    const photo = await sanitizeImage(form.get("image"), "Product evidence");
    const screening = await preflightImage(photo.bytes);
    if (screening.faceCount > 0)
      return NextResponse.json(
        {
          error:
            "A possible person was detected. Only product-only photos are accepted; use a flat-lay or close-up without people.",
        },
        { status: 422 },
      );
    const id = crypto.randomUUID();
    image = await putArtifact(
      a.owner,
      id,
      "redacted-community",
      photo.bytes,
      photo.type,
    );
    const data: CommunityMedia = {
      image,
      createdAt: new Date().toISOString(),
      consentVersion: "public-product-image-1",
      redactionReviewed: true,
      personScreened: true,
      possiblePerson: screening.personFraction > 0.12,
    };
    await changeRecord(id, a.owner, "community-media", () => data);
    return NextResponse.json(
      { mediaId: id, pendingModeration: true },
      { status: 201 },
    );
  } catch {
    if (image) await deleteArtifacts([image]).catch(() => {});
    return NextResponse.json(
      {
        error:
          "The product-only image could not pass screening. Text-only contributions remain available.",
      },
      { status: 503 },
    );
  }
}
