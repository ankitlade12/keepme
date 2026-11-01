import { NextRequest, NextResponse } from "next/server";
import { deleteSession, revokeSession } from "@/lib/session-store";
import { authorizedSession } from "@/lib/session-auth";
import { deleteArtifacts } from "@/lib/object-store";
import { originAllowed } from "@/lib/security";
import { enqueueJob } from "@/lib/job-queue";
import { recordEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await authorizedSession(request, id);
  if (!session)
    return NextResponse.json(
      { error: "Session not found or expired." },
      { status: 404 },
    );
  return NextResponse.json(
    {
      sessionId: session.id,
      stage: session.stage,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      approved: session.approved,
      hasSourceImage: Boolean(session.sourceImage),
      hasReferenceImage: Boolean(session.referenceImage),
      hasResultImage: Boolean(session.resultImage),
      provider: session.provider,
      hasGenerationTask: Boolean(session.generationTaskId),
      contract: session.contract,
      result: session.result,
      allowanceRemaining: Math.max(0, 2 - session.providerTaskCount),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!originAllowed(request))
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  const session = await authorizedSession(request, id);
  if (!session)
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  await revokeSession(id);
  await enqueueJob({
    tenantId: session.tenantId,
    sessionId: id,
    kind: "session_cleanup",
    payload: {},
  });
  let evidence;
  try {
    evidence = await deleteArtifacts([
      session.sourceImage,
      session.referenceImage,
      session.resultImage,
      session.originalResultImage ?? null,
    ]);
  } catch {
    return NextResponse.json(
      {
        error:
          "Application access revoked. Storage cleanup is pending and queued for retry; provider deletion is unconfirmed.",
        status: "deletion_pending",
        deletionVerified: false,
      },
      { status: 503 },
    );
  }
  if (!evidence.every((item) => item.verifiedAbsent))
    return NextResponse.json(
      {
        error:
          "Storage deletion could not be verified. Cleanup has been queued for retry.",
      },
      { status: 503 },
    );
  if (!(await deleteSession(id, evidence)))
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  await recordEvent(session.tenantId, id, "deletion", "verified", {
    artifactCount: evidence.length,
    allAbsent: true,
  });
  return NextResponse.json({
    sessionId: id,
    status: "deleted",
    deletionVerified: true,
    providerDeletion: "not_confirmed",
    evidenceId: `del_${crypto.randomUUID().slice(0, 12)}`,
    deletedArtifacts: [
      "person",
      "garment",
      "generated",
      "masks",
      "heatmaps",
      "repairs",
    ],
  });
}
