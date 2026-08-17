// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./server-config", () => ({
  serverConfig: {
    MALWARE_SCAN_URL: "https://scanner.internal",
    MALWARE_SCAN_TOKEN: "scanner-token",
  },
}));

vi.mock("./runtime-capabilities", () => ({ productionSafetyRequired: () => true }));

import { scanForMalware, UploadSecurityUnavailableError, UploadValidationError } from "./upload-security";

afterEach(() => vi.unstubAllGlobals());

describe("malware scanner retries", () => {
  it("waits for a cold scanner and requires an explicit clean decision", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: "Scanner unavailable" }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ clean: true }));
    vi.stubGlobal("fetch", fetchMock);
    const waitForRetry = vi.fn(async () => undefined);

    await scanForMalware(new Uint8Array([1, 2, 3]), "Image", waitForRetry);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(waitForRetry).toHaveBeenCalledTimes(1);
  });

  it("rejects a positive malware finding", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ clean: false })));
    await expect(scanForMalware(new Uint8Array([1]), "Image", async () => undefined)).rejects.toBeInstanceOf(UploadValidationError);
  });

  it("fails closed on an invalid scanner response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "unknown" })));
    await expect(scanForMalware(new Uint8Array([1]), "Image", async () => undefined)).rejects.toBeInstanceOf(UploadSecurityUnavailableError);
  });
});
