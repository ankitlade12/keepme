import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const base = process.env.KEEPME_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 2400, height: 1260 } });
  const page = await context.newPage();
  for (const path of ["/", "/studio", "/dashboard", "/privacy", "/terms", "/security"]) {
    const browserErrors = [];
    const failedResponses = [];
    const onConsole = (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    };
    const onPageError = (error) => browserErrors.push(error.message);
    const onResponse = (response) => {
      if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
    };
    page.on("console", onConsole);
    page.on("pageerror", onPageError);
    page.on("response", onResponse);
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    const rendering = await page.evaluate(() => ({
      brokenImages: Array.from(document.images)
        .filter((image) => !image.complete || image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src || image.alt),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    }));
    if (path === "/studio") {
      const liveOption = page.getByRole("radio", { name: /Live virtual try-on/ });
      if (await liveOption.isEnabled()) {
        await liveOption.click();
        await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
        const liveRendering = await page.evaluate(() => ({
          brokenImages: Array.from(document.images)
            .filter((image) => image.naturalWidth === 0)
            .map((image) => image.currentSrc || image.src || image.alt),
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        }));
        rendering.brokenImages.push(...liveRendering.brokenImages.map((image) => `live mode: ${image}`));
        rendering.horizontalOverflow ||= liveRendering.horizontalOverflow;
      }
    }
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    if (rendering.brokenImages.length || rendering.horizontalOverflow || browserErrors.length || result.violations.length) {
      if (rendering.brokenImages.length) console.error(`${path}: broken images: ${rendering.brokenImages.join(", ")}`);
      if (rendering.horizontalOverflow) console.error(`${path}: horizontal page overflow at 2400px`);
      if (failedResponses.length) console.error(`${path}: failed responses: ${failedResponses.join(" | ")}`);
      if (browserErrors.length) console.error(`${path}: browser errors: ${browserErrors.join(" | ")}`);
      console.error(`${path}: ${result.violations.map((item) => `${item.id} (${item.nodes.length})`).join(", ")}`);
      for (const violation of result.violations) for (const node of violation.nodes) console.error(`  ${violation.id} ${node.target.join(" ")}: ${node.failureSummary ?? node.html}`);
      process.exitCode = 1;
    } else console.log(`${path}: images and layout render; no browser errors or automated WCAG A/AA violations`);
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("response", onResponse);
  }
} finally {
  await browser.close();
}
