import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const envSource = await readFile(path.join(root, ".env.local"), "utf8");
for (const line of envSource.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const separator = trimmed.indexOf("=");
  if (separator === -1) continue;
  const key = trimmed.slice(0, separator).trim();
  const value = trimmed.slice(separator + 1).trim();
  if (!process.env[key]) process.env[key] = value;
}

const apiKey = process.env.YOUCAM_API_KEY;
const apiBase = process.env.YOUCAM_API_BASE_URL ?? "https://yce-api-01.makeupar.com";
if (!apiKey) throw new Error("YOUCAM_API_KEY is missing from .env.local");

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

function normalizeHeaders(headers) {
  if (!headers) return {};
  if (Array.isArray(headers)) return Object.fromEntries(headers.map(({ name, value }) => [name, value]));
  return headers;
}

async function upload(bytes, name, contentType) {
  const slot = await youCam("/s2s/v2.1/file/skin-analysis", {
    method: "POST",
    body: JSON.stringify({
      files: [{ content_type: contentType, file_name: name, file_size: bytes.byteLength }],
    }),
  });
  const file = slot.data?.files?.[0];
  const request = file?.requests?.[0];
  if (!file?.file_id || !request?.url) throw new Error("Skin Analysis did not return an upload slot.");
  const response = await fetch(request.url, {
    method: request.method ?? "PUT",
    headers: normalizeHeaders(request.headers),
    body: bytes,
  });
  if (!response.ok) throw new Error(`Skin Analysis upload failed (${response.status}).`);
  return file.file_id;
}

async function analyze(imagePath, label) {
  console.log(`Uploading ${label} for Skin Analysis…`);
  const bytes = await readFile(imagePath);
  const isJpeg = /\.jpe?g$/i.test(imagePath);
  const fileId = await upload(bytes, `keepme-${label}.${isJpeg ? "jpg" : "png"}`, isJpeg ? "image/jpeg" : "image/png");
  const task = await youCam("/s2s/v2.1/task/skin-analysis", {
    method: "POST",
    body: JSON.stringify({
      src_file_id: fileId,
      dst_actions: ["texture", "radiance", "redness"],
      miniserver_args: { enable_mask_overlay: false },
      format: "json",
      pf_camera_kit: false,
    }),
  });
  const taskId = task.data?.task_id;
  if (!taskId) throw new Error("Skin Analysis did not return a task ID.");

  for (let attempt = 1; attempt <= 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(1200 + attempt * 200, 3000)));
    const status = await youCam(`/s2s/v2.1/task/skin-analysis/${encodeURIComponent(taskId)}`);
    const state = status.data?.task_status;
    console.log(`${label} poll ${attempt}: ${state ?? "unknown"}`);
    if (state === "error" || state === "failed") {
      throw new Error(`Skin Analysis failed for ${label}: ${status.data?.error ?? status.data?.message ?? "Unknown provider error"}`);
    }
    if (state === "success") return status.data?.results ?? {};
  }
  throw new Error(`Skin Analysis timed out for ${label}.`);
}

function redactUrls(value) {
  if (Array.isArray(value)) return value.map(redactUrls);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /url/i.test(key) ? "<redacted>" : redactUrls(item)]));
  }
  return value;
}

const sourceInput = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "public/demo/source-shopper.png");
const generatedInput = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, "public/demo/youcam-live-tryon.jpg");
const source = await analyze(sourceInput, "source");
const generated = await analyze(generatedInput, "generated");
const comparison = {
  provider: "YouCam Skin Analysis v2.1",
  concerns: ["texture", "radiance", "redness"],
  source: redactUrls(source),
  generated: redactUrls(generated),
  createdAt: new Date().toISOString(),
};
await writeFile(path.join(root, "public/demo/skin-comparison.json"), `${JSON.stringify(comparison, null, 2)}\n`);
console.log("Saved redacted Skin Analysis results to public/demo/skin-comparison.json");
