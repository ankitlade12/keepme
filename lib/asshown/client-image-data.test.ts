// @vitest-environment node
import { expect, it, vi, afterEach } from "vitest";
import { dataImageFile } from "./client-image";
afterEach(() => vi.unstubAllGlobals());
it("preserves uploaded handoff bytes without a network fetch", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const file = dataImageFile(
    `data:image/png;base64,${bytes.toString("base64")}`,
    "garment.png",
  );
  expect(file.type).toBe("image/png");
  expect(Buffer.from(await file.arrayBuffer())).toEqual(bytes);
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects unsupported, malformed and oversized handoffs", () => {
  for (const url of [
    "https://example.com/image.png",
    "data:text/html;base64,aGVsbG8=",
    "data:image/png;base64,***",
    "data:image/png;base64,",
    `data:image/png;base64,${"A".repeat(14 * 1024 * 1024)}`,
  ])
    expect(() => dataImageFile(url, "garment")).toThrow();
});
