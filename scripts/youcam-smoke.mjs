import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function loadLocalEnv() {
  const source = await readFile(path.join(root, ".env.local"), "utf8");
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

await loadLocalEnv();

const apiKey = process.env.YOUCAM_API_KEY;
const apiBase = process.env.YOUCAM_API_BASE_URL ?? "https://yce-api-01.makeupar.com";
if (!apiKey) throw new Error("YOUCAM_API_KEY is missing from .env.local");

const sourcePath = path.join(root, "public/demo/source-shopper.png");
const garmentPath = path.resolve(root, process.env.KEEPME_GARMENT_PATH ?? "public/demo/rust-jacket.png");
const outputPath = path.resolve(root, process.env.KEEPME_OUTPUT_PATH ?? "public/demo/youcam-live-tryon.png");

const sourceBytes = await readFile(sourcePath);
const garmentBytes = await readFile(garmentPath);

const authHeaders = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

async function youCam(pathname, init = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...init,
    headers: { ...authHeaders, ...init.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || (typeof payload.status === "number" && payload.status >= 400)) {
    throw new Error(`YouCam ${pathname} failed (${response.status}/${payload.status ?? "unknown"}): ${payload.message ?? payload.error ?? "Unknown error"}`);
  }
  return payload;
}

function requestHeaders(headers) {
  if (!headers) return {};
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map((header) => [header.name, header.value]));
  }
  return headers;
}

async function uploadFile(name, bytes) {
  const slot = await youCam("/s2s/v2.0/file/cloth-v3", {
    method: "POST",
    body: JSON.stringify({
      files: [{ content_type: "image/png", file_name: name, file_size: bytes.byteLength }],
    }),
  });
  const file = slot.data?.files?.[0];
  const upload = file?.requests?.[0];
  if (!file?.file_id || !upload?.url) throw new Error("YouCam did not return a valid upload slot.");
  const response = await fetch(upload.url, {
    method: upload.method ?? "PUT",
    headers: requestHeaders(upload.headers),
    body: bytes,
  });
  if (!response.ok) throw new Error(`Presigned upload failed (${response.status}).`);
  return file.file_id;
}

console.log("Uploading synthetic source and garment…");
const [sourceFileId, garmentFileId] = await Promise.all([
  uploadFile("keepme-source.png", sourceBytes),
  uploadFile("keepme-garment.png", garmentBytes),
]);

console.log("Starting YouCam Clothes v3 generation…");
const task = await youCam("/s2s/v2.0/task/cloth-v3", {
  method: "POST",
  body: JSON.stringify({
    src_file_id: sourceFileId,
    ref_file_id: garmentFileId,
    garment_category: "upper_body",
  }),
});

const taskId = task.data?.task_id;
if (!taskId) throw new Error("YouCam did not return a task ID.");

let resultUrl;
for (let attempt = 1; attempt <= 60; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, Math.min(1500 + attempt * 250, 4000)));
  const status = await youCam(`/s2s/v2.0/task/cloth-v3/${encodeURIComponent(taskId)}`);
  const state = status.data?.task_status;
  console.log(`Poll ${attempt}: ${state ?? "unknown"}`);
  if (state === "error" || state === "failed") {
    throw new Error(`YouCam generation failed: ${status.data?.error ?? status.data?.message ?? "Unknown provider error"}`);
  }
  if (state === "success") {
    const results = status.data?.results;
    resultUrl = Array.isArray(results) ? results[0]?.url : results?.url;
    break;
  }
}

if (!resultUrl) throw new Error("YouCam generation timed out without a result URL.");

const result = await fetch(resultUrl);
if (!result.ok) throw new Error(`Could not download the generated image (${result.status}).`);
await writeFile(outputPath, Buffer.from(await result.arrayBuffer()));
console.log(`Saved live result to ${path.relative(root, outputPath)}`);
