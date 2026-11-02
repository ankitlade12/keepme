import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  if (
    new URL(base).hostname.endsWith(".vercel.app") &&
    process.env.VERCEL_OIDC_TOKEN
  )
    await page.route(`${base}/**`, (r) =>
      r.continue({
        headers: {
          ...r.request().headers(),
          "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN,
        },
      }),
    );
  await page.goto(`${base}/check?example=1`);
  await page
    .getByRole("button", { name: "Arrival check", exact: true })
    .click();
  await page
    .getByLabel(/Add JPEG or PNG images/)
    .setInputFiles("public/demo/rust-jacket.png");
  const included = page.getByRole("checkbox", {
    name: "Include this attachment in the download",
  });
  await included.waitFor();
  assert.equal(await included.isChecked(), false);
  await included.check();
  await page
    .getByLabel("Describe what this shows")
    .fill("Synthetic garment used to test the evidence package.");
  await page
    .getByRole("checkbox", { name: /I reviewed the selected images/ })
    .check();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download evidence package (1 attachments)" })
    .click();
  const result = await downloaded;
  const html = await readFile(await result.path(), "utf8");
  assert.match(html, /data:image\/png;base64,/);
  assert.match(html, /Synthetic garment used/);
  assert.match(html, /Original listing evidence/);
  await page.screenshot({
    path: "artifacts/asshown-evidence-package.png",
    fullPage: true,
  });
  console.log(
    "Attachment selection, review, embedded-image export and listing provenance: passed",
  );
} finally {
  await browser.close();
}
