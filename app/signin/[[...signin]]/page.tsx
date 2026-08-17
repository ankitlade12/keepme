import { ClerkProvider, SignIn } from "@clerk/nextjs";
import Link from "@/components/NoPrefetchLink";
import { clerkConfigured } from "@/lib/clerk-config";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl = "/dashboard" } = await searchParams;
  const safeCallbackUrl = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/dashboard";

  if (!clerkConfigured()) {
    return (
      <main className="legal-page" id="main-content">
        <div className="legal-shell auth-card">
          <Link className="brand" href="/"><span className="brand-mark" />KeepMe</Link>
          <span className="section-kicker">Retailer access</span>
          <h1>Retailer sign-in is not configured</h1>
          <p>This environment does not have Clerk credentials. Shopper sessions remain available through their private session capability, but retailer data stays inaccessible.</p>
          <Link className="text-link" href="/">Return home</Link>
        </div>
      </main>
    );
  }

  return (
    <ClerkProvider appearance={{ variables: { colorWarning: "#fff4ef" } }}>
      <main className="legal-page" id="main-content">
        <div className="legal-shell auth-card">
          <Link className="brand" href="/"><span className="brand-mark" />KeepMe</Link>
          <span className="section-kicker">Retailer access</span>
          <h1>Sign in to your integrity workspace</h1>
          <p>Retailer data is isolated by organization. Shopper images are never shown in this console.</p>
          <SignIn routing="path" path="/signin" fallbackRedirectUrl={safeCallbackUrl} />
          <Link className="text-link" href="/">Return home</Link>
        </div>
      </main>
    </ClerkProvider>
  );
}
