// @vitest-environment node
import { describe, it, expect } from "vitest";
import { permittedUrl, publicIPv4, parseProduct } from "./importer";
describe("retailer import boundary", () => {
  it("blocks local and unapproved targets", () => {
    for (const u of [
      "http://shop.example/item",
      "https://127.0.0.1",
      "https://shop.example.evil.com/item",
      "https://user:pass@shop.example/item",
    ])
      expect(() => permittedUrl(u, ["shop.example"])).toThrow();
  });
  it("blocks private DNS answers", () => {
    for (const ip of [
      "127.0.0.1",
      "10.2.0.1",
      "169.254.169.254",
      "192.168.0.1",
      "172.16.0.1",
      "100.64.0.1",
      "::1",
    ])
      expect(publicIPv4(ip)).toBe(false);
    expect(publicIPv4("8.8.8.8")).toBe(true);
  });
  it("extracts only a single structured product", () => {
    expect(
      parseProduct(
        '<script type="application/ld+json">{"@type":"Product","name":"Jacket","description":"Machine wash cold"}</script>',
      ).title,
    ).toBe("Jacket");
    expect(() => parseProduct("<html>Sign in</html>")).toThrow();
  });
});
