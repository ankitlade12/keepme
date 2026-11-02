import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { clerkConfigured } from "@/lib/clerk-config";
export default function SignUpPage() {
  return (
    <main className="legal-page" id="main-content">
      <div className="legal-shell auth-card">
        <Link className="brand" href="/">
          AsShown
        </Link>
        <h1>Your decisions, in one place</h1>
        <p>
          Create an account to keep private evidence, reuse your requirements
          and contribute reviewed product notes.
        </p>
        {clerkConfigured() ? (
          <SignUp
            routing="path"
            path="/signup"
            signInUrl="/signin"
            fallbackRedirectUrl="/check"
          />
        ) : (
          <p>
            Account creation is currently unavailable. Guest checks remain
            available.
          </p>
        )}
      </div>
    </main>
  );
}
