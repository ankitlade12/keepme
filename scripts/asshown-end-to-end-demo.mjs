import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
const protection =
  process.env.VERCEL_OIDC_TOKEN &&
  new URL(base).hostname.endsWith(".vercel.app")
    ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN }
    : {};
const dir = "artifacts/live-demo";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  recordVideo: { dir, size: { width: 1440, height: 1000 } },
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
let sessionId,
  deleted = false;
const report = {
  base,
  startedAt: new Date().toISOString(),
  listing: "Illustrative sample, not a verified Amazon product",
  subject: "Synthetic shopper",
  steps: [],
  requests: [],
};
page.on("response", async (r) => {
  const u = new URL(r.url());
  if (u.origin !== base || !u.pathname.startsWith("/api/")) return;
  report.requests.push({
    path: u.pathname,
    method: r.request().method(),
    status: r.status(),
  });
  if (
    u.pathname === "/api/v1/sessions" &&
    r.request().method() === "POST" &&
    r.ok()
  ) {
    try {
      sessionId = (await r.json()).sessionId;
    } catch {}
  }
  if (u.pathname.endsWith("/generation-status")) {
    try {
      console.log("YouCam:", (await r.json()).taskStatus);
    } catch {}
  }
});
async function chapter(name, text) {
  console.log(name + ": " + text);
  report.steps.push({ name, text, at: new Date().toISOString() });
  await page.evaluate((text) => {
    document.getElementById("demo-caption")?.remove();
    const node = document.createElement("div");
    node.id = "demo-caption";
    node.textContent = text;
    Object.assign(node.style, {
      position: "fixed",
      bottom: "0",
      left: "0",
      right: "0",
      zIndex: "99999",
      background: "#252131",
      color: "#fff",
      padding: "16px 28px",
      font: "18px/1.5 system-ui",
      textAlign: "center",
      pointerEvents: "none",
    });
    document.body.append(node);
  }, text);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}
try {
  if (
    process.env.VERCEL_OIDC_TOKEN &&
    new URL(base).hostname.endsWith(".vercel.app")
  ) {
    await page.route(`${base}/**`, (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN,
        },
      }),
    );
    await page.goto(base);
  } else {
    await page.goto(base);
  }
  await page.getByRole("heading", { name: /Love the look/ }).waitFor();
  await chapter(
    "01-start",
    "AsShown: start with practical needs. This demo uses an illustrative listing and a synthetic person.",
  );
  await page.goto(`${base}/check`);
  await page
    .getByLabel("Item name", { exact: true })
    .fill("Everyday utility jacket — demo");
  await page
    .getByLabel("Brand (optional)", { exact: true })
    .fill("Illustrative catalog");
  await page
    .getByLabel("Retailer (optional)", { exact: true })
    .fill("Demo listing — not for sale");
  await page.getByLabel("Sku", { exact: true }).fill("DEMO-RUST-M");
  await page.getByLabel("Color", { exact: true }).fill("Rust");
  await page.getByLabel("Size", { exact: true }).fill("M");
  await page
    .getByLabel("Listing text", { exact: true })
    .fill(
      "Illustrative listing: Everyday utility jacket. Rust, size M. Long sleeves. 100% cotton. Machine wash cold. Two patch pockets. $68.00. Shipping and tax not supplied. Pocket functionality has not been confirmed.",
    );
  await page
    .getByLabel("Choose product photos")
    .setInputFiles("public/demo/rust-jacket.png");
  await page.getByAltText("Product source 1").waitFor();
  await page.getByRole("checkbox", { name: /I confirm this text/ }).check();
  await chapter(
    "02-item",
    "Add the original product image, listing text and exact Rust / M variant. This is sample data, not a retailer claim.",
  );
  await page
    .getByRole("button", { name: "Confirm sources", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove Full-length sleeves", exact: true })
    .click();
  await chapter(
    "03-requirements",
    "Two essentials: machine washable and functional pockets. Preferences cannot override these.",
  );
  await page
    .getByRole("button", { name: "Check requirements", exact: true })
    .click();
  await page.getByText("Source-supported", { exact: true }).first().waitFor();
  await page.getByText("Still unknown", { exact: true }).first().waitFor();
  await chapter(
    "04-evidence",
    "Care is supported by the supplied listing. Functional pockets remain unknown and need confirmation.",
  );
  await page
    .getByRole("button", { name: "Keep on shortlist", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Your shortlist", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve & save report", exact: true })
    .click();
  const reportDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Readable report", exact: true })
    .click();
  const download = await reportDownload;
  await download.saveAs(`${dir}/shopping-report.txt`);
  await chapter(
    "05-decision",
    "Save a decision report with the unresolved pocket requirement still visible. Saving does not confirm suitability.",
  );
  await page
    .getByRole("button", { name: "Check an item", exact: true })
    .click();
  await page
    .getByRole("button", { name: "4. YouCam preview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open preview studio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Build my contract", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("radio", { name: /Live virtual try-on/ })
      .getAttribute("aria-checked"),
    "true",
  );
  await chapter(
    "06-handoff",
    "The same selected garment reaches the live YouCam studio. The shopper image is synthetic.",
  );
  await page
    .getByRole("button", { name: "Build my contract", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: /I approve this contract for one live virtual try-on/,
    })
    .check();
  await chapter(
    "07-consent",
    "Review appearance protections and approve one real YouCam Clothes v3 generation. No personal photo is used.",
  );
  const verified = page.waitForResponse(
    (r) => r.url().endsWith("/verify") && r.request().method() === "POST",
    { timeout: 300000 },
  );
  await page
    .getByRole("button", { name: "Approve & generate", exact: true })
    .click();
  const response = await Promise.race([
    verified,
    page
      .locator(".error-banner")
      .waitFor({ state: "visible", timeout: 300000 })
      .then(async () => {
        throw new Error(await page.locator(".error-banner").innerText());
      }),
  ]);
  assert.equal(response.status(), 200, await response.text());
  let assessment = await response.json();
  report.integrityState = assessment.state;
  assert(sessionId, "Missing real session");
  const image = await page.request.get(
    `${base}/api/v1/sessions/${sessionId}/result-image`,
    { headers: protection },
  );
  assert.equal(image.status(), 200);
  await writeFile(`${dir}/youcam-result.jpg`, await image.body());
  await chapter(
    "08-live-result",
    `Fresh YouCam result. Appearance check: ${assessment.state}. This does not prove fit, fabric or pocket functionality.`,
  );
  if (assessment.state === "failed" && assessment.repairSupported) {
    const repaired = page.waitForResponse((r) => r.url().endsWith("/repair"), {
      timeout: 120000,
    });
    await page
      .getByRole("button", {
        name: "Restore source zone & reverify",
        exact: true,
      })
      .click();
    const r = await repaired;
    assert.equal(r.status(), 200);
    assessment = await r.json();
    report.repairState = assessment.state;
    await chapter(
      "09-repair",
      `Source-zone repair was checked again: ${assessment.state}.`,
    );
  }
  if (!["failed", "inconclusive"].includes(assessment.state)) {
    await page
      .getByRole("button", {
        name: /^Approve (this result|with finding retained)$/,
      })
      .click();
    await page
      .getByRole("link", { name: "Download signed JSON", exact: true })
      .waitFor();
    const receipt = await page.request.get(
      `${base}/api/v1/sessions/${sessionId}/receipt-download`,
      { headers: protection },
    );
    assert.equal(receipt.status(), 200);
    await writeFile(`${dir}/signed-receipt.json`, await receipt.body());
    await chapter(
      "10-receipt",
      "A signed receipt records this YouCam result and its appearance findings. Product requirements stay separate.",
    );
    await page
      .getByRole("button", { name: "Delete images now", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Your images are gone.", exact: true })
      .waitFor();
    deleted = true;
    await chapter(
      "11-deletion",
      "Session images are deleted from AsShown. Perfect Corp retention is separate. This local demo recording is retained.",
    );
  } else {
    assert.equal(
      await page
        .getByRole("button", {
          name: /^Approve (this result|with finding retained)$/,
        })
        .count(),
      0,
    );
    await chapter(
      "10-review-required",
      "Approval is blocked because the appearance check is not verified. The app does not fabricate a passing receipt.",
    );
  }
  report.result = "completed";
} catch (e) {
  report.result = "failed";
  report.error = e.message;
  await page
    .screenshot({ path: `${dir}/failure.png`, fullPage: true })
    .catch(() => {});
  throw e;
} finally {
  if (sessionId) {
    if (!deleted) {
      const r = await page.request.delete(
        `${base}/api/v1/sessions/${sessionId}`,
        { headers: { Origin: base, ...protection } },
      );
      assert(r.ok(), "Demo session cleanup failed");
    }
    const r = await page.request.get(
      `${base}/api/v1/sessions/${sessionId}/result-image`,
      { headers: protection },
    );
    assert.equal(r.status(), 404, "Deleted pixels remained accessible");
    report.deletionVerified = true;
  }
  const video = page.video();
  await context.close();
  await video.saveAs(`${dir}/asshown-end-to-end.webm`);
  await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(`${dir}/run.json`, JSON.stringify(report, null, 2));
  console.log("Recording and evidence saved in " + dir);
}
