import { afterEach, expect, it, vi } from "vitest";
import { processingImage } from "./client-image";
afterEach(() => vi.restoreAllMocks());
it("prepares a bounded processing copy without changing the original file", async () => {
  const original = new File(
    [new Uint8Array([137, 80, 78, 71]), new Uint8Array(5 * 1024 * 1024)],
    "large.png",
    { type: "image/png" },
  );
  Object.defineProperty(original, "arrayBuffer", {
    value: async () => new Uint8Array([137, 80, 78, 71]).buffer,
  });
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 2000, height: 3000, close: vi.fn() })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) =>
      callback(new Blob([new Uint8Array(512 * 1024)], { type: "image/jpeg" })),
  );
  const result = await processingImage(original);
  expect(result.type).toBe("image/jpeg");
  expect(result.size * 2).toBeLessThan(4 * 1024 * 1024);
  expect(original.size).toBeGreaterThan(5 * 1024 * 1024);
  expect(original.type).toBe("image/png");
  vi.unstubAllGlobals();
});
