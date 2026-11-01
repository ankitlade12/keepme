"use client";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
export function AccountSessionGuard({ children }: { children: ReactNode }) {
  const { isLoaded, user } = useUser();
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const current = user?.id ?? "guest",
        previous = sessionStorage.getItem("asshown-owner");
      sessionStorage.setItem("asshown-owner", current);
      if (previous && previous !== "guest" && previous !== current) {
        for (const key of [
          "asshown-work",
          "asshown-preview-garment",
          "keepme-session-id",
        ])
          sessionStorage.removeItem(key);
        window.location.reload();
      }
    } catch {
      /* Browser storage may be disabled; server authorization still applies. */
    }
  }, [isLoaded, user?.id]);
  return children;
}
export function AccountMenu() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded)
    return (
      <span className="as-muted" aria-label="Loading account">
        Account
      </span>
    );
  return isSignedIn ? (
    <UserButton />
  ) : (
    <Link className="nav-link" href="/signin">
      Sign in
    </Link>
  );
}
