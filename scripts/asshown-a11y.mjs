import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
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
let failures = [];
for (const path of ["/", "/check?example=1"]) {
  await page.goto(`${base}${path}`);
  await page.waitForTimeout(600);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  failures.push(
    ...results.violations.map((v) => ({
      path,
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({ html: n.html, summary: n.failureSummary })),
    })),
  );
}
console.log(JSON.stringify(failures, null, 2));
await browser.close();
if (failures.length) process.exitCode = 1;
