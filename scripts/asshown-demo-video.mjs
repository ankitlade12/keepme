import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
await mkdir("artifacts/demo-video", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: {
    dir: "artifacts/demo-video",
    size: { width: 1280, height: 800 },
  },
});
const page = await context.newPage();
async function chapter(text, seconds = 12) {
  await page.evaluate((text) => {
    document.getElementById("demo-caption")?.remove();
    const c = document.createElement("div");
    c.id = "demo-caption";
    c.textContent = text;
    Object.assign(c.style, {
      position: "fixed",
      bottom: "0",
      left: "0",
      right: "0",
      zIndex: "99999",
      background: "#252131",
      color: "#fff",
      padding: "18px 32px",
      font: "18px/1.5 system-ui",
      textAlign: "center",
    });
    document.body.append(c);
  }, text);
  await page.waitForTimeout(seconds * 1000);
}
try {
  await page.goto("http://localhost:3001");
  await chapter(
    "AsShown: check clothing against your practical needs before buying. No selfie or account needed to start.",
  );
  await page.goto("http://localhost:3001/check?example=1");
  await page
    .getByRole("heading", { name: "Everyday utility jacket", exact: true })
    .waitFor();
  await chapter(
    "Illustrative product data: inspect listing evidence, confirm the exact variant, and keep unknowns visible.",
  );
  await page
    .getByRole("button", { name: "Your shortlist", exact: true })
    .click();
  await chapter(
    "Compare your essentials. A care conflict stays visible; an attractive preview cannot override it.",
  );
  await page.goto("http://localhost:3001/demo/youcam-live-tryon.jpg");
  await chapter(
    "Recorded YouCam Clothes v3 output with a synthetic person. This is a recorded result, not a live call or proof of fit.",
  );
  await page.goto("http://localhost:3001/check?example=1");
  await page
    .getByRole("button", { name: "Arrival check", exact: true })
    .click();
  await chapter(
    "After delivery: review the label and photos, document differences, and prepare an editable seller message.",
  );
  await page
    .getByRole("button", { name: "Product notes", exact: true })
    .click();
  await chapter(
    "Help the community with exact-variant evidence. Contributions require consent and moderation; corrections and withdrawal are supported.",
  );
  await page.goto("http://localhost:3001/privacy");
  await chapter(
    "Your evidence stays private unless you explicitly contribute. AI interpretation, OCR and translation still need Gateway billing activation.",
  );
} finally {
  const video = page.video();
  await context.close();
  await video.saveAs("artifacts/asshown-demo-draft.webm");
  await browser.close();
}
console.log(
  "Captioned 84-second local demo draft saved. No video uploaded or published.",
);
