import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/session-store";
import { uploadToYouCam, YouCamConfigurationError } from "@/lib/youcam";
import { authorizedSession } from "@/lib/session-auth";
import { consumeRateLimit, originAllowed } from "@/lib/security";
import { sanitizeImage, UploadSecurityUnavailableError, UploadValidationError } from "@/lib/upload-security";
import { deleteArtifacts, putArtifact } from "@/lib/object-store";
import { recordEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!originAllowed(request)) return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  const session = await authorizedSession(request, id);
  if (!session) return NextResponse.json({ error: "Session not found, expired, or unauthorized." }, { status: 404 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 21 * 1024 * 1024) return NextResponse.json({ error: "Upload request exceeds 21 MB." }, { status: 413 });
  const limit = await consumeRateLimit(`upload:${session.tenantId}:${id}`, 4, 60 * 60);
  if (!limit.allowed) return NextResponse.json({ error: "Upload limit reached for this session." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

  try {
    const form = await request.formData();
    const [source, reference] = await Promise.all([sanitizeImage(form.get("source"), "Person image"), sanitizeImage(form.get("reference"), "Garment image")]);
    const [sourceFileId, referenceFileId] = await Promise.all([
      uploadToYouCam("cloth-v3", source),
      uploadToYouCam("cloth-v3", reference),
    ]);
    const [sourceImage, referenceImage] = await Promise.all([
      putArtifact(session.tenantId, id, "source", source.bytes, source.type),
      putArtifact(session.tenantId, id, "reference", reference.bytes, reference.type),
    ]);
    await deleteArtifacts([session.sourceImage, session.referenceImage]);

    await updateSession(id, {
      sourceFileId,
      referenceFileId,
      sourceImage,
      referenceImage,
      stage: "ready",
      provider: "youcam",
    });
    await recordEvent(session.tenantId, id, "upload", "validated_and_stored", { sourceBytes: source.size, referenceBytes: reference.size, metadataStripped: true, malwareScanned: Boolean(process.env.MALWARE_SCAN_URL) });

    return NextResponse.json({ sourceFileId, referenceFileId, provider: "youcam" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Images could not be uploaded.";
    const status = error instanceof YouCamConfigurationError || error instanceof UploadSecurityUnavailableError ? 503 : error instanceof UploadValidationError ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
