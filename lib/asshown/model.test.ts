import { afterEach, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { directModel } from "./model";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("does not fall back to Gateway when only OIDC is configured", () => {
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
  vi.stubEnv("VERCEL_OIDC_TOKEN", "test-oidc");
  vi.stubEnv("ASSHOWN_AI_MODEL", "google/gemini-3.8-flash");
  expect(directModel("text")).toBeNull();
});
it("rejects model names belonging to other providers", () => {
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
  vi.stubEnv("ASSHOWN_VISION_MODEL", "other/model");
  expect(directModel("vision")).toBeNull();
});
it("sends model requests to Google with the direct key, never Gateway", async () => {
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
  vi.stubEnv("ASSHOWN_AI_MODEL", "google/gemini-3.8-flash");
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: { role: "model", parts: [{ text: "ok" }] },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 1,
            totalTokenCount: 2,
          },
        }),
        { headers: { "content-type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const provider = directModel("text")!;
  const result = await generateText({
    model: provider.model,
    prompt: "Connection test",
    maxRetries: 0,
  });
  expect(result.text).toBe("ok");
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(new URL(url).hostname).toBe("generativelanguage.googleapis.com");
  expect(url).toContain("gemini-3.8-flash:generateContent");
  expect(new Headers(init.headers).get("x-goog-api-key")).toBe("test-key");
  expect(provider.name).toBe("google/gemini-3.8-flash");
});
