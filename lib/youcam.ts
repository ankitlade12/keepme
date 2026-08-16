const API_BASE = process.env.YOUCAM_API_BASE_URL ?? "https://yce-api-01.makeupar.com";

type UploadKind = "cloth-v3" | "skin-analysis";

export class YouCamConfigurationError extends Error {}

function authHeaders() {
  const apiKey = process.env.YOUCAM_API_KEY;
  if (!apiKey) throw new YouCamConfigurationError("YOUCAM_API_KEY is not configured.");
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

async function youCamRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`YouCam request failed with status ${response.status}`);
  return response.json() as Promise<T>;
}

export async function createUpload(kind: UploadKind, file: { name: string; size: number; type: string }) {
  const version = kind === "skin-analysis" ? "v2.1" : "v2.0";
  return youCamRequest<{
    status: number;
    data: { files: Array<{ file_id: string; requests: Array<{ method: "PUT"; url: string; headers: Record<string, string> }> }> };
  }>(`/s2s/${version}/file/${kind}`, {
    method: "POST",
    body: JSON.stringify({ files: [{ content_type: file.type, file_name: "keepme-upload.jpg", file_size: file.size }] }),
  });
}

function normalizeUploadHeaders(headers: Record<string, string> | Array<{ name: string; value: string }> | undefined) {
  if (!headers) return {};
  if (Array.isArray(headers)) return Object.fromEntries(headers.map(({ name, value }) => [name, value]));
  return headers;
}

export async function uploadToYouCam(kind: UploadKind, file: { name: string; size: number; type: string; bytes: Uint8Array }) {
  const slot = await createUpload(kind, file);
  const uploadedFile = slot.data.files[0];
  const request = uploadedFile?.requests?.[0] as { method?: string; url?: string; headers?: Record<string, string> | Array<{ name: string; value: string }> } | undefined;
  if (!uploadedFile?.file_id || !request?.url) throw new Error("YouCam did not return a valid upload slot.");
  const response = await fetch(request.url, {
    method: request.method ?? "PUT",
    headers: normalizeUploadHeaders(request.headers),
    body: Buffer.from(file.bytes),
  });
  if (!response.ok) throw new Error(`YouCam upload failed with status ${response.status}`);
  return uploadedFile.file_id;
}

export async function createClothesTask(sourceFileId: string, referenceFileId: string) {
  return youCamRequest<{ status: number; data: { task_id: string } }>("/s2s/v2.0/task/cloth-v3", {
    method: "POST",
    body: JSON.stringify({ src_file_id: sourceFileId, ref_file_id: referenceFileId, garment_category: "upper_body" }),
  });
}

export async function getClothesTask(taskId: string) {
  return youCamRequest<{
    status: number;
    data: { task_status: "running" | "success" | "error"; results?: { url: string } | Array<{ url: string }>; error?: string };
  }>(`/s2s/v2.0/task/cloth-v3/${encodeURIComponent(taskId)}`);
}

export async function createSkinTask(sourceFileId: string) {
  return youCamRequest<{ status: number; data: { task_id: string } }>("/s2s/v2.1/task/skin-analysis", {
    method: "POST",
    body: JSON.stringify({
      src_file_id: sourceFileId,
      dst_actions: ["texture", "radiance", "redness"],
      format: "json",
    }),
  });
}

export async function getSkinTask(taskId: string) {
  return youCamRequest<{
    status: number;
    data: {
      task_status: "running" | "success" | "error";
      results?: { output?: Array<{ type: string; ui_score?: number; raw_score?: number; score?: number }> };
      error?: string;
    };
  }>(`/s2s/v2.1/task/skin-analysis/${encodeURIComponent(taskId)}`);
}
