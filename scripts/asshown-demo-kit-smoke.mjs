import { chromium } from "playwright";
import { readFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(30000);
const protection =
  new URL(base).hostname.endsWith(".vercel.app") &&
  process.env.VERCEL_OIDC_TOKEN
    ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN }
    : {};
let studioId;
try {
  if (process.env.ASSHOWN_SHARE_URL) {
    assert.equal(new URL(process.env.ASSHOWN_SHARE_URL).origin, base);
    await page.goto(process.env.ASSHOWN_SHARE_URL);
  } else if (Object.keys(protection).length)
    await page.route(`${base}/**`, (r) =>
      r.continue({ headers: { ...r.request().headers(), ...protection } }),
    );
  await page.goto(`${base}/demo-kit/index.html`);
  await page.getByRole("heading", { name: "Your complete demo kit" }).waitFor();
  assert.equal(await page.locator("article img").count(), 7);
  for (const img of await page.locator("article img").all())
    await img.evaluate((i) => i.decode());
  const ready = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download everything (.zip)" }).click();
  const downloaded = await readFile(await (await ready).path());
  const hash = (b) => createHash("sha256").update(b).digest("hex");
  assert.equal(hash(downloaded), hash(await readFile("public/demo-kit.zip")));
  console.log(
    "Seven kit images load; ZIP download matches the packaged files.",
  );
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
  await mkdir("artifacts/full-qa", { recursive: true });
  await page.screenshot({
    path: "artifacts/full-qa/clean-evidence.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "4. YouCam preview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open preview studio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Build my contract", exact: true })
    .waitFor();
  studioId = await page.evaluate(() =>
    sessionStorage.getItem("asshown-studio-id"),
  );
  assert(studioId);
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("public/demo-kit/03-synthetic-shopper.png");
  await page
    .getByRole("button", { name: "Build my contract", exact: true })
    .click();
  const generate = page.getByRole("button", {
    name: "Approve & generate",
    exact: true,
  });
  assert(await generate.isDisabled());
  await page
    .getByRole("checkbox", {
      name: /I approve this contract for one live virtual try-on/,
    })
    .check();
  assert.equal(await generate.isDisabled(), false);
  await page.screenshot({
    path: "artifacts/full-qa/clean-studio-contract.png",
    fullPage: true,
  });
  console.log(
    "Kit listing verdicts, seller reply, garment handoff, synthetic photo and consent gate pass. No paid generation requested.",
  );
} finally {
  try {
    if (studioId) {
      const r = await page.request.delete(
        `${base}/api/v1/sessions/${studioId}`,
        { headers: { ...protection, Origin: base } },
      );
      assert.equal(r.status(), 200);
    }
  } finally {
    await browser.close();
  }
}
