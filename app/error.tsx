"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="deletion-panel" style={{ minHeight: "100vh", display: "grid", placeContent: "center" }}>
      <div className="deletion-icon" style={{ background: "var(--clay-soft)", color: "var(--clay)" }}><AlertTriangle size={34} /></div>
      <span className="eyebrow">KeepMe paused safely</span>
      <h2>Something interrupted this session.</h2>
      <p>Your contract was not expanded and no duplicate generation was submitted. Try again, or return home.</p>
      <div className="studio-actions" style={{ justifyContent: "center" }}><Link className="btn btn-secondary" href="/" prefetch={false}>Return home</Link><button className="btn btn-primary" onClick={() => retry()}>Try again</button></div>
    </main>
  );
}
