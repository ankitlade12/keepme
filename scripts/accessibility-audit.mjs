import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const base = process.env.KEEPME_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const path of ["/", "/studio", "/dashboard", "/privacy", "/terms", "/security"]) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    if (result.violations.length) {
      console.error(`${path}: ${result.violations.map((item) => `${item.id} (${item.nodes.length})`).join(", ")}`);
      for (const violation of result.violations) for (const node of violation.nodes) console.error(`  ${violation.id} ${node.target.join(" ")}: ${node.failureSummary ?? node.html}`);
      process.exitCode = 1;
    } else console.log(`${path}: no automated WCAG A/AA violations`);
  }
} finally {
  await browser.close();
}
