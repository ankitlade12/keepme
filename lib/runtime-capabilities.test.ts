import { describe, expect, it } from "vitest";
import { evaluateLiveTryOn, productionSafetyRequired } from "./runtime-capabilities";

describe("runtime capabilities", () => {
  it("allows a configured provider in local development", () => {
    expect(evaluateLiveTryOn({ NODE_ENV: "development", YOUCAM_API_KEY: "test-key" })).toEqual({ available: true, missing: [] });
  });

  it("keeps production live mode closed until every image-safety service is configured", () => {
    const status = evaluateLiveTryOn({
      NODE_ENV: "production",
      KEEPME_ALLOW_EPHEMERAL: "false",
      YOUCAM_API_KEY: "test-key",
      INTEGRITY_WORKER_TOKEN: "test-token",
    });
    expect(status.available).toBe(false);
    expect(status.missing).toEqual(["MALWARE_SCAN_URL", "MALWARE_SCAN_TOKEN", "INTEGRITY_WORKER_URL or INTEGRITY_URL"]);
  });

  it("recognizes a complete production live stack", () => {
    expect(evaluateLiveTryOn({
      NODE_ENV: "production",
      KEEPME_ALLOW_EPHEMERAL: "false",
      YOUCAM_API_KEY: "test-key",
      MALWARE_SCAN_URL: "https://scanner.internal",
      MALWARE_SCAN_TOKEN: "scanner-token",
      INTEGRITY_URL: "https://integrity.internal",
      INTEGRITY_WORKER_TOKEN: "worker-token",
    })).toEqual({ available: true, missing: [] });
  });

  it("treats production as fail-closed unless ephemeral mode is explicitly enabled", () => {
    expect(productionSafetyRequired({ NODE_ENV: "production" })).toBe(true);
    expect(productionSafetyRequired({ NODE_ENV: "production", KEEPME_ALLOW_EPHEMERAL: "true" })).toBe(false);
  });
});
