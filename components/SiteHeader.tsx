import { clerkConfigured } from "@/lib/clerk-config";
import { AccountMenu } from "./AccountMenu";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { liveTryOnStatus } from "@/lib/runtime-capabilities";

export function SiteHeader({ studio = false }: { studio?: boolean }) {
  const liveModeAvailable = liveTryOnStatus().available;
  return (
    <header className={studio ? "studio-header-wrap" : undefined}>
      <div className="container site-header">
        <Link
          className="brand"
          href="/"
          aria-label="AsShown home"
          prefetch={false}
        >
          <span className="brand-mark" aria-hidden="true" />
          AsShown
        </Link>
        <nav className="nav" aria-label="Primary navigation">
          <Link className="nav-link" href="/#how-it-works" prefetch={false}>
            How it works
          </Link>
          <Link
            className="nav-link"
            href="/check?view=shortlist"
            prefetch={false}
          >
            Shortlist
          </Link>
          <Link
            className="nav-link"
            href="/check?view=privacy"
            prefetch={false}
          >
            Your privacy
          </Link>
        </nav>
        <div className="header-actions">
          {clerkConfigured() && <AccountMenu />}
          <span className="demo-pill">
            <span className="dot" />{" "}
            {liveModeAvailable
              ? studio
                ? "YouCam configured"
                : "Live YouCam"
              : "YouCam preview studio"}
          </span>
          {!studio && (
            <Link className="btn btn-primary" href="/check" prefetch={false}>
              Check an item <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
