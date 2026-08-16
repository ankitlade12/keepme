import "server-only";

import { createHash } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { serverConfig } from "./server-config";

export interface ArtifactRef {
  key: string;
  contentType: string;
  size: number;
  sha256: string;
}

const localArtifacts = new Map<string, Uint8Array>();
let s3: S3Client | null = null;

function objectStorageEnabled() {
  return Boolean(serverConfig.OBJECT_STORAGE_BUCKET && serverConfig.OBJECT_STORAGE_ACCESS_KEY_ID && serverConfig.OBJECT_STORAGE_SECRET_ACCESS_KEY);
}

function client() {
  s3 ??= new S3Client({
    region: serverConfig.OBJECT_STORAGE_REGION,
    endpoint: serverConfig.OBJECT_STORAGE_ENDPOINT,
    forcePathStyle: Boolean(serverConfig.OBJECT_STORAGE_ENDPOINT),
    credentials: {
      accessKeyId: serverConfig.OBJECT_STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: serverConfig.OBJECT_STORAGE_SECRET_ACCESS_KEY!,
    },
  });
  return s3;
}

export async function putArtifact(tenantId: string, sessionId: string, kind: string, bytes: Uint8Array, contentType: string): Promise<ArtifactRef> {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const key = `${encodeURIComponent(tenantId)}/${sessionId}/${kind}-${crypto.randomUUID()}`;
  if (objectStorageEnabled()) {
    await client().send(new PutObjectCommand({
      Bucket: serverConfig.OBJECT_STORAGE_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "private, no-store",
      ServerSideEncryption: serverConfig.OBJECT_STORAGE_KMS_KEY_ID ? "aws:kms" : "AES256",
      SSEKMSKeyId: serverConfig.OBJECT_STORAGE_KMS_KEY_ID,
      Metadata: { sha256, session: sessionId },
    }));
  } else {
    localArtifacts.set(key, new Uint8Array(bytes));
  }
  return { key, contentType, size: bytes.byteLength, sha256 };
}

export async function readArtifact(reference: ArtifactRef): Promise<Uint8Array> {
  if (!objectStorageEnabled()) {
    const bytes = localArtifacts.get(reference.key);
    if (!bytes) throw new Error("Artifact is unavailable.");
    return new Uint8Array(bytes);
  }
  const response = await client().send(new GetObjectCommand({ Bucket: serverConfig.OBJECT_STORAGE_BUCKET, Key: reference.key }));
  if (!response.Body) throw new Error("Artifact is unavailable.");
  return new Uint8Array(await response.Body.transformToByteArray());
}

export async function deleteArtifacts(references: Array<ArtifactRef | null>) {
  const evidence: Array<{ keyHash: string; deleted: boolean; verifiedAbsent: boolean }> = [];
  for (const reference of references.filter((value): value is ArtifactRef => Boolean(value))) {
    let verifiedAbsent = false;
    if (objectStorageEnabled()) {
      await client().send(new DeleteObjectCommand({ Bucket: serverConfig.OBJECT_STORAGE_BUCKET, Key: reference.key }));
      try {
        await client().send(new HeadObjectCommand({ Bucket: serverConfig.OBJECT_STORAGE_BUCKET, Key: reference.key }));
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        verifiedAbsent = status === 404;
      }
    } else {
      localArtifacts.delete(reference.key);
      verifiedAbsent = !localArtifacts.has(reference.key);
    }
    evidence.push({ keyHash: createHash("sha256").update(reference.key).digest("hex"), deleted: true, verifiedAbsent });
  }
  return evidence;
}

export function usingDurableObjectStorage() {
  return objectStorageEnabled();
}
