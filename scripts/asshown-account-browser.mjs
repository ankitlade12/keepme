import { chromium } from "playwright";
import { createClerkClient } from "@clerk/backend";
import assert from "node:assert/strict";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"))
  throw new Error("Development Clerk instance required");
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const browser = await chromium.launch();
let user;
try {
  user = await clerk.users.createUser({
    emailAddress: [`browser-${crypto.randomUUID()}+clerk_test@example.com`],
    skipPasswordRequirement: true,
  });
  const ticket = await clerk.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 120,
  });
  const page = await browser.newPage();
  if (
    new URL(base).hostname.endsWith(".vercel.app") &&
    process.env.VERCEL_OIDC_TOKEN
  ) {
    await page.route(`${base}/**`, (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN,
        },
      }),
    );
  }
  await page.goto(`${base}/check?example=1`);
  await page.waitForFunction(() => window.Clerk?.loaded);
  await page.evaluate(async (token) => {
    const result = await window.Clerk.client.signIn.create({
      strategy: "ticket",
      ticket: token,
    });
    await window.Clerk.setActive({ session: result.createdSessionId });
  }, ticket.token);
  await page.reload();
  await page.getByRole("button", { name: "Saved checks", exact: true }).click();
  await page
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await page.getByText("Saved to your account.", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Saved checks", exact: true }).click();
  await page
    .getByRole("button", { name: "Load saved version", exact: true })
    .click();
  await page
    .getByText("Saved account workspace loaded.", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Check an item", exact: true })
    .click();
  await page
    .getByRole("button", { name: "3. Evidence & decision", exact: true })
    .click();
  const bytes = await sharp(randomBytes(1400 * 1200 * 3), {
    raw: { width: 1400, height: 1200, channels: 3 },
  })
    .png()
    .toBuffer();
  assert(bytes.length > 4.5 * 1024 * 1024);
  await page.getByLabel("Original JPEG or PNG (10 MB maximum)").setInputFiles({
    name: "synthetic-large.png",
    mimeType: "image/png",
    buffer: bytes,
  });
  await page
    .getByRole("checkbox", { name: /Save this original and a processing copy/ })
    .check();
  const finalization = page.waitForResponse(
    (r) =>
      r.url() === `${base}/api/asshown/assets` &&
      r.request().method() === "POST",
    { timeout: 90000 },
  );
  await page
    .getByRole("button", { name: "Save private evidence", exact: true })
    .click();
  const result = await finalization;
  assert.equal(result.status(), 201, await result.text());
  await page
    .getByText("Original evidence saved privately to your account.", {
      exact: true,
    })
    .waitFor({ timeout: 90000 });
  const r = await page.request.delete(`${base}/api/asshown/workspace`, {
    headers: {
      Origin: base,
      ...(new URL(base).hostname.endsWith(".vercel.app") &&
      process.env.VERCEL_OIDC_TOKEN
        ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN }
        : {}),
    },
  });
  assert.equal(r.status(), 200);
  console.log(
    "Browser authentication, account save/restore, large private upload and deletion: passed",
  );
} finally {
  await browser.close();
  if (user) {
    const session = await clerk.sessions.createSession({ userId: user.id });
    const token = (await clerk.sessions.getToken(session.id)).jwt;
    const cleanup = await fetch(`${base}/api/asshown/workspace`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: base,
        ...(new URL(base).hostname.endsWith(".vercel.app") &&
        process.env.VERCEL_OIDC_TOKEN
          ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN }
          : {}),
      },
    });
    assert.equal(
      cleanup.status,
      200,
      "Test workspace cleanup must succeed before deleting its owner",
    );
    await clerk.users.deleteUser(user.id);
  }
}
