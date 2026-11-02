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
  if (process.env.TEST_AMAZON_FIXTURES === "true") {
    console.log(
      "CONTROLLED API FIXTURES: browser behavior only, not live retailer verification.",
    );
    const variants = [
      { asin: "B096YM16SV", color: "Black", size: "X-Large" },
      { asin: "B096YJMFDJ", color: "Black", size: "Small" },
      { asin: "B096YKRNVQ", color: "Black", size: "Medium" },
      { asin: "B096YL2ZD3", color: "Red", size: "X-Large" },
    ];
    await page.route("**/api/asshown/import", (r) => {
      const url = r.request().postDataJSON().url;
      const v = variants.find((v) => url.includes(v.asin));
      return r.fulfill(
        v
          ? {
              json: {
                mode: "imported",
                title: "Amazon Essentials Polar Fleece Jacket",
                brand: "Amazon Essentials",
                productId: v.asin,
                text: "Machine Wash Cold",
                color: v.color,
                size: v.size,
                variants,
                sourceUrl: `https://www.amazon.com/dp/${v.asin}`,
                sourceDate: new Date().toISOString(),
                variantConfirmed: false,
              },
            }
          : { status: 422, json: { error: "Use an Amazon product link" } },
      );
    });
  }
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
    "Black",
  );
  assert.equal(
    await page.getByLabel("Size", { exact: true }).inputValue(),
    "X-Large",
  );
  assert(
    (await page
      .getByLabel("Color", { exact: true })
      .locator("option")
      .count()) > 1,
  );
  await page.getByRole("checkbox", { name: /I confirm this text/ }).check();
  const changed = page.waitForResponse(
    (r) => r.url() === `${base}/api/asshown/import`,
  );
  await page.getByLabel("Size", { exact: true }).selectOption("Small");
  const next = await (await changed).json();
  assert.equal(next.mode, "imported", next.message);
  assert.equal(next.productId, "B096YJMFDJ");
  await page.waitForFunction(
    () => document.querySelector("select")?.disabled === false,
  );
  assert.equal(
    await page.getByLabel("Size", { exact: true }).inputValue(),
    "Small",
  );
  assert.equal(
    await page.getByLabel("Sku", { exact: true }).inputValue(),
    "B096YJMFDJ",
  );
  assert.equal(
    await page
      .getByRole("checkbox", { name: /I confirm this text/ })
      .isChecked(),
    false,
  );
  // Controlled failure verifies a blocked variant does not overwrite the last successful import.
  const failedVariant = (r) =>
    r.fulfill({
      json: { mode: "manual", message: "Retailer temporarily unavailable." },
    });
  await page.route("**/api/asshown/import", failedVariant);
  await page.getByLabel("Size", { exact: true }).selectOption("Medium");
  await page
    .getByRole("alert")
    .filter({ hasText: "Your previous selection is unchanged" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Size", { exact: true }).inputValue(),
    "Small",
  );
  assert.equal(
    await page.getByLabel("Sku", { exact: true }).inputValue(),
    "B096YJMFDJ",
  );
  await page.unroute("**/api/asshown/import", failedVariant);
  console.log(
    "Amazon dropdowns and variant re-import passed; controlled failure preserves previous selection.",
  );
  await page.screenshot({
    path: "artifacts/full-qa/amazon-import-success.png",
    fullPage: true,
  });
  console.log(
    "Amazon listing populated in browser; variant confirmation still required: passed.",
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
