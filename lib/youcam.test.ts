import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("./security", () => ({ consumeRateLimit: vi.fn() }));
vi.mock("./asshown/processing", () => ({ paidFeaturesEnabled: vi.fn() }));
import { consumeRateLimit } from "./security";
import { paidFeaturesEnabled } from "./asshown/processing";
import {
  createClothesTask,
  assertYouCamUnitsAvailable,
  YouCamRequestError,
  YouCamConfigurationError,
} from "./youcam";

beforeEach(() => {
  vi.stubEnv("YOUCAM_API_KEY", "test-only");
  vi.mocked(paidFeaturesEnabled).mockResolvedValue(true);
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 99,
    retryAfter: 0,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("preserves HTTP failure status without exposing provider bodies or retrying", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response("private provider detail", { status: 429 }),
    );
  vi.stubGlobal("fetch", fetchMock);
  const error = await createClothesTask("source", "garment").catch((e) => e);
  expect(error).toBeInstanceOf(YouCamRequestError);
  expect(error.status).toBe(429);
  expect(error.message).not.toContain("private provider detail");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("keeps transport failures uncertain and never retries a paid submission", async () => {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
  vi.stubGlobal("fetch", fetchMock);
  await expect(createClothesTask("source", "garment")).rejects.toThrow(
    "fetch failed",
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("identifies a local budget stop before any provider request", async () => {
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: false,
    remaining: 0,
    retryAfter: 100,
  });
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(createClothesTask("source", "garment")).rejects.toBeInstanceOf(
    YouCamConfigurationError,
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

it("stops an empty or expired unit balance before task submission", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        results: [
          { amount: 0, expiry: Date.now() + 10000 },
          { amount: 10, expiry: Date.now() - 10000 },
        ],
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  await expect(assertYouCamUnitsAvailable()).rejects.toThrow(
    "no API units remaining",
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toContain("/client/credit");
});
it("allows a positive unexpired balance to proceed", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [{ amount: 2, expiry: Date.now() + 10000 }],
          }),
          { status: 200 },
        ),
      ),
  );
  await expect(assertYouCamUnitsAvailable()).resolves.toBeUndefined();
});
