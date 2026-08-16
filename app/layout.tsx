import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KeepMe — Change the clothes, not the person",
  description: "A consent and identity-integrity layer for apparel virtual try-on.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><a className="skip-link" href="#main-content">Skip to main content</a>{children}</body>
    </html>
  );
}
