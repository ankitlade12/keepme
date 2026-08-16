import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function SiteHeader({ studio = false }: { studio?: boolean }) {
  const youCamConnected = Boolean(process.env.YOUCAM_API_KEY);
  return (
    <header className={studio ? "studio-header-wrap" : undefined}>
      <div className="container site-header">
        <Link className="brand" href="/" aria-label="KeepMe home">
          <span className="brand-mark" aria-hidden="true" />
          KeepMe
        </Link>
        <nav className="nav" aria-label="Primary navigation">
          <Link className="nav-link" href="/#how-it-works">How it works</Link>
          <Link className="nav-link" href="/#why">Why KeepMe</Link>
          <Link className="nav-link" href="/dashboard">For retailers</Link>
        </nav>
        <div className="header-actions">
          <span className="demo-pill"><span className="dot" /> {youCamConnected ? studio ? "YouCam connected" : "Live YouCam" : "Controlled demo"}</span>
          {!studio && <Link className="btn btn-primary" href="/studio">Try it safely <ArrowUpRight size={16} /></Link>}
        </div>
      </div>
    </header>
  );
}
