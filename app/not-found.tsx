import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="deletion-panel" style={{ minHeight: "100vh", display: "grid", placeContent: "center" }}>
      <div className="deletion-icon"><SearchX size={34} /></div>
      <span className="eyebrow">404 · Not found</span>
      <h2>This page slipped out of frame.</h2>
      <p>The page does not exist, but your private try-on can start from a clean session.</p>
      <div className="studio-actions" style={{ justifyContent: "center" }}><Link className="btn btn-secondary" href="/">Return home</Link><Link className="btn btn-primary" href="/studio">Start safe try-on</Link></div>
    </main>
  );
}
