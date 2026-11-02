"use client";
import { useEffect, useState } from "react";
export function ProcessingControls() {
  const [paused, setPaused] = useState<boolean | null>(null),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    fetch("/api/asshown/operations")
      .then(async (r) => {
        if (!r.ok) return;
        setPaused((await r.json()).control.paused);
      })
      .catch(() => setMessage("Processing status unavailable."));
  }, []);
  return (
    <details>
      <summary>Privacy incident controls</summary>
      <p className="as-muted">
        Pause new AI requests. Submitted jobs continue; deletion and support
        remain available.
      </p>
      <p>
        New AI requests:{" "}
        {paused === null ? "loading" : paused ? "paused" : "enabled"}
      </p>
      <label className="as-field">
        Incident or resolution reason
        <textarea
          value={reason}
          maxLength={1000}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <button
        className="as-secondary"
        disabled={paused === null || reason.trim().length < 10}
        onClick={async () => {
          const r = await fetch("/api/asshown/operations", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paused: !paused, reason }),
          });
          const d = await r.json();
          if (r.ok) {
            setPaused(d.paused);
            setReason("");
            setMessage("Processing control updated with an audit entry.");
          } else setMessage(d.error);
        }}
      >
        {paused ? "Resume new AI requests" : "Pause new AI requests"}
      </button>
      <p role="status">{message}</p>
    </details>
  );
}
