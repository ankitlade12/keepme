import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const dir = "artifacts/review-demo";
await mkdir(dir, { recursive: true });
const filmStart = Date.now();
const chapters = [];
async function chapter(id) {
  console.log("Recording", id);
  chapters.push({ id, at: (Date.now() - filmStart) / 1000 });
}
const page = await browser.newPage({
  recordVideo: { dir, size: { width: 1600, height: 900 } },
  viewport: { width: 1600, height: 900 },
});
page.setDefaultTimeout(45000);
let sessionId;
let deleted = false;
const protection =
  new URL(base).hostname.endsWith(".vercel.app") &&
  process.env.VERCEL_OIDC_TOKEN
    ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN }
    : {};
try {
  if (process.env.ASSHOWN_SHARE_URL)
    await page.goto(process.env.ASSHOWN_SHARE_URL);
  else if (Object.keys(protection).length)
    await page.route(`${base}/**`, (r) =>
      r.continue({ headers: { ...r.request().headers(), ...protection } }),
    );
  page.on("response", async (r) => {
    if (
      r.request().method() === "POST" &&
      r.url().endsWith("/api/v1/sessions") &&
      r.ok()
    )
      sessionId = (await r.json()).sessionId;
  });
  await chapter("problem");
  await page.goto(base);
  await page.waitForTimeout(2500);
  await chapter("requirements");
  await page.goto(`${base}/check`);
  for (const [label, value] of Object.entries({
    "Item name": "Everyday utility jacket",
    "Brand (optional)": "Illustrative catalog",
    "Retailer (optional)": "Demo listing — not for sale",
    Sku: "DEMO-RUST-M",
    Color: "Rust",
    Size: "M",
  }))
    await page.getByLabel(label, { exact: true }).fill(value);
  const listing = (
    await readFile("public/demo-kit/01-rust-listing.txt", "utf8")
  )
    .split("PASTE ONLY THE FOLLOWING INTO LISTING TEXT:")[1]
    .trim();
  await page.getByLabel("Listing text", { exact: true }).fill(listing);
  await page
    .getByLabel("Choose product photos")
    .setInputFiles("public/demo-kit/01-rust-jacket.png");
  await page.getByRole("checkbox", { name: /I confirm this text/ }).check();
  await page
    .getByRole("button", { name: "Confirm sources", exact: true })
    .click();
  await page.waitForTimeout(2000);
  await chapter("evidence");
  await page
    .getByRole("button", { name: "3. Evidence & decision", exact: true })
    .click();
  assert.equal(
    await page.getByText("Source-supported", { exact: true }).count(),
    2,
  );
  assert.equal(
    await page.getByText("Still unknown", { exact: true }).count(),
    1,
  );
  await page
    .getByLabel("Paste the seller’s reply", { exact: true })
    .fill(
      "For DEMO-RUST-M, Rust / M: the jacket has functional pockets. Machine wash cold.",
    );
  await page
    .getByRole("button", { name: "Add reply as evidence", exact: true })
    .click();
  assert.equal(
    await page.getByText("Source-supported", { exact: true }).count(),
    3,
  );
  await page
    .getByRole("button", { name: "Keep on shortlist", exact: true })
    .click();
  await page.screenshot({
    path: `${dir}/product-evidence.png`,
    fullPage: true,
  });
  await page.waitForTimeout(2000);
  await chapter("preview");
  await page
    .getByRole("button", { name: "4. YouCam preview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open preview studio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Build my contract", exact: true })
    .waitFor();
  await page.getByRole("radio", { name: /Identity drift demo/ }).click();
  await page
    .getByRole("button", { name: "Protect the glasses", exact: true })
    .click();
  await page.getByLabel(/I approve this Identity Contract/).check();
  await page
    .getByRole("button", { name: "Run identity drift demo", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "A protected region changed" })
    .waitFor();
  assert.match(
    await page.locator("body").innerText(),
    /local skin appearance change needs review/,
  );
  await page.waitForTimeout(2000);
  await chapter("repair");
  await page
    .getByRole("button", {
      name: "Restore source zone & reverify",
      exact: true,
    })
    .click();
  await page
    .getByRole("heading", { name: "Passed after your repair" })
    .waitFor();
  await page.getByText("Controlled checks passed", { exact: true }).waitFor();
  await page
    .getByRole("img", {
      name: "Controlled repair fixture with the shopper’s glasses restored",
      exact: true,
    })
    .waitFor();
  await page.waitForTimeout(2000);
  await chapter("review");
  const exportButton = page.getByRole("button", {
    name: "Export reviewed observations",
  });
  assert.equal(await exportButton.isDisabled(), true);
  if (process.env.LIVE_REVIEW === "1") {
    await page
      .getByLabel("Send these two images to OpenAI for garment review.")
      .check();
    const pending = page.waitForResponse(
      (r) => r.url().endsWith("/api/asshown/vision"),
      { timeout: 90000 },
    );
    await page
      .getByRole("button", { name: "Suggest visible garment observations" })
      .click();
    const response = await pending;
    const data = await response.json();
    assert.equal(response.ok(), true, JSON.stringify(data));
    assert.ok(data.observations.length > 0);
    assert.ok(data.observations.every((o) => !o.automatedPass));
    await writeFile(
      `${dir}/openai-observations.json`,
      JSON.stringify(data, null, 2),
    );
    assert.equal(
      await page
        .getByRole("link", {
          name: "Open full-size generated preview for comparison",
        })
        .count(),
      1,
    );
    assert.equal(await exportButton.isDisabled(), true);
  }
  await page
    .getByLabel("Your corrections or manual observations")
    .fill(
      "I reviewed the collar, sleeves, and fastening areas. Washing and pocket function still depend on product evidence.",
    );
  await page.getByLabel(/I reviewed these observations/).check();
  assert.equal(await exportButton.isEnabled(), true);
  const downloadEvent = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadEvent;
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(exported.humanReviewConfirmed, true);
  assert.equal(exported.automatedVerification, "not validated");
  await page.screenshot({ path: `${dir}/review.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Mobile studio overflows horizontally",
  );
  await page.screenshot({ path: `${dir}/review-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1600, height: 900 });
  await chapter("receipt");
  await page
    .getByRole("button", { name: "Approve this result", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Download signed JSON", exact: true })
    .waitFor();
  const receipt = await page.request.get(
    `${base}/api/v1/sessions/${sessionId}/receipt-download`,
    { headers: protection },
  );
  assert.equal(receipt.status(), 200);
  await writeFile(`${dir}/receipt.json`, await receipt.body());
  await page
    .getByRole("button", { name: "Delete images now", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Your images are gone.", exact: true })
    .waitFor();
  deleted = true;
  for (const image of ["result-image", "original-result-image", "source-image"])
    assert.equal(
      (
        await page.request.get(
          `${base}/api/v1/sessions/${sessionId}/${image}`,
          { headers: protection },
        )
      ).status(),
      404,
    );
  await page.waitForTimeout(2000);
  await chapter("arrival");
  await page.goto(`${base}/check?example=1`);
  await page
    .getByRole("button", { name: "Arrival check", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Review the delivered item" })
    .waitFor();
  await page
    .getByLabel("Delivered-item photograph")
    .setInputFiles("public/demo-kit/01-rust-jacket.png");
  await page.waitForTimeout(2000);
  await chapter("community");
  for (const label of [
    "Product notes",
    "Your requirements",
    "Saved checks",
    "Privacy & data",
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForTimeout(1800);
  }
  await chapter("built");
  await page.goto(base);
  await page.waitForTimeout(2500);
  chapters.push({ id: "end", at: (Date.now() - filmStart) / 1000 });
  await writeFile(`${dir}/chapters.json`, JSON.stringify(chapters, null, 2));
  console.log(
    JSON.stringify({
      productEvidenceAndShortlist: true,
      controlledRepair: true,
      liveOpenAI: process.env.LIVE_REVIEW === "1",
      humanReviewExport: true,
      signedReceipt: true,
      deletedImagesReturn404: true,
    }),
  );
} catch (e) {
  await page.screenshot({ path: `${dir}/failure.png`, fullPage: true });
  throw e;
} finally {
  if (sessionId && !deleted)
    await page.request
      .delete(`${base}/api/v1/sessions/${sessionId}`, {
        headers: { ...protection, Origin: base },
      })
      .catch(() => {});
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(`${dir}/complete-demo.webm`);
  await browser.close();
}
