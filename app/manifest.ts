import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AsShown — Clothing decisions with evidence",
    short_name: "AsShown",
    description: "Consent and identity-integrity evidence for apparel virtual try-on.",
    start_url: "/check",
    display: "standalone",
    background_color: "#f7f5ed",
    theme_color: "#715197",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
