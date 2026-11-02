import { afterEach, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { directModel } from "./model";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("does not fall back to Gateway when only OIDC is configured", () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("VERCEL_OIDC_TOKEN", "test-oidc");
  vi.stubEnv("ASSHOWN_AI_MODEL", "openai/gpt-4.1-mini");
  expect(directModel("text")).toBeNull();
});
it("rejects model names belonging to other providers", () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("ASSHOWN_VISION_MODEL", "google/gemini-3.8-flash");
  expect(directModel("vision")).toBeNull();
});
it("sends requests directly to OpenAI with storage disabled", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("ASSHOWN_AI_MODEL", "openai/gpt-4.1-mini");
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          id: "resp_test",
          object: "response",
          created_at: 1,
          model: "gpt-4.1-mini",
          status: "completed",
          output: [
            {
              id: "msg_test",
              type: "message",
              role: "assistant",
              status: "completed",
              content: [{ type: "output_text", text: "ok", annotations: [] }],
            },
          ],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        }),
        { headers: { "content-type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const provider = directModel("text")!;
  const result = await generateText({
    model: provider.model,
    prompt: "Connection test",
    providerOptions: { openai: { store: false } },
    maxRetries: 0,
  });
  expect(result.text).toBe("ok");
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://api.openai.com/v1/responses");
  expect(new Headers(init.headers).get("authorization")).toBe(
    "Bearer test-key",
  );
  expect(JSON.parse(init.body as string).store).toBe(false);
});
