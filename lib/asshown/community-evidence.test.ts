import { describe, expect, it } from "vitest";
import { refreshCommunityEvidence } from "./community-evidence";
import { defaults, evaluate, type Product } from "./policy";
const id = "00000000-0000-4000-8000-000000000001";
const product: Product = {
  id: "item",
  sku: "sku-1",
  title: "Jacket",
  retailer: "Shop",
  brand: "Brand",
  color: "Rust",
  size: "M",
  confirmed: true,
  decision: "undecided",
  sources: [
    {
      id: "source",
      kind: "community report",
      text: "Machine wash cold.",
      variant: "Rust / M",
      date: "2026-11-01",
      communityId: id,
      communityStatus: "published",
    },
  ],
};
const note = {
  id,
  productId: "sku-1",
  retailer: "Shop",
  color: "Rust",
  size: "M",
  text: "Machine wash cold.",
  date: "2026-11-01",
  confirmed: true,
  status: "published",
};
describe("linked community evidence", () => {
  it("invalidates current findings after withdrawal or dispute", () => {
    expect(
      evaluate(refreshCommunityEvidence([product], [note])[0], [defaults[0]])[0]
        .state,
    ).toBe("supported");
    for (const status of ["disputed", "withdrawn", "removed"])
      expect(
        evaluate(
          refreshCommunityEvidence([product], [{ ...note, status }])[0],
          [defaults[0]],
        )[0].state,
      ).toBe("unknown");
  });
  it("requires exact product and retailer and fails closed when unavailable", () => {
    for (const notes of [
      [],
      [{ ...note, productId: "other" }],
      [{ ...note, retailer: "Other shop" }],
    ])
      expect(
        refreshCommunityEvidence([product], notes)[0].sources[0]
          .communityStatus,
      ).toBe("unavailable");
  });
  it("excludes corrected sources while preserving their original text", () => {
    const p = {
      ...product,
      sources: [
        {
          ...product.sources[0],
          excluded: true,
          correctionReason: "Wrong item",
        },
      ],
    };
    expect(evaluate(p, [defaults[0]])[0].state).toBe("unknown");
    expect(p.sources[0].text).toBe("Machine wash cold.");
  });
});
