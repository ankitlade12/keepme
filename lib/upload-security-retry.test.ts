import { createHash } from "node:crypto";
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./server-config", () => ({
  serverConfig: {
    MALWARE_SCAN_URL: "https://scanner.internal",
    MALWARE_SCAN_TOKEN: "scanner-token",
  },
}));

vi.mock("./runtime-capabilities", () => ({
  productionSafetyRequired: () => true,
}));

import {
  scanForMalware,
  UploadSecurityUnavailableError,
  UploadValidationError,
} from "./upload-security";

afterEach(() => vi.unstubAllGlobals());

describe("malware scanner retries", () => {
  it("waits for a cold scanner and requires an explicit clean decision", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "Scanner unavailable" }, { status: 503 }),
      )
      .mockResolvedValueOnce(Response.json({ clean: true }));
    vi.stubGlobal("fetch", fetchMock);
    const waitForRetry = vi.fn(async () => undefined);

    await scanForMalware(new Uint8Array([1, 2, 3]), "Image", waitForRetry);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(waitForRetry).toHaveBeenCalledTimes(1);
  });

  it("rejects a positive malware finding", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ clean: false })),
    );
    await expect(
      scanForMalware(new Uint8Array([1]), "Image", async () => undefined),
    ).rejects.toBeInstanceOf(UploadValidationError);
  });

  it("fails closed on an invalid scanner response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ status: "unknown" })),
    );
    await expect(
      scanForMalware(new Uint8Array([1]), "Image", async () => undefined),
    ).rejects.toBeInstanceOf(UploadSecurityUnavailableError);
  });
});

it("requires the scanner to attest to the fetched original bytes", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ clean: true, sha256: hash })),
    );
  vi.stubGlobal("fetch", fetcher);
  await scanForMalware(
    bytes,
    "Image",
    async () => undefined,
    "https://store.private.blob.vercel-storage.com/one",
  );
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    url: "https://store.private.blob.vercel-storage.com/one",
    sha256: hash,
  });
  fetcher.mockResolvedValue(new Response(JSON.stringify({ clean: true })));
  await expect(
    scanForMalware(
      bytes,
      "Image",
      async () => undefined,
      "https://store.private.blob.vercel-storage.com/one",
    ),
  ).rejects.toBeInstanceOf(UploadSecurityUnavailableError);
});
