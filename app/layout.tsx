import { AccountSessionGuard } from "@/components/AccountMenu";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkConfigured } from "@/lib/clerk-config";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import "./globals.css";
import "./asshown.css";

export const metadata: Metadata = {
  title: "AsShown — Love the look. Know the details.",
  description:
    "Source-backed clothing decisions and optional YouCam virtual try-on.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const vercelTelemetry = false; // Analytics remain off until user-consent and retention review.
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {clerkConfigured() ? (
          <ClerkProvider
            signInUrl="/signin"
            signUpUrl="/signup"
            appearance={{
              variables: { colorPrimary: "#72508b", colorSuccess: "#72508b" },
            }}
          >
            <AccountSessionGuard>{children}</AccountSessionGuard>
          </ClerkProvider>
        ) : (
          children
        )}
        {vercelTelemetry && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
