import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const results = [];
await mkdir("artifacts/full-qa", { recursive: true });
async function run(name, fn) {
  const context = await browser.newContext();
  const p = await context.newPage();
  p.setDefaultTimeout(15000);
  if (
    new URL(base).hostname.endsWith(".vercel.app") &&
    process.env.VERCEL_OIDC_TOKEN
  )
    await p.route(`${base}/**`, (r) =>
      r.continue({
        headers: {
          ...r.request().headers(),
          "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN,
        },
      }),
    );
  try {
    await p.goto(`${base}/check?example=1`);
    await p
      .getByRole("heading", { name: "Everyday utility jacket", exact: true })
      .waitFor();
    await fn(p);
    results.push({ name, status: "passed" });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, status: "failed", error: e.message });
    await p.screenshot({
      path: `artifacts/full-qa/${name}.png`,
      fullPage: true,
    });
    console.log("FAIL", name, e.message);
  } finally {
    await context.close();
  }
}
async function downloaded(p, button) {
  const ready = p.waitForEvent("download");
  await p.getByRole("button", { name: button, exact: true }).click();
  return readFile(await (await ready).path(), "utf8");
}
try {
  await run("profiles-and-immutable-history", async (p) => {
    await p
      .getByRole("button", { name: "Your shortlist", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Approve & save report", exact: true })
      .click();
    await p.getByRole("button", { name: "Saved checks", exact: true }).click();
    const before = JSON.parse(await downloaded(p, "Export"));
    await p
      .getByRole("button", { name: "Your requirements", exact: true })
      .click();
    await p.getByLabel("Profile name", { exact: true }).fill("Work clothing");
    await p
      .getByRole("button", { name: "Save current requirements", exact: true })
      .click();
    await p
      .getByLabel("Profile name", { exact: true })
      .nth(1)
      .fill("Travel clothing");
    await p
      .getByRole("button", { name: "Apply & review", exact: true })
      .click();
    await p
      .getByLabel("Importance for Machine washable", { exact: true })
      .selectOption("preferred");
    await p
      .getByRole("button", { name: "Your requirements", exact: true })
      .click();
    assert.equal(
      await p.getByLabel("Profile name", { exact: true }).nth(1).inputValue(),
      "Travel clothing",
    );
    await p
      .getByRole("button", {
        name: "Replace with current requirements",
        exact: true,
      })
      .click();
    await p
      .getByRole("button", { name: "Apply & review", exact: true })
      .click();
    assert.equal(
      await p
        .getByLabel("Importance for Machine washable", { exact: true })
        .inputValue(),
      "preferred",
    );
    await p.getByRole("button", { name: "Saved checks", exact: true }).click();
    assert.deepEqual(JSON.parse(await downloaded(p, "Export")), before);
    await p
      .getByRole("button", { name: "Your requirements", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Delete profile", exact: true })
      .click();
    assert.equal(
      await p
        .getByRole("button", { name: "Apply & review", exact: true })
        .count(),
      0,
    );
    await p.reload();
    await p.getByRole("button", { name: "Saved checks", exact: true }).click();
    assert.deepEqual(JSON.parse(await downloaded(p, "Export")), before);
  });
  await run("conflicts-source-review-and-variant-change", async (p) => {
    await p
      .getByLabel("Paste the seller’s reply", { exact: true })
      .fill("Dry-clean only. Functional pockets.");
    await p
      .getByRole("button", { name: "Add reply as evidence", exact: true })
      .click();
    await p.getByText("Sources disagree", { exact: true }).waitFor();
    await p.getByText("Review and correct source use", { exact: true }).click();
    await p
      .getByLabel("Reason for changing source use", { exact: true })
      .fill("Seller sent the wrong variant instructions");
    const reply = p.locator("article").filter({
      has: p.getByText("Dry-clean only. Functional pockets.", {
        exact: true,
      }),
    });
    await reply
      .getByRole("button", {
        name: "Exclude source from findings",
        exact: true,
      })
      .click();
    assert.equal(
      await p.getByText("Sources disagree", { exact: true }).count(),
      0,
    );
    await reply
      .getByRole("button", { name: "Restore source use", exact: true })
      .click();
    await p.getByText("Sources disagree", { exact: true }).waitFor();
    await p.getByText("Correct this variant", { exact: true }).click();
    await p.getByLabel("color", { exact: true }).fill("Blue");
    assert.equal(
      await p.getByText("Source-supported", { exact: true }).count(),
      0,
    );
    assert.equal(
      await p.getByText("Still unknown", { exact: true }).count(),
      3,
    );
  });
  await run("arrival-mismatch-and-reviewed-export", async (p) => {
    await p.getByRole("button", { name: "Arrival check", exact: true }).click();
    const exportButton = p.getByRole("button", {
      name: "Export editable seller-message draft",
      exact: true,
    });
    assert(await exportButton.isDisabled());
    await p
      .getByLabel("Delivered color (from label/order)", { exact: true })
      .fill("Blue");
    await p
      .getByLabel("Delivered size (from label/order)", { exact: true })
      .fill("L");
    await p
      .getByText(/These details differ from the checked variant/)
      .waitFor();
    await p
      .getByLabel("Your observations", { exact: true })
      .fill(
        "The delivered label states Blue / L. Please help clarify the order.",
      );
    assert(await exportButton.isDisabled());
    await p
      .getByRole("checkbox", {
        name: /I reviewed the delivered color and size/,
      })
      .check();
    const text = await downloaded(p, "Export editable seller-message draft");
    assert.match(text, /Rust \/ M/);
    assert.match(text, /Blue \/ L/);
    assert.match(text, /Review before sending/);
    await p
      .getByLabel("Delivered size (from label/order)", { exact: true })
      .fill("XL");
    assert(await exportButton.isDisabled());
  });
  await run("privacy-dialog-keyboard-and-mobile", async (p) => {
    await p
      .getByRole("button", { name: "Privacy & data", exact: true })
      .click();
    const before = JSON.parse(await downloaded(p, "Export workspace data"));
    assert.equal(before.decision.products.length, 2);
    await p
      .getByRole("button", { name: "Delete workspace data", exact: true })
      .click();
    await p.getByRole("dialog").waitFor();
    assert.equal(
      await p.evaluate(() => document.activeElement?.textContent?.trim()),
      "Keep my workspace",
    );
    await p.keyboard.press("Escape");
    assert.equal(await p.getByRole("dialog").count(), 0);
    await p
      .getByRole("button", { name: "Delete workspace data", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Delete workspace", exact: true })
      .click();
    await p.getByText("Workspace data deleted.", { exact: true }).waitFor();
    const cleared = JSON.parse(await downloaded(p, "Export workspace data"));
    assert.equal(cleared.decision.products.length, 0);
    assert.equal(cleared.history.length, 0);
    await p.reload();
    await p
      .getByRole("button", { name: "Privacy & data", exact: true })
      .click();
    assert.equal(
      JSON.parse(await downloaded(p, "Export workspace data")).decision.products
        .length,
      0,
    );
    await p.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  });
  await run("amazon-manual-import-requires-new-confirmation", async (p) => {
    await p
      .getByRole("button", { name: "1. Add your item", exact: true })
      .click();
    await p.getByRole("checkbox", { name: /I confirm this text/ }).check();
    await p.route("**/api/asshown/import", (r) =>
      r.fulfill({
        json: {
          mode: "manual",
          productId: "B0CM6S894C",
          sourceUrl: "https://www.amazon.com/dp/B0CM6S894C",
          message: "Retailer blocked automatic retrieval. Paste the listing.",
        },
      }),
    );
    await p
      .getByText("Add an Amazon or supported retailer link", { exact: true })
      .click();
    await p
      .getByLabel("Public product URL", { exact: true })
      .fill("https://www.amazon.com/dp/B0CM6S894C");
    await p
      .getByRole("button", { name: "Import listing", exact: true })
      .click();
    await p
      .getByText("Retailer blocked automatic retrieval. Paste the listing.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await p
        .getByRole("checkbox", { name: /I confirm this text/ })
        .isChecked(),
      false,
    );
  });
  await run("invalid-image-and-three-item-limit", async (p) => {
    await p
      .getByRole("button", { name: "1. Add your item", exact: true })
      .click();
    await p.getByLabel("Choose product photos").setInputFiles({
      name: "bad.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
    await p
      .getByRole("alert")
      .filter({ hasText: /not a supported JPEG or PNG/ })
      .waitFor();
    await p.getByLabel("Item name", { exact: true }).fill("Third sample");
    await p.getByLabel("Color", { exact: true }).fill("Rust");
    await p.getByLabel("Size", { exact: true }).fill("M");
    await p
      .getByLabel("Listing text", { exact: true })
      .fill("Machine washable. Long sleeves. Functional pockets. EUR 40.");
    await p.getByRole("checkbox", { name: /I confirm this text/ }).check();
    await p
      .getByRole("button", { name: "Confirm sources", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Your shortlist", exact: true })
      .click();
    assert.equal(
      (await p.getByText("Third sample", { exact: true }).count()) > 0,
      true,
    );
    await p.getByRole("button", { name: "Check an item", exact: true }).click();
    await p
      .getByRole("button", { name: "1. Add your item", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Confirm sources", exact: true })
      .click();
    await p
      .getByRole("alert")
      .filter({ hasText: /Compare up to three items/ })
      .waitFor();
  });
} finally {
  await browser.close();
  await writeFile(
    "artifacts/full-qa/browser-results.json",
    JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2),
  );
}
if (results.some((r) => r.status === "failed")) process.exitCode = 1;
