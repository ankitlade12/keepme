const base = process.env.KEEPME_URL ?? "http://127.0.0.1:3000";

async function json(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${payload.error ?? "Request failed"}`);
  return payload;
}

const created = await fetch(`${base}/api/v1/sessions`, { method: "POST" });
const session = await json(created);
const sessionCookie = created.headers.get("set-cookie")?.split(";", 1)[0];
if (!sessionCookie) throw new Error("Session capability cookie was not issued.");
const id = session.sessionId;
const api = (path, init = {}) => fetch(`${base}${path}`, { ...init, headers: { ...(init.headers ?? {}), Cookie: sessionCookie } });
const unauthorized = await fetch(`${base}/api/v1/sessions/${id}`);
if (unauthorized.status !== 404) throw new Error("Session endpoint did not hide an unauthorized session.");
const contract = {
  contractId: `ic_${crypto.randomUUID().slice(0, 8)}`,
  contractVersion: "1.0",
  sessionId: id,
  garmentCategory: "upper_body",
  garment: { id: "rust-utility", name: "Rust utility jacket", source: "catalog" },
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
await json(await api(`/api/v1/sessions/${id}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ demoMode: true }) }));
const status = await json(await api(`/api/v1/sessions/${id}/generation-status`));
if (status.taskStatus !== "success") throw new Error(`Guided generation ended as ${status.taskStatus}`);

const violation = await json(await api(`/api/v1/sessions/${id}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fixture: "violation" }) }));
if (violation.state !== "failed" || !violation.findings.some((finding) => finding.code === "PRESERVE_ZONE_CHANGED")) throw new Error("Controlled glasses violation was not detected.");

const repaired = await json(await api(`/api/v1/sessions/${id}/repair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
if (repaired.state !== "passed_after_repair") throw new Error(`Repair ended as ${repaired.state}`);

const receipt = await json(await api(`/api/v1/sessions/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
if (receipt.generator !== "KeepMe controlled demo") throw new Error("Controlled fixture was mislabeled in the receipt.");
if (!receipt.signature || receipt.signatureAlgorithm !== "HS256" || !receipt.contractDigest || !receipt.resultDigest) throw new Error("Receipt was not signed with evidence digests.");

const deletion = await json(await api(`/api/v1/sessions/${id}`, { method: "DELETE" }));
if (!deletion.deletionVerified) throw new Error("Artifact deletion was not verified.");
const deletedResult = await api(`/api/v1/sessions/${id}/result-image`);
if (deletedResult.status !== 404) throw new Error("Deleted guided fixture remained accessible.");

console.log("Guided demo verified: glasses drift detected → repaired → receipted → deleted.");
