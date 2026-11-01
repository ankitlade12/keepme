import { chromium } from "playwright";
import { createClerkClient } from "@clerk/backend";
import assert from "node:assert/strict";
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
  await page.goto("http://localhost:3001/check?example=1");
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
  const r = await page.request.delete(
    "http://localhost:3001/api/asshown/workspace",
    { headers: { Origin: "http://localhost:3001" } },
  );
  assert.equal(r.status(), 200);
  console.log(
    "Browser authentication, account save, refresh, restore and deletion: passed",
  );
} finally {
  await browser.close();
  if (user) await clerk.users.deleteUser(user.id);
}
