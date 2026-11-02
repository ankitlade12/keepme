import { createClerkClient } from "@clerk/backend";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"))
  throw new Error("Development instance required");
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
let user, note, session;
async function call(method, body) {
  const token = (await clerk.sessions.getToken(session.id)).jwt;
  return fetch(base + "/api/asshown/community", {
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
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
try {
  user = await clerk.users.createUser({
    emailAddress: [`community-${crypto.randomUUID()}+clerk_test@example.com`],
    skipPasswordRequirement: true,
  });
  session = await clerk.sessions.createSession({ userId: user.id });
  let mediaId;
  if (process.env.TEST_COMMUNITY_PHOTO === "true") {
    const token = (await clerk.sessions.getToken(session.id)).jwt;
    const headers = {
      Authorization: `Bearer ${token}`,
      Origin: base,
      ...(new URL(base).hostname.endsWith(".vercel.app") &&
      process.env.VERCEL_OIDC_TOKEN
        ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN }
        : {}),
    };
    const form = new FormData();
    form.set("consent", "true");
    form.set("redactionReviewed", "true");
    form.set(
      "image",
      new File(
        [await readFile("public/demo/rust-jacket.png")],
        "synthetic-fixture.png",
        { type: "image/png" },
      ),
    );
    const uploaded = await fetch(base + "/api/asshown/community-media", {
      method: "POST",
      headers,
      body: form,
      redirect: "error",
    });
    assert.equal(uploaded.status, 201, await uploaded.clone().text());
    mediaId = (await uploaded.json()).mediaId;
    console.log("Hosted product-photo scanner and person screening passed.");
  }
  const r = await call("POST", {
    mediaId,
    title: "Synthetic integration fixture",
    retailer: "TEST ONLY",
    productId: crypto.randomUUID(),
    color: "Rust",
    size: "M",
    confirmed: true,
    text: "Synthetic test report: not a real shopping recommendation.",
    date: new Date().toISOString(),
    consent: true,
  });
  assert.equal(r.status, 201, await r.clone().text());
  note = (await r.json()).note;
  assert.equal(
    (
      await call("PATCH", {
        id: note.id,
        action: "publish",
        reason: "Test self-publication rejection",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("PATCH", {
        id: note.id,
        action: "dispute",
        reason: "Test pending visibility protection",
      })
    ).status,
    403,
  );
  const list = await (await call("GET")).json();
  assert(!list.published.some((n) => n.id === note.id));
  assert.equal(
    (
      await call("PATCH", {
        id: note.id,
        action: "correct",
        reason: "Correcting test wording",
        replacement:
          "Corrected synthetic integration report; not a real product.",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("PATCH", {
        id: note.id,
        action: "withdraw",
        reason: "Synthetic test finished; withdrawing fixture",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("PATCH", {
        id: note.id,
        action: "publish",
        reason: "Withdrawn report must stay private",
      })
    ).status,
    403,
  );
  console.log(
    "Real account contribution, private pending state, blocked self-publication, correction and permanent withdrawal: passed",
  );
} finally {
  if (note && session)
    await call("PATCH", {
      id: note.id,
      action: "withdraw",
      reason: "Synthetic test cleanup",
    }).catch(() => {});
  if (user) await clerk.users.deleteUser(user.id);
}
