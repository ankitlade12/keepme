import type { Product } from "./policy";
export type SharedEvidence = {
  id: string;
  productId: string;
  retailer: string;
  color: string;
  size: string;
  confirmed: boolean;
  text: string;
  date: string;
  status: string;
};
const norm = (value: string) => value.trim().toLowerCase();
export function refreshCommunityEvidence(
  products: Product[],
  notes: SharedEvidence[],
): Product[] {
  return products.map((product) => ({
    ...product,
    sources: product.sources.map((source) => {
      if (!source.communityId) return source;
      const note = notes.find((n) => n.id === source.communityId);
      const valid =
        note?.status === "published" &&
        note.confirmed &&
        Boolean(product.sku) &&
        norm(note.productId) === norm(product.sku!) &&
        norm(note.retailer) === norm(product.retailer) &&
        norm(note.color) === norm(product.color) &&
        norm(note.size) === norm(product.size);
      return {
        ...source,
        communityStatus: valid
          ? ("published" as const)
          : ("unavailable" as const),
        text: valid ? note.text : source.text,
        date: valid ? note.date : source.date,
      };
    }),
  }));
}
