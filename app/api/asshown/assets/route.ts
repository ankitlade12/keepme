import { NextRequest, NextResponse } from "next/server";
import { actor } from "@/lib/asshown/access";
import {
  assetInput,
  assetExpired,
  publicAsset,
  type PrivateAsset,
} from "@/lib/asshown/assets";
import { changeRecord, listRecords } from "@/lib/asshown/records";
import { sanitizeImage, UploadValidationError } from "@/lib/upload-security";
import {
  putArtifact,
  deleteArtifacts,
  type ArtifactRef,
} from "@/lib/object-store";
import { originAllowed, consumeRateLimit } from "@/lib/security";
export async function GET(request: NextRequest) {
  const a = await actor(request);
  if (!a.user || !a.owner)
    return NextResponse.json(
      { error: "Sign in to access saved evidence." },
      { status: 401 },
    );
  const rows = await listRecords("asset", a.owner);
  return NextResponse.json(
    {
      assets: rows
        .filter(
          (r) =>
            !(r.data as PrivateAsset).revokedAt &&
            !assetExpired(r.data as PrivateAsset),
        )
        .map(publicAsset),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: NextRequest) {
  if (!originAllowed(request))
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  const a = await actor(request);
  if (!a.user || !a.owner)
    return NextResponse.json(
      { error: "Sign in to keep private evidence across devices." },
      { status: 401 },
    );
  if (Number(request.headers.get("content-length") ?? 0) > 11 * 1024 * 1024)
    return NextResponse.json(
      { error: "Upload must be at most 10 MB." },
      { status: 413 },
    );
  if (!(await consumeRateLimit(`assets:${a.owner}`, 20, 3600)).allowed)
    return NextResponse.json(
      { error: "Upload allowance reached. Try later." },
      { status: 429 },
    );
  const stored: ArtifactRef[] = [];
  let recorded = false;
  try {
    const form = await request.formData();
    const parsed = assetInput.safeParse(
      Object.fromEntries(
        ["productId", "variant", "kind", "note", "consent"].map((k) => [
          k,
          form.get(k) ?? "",
        ]),
      ),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "Confirm storage consent and the exact item before saving." },
        { status: 400 },
      );
    if (
      (await listRecords("asset", a.owner)).filter(
        (r) => !(r.data as PrivateAsset).revokedAt,
      ).length >= 60
    )
      return NextResponse.json(
        {
          error:
            "Your library holds 60 images. Delete unused evidence before adding more.",
        },
        { status: 409 },
      );
    const file = form.get("image");
    if (file instanceof File && file.size > 4 * 1024 * 1024)
      return NextResponse.json(
        { error: "Private originals must be 4 MB or smaller." },
        { status: 413 },
      );
    const normalized = await sanitizeImage(file, "Evidence image");
    const bytes = new Uint8Array(await (file as File).arrayBuffer());
    const id = crypto.randomUUID();
    const type = bytes[0] === 137 ? "image/png" : "image/jpeg";
    const original = await putArtifact(a.owner, id, "original", bytes, type);
    stored.push(original);
    const processing = await putArtifact(
      a.owner,
      id,
      "processing",
      normalized.bytes,
      normalized.type,
    );
    stored.push(processing);
    const data: PrivateAsset = {
      ...parsed.data,
      id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      original,
      processing,
      consentVersion: "private-evidence-1",
    };
    const row = await changeRecord(id, a.owner, "asset", () => data);
    recorded = true;
    return NextResponse.json(
      { asset: publicAsset(row!) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof UploadValidationError
            ? e.message
            : "Evidence could not be saved. Try again when image storage and scanning are available.",
      },
      { status: e instanceof UploadValidationError ? 400 : 503 },
    );
  } finally {
    if (!recorded && stored.length)
      await deleteArtifacts(stored).catch(() => {});
  }
}
