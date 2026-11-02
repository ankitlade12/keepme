"use client";
import { useEffect, useState } from "react";
import { processingImage, dataImageFile } from "@/lib/asshown/client-image";
import { assessObservation } from "@/lib/asshown/vision";
type ReviewProps = {
  source?: string;
  initialResult?: string;
  kind: "preview" | "arrival";
};
export function VisualReviewPanel(props: ReviewProps) {
  return (
    <ReviewContent
      key={`${props.kind}:${props.source}:${props.initialResult}`}
      {...props}
    />
  );
}

function ReviewImage({ src, alt }: { src: string; alt: string }) {
  return (
    <a
      href={src}
      onClick={(event) => {
        if (!src.startsWith("data:")) return;
        event.preventDefault();
        const url = URL.createObjectURL(dataImageFile(src, "product-photo"));
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open full-size ${alt.toLowerCase()}`}
      style={{ display: "block", textAlign: "center" }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          display: "inline-block",
          maxHeight: 300,
          maxWidth: "100%",
          width: "auto",
          height: "auto",
        }}
      />
    </a>
  );
}
const attributeLabels = {
  neckline: "Collar and neckline",
  sleeves: "Sleeves",
  "large closure": "Buttons and fastenings",
};

function ReviewContent({
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
    [corrections, setCorrections] = useState(""),
    [reviewed, setReviewed] = useState(false);
  useEffect(
    () => () => {
      if (target.startsWith("blob:")) URL.revokeObjectURL(target);
    },
    [target],
  );
  async function inspect() {
    if (!source || !target) return;
    setBusy(true);
    setReviewed(false);
    setObservations([]);
    setMessage("");
    try {
      async function imageFile(url: string, name: string) {
        if (url.startsWith("data:")) return dataImageFile(url, name);
        const response = await fetch(url);
        if (!response.ok) throw new Error("An image expired. Select it again.");
        return new File([await response.blob()], name, {
          type: response.headers.get("content-type") ?? "image/jpeg",
        });
      }
      const [a, b] = await Promise.all([
        imageFile(source, "source.jpg"),
        file ?? imageFile(target, "result.jpg"),
      ]);
      const form = new FormData();
      form.append("source", a);
      form.append("result", b);
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
        AI suggestions need your review; they do not establish fit or
        suitability.
      </p>
      <div className="as-form-grid">
        <div>
          {source ? (
            <ReviewImage src={source} alt="Original product evidence" />
          ) : (
            <p className="as-notice">Add an original product photo first.</p>
          )}
          <p className="as-muted">Original product evidence</p>
        </div>
        <div>
          {target && (
            <ReviewImage
              src={target}
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
            disabled={busy}
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
              setReviewed(false);
              setCorrections("");
              setMessage("");
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
        Send these two images to OpenAI for garment review.
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
      {observations.length > 0 && (
        <p className="as-muted">
          Open either image at full size to compare the details.
        </p>
      )}
      {observations.map((o, i) => (
        <article className="as-evidence" key={i}>
          <h3>{attributeLabels[o.attribute]}</h3>
          <p>
            <strong>
              {o.status === "unassessable"
                ? "Not clearly visible"
                : o.possibleDifference
                  ? "Possible difference — review visually"
                  : "Review visually"}
            </strong>
          </p>
          <p>Product: {o.sourceDescription}</p>
          <p>
            {kind === "arrival" ? "Delivered item" : "Preview"}:{" "}
            {o.resultDescription}
          </p>
          <details>
            <summary>Uncertainty</summary>
            <p>{o.limitation}</p>
          </details>
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
          onChange={(e) => {
            setCorrections(e.target.value);
            setReviewed(false);
          }}
          placeholder="Describe what you can actually see. These notes are yours, not an automated finding."
        />
      </label>
      <label className="as-checkbox">
        <input
          type="checkbox"
          checked={reviewed}
          disabled={busy || (!corrections.trim() && !observations.length)}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        I reviewed these observations against both images and added any
        corrections.
      </label>
      <button
        className="as-secondary"
        disabled={
          busy || !reviewed || (!corrections.trim() && !observations.length)
        }
        onClick={() => {
          if (!reviewed || busy) return;
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
                    humanReviewConfirmed: true,
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
