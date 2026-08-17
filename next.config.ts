import type { NextConfig } from "next";

function clerkFrontendOrigin() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) return "";
  try {
    const encoded = key.replace(/^pk_(test|live)_/, "");
    const domain = Buffer.from(encoded, "base64url").toString("utf8").replace(/\$$/, "");
    return domain ? `https://${domain}` : "";
  } catch {
    return "";
  }
}

const clerkOrigin = clerkFrontendOrigin();
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `img-src 'self' blob: data: https://img.clerk.com`,
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === "production" ? "" : "'unsafe-eval'"} ${clerkOrigin} https://va.vercel-scripts.com https://challenges.cloudflare.com https://*.protect.clerk.com`,
  `connect-src 'self' ${clerkOrigin} https://*.protect.clerk.com https://clerk-telemetry.com https://*.clerk-telemetry.com`,
  "frame-src 'self' https://challenges.cloudflare.com https://*.protect.clerk.com",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ").replace(/\s{2,}/g, " ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: process.env.VERCEL ? undefined : "standalone",
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
