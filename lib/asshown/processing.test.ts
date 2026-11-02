import { afterEach, describe, expect, it, vi } from "vitest";
const list = vi.hoisted(() => vi.fn());
vi.mock("./records", () => ({ listRecords: list, changeRecord: vi.fn() }));
import { paidFeaturesEnabled } from "./processing";
afterEach(() => vi.unstubAllEnvs());
describe("privacy incident stop", () => {
  it("blocks processing when deployment switch is off", async () => {
    vi.stubEnv("ASSHOWN_PAID_FEATURES_ENABLED", "false");
    expect(await paidFeaturesEnabled()).toBe(false);
  });
  it("blocks processing when a moderator has paused it", async () => {
    vi.stubEnv("ASSHOWN_PAID_FEATURES_ENABLED", "true");
    list.mockResolvedValue([
      { id: "processing-control", data: { paused: true } },
    ]);
    expect(await paidFeaturesEnabled()).toBe(false);
  });
  it("allows requests only when neither stop is active", async () => {
    vi.stubEnv("ASSHOWN_PAID_FEATURES_ENABLED", "true");
    list.mockResolvedValue([]);
    expect(await paidFeaturesEnabled()).toBe(true);
  });
});
