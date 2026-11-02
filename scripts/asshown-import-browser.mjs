import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  if (
    new URL(base).hostname.endsWith(".vercel.app") &&
    process.env.VERCEL_OIDC_TOKEN
  )
    await page.route(`${base}/**`, (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN,
        },
      }),
    );
  await page.goto(`${base}/check`);
  await page
    .getByText("Add an Amazon or supported retailer link", { exact: true })
    .click();
  // Intentionally nonexistent fixture: verify honest fallback, not product extraction.
  await page
    .getByLabel("Public product URL")
    .fill("https://www.amazon.com/dp/B000000000?tag=test");
  const response = page.waitForResponse(
    (r) => r.url() === `${base}/api/asshown/import`,
  );
  await page
    .getByRole("button", { name: "Import listing", exact: true })
    .click();
  const result = await response;
  assert.equal(result.status(), 200);
  const data = await result.json();
  assert.equal(data.mode, "manual");
  assert.equal(data.productId, "B000000000");
  assert.equal(data.sourceUrl, "https://www.amazon.com/dp/B000000000");
  assert.equal(data.variantConfirmed, false);
  await page
    .getByRole("status")
    .filter({
      hasText: "Amazon link saved. Listing details could not be retrieved.",
    })
    .waitFor();
  assert.equal(
    await page.getByLabel("Item name", { exact: true }).inputValue(),
    "",
  );
  console.log(
    "Amazon link intake, tracking removal, unknown variant and visible manual fallback passed.",
  );
} finally {
  await browser.close();
}
