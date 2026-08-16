import { readFile } from "node:fs/promises";
import path from "node:path";

const base = process.env.KEEPME_URL ?? "http://127.0.0.1:3000";
const root = process.cwd();

async function json(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${payload.error ?? "Request failed"}`);
  return payload;
}

console.log("Creating private session…");
const created = await fetch(`${base}/api/v1/sessions`, { method: "POST" });
const sessionCookie = created.headers.get("set-cookie")?.split(";", 1)[0];
if (!sessionCookie) throw new Error("Session capability cookie was not issued.");
const session = await json(created);
const id = session.sessionId;
const api = (route, init = {}) => fetch(`${base}${route}`, { ...init, headers: { ...(init.headers ?? {}), Cookie: sessionCookie } });
const contract = {
  contractId: `ic_${crypto.randomUUID().slice(0, 8)}`,
  contractVersion: "1.0",
  sessionId: id,
  garmentCategory: "upper_body",
  protections: [
    ["face_geometry", "Face shape", "Checks facial landmarks for unexpected movement."],
    ["skin_appearance", "Skin appearance", "Compares visible skin and eligible Skin AI signals."],
    ["hair", "Hair", "Flags edits to hair outside the garment boundary."],
    ["background", "Background", "Detects material changes to the surrounding scene."],
    ["glasses", "Glasses", "Treats eyewear as a protected personal object."],
  ].map(([protectionId, label, description]) => ({ id: protectionId, label, description, enabled: true })),
  customZones: [{ zoneId: "zone_glasses", label: "Glasses", x: 0.38, y: 0.16, width: 0.24, height: 0.1, critical: true }],
  thresholdProfile: "mvp_conservative_v1",
  retention: { original: "session_only", generated: "session_only", receipt: "user_choice", analytics: "anonymous_events_only" },
  consentedAt: new Date().toISOString(),
};
await json(await api(`/api/v1/sessions/${id}/identity-contract`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contract) }));

console.log("Uploading source and garment through the app boundary…");
const form = new FormData();
form.append("source", new File([await readFile(path.join(root, "public/demo/source-shopper.png"))], "source.png", { type: "image/png" }));
form.append("reference", new File([await readFile(path.join(root, "public/demo/rust-jacket.png"))], "garment.png", { type: "image/png" }));
const uploaded = await json(await api(`/api/v1/sessions/${id}/uploads`, { method: "POST", body: form }));

console.log("Starting live Clothes v3 task…");
await json(await api(`/api/v1/sessions/${id}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...uploaded, demoMode: false }) }));
let completed = false;
for (let attempt = 1; attempt <= 60; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, Math.min(1200 + attempt * 150, 3000)));
  const status = await json(await api(`/api/v1/sessions/${id}/generation-status`));
  console.log(`Generation check ${attempt}: ${status.taskStatus}`);
  if (status.taskStatus === "error") throw new Error(status.error ?? "Generation failed.");
  if (status.taskStatus === "success") {
    completed = true;
    break;
  }
}
if (!completed) throw new Error("Generation did not complete within the bounded polling window.");

const image = await api(`/api/v1/sessions/${id}/result-image`);
const imageBytes = image.ok ? await image.arrayBuffer() : new ArrayBuffer(0);
if (!image.ok || imageBytes.byteLength === 0) throw new Error("Generated image endpoint is empty.");

console.log("Running measured integrity and Skin AI verification…");
let result = await json(await api(`/api/v1/sessions/${id}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
console.log(`Integrity state: ${result.state}; confidence: ${Math.round(result.confidence * 100)}%; score: ${Math.round(result.summaryScore * 100)}%`);
if (result.state === "failed" && result.repairSupported) {
  console.log("Applying source-zone repair and reverifying…");
  result = await json(await api(`/api/v1/sessions/${id}/repair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
  console.log(`Repair state: ${result.state}`);
}
if (result.state !== "failed") {
  const receipt = await json(await api(`/api/v1/sessions/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
  console.log(`Receipt created with provider: ${receipt.generator}`);
}

await json(await api(`/api/v1/sessions/${id}`, { method: "DELETE" }));
const afterDelete = await api(`/api/v1/sessions/${id}/result-image`);
if (afterDelete.status !== 404) throw new Error(`Deleted result remained accessible (${afterDelete.status}).`);
console.log("Deletion verified: generated pixels are inaccessible.");
