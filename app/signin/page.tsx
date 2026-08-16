import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const session = await auth();
  const { callbackUrl = "/dashboard" } = await searchParams;
  if (session?.user) redirect(callbackUrl.startsWith("/") ? callbackUrl : "/dashboard");
  const configured = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
  return (
    <main className="legal-page">
      <div className="legal-shell auth-card">
        <Link className="brand" href="/"><span className="brand-mark" />KeepMe</Link>
        <span className="section-kicker">Retailer access</span>
        <h1>Sign in to your integrity workspace</h1>
        <p>Retailer data is isolated by organization. Shopper images are never shown in this console.</p>
        {configured ? (
          <form action={async () => { "use server"; await signIn("github", { redirectTo: callbackUrl.startsWith("/") ? callbackUrl : "/dashboard" }); }}>
            <button className="btn btn-primary" type="submit">Continue with GitHub</button>
          </form>
        ) : <div className="legal-notice">Authentication is available after the production GitHub OAuth credentials are configured.</div>}
        <Link className="text-link" href="/">Return home</Link>
      </div>
    </main>
  );
}
