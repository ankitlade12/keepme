import {purgeExpiredRecords} from "./asshown/records";
import { cleanupCommunityMedia } from "./asshown/community-media";
import "server-only";
import { cleanupPrivateAssets } from "./asshown/assets";

import { deleteArtifacts } from "./object-store";
import {
  deleteSession,
  expiredSessions,
  getSessionRecord,
} from "./session-store";
import { claimJobs, finishJob } from "./job-queue";
import { recordEvent } from "./observability";

async function cleanupSession(sessionId: string) {
  const session = await getSessionRecord(sessionId);
  if (
    !session ||
    (session.deletedAt &&
      !session.sourceImage &&
      !session.referenceImage &&
      !session.resultImage &&
      !session.originalResultImage)
  )
    return;
  const evidence = await deleteArtifacts([
    session.sourceImage,
    session.referenceImage,
    session.resultImage,
    session.originalResultImage ?? null,
  ]);
  if (!evidence.every((item) => item.verifiedAbsent))
    throw new Error("Artifact deletion verification failed.");
  await deleteSession(session.id, evidence);
  await recordEvent(
    session.tenantId,
    session.id,
    "deletion",
    "expired_and_verified",
    { artifactCount: evidence.length },
  );
}

export async function runMaintenance() {
  const jobs = await claimJobs(50);
  let completed = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      if (job.kind === "session_cleanup") await cleanupSession(job.sessionId);
      await finishJob(job);
      completed += 1;
    } catch (error) {
      await finishJob(
        job,
        error instanceof Error ? error.message : "Unknown cleanup error",
      );
      failed += 1;
    }
  }
  const expired = await expiredSessions(100);
  for (const session of expired) {
    try {
      await cleanupSession(session.id);
      completed += 1;
    } catch {
      failed += 1;
    }
  }
  const privateAssets = await cleanupPrivateAssets();
  return {
    expiredMetadata:await purgeExpiredRecords(),
    claimed: jobs.length,
    swept: expired.length,
    completed,
    failed,
    privateAssets,
    communityMedia: await cleanupCommunityMedia(),
  };
}
