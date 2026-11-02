import "server-only";
import { z } from "zod";
import { changeRecord, listRecords, type RecordRow } from "./records";
import { deleteArtifacts, type ArtifactRef } from "../object-store";
export const assetInput = z.object({
  productId: z.string().min(1).max(150),
  variant: z.string().max(150),
  kind: z.enum(["product photo", "receipt", "delivered photo", "seller reply"]),
  note: z.string().max(2000).default(""),
  consent: z.literal("true"),
});
export type PrivateAsset = z.infer<typeof assetInput> & {
  id: string;
  createdAt: string;
  expiresAt?: string;
  original: ArtifactRef;
  processing: ArtifactRef;
  revokedAt?: string;
  purgedAt?: string;
  consentVersion: "private-evidence-1";
};
export function assetExpired(asset: PrivateAsset) {
  return Boolean(asset.expiresAt && Date.parse(asset.expiresAt) <= Date.now());
}
export function publicAsset(row: RecordRow) {
  const d = row.data as PrivateAsset;
  return {
    id: row.id,
    productId: d.productId,
    variant: d.variant,
    kind: d.kind,
    note: d.note,
    createdAt: d.createdAt,
    expiresAt: d.expiresAt,
    sha256: d.original.sha256,
    url: `/api/asshown/assets/${row.id}`,
  };
}
export async function ownedAsset(owner: string, id: string) {
  const row = (await listRecords("asset", owner)).find((r) => r.id === id);
  return row &&
    !(row.data as PrivateAsset).revokedAt &&
    !assetExpired(row.data as PrivateAsset)
    ? row
    : null;
}
export async function purgeAsset(row: RecordRow) {
  const data = row.data as PrivateAsset;
  if (!data.revokedAt || data.purgedAt) return;
  const evidence = await deleteArtifacts([data.original, data.processing]);
  if (!evidence.every((e) => e.verifiedAbsent))
    throw new Error("Deletion is awaiting verification.");
  await changeRecord(row.id, row.owner, "asset", (current) =>
    current
      ? {
          id: row.id,
          original: data.original,
          processing: data.processing,
          revokedAt: data.revokedAt,
          purgedAt: new Date().toISOString(),
        }
      : null,
  );
}
export async function revokeAsset(row: RecordRow) {
  const revoked = await changeRecord(row.id, row.owner, "asset", (current) =>
    current
      ? {
          ...(current.data as PrivateAsset),
          revokedAt: new Date().toISOString(),
        }
      : null,
  );
  if (revoked) await purgeAsset(revoked);
}
export async function cleanupPrivateAssets() {
  let completed = 0,
    failed = 0;
  for (const row of await listRecords("asset")) {
    const data = row.data as PrivateAsset;
    if ((data.revokedAt || assetExpired(data)) && !data.purgedAt) {
      try {
        if (!data.revokedAt) await revokeAsset(row);
        else await purgeAsset(row);
        completed++;
      } catch {
        failed++;
      }
    }
  }
  return { completed, failed };
}

export async function renewAsset(owner: string, id: string) {
  return changeRecord(id, owner, "asset", (current) => {
    if (
      !current ||
      (current.data as PrivateAsset).revokedAt ||
      assetExpired(current.data as PrivateAsset)
    )
      throw new Error("Evidence is no longer available.");
    return {
      ...(current.data as PrivateAsset),
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      renewedAt: new Date().toISOString(),
    };
  });
}
