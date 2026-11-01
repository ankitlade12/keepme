import "server-only";
import { changeRecord, listRecords } from "./records";
import { deleteArtifacts, type ArtifactRef } from "../object-store";
export type CommunityMedia = {
  image: ArtifactRef;
  createdAt: string;
  contributionId?: string;
  revokedAt?: string;
  purgedAt?: string;
  consentVersion: "public-product-image-1";
  redactionReviewed: true;
  personScreened: true;
  possiblePerson?: boolean;
};
export async function revokeCommunityMedia(id: string, owner: string) {
  await changeRecord(id, owner, "community-media", (r) =>
    r
      ? { ...(r.data as CommunityMedia), revokedAt: new Date().toISOString() }
      : null,
  );
}
export async function cleanupCommunityMedia() {
  let completed = 0,
    failed = 0;
  for (const row of await listRecords("community-media")) {
    const data = row.data as CommunityMedia;
    if (data.purgedAt) continue;
    if (
      !data.revokedAt &&
      (data.contributionId ||
        Date.now() - Date.parse(data.createdAt) < 86400000)
    )
      continue;
    try {
      await revokeCommunityMedia(row.id, row.owner);
      const deleted = await deleteArtifacts([data.image]);
      if (!deleted.every((d) => d.verifiedAbsent)) throw new Error();
      await changeRecord(row.id, row.owner, "community-media", (r) =>
        r
          ? {
              ...(r.data as CommunityMedia),
              purgedAt: new Date().toISOString(),
            }
          : null,
      );
      completed++;
    } catch {
      failed++;
    }
  }
  return { completed, failed };
}
