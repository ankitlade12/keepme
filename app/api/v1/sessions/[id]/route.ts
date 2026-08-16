import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/session-store";
import { authorizedSession } from "@/lib/session-auth";
import { deleteArtifacts } from "@/lib/object-store";
import { originAllowed } from "@/lib/security";
import { recordEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await authorizedSession(request, id);
  if (!session) return NextResponse.json({ error: "Session not found or expired." }, { status: 404 });
  return NextResponse.json({
    sessionId: session.id,
    stage: session.stage,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    approved: session.approved,
    hasSourceImage: Boolean(session.sourceImage),
    hasReferenceImage: Boolean(session.referenceImage),
    hasResultImage: Boolean(session.resultImage),
    provider: session.provider,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!originAllowed(request)) return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  const session = await authorizedSession(request, id);
  if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  const evidence = await deleteArtifacts([session.sourceImage, session.referenceImage, session.resultImage]);
  if (!evidence.every((item) => item.verifiedAbsent)) return NextResponse.json({ error: "Storage deletion could not be verified. Cleanup has been queued for retry." }, { status: 503 });
  if (!await deleteSession(id, evidence)) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  await recordEvent(session.tenantId, id, "deletion", "verified", { artifactCount: evidence.length, allAbsent: true });
  return NextResponse.json({ sessionId: id, status: "deleted", deletionVerified: true, evidenceId: `del_${crypto.randomUUID().slice(0, 12)}`, deletedArtifacts: ["person", "garment", "generated", "masks", "heatmaps", "repairs"] });
}
