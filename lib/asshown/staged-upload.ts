import "server-only";
import { head } from "@vercel/blob";
import { assetInput } from "./assets";
import { changeRecord, listRecords } from "./records";
import {
  deleteArtifacts,
  readArtifact,
  type ArtifactRef,
} from "../object-store";
export type UploadIntent = {
  key: string;
  expiresAt: string;
  input: unknown;
  claimed?: boolean;
  revokedAt?: string;
};
export async function claimUpload(owner: string, id: string) {
  const row = await changeRecord(id, owner, "upload-intent", (current) => {
    if (!current || current.category !== "upload-intent")
      throw new Error("Upload unavailable.");
    const data = current.data as UploadIntent;
    if (
      data.claimed ||
      data.revokedAt ||
      Date.parse(data.expiresAt) <= Date.now()
    )
      throw new Error("Upload expired or already finalized.");
    return { ...data, claimed: true };
  });
  return row!.data as UploadIntent;
}
export async function stagedFile(intent: UploadIntent) {
  const info = await head(intent.key);
  if (
    info.size > 10 * 1024 * 1024 ||
    !["image/png", "image/jpeg"].includes(info.contentType)
  )
    throw new Error("Choose a JPEG or PNG of at most 10 MB.");
  const ref: ArtifactRef = {
    key: intent.key,
    url: info.url,
    size: info.size,
    contentType: info.contentType,
    sha256: "",
  };
  const bytes = await readArtifact(ref);
  if (bytes.length > 10 * 1024 * 1024) throw new Error("Image exceeds 10 MB.");
  return {
    file: new File([Buffer.from(bytes)], "original", {
      type: info.contentType,
    }),
    input: assetInput.parse(intent.input),
    ref,
  };
}
export async function cleanupStagedUploads() {
  let completed = 0,
    failed = 0;
  for (const row of await listRecords("upload-intent")) {
    const data = row.data as UploadIntent;
    // Wait beyond token expiry, including replayed writes after a failed finalization.
    if (Date.parse(data.expiresAt) > Date.now()) continue;
    try {
      const result = await deleteArtifacts([
        {
          key: data.key,
          size: 0,
          contentType: "application/octet-stream",
          sha256: "",
        },
      ]);
      if (!result.every((r) => r.verifiedAbsent))
        throw new Error("Awaiting deletion verification.");
      await changeRecord(row.id, row.owner, "upload-intent", () => null);
      completed++;
    } catch {
      failed++;
    }
  }
  return { completed, failed };
}
