import { SignIn } from "@clerk/nextjs";
import Link from "@/components/NoPrefetchLink";
import { clerkConfigured } from "@/lib/clerk-config";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl = "/check" } = await searchParams;
  const safeCallbackUrl =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/check";

  if (!clerkConfigured()) {
    return (
      <main className="legal-page" id="main-content">
        <div className="legal-shell auth-card">
          <Link className="brand" href="/">
            <span className="brand-mark" />
            AsShown
          </Link>
          <span className="section-kicker">Saved shopping decisions</span>
          <h1>Account sign-in is not configured</h1>
          <p>
            The account service has not been connected here yet. You can still
            use the private guest workspace and export your decisions.
          </p>
          <Link className="text-link" href="/">
            Return home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="legal-page" id="main-content">
        <div className="legal-shell auth-card">
          <Link className="brand" href="/">
            <span className="brand-mark" />
            AsShown
          </Link>
          <span className="section-kicker">Saved shopping decisions</span>
          <h1>Keep your decisions with you</h1>
          <p>
            Save your requirements, decision history, and contributions in your
            own account. Personal-photo sharing stays a separate choice.
          </p>
          <SignIn
            routing="path"
            path="/signin"
            fallbackRedirectUrl={safeCallbackUrl}
          />
          <Link className="text-link" href="/">
            Return home
          </Link>
        </div>
      </main>
    </>
  );
}
