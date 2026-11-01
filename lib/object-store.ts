import "server-only";

import { createHash } from "node:crypto";
import { BlobNotFoundError, del, get, head, put } from "@vercel/blob";
import { serverConfig } from "./server-config";

export interface ArtifactRef {
  key: string;
  url?: string;
  contentType: string;
  size: number;
  sha256: string;
}

const localArtifacts = new Map<string, Uint8Array>();

function objectStorageEnabled() {
  return Boolean(serverConfig.BLOB_READ_WRITE_TOKEN);
}

export async function putArtifact(
  tenantId: string,
  sessionId: string,
  kind: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<ArtifactRef> {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let key = `${createHash("sha256").update(tenantId).digest("hex")}/${sessionId}/${kind}-${crypto.randomUUID()}`;
  let url: string | undefined;
  if (objectStorageEnabled()) {
    const stored = await put(key, Buffer.from(bytes), {
      access: "private",
      addRandomSuffix: false,
      contentType,
      cacheControlMaxAge: 60,
    });
    key = stored.pathname;
    url = stored.url;
  } else {
    localArtifacts.set(key, new Uint8Array(bytes));
  }
  return { key, url, contentType, size: bytes.byteLength, sha256 };
}

export async function readArtifact(
  reference: ArtifactRef,
): Promise<Uint8Array> {
  if (!objectStorageEnabled()) {
    const bytes = localArtifacts.get(reference.key);
    if (!bytes) throw new Error("Artifact is unavailable.");
    return new Uint8Array(bytes);
  }
  const response = await get(reference.url ?? reference.key, {
    access: "private",
    useCache: false,
  });
  if (!response || response.statusCode !== 200)
    throw new Error("Artifact is unavailable.");
  return new Uint8Array(await new Response(response.stream).arrayBuffer());
}

export async function deleteArtifacts(references: Array<ArtifactRef | null>) {
  const evidence: Array<{
    keyHash: string;
    deleted: boolean;
    verifiedAbsent: boolean;
  }> = [];
  for (const reference of references.filter((value): value is ArtifactRef =>
    Boolean(value),
  )) {
    let verifiedAbsent = false;
    if (objectStorageEnabled()) {
      await del(reference.url ?? reference.key);
      try {
        await head(reference.url ?? reference.key);
      } catch (error) {
        verifiedAbsent = error instanceof BlobNotFoundError;
      }
    } else {
      localArtifacts.delete(reference.key);
      verifiedAbsent = !localArtifacts.has(reference.key);
    }
    evidence.push({
      keyHash: createHash("sha256").update(reference.key).digest("hex"),
      deleted: true,
      verifiedAbsent,
    });
  }
  return evidence;
}

export function usingDurableObjectStorage() {
  return objectStorageEnabled();
}
