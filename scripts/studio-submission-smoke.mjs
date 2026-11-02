import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.ASSHOWN_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
try {
  for (const unknown of [true, false]) {
    const page = await browser.newPage();
    if (process.env.ASSHOWN_SHARE_URL)
      await page.goto(process.env.ASSHOWN_SHARE_URL);
    let submissions = 0;
    await page.route("**/api/v1/sessions**", async (route) => {
      const req = route.request();
      if (req.url().endsWith("/generate")) submissions++;
      if (req.method() === "POST")
        return route.fulfill({ json: { sessionId: "ses_submission_test" } });
      return route.fulfill({
        json: {
          sessionId: "ses_submission_test",
          provider: "youcam",
          hasGenerationTask: true,
          submissionUnknown: unknown,
          generationError: unknown ? "This submission needs review." : null,
          contract: null,
        },
      });
    });
    await page.goto(`${base}/studio`);
    if (unknown) {
      const button = page.getByRole("button", {
        name: "Submission needs review",
      });
      await button.waitFor();
      assert.equal(await button.isDisabled(), true);
      await page.reload();
      await button.waitFor();
      assert.equal(await button.isDisabled(), true);
    } else
      await page
        .getByRole("button", { name: "Check existing generation" })
        .waitFor();
    assert.equal(submissions, 0);
    await page.close();
  }
  console.log(
    "Unknown submissions stay disabled after reload; known jobs offer status checks. No provider calls made.",
  );
} finally {
  await browser.close();
}
