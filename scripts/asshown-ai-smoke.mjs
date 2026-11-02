import { createClerkClient } from "@clerk/backend";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"))
  throw new Error("Development Clerk instance required.");
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
let user, token;
const headers = () => ({
  Authorization: `Bearer ${token}`,
  Origin: base,
  ...(new URL(base).hostname.endsWith(".vercel.app") &&
  process.env.VERCEL_OIDC_TOKEN
    ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN }
    : {}),
});
async function call(path, body, method = "POST") {
  const r = await fetch(base + "/api/asshown/" + path, {
    method,
    headers: {
      ...headers(),
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(90000),
  });
  const d = await r.json();
  assert.equal(r.ok, true, `${path}: HTTP ${r.status}: ${d.error ?? "failed"}`);
  return d;
}
try {
  user = await clerk.users.createUser({
    emailAddress: [`ai-${crypto.randomUUID()}+clerk_test@example.com`],
    skipPasswordRequirement: true,
  });
  const session = await clerk.sessions.createSession({ userId: user.id });
  token = (await clerk.sessions.getToken(session.id)).jwt;
  const interpreted = await call("assist", {
    action: "interpret",
    text: "Machine washable is essential. Long sleeves are essential.",
    consent: true,
  });
  assert(interpreted.requirements.some((r) => r.attribute === "care"));
  assert(interpreted.reviewRequired);
  console.log("Live requirement interpretation passed.");
  const translated = await call("assist", {
    action: "translate",
    text: "Price: $35. Material: 100% cotton. Do not tumble dry.",
    language: "Spanish",
    consent: true,
  });
  assert(
    translated.translation.includes("35") &&
      translated.translation.includes("100"),
  );
  assert(translated.reviewRequired);
  console.log("Live translation with numeric preservation passed.");
  const label = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="white"/><text x="50" y="150" font-size="48" fill="black">TEST LABEL</text><text x="50" y="250" font-size="48" fill="black">100% COTTON</text><text x="50" y="350" font-size="48" fill="black">MACHINE WASH COLD</text><text x="50" y="450" font-size="48" fill="black">DO NOT TUMBLE DRY</text></svg>',
    ),
  )
    .png()
    .toBuffer();
  const upload = new FormData();
  for (const [k, v] of Object.entries({
    productId: "ai-synthetic-label",
    variant: "Test / M",
    kind: "product photo",
    note: "Synthetic OCR fixture",
    consent: "true",
  }))
    upload.set(k, v);
  upload.set(
    "image",
    new File([label], "test-label.png", { type: "image/png" }),
  );
  const asset = (await call("assets", upload)).asset;
  const ocr = await call("extract", { assetId: asset.id, consent: true });
  assert(/100\s*%/.test(ocr.text) && /cotton/i.test(ocr.text));
  assert(ocr.reviewRequired);
  console.log("Live private-image OCR passed.");
  const form = new FormData();
  for (const key of ["source", "result"])
    form.set(
      key,
      new File(
        [await readFile("public/demo/rust-jacket.png")],
        "synthetic-garment.png",
        { type: "image/png" },
      ),
    );
  form.set("kind", "arrival");
  form.set("consent", "true");
  const vision = await call("vision", form);
  assert.equal(vision.status, "manual review required");
  assert(Array.isArray(vision.observations));
  console.log("Live visual observations remain manual-review-only: passed.");
} finally {
  if (token) await call("workspace", undefined, "DELETE");
  if (user) await clerk.users.deleteUser(user.id);
}
