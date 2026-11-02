// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  amazonProduct,
  permittedUrl,
  publicIPv4,
  parseProduct,
  robotsAllows,
} from "./importer";
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

it("respects matching robots paths rather than blocking an entire retailer", () => {
  const rules =
    "User-agent: *\nDisallow: /cart\nDisallow: /products/private*\nAllow: /products/private-public$";
  expect(
    robotsAllows(rules, new URL("https://shop.example/products/shirt")),
  ).toBe(true);
  expect(robotsAllows(rules, new URL("https://shop.example/cart"))).toBe(false);
  expect(
    robotsAllows(rules, new URL("https://shop.example/products/private-item")),
  ).toBe(false);
  expect(
    robotsAllows(
      rules,
      new URL("https://shop.example/products/private-public"),
    ),
  ).toBe(true);
});
it("uses the bot-specific group when present", () => {
  const rules =
    "User-agent: *\nAllow: /\nUser-agent: AsShownProductImport\nDisallow: /";
  expect(
    robotsAllows(rules, new URL("https://shop.example/products/shirt")),
  ).toBe(false);
});

it("treats regex punctuation in robots paths literally", () => {
  const r = "User-agent: *\nDisallow: /products/shirt?private=true$";
  expect(
    robotsAllows(
      r,
      new URL("https://shop.example/products/shirt?private=true"),
    ),
  ).toBe(false);
  expect(robotsAllows(r, new URL("https://shop.example/products/shirt"))).toBe(
    true,
  );
});

it("recognizes Amazon product links and removes tracking", () => {
  for (const path of [
    "/a-shirt/dp/B012345678/ref=abc?tag=affiliate",
    "/gp/product/b012345678?th=1",
  ]) {
    expect(amazonProduct(`https://www.amazon.com${path}`)).toEqual({
      productId: "B012345678",
      sourceUrl: "https://www.amazon.com/dp/B012345678",
    });
  }
  expect(
    amazonProduct("https://amazon.com.evil.example/dp/B012345678"),
  ).toBeNull();
});
it("rejects unsafe and non-product Amazon URLs", () => {
  for (const url of [
    "http://amazon.com/dp/B012345678",
    "https://user:pass@amazon.com/dp/B012345678",
    "https://amazon.com:444/dp/B012345678",
    "https://amazon.com/s?k=shirt",
    "https://amazon.com/dp/B0123456789",
  ]) {
    expect(() => amazonProduct(url)).toThrow();
  }
});
