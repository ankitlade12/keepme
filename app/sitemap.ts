import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return ["", "/privacy", "/terms", "/security"].map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: path ? "monthly" as const : "weekly" as const, priority: path ? 0.5 : 1 }));
}
