"use client";
import { useState } from "react";
import type { Product, Source } from "@/lib/asshown/policy";
export function SourceReview({
  product,
  onChange,
}: {
  product: Product;
  onChange: (sources: Source[]) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <section className="as-panel">
      <details>
        <summary>Review and correct source use</summary>
        <p className="as-muted">
          Original wording stays visible. Exclude a mistaken transcription or
          wrong-variant statement with a reason; current findings will be
          recalculated. Saved snapshots keep their historical version.
        </p>
        <label className="as-field">
          Reason for changing source use
          <input
            value={reason}
            maxLength={1000}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {product.sources.map((source) => (
          <article className="as-notice" key={source.id}>
            <strong>
              {source.kind} · {source.variant}
            </strong>
            <p>{source.text}</p>
            <p className="as-muted">
              {source.excluded
                ? "Excluded from current findings"
                : "Included when variant-matched"}
              {source.communityId
                ? ` · Community status: ${source.communityStatus ?? "unavailable"}`
                : ""}
            </p>
            {source.correctionReason && (
              <p>Review reason: {source.correctionReason}</p>
            )}
            <button
              className="as-secondary"
              disabled={reason.trim().length < 5}
              onClick={() =>
                onChange(
                  product.sources.map((s) =>
                    s.id === source.id
                      ? {
                          ...s,
                          excluded: !s.excluded,
                          correctionReason: reason,
                        }
                      : s,
                  ),
                )
              }
            >
              {source.excluded
                ? "Restore source use"
                : "Exclude source from findings"}
            </button>
          </article>
        ))}
      </details>
    </section>
  );
}
