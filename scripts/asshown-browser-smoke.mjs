import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
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
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base);
await page.getByRole("heading", { name: /Love the look/ }).waitFor();
await mkdir("artifacts", { recursive: true });
await page.screenshot({
  path: "artifacts/asshown-home-desktop.png",
  fullPage: true,
});
await page.getByRole("link", { name: "Explore an example" }).click();
await page
  .getByRole("heading", { name: "Everyday utility jacket", exact: true })
  .waitFor();
await page.getByRole("button", { name: "Your shortlist", exact: true }).click();
if (!(await page.getByText("Essential conflict", { exact: true }).count()))
  throw new Error("Missing care conflict");
await page.screenshot({
  path: "artifacts/asshown-shortlist-desktop.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Approve & save report" }).click();
await page.getByRole("button", { name: "Saved checks", exact: true }).click();
await page
  .getByRole("heading", {
    name: "Everyday utility jacket + The indigo overshirt",
  })
  .waitFor();
await page.reload();
await page.getByRole("button", { name: "Saved checks", exact: true }).click();
await page
  .getByRole("heading", {
    name: "Everyday utility jacket + The indigo overshirt",
  })
  .waitFor();
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base);
await page.screenshot({
  path: "artifacts/asshown-home-mobile.png",
  fullPage: true,
});
if (
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
)
  throw new Error("Mobile overflow");
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
console.log("Desktop, mobile, comparison, save, refresh: passed");
