import type { Product } from "./policy";
export function examples(): Product[] {
  const date = new Date().toISOString();
  return [
    {
      id: "example-rust",
      title: "Everyday utility jacket",
      brand: "Illustrative catalog",
      retailer: "Demo listing — not for sale",
      color: "Rust",
      size: "M",
      confirmed: true,
      image: "/demo/rust-jacket.png",
      decision: "shortlist",
      sources: [
        {
          id: "example-source-1",
          kind: "seller listing",
          date,
          variant: "Rust / M",
          text: "Illustrative listing: Everyday utility jacket. Long sleeves. 100% cotton. Machine wash cold. Two patch pockets. $68.00. Shipping and tax not supplied.",
        },
      ],
    },
    {
      id: "example-indigo",
      title: "The indigo overshirt",
      brand: "Illustrative catalog",
      retailer: "Demo listing — not for sale",
      color: "Indigo",
      size: "M",
      confirmed: true,
      image: "/demo/indigo-overshirt.png",
      decision: "shortlist",
      sources: [
        {
          id: "example-source-2",
          kind: "seller listing",
          date,
          variant: "Indigo / M",
          text: "Illustrative listing: The indigo overshirt. Long sleeves. 80% cotton, 20% polyester. Dry-clean only. Functional pockets. Button closure. $79.00. Shipping and tax not supplied.",
        },
      ],
    },
  ];
}
