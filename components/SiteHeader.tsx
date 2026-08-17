import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { liveTryOnStatus } from "@/lib/runtime-capabilities";

export function SiteHeader({ studio = false }: { studio?: boolean }) {
  const liveModeAvailable = liveTryOnStatus().available;
  return (
    <header className={studio ? "studio-header-wrap" : undefined}>
      <div className="container site-header">
        <Link className="brand" href="/" aria-label="KeepMe home" prefetch={false}>
          <span className="brand-mark" aria-hidden="true" />
          KeepMe
        </Link>
        <nav className="nav" aria-label="Primary navigation">
          <Link className="nav-link" href="/#how-it-works" prefetch={false}>How it works</Link>
          <Link className="nav-link" href="/#why" prefetch={false}>Why KeepMe</Link>
          <Link className="nav-link" href="/dashboard" prefetch={false}>For retailers</Link>
        </nav>
        <div className="header-actions">
          <span className="demo-pill"><span className="dot" /> {liveModeAvailable ? studio ? "YouCam connected" : "Live YouCam" : "Controlled demo"}</span>
          {!studio && <Link className="btn btn-primary" href="/studio" prefetch={false}>Try it safely <ArrowUpRight size={16} /></Link>}
        </div>
      </div>
    </header>
  );
}
