"use client";

import { useRouter } from "next/navigation";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  return <html lang="en"><body><main className="deletion-panel" style={{ minHeight: "100vh", display: "grid", placeContent: "center" }}><span className="eyebrow">KeepMe paused safely</span><h2>The application could not continue.</h2><p>No additional generation was submitted. Retry from a clean render or return to the home page.</p><div className="studio-actions" style={{ justifyContent: "center" }}><button className="btn btn-secondary" onClick={() => router.push("/")}>Return home</button><button className="btn btn-primary" onClick={reset}>Try again</button></div></main></body></html>;
}
