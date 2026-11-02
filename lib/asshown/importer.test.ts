// @vitest-environment node
import { gzipSync, deflateSync, brotliCompressSync } from "node:zlib";
import { describe, it, expect } from "vitest";
import {
  amazonProduct,
  amazonVariants,
  parseAmazonProduct,
  decodeRetailerBody,
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

const amazonFixture = `<input id="ASIN" value="B096YM16SV"><span id="productTitle">Example &amp; Jacket</span><a id="bylineInfo">Visit the Example Store</a><div id="productFactsDesktop_feature_div"><div>Care instructions <span>Machine Wash Cold</span></div><script>untrusted()</script><p>Two zippered hand pockets.</p></div><div id="reviews">Waterproof</div>`;
it("decodes retailer compression before extracting exact-ASIN Amazon details", () => {
  for (const [encoding, bytes] of [
    ["gzip", gzipSync(amazonFixture)],
    ["deflate", deflateSync(amazonFixture)],
    ["br", brotliCompressSync(amazonFixture)],
    ["identity", Buffer.from(amazonFixture)],
  ] as const) {
    const product = parseAmazonProduct(
      decodeRetailerBody(bytes, encoding),
      "B096YM16SV",
    );
    expect(product.title).toBe("Example & Jacket");
    expect(product.brand).toBe("Example");
    expect(product.text).toContain("Machine Wash Cold");
    expect(product.text).not.toMatch(/untrusted|Waterproof/);
  }
});
it("rejects corrupt compression and bounds decompressed pages", () => {
  expect(() => decodeRetailerBody(Buffer.from("invalid"), "gzip")).toThrow();
  expect(() =>
    decodeRetailerBody(gzipSync(Buffer.alloc(5 * 1024 * 1024)), "gzip"),
  ).toThrow();
  expect(() => decodeRetailerBody(Buffer.from("test"), "unknown")).toThrow();
});
it("rejects CAPTCHA, mismatched ASINs, duplicate identities and empty details", () => {
  for (const html of [
    "<html>Robot check</html>",
    amazonFixture.replace("B096YM16SV", "B012345678"),
    amazonFixture + '<input id="ASIN" value="B096YM16SV">',
    amazonFixture.replace(
      'id="productFactsDesktop_feature_div"',
      'id="unrelated"',
    ),
  ])
    expect(() => parseAmazonProduct(html, "B096YM16SV")).toThrow();
});

const variantFixture = JSON.stringify({
  dimensions: ["material_type", "color_name", "size_name"],
  dimensionValuesDisplayData: {
    B096YM16SV: ["Recycled", "Black", "X-Large"],
    B096YJMFDJ: ["Recycled", "Black", "Small"],
    B096YL2ZD3: ["Recycled", "Red", "X-Large"],
    B012345678: ["Other material", "Blue", "Small"],
  },
});
it("extracts the selected variant and real combinations without mixing other materials", () => {
  const result = amazonVariants(variantFixture, "B096YM16SV");
  expect(result.color).toBe("Black");
  expect(result.size).toBe("X-Large");
  expect(result.variants).toHaveLength(3);
  expect(result.variants.find((v) => v.size === "Small")?.asin).toBe(
    "B096YJMFDJ",
  );
  expect(result.variants.some((v) => v.color === "Blue")).toBe(false);
});
it("keeps manual fields for absent, malformed, ambiguous or mismatched variant data", () => {
  for (const html of [
    "<html>no variants</html>",
    variantFixture.replace('"dimensions":', '"missing":'),
    variantFixture.replace('"B096YM16SV":', '"INVALID":'),
    variantFixture.replace('"Red","X-Large"', '"Black","X-Large"'),
    variantFixture
      .replace('"Small"', '"' + "x".repeat(81) + '"')
      .replace('"X-Large"', '"' + "x".repeat(81) + '"'),
  ])
    expect(amazonVariants(html, "B096YM16SV").variants).toEqual([]);
});
