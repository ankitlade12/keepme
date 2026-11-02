import { upload as directUpload } from "@vercel/blob/client";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"))
  throw new Error("This script requires a Clerk development instance.");
const users = [];
let ownerToken;
async function makeUser() {
  const user = await clerk.users.createUser({
    externalId: `asshown-test-${crypto.randomUUID()}`,
    firstName: "AsShown test",
    emailAddress: [
      `asshown-test-${crypto.randomUUID()}+clerk_test@example.com`,
    ],
    skipPasswordRequirement: true,
  });
  users.push(user.id);
  const session = await clerk.sessions.createSession({ userId: user.id });
  return (await clerk.sessions.getToken(session.id)).jwt;
}
function call(token, path, method = "GET", body) {
  return fetch(base + "/api/asshown/" + path, {
    method,
    redirect: "error",
    headers: {
      ...(new URL(base).protocol === "https:" &&
      new URL(base).hostname.endsWith(".vercel.app") &&
      process.env.VERCEL_OIDC_TOKEN
        ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN }
        : {}),
      Authorization: `Bearer ${token}`,
      Origin: base,
      ...(body instanceof FormData
        ? {}
        : body
          ? { "Content-Type": "application/json" }
          : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
}
try {
  const a = (ownerToken = await makeUser()),
    b = await makeUser();
  const initial = await call(a, "workspace");
  assert.equal(initial.status, 200);
  assert.equal((await initial.json()).signedIn, true);
  const bytes =
    process.env.ASSHOWN_DIRECT_UPLOAD === "true"
      ? await sharp(randomBytes(1400 * 1200 * 3), {
          raw: { width: 1400, height: 1200, channels: 3 },
        })
          .png()
          .toBuffer()
      : await readFile("public/demo/rust-jacket.png");
  const form = new FormData();
  for (const [k, v] of Object.entries({
    productId: "account-test-item",
    variant: "Rust / M",
    kind: "product photo",
    note: "Synthetic test fixture",
    consent: "true",
  }))
    form.set(k, v);
  form.set("image", new File([bytes], "fixture.png", { type: "image/png" }));
  let upload;
  if (process.env.ASSHOWN_DIRECT_UPLOAD === "true") {
    assert(bytes.length > 4.5 * 1024 * 1024);
    const uploadId = crypto.randomUUID();
    const h = {
      Authorization: `Bearer ${a}`,
      Origin: base,
      ...(new URL(base).hostname.endsWith(".vercel.app") &&
      process.env.VERCEL_OIDC_TOKEN
        ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN }
        : {}),
    };
    await directUpload(
      `quarantine/${uploadId}`,
      new Blob([bytes], { type: "image/png" }),
      {
        access: "private",
        handleUploadUrl: base + "/api/asshown/assets/upload",
        headers: h,
        clientPayload: JSON.stringify(
          Object.fromEntries(
            [...form.entries()].filter(([key]) => key !== "image"),
          ),
        ),
      },
    );
    assert((await call(b, "assets", "POST", { uploadId })).status >= 400);
    upload = await call(a, "assets", "POST", { uploadId });
    assert((await call(a, "assets", "POST", { uploadId })).status >= 400);
  } else upload = await call(a, "assets", "POST", form);
  assert.equal(upload.status, 201, await upload.clone().text());
  const asset = (await upload.json()).asset;
  assert.equal((await call(b, "assets/" + asset.id)).status, 404);
  assert.equal((await call(b, "assets/" + asset.id, "DELETE")).status, 404);
  const original = await call(a, "assets/" + asset.id);
  assert.equal(original.status, 200);
  assert.deepEqual(Buffer.from(await original.arrayBuffer()), bytes);
  const product = {
    id: "account-test-item",
    title: "Synthetic jacket",
    brand: "Test",
    retailer: "Test",
    color: "Rust",
    size: "M",
    confirmed: true,
    sources: [],
    assetIds: [asset.id],
    decision: "undecided",
  };
  const data = {
    products: [product],
    requirements: [],
    profiles: [],
    history: [],
    version: 1,
    revision: 0,
  };
  assert.equal((await call(a, "workspace", "PUT", data)).status, 200);
  const saved = (await (await call(a, "workspace")).json()).workspace.data;
  assert.equal(saved.products[0].assetIds[0], asset.id);
  assert.equal((await call(b, "workspace", "PUT", data)).status, 400);
  assert.equal((await call(a, "workspace", "DELETE")).status, 200);
  assert.equal((await call(a, "assets/" + asset.id)).status, 404);
  console.log(
    "Real Clerk accounts: saved original bytes, cross-account isolation, workspace association and deletion passed.",
  );
} finally {
  if (ownerToken) await call(ownerToken, "workspace", "DELETE").catch(() => {});
  for (const id of users) await clerk.users.deleteUser(id);
}
