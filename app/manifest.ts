import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KeepMe — Safe virtual try-on",
    short_name: "KeepMe",
    description: "Consent and identity-integrity evidence for apparel virtual try-on.",
    start_url: "/studio",
    display: "standalone",
    background_color: "#f7f5ed",
    theme_color: "#2f644d",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
