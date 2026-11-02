"use client";
import { useEffect, useState } from "react";
import { processingImage } from "@/lib/asshown/client-image";
import { assessObservation } from "@/lib/asshown/vision";
export function VisualReviewPanel({
  source,
  initialResult,
  kind,
}: {
  source?: string;
  initialResult?: string;
  kind: "preview" | "arrival";
}) {
  const [file, setFile] = useState<File | null>(null),
    [target, setTarget] = useState(initialResult ?? ""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [observations, setObservations] = useState<
      Array<ReturnType<typeof assessObservation>>
    >([]),
    [corrections, setCorrections] = useState("");
  useEffect(
    () => () => {
      if (target.startsWith("blob:")) URL.revokeObjectURL(target);
    },
    [target],
  );
  async function inspect() {
    if (!source || !target) return;
    setBusy(true);
    try {
      const [a, b] = await Promise.all([fetch(source), fetch(target)]);
      if (!a.ok || !b.ok) throw new Error("An image expired. Select it again.");
      const form = new FormData();
      form.append(
        "source",
        new File([await a.blob()], "source.jpg", {
          type: a.headers.get("content-type") ?? "image/jpeg",
        }),
      );
      form.append(
        "result",
        file ??
          new File([await b.blob()], "result.jpg", {
            type: b.headers.get("content-type") ?? "image/jpeg",
          }),
      );
      for (const key of ["source", "result"])
        form.set(key, await processingImage(form.get(key) as File));
      form.append("kind", kind);
      form.append("consent", String(consent));
      await fetch("/api/asshown/workspace");
      const response = await fetch("/api/asshown/vision", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setObservations(data.observations);
      setMessage(data.limitation);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="as-panel">
      <h2>
        {kind === "arrival"
          ? "Review the delivered item"
          : "Review garment details separately"}
      </h2>
      <p className="as-muted">
        Compare the original product photograph with{" "}
        {kind === "arrival" ? "the delivered item" : "the preview"}. AI
        suggestions are unvalidated and require your review. Appearance
        integrity does not establish garment suitability.
      </p>
      <div className="as-form-grid">
        <div>
          {source ? (
            <img
              src={source}
              style={{ height: 230, width: "100%", objectFit: "contain" }}
              alt="Original product evidence"
            />
          ) : (
            <p className="as-notice">Add an original product photo first.</p>
          )}
          <p className="as-muted">Original product evidence</p>
        </div>
        <div>
          {target && (
            <img
              src={target}
              style={{ height: 230, width: "100%", objectFit: "contain" }}
              alt={
                kind === "arrival"
                  ? "Delivered item for comparison"
                  : "Generated preview for comparison"
              }
            />
          )}
          <p className="as-muted">
            {kind === "arrival"
              ? "Delivered item — user supplied"
              : "AI-generated preview"}
          </p>
        </div>
      </div>
      {kind === "arrival" && (
        <label className="as-field">
          Delivered-item photograph
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => {
              const next = e.target.files?.[0];
              if (
                next &&
                (!["image/jpeg", "image/png"].includes(next.type) ||
                  next.size > 10 * 1024 * 1024)
              ) {
                setMessage("Choose a JPEG or PNG of 10 MB or less.");
                return;
              }
              setFile(next ?? null);
              setTarget(next ? URL.createObjectURL(next) : "");
              setConsent(false);
              setObservations([]);
            }}
          />
        </label>
      )}
      <label className="as-checkbox">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        Send these two images directly to OpenAI for this visual review. This is
        separate from YouCam generation. Do not include receipts or personal
        information.
      </label>
      <button
        className="as-secondary"
        disabled={!consent || !source || !target || busy}
        onClick={inspect}
      >
        {busy
          ? "Inspecting visible details…"
          : "Suggest visible garment observations"}
      </button>
      {observations.map((o, i) => (
        <article className="as-evidence" key={i}>
          <h3>
            {o.attribute} · {o.status}
          </h3>
          <p>Source: {o.sourceDescription}</p>
          <p>Comparison: {o.resultDescription}</p>
          <p>{o.limitation}</p>
          <small>
            Source region:{" "}
            {o.sourceRegion ? JSON.stringify(o.sourceRegion) : "not located"} ·
            Comparison region:{" "}
            {o.resultRegion ? JSON.stringify(o.resultRegion) : "not located"}
          </small>
        </article>
      ))}
      {message && (
        <p role="status" className="as-notice warning">
          {message}
        </p>
      )}
      <label className="as-field" style={{ marginTop: 20 }}>
        Your corrections or manual observations
        <textarea
          value={corrections}
          maxLength={2000}
          onChange={(e) => setCorrections(e.target.value)}
          placeholder="Describe what you can actually see. These notes are yours, not an automated finding."
        />
      </label>
      <button
        className="as-secondary"
        disabled={!corrections.trim() && !observations.length}
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob(
              [
                JSON.stringify(
                  {
                    kind,
                    source: "Original product evidence",
                    target:
                      kind === "preview" ? "AI preview" : "Delivered item",
                    observations,
                    corrections,
                    automatedVerification: "not validated",
                    date: new Date().toISOString(),
                  },
                  null,
                  2,
                ),
              ],
              { type: "application/json" },
            ),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = "AsShown-visual-review.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        Export reviewed observations
      </button>
    </section>
  );
}
