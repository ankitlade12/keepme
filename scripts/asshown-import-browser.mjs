import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
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
  await page
    .getByLabel("Public product URL")
    .fill("https://www.amazon.com/dp/B096YM16SV?tag=test");
  const imported = page.waitForResponse(
    (r) => r.url() === `${base}/api/asshown/import`,
  );
  await page
    .getByRole("button", { name: "Import listing", exact: true })
    .click();
  const live = await imported;
  assert.equal(live.status(), 200);
  const product = await live.json();
  assert.equal(product.mode, "imported", product.message);
  assert.equal(product.productId, "B096YM16SV");
  assert.match(product.title, /Polar Fleece Jacket/);
  assert.equal(product.brand, "Amazon Essentials");
  assert.match(product.text, /Machine Wash Cold/i);
  await page
    .getByRole("status")
    .filter({ hasText: "Imported public product text" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Item name", { exact: true }).inputValue(),
    product.title,
  );
  assert.match(
    await page
      .getByPlaceholder(
        "Include care, fabric, sleeves, closures, pockets, and price if supplied.",
      )
      .inputValue(),
    /Machine Wash Cold/i,
  );
  assert.equal(
    await page
      .getByRole("checkbox", { name: /I confirm this text/ })
      .isChecked(),
    false,
  );
  assert.equal(
    await page.getByLabel("Color", { exact: true }).inputValue(),
    "",
  );
  assert.equal(await page.getByLabel("Size", { exact: true }).inputValue(), "");
  await page.screenshot({
    path: "artifacts/full-qa/amazon-import-success.png",
    fullPage: true,
  });
  console.log(
    "Real Amazon listing extracted and populated in browser; variant confirmation still required: passed.",
  );
  await page.reload();
  await page
    .getByText("Add an Amazon or supported retailer link", { exact: true })
    .click();
  // A search URL is unambiguously not a product; never assume an ASIN is nonexistent.
  await page
    .getByLabel("Public product URL")
    .fill("https://www.amazon.com/s?k=jacket");
  const rejected = page.waitForResponse(
    (r) => r.url() === `${base}/api/asshown/import`,
  );
  await page
    .getByRole("button", { name: "Import listing", exact: true })
    .click();
  assert.equal((await rejected).status(), 422);
  await page
    .getByRole("alert")
    .filter({ hasText: "Use an Amazon product link" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Item name", { exact: true }).inputValue(),
    "",
  );
  console.log("Non-product Amazon URL rejected with visible guidance: passed.");
} finally {
  await browser.close();
}
