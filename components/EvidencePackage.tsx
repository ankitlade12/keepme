"use client";
import { PrivateEvidenceLibrary } from "./PrivateEvidenceLibrary";
import { useRef, useState, useEffect } from "react";
import { type Product, variant } from "@/lib/asshown/policy";
import { readImage } from "@/lib/asshown/client-image";
import {
  evidencePackage,
  type EvidenceAttachment,
} from "@/lib/asshown/evidence-package";
export function EvidencePackage({ product }: { product: Product }) {
  const [files, setFiles] = useState<EvidenceAttachment[]>([]);
  const [kind, setKind] =
    useState<EvidenceAttachment["kind"]>("delivered photo");
  const [message, setMessage] = useState(
    `Hello, I’d like to clarify details of ${product.title} (${variant(product)}).\n\nMy observations:\n\nCould you help clarify these differences?`,
  );
  const [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function add(input: HTMLInputElement) {
    const incoming = Array.from(input.files ?? []);
    input.value = "";
    if (files.length + incoming.length > 6) {
      setStatus("Keep at most six attachments per package.");
      return;
    }
    setBusy(true);
    setReviewed(false);
    try {
      const additions: EvidenceAttachment[] = [];
      for (const file of incoming)
        additions.push({
          id: crypto.randomUUID(),
          name: file.name,
          kind,
          image: await readImage(file),
          selected: false,
          note: "",
        });
      if (active.current) {
        setFiles((previous) => [...previous, ...additions]);
        setStatus(
          "Added privately. Select each attachment you want to include.",
        );
      }
    } catch (error) {
      if (active.current)
        setStatus(
          error instanceof Error ? error.message : "Could not read attachment.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  }
  function exportPackage() {
    try {
      const html = evidencePackage(product, message, files);
      const url = URL.createObjectURL(
        new Blob([html], { type: "text/html;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "asshown-evidence-package.html";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(
        "Downloaded a self-contained package. Open it to review or print to PDF; nothing was sent.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed.");
    }
  }
  return (
    <section className="as-panel">
      <details>
        <summary>Choose evidence saved in your account</summary>
        <PrivateEvidenceLibrary
          productId={product.id}
          variant={variant(product)}
          onUse={async (asset) => {
            if (files.length >= 6) {
              setStatus("Keep at most six attachments.");
              return;
            }
            try {
              const r = await fetch(asset.url);
              if (!r.ok)
                throw new Error("Saved evidence is no longer available.");
              const blob = await r.blob();
              const image = await readImage(
                new File([blob], asset.kind, { type: blob.type }),
              );
              setFiles((old) => [
                ...old,
                {
                  id: crypto.randomUUID(),
                  name: asset.kind,
                  kind: asset.kind,
                  image,
                  selected: false,
                  note: asset.note,
                },
              ]);
              setReviewed(false);
              setStatus(
                "Saved evidence added privately. Select it before exporting.",
              );
            } catch (e) {
              setStatus((e as Error).message);
            }
          }}
        />
      </details>
      <span className="as-kicker">PRIVATE EVIDENCE PACKAGE</span>
      <h2>Include the details you choose</h2>
      <p className="as-muted">Attachments clear when you leave or refresh.</p>
      <label className="as-field">
        Attachment type
        <select
          value={kind}
          onChange={(e) =>
            setKind(e.target.value as EvidenceAttachment["kind"])
          }
        >
          <option>delivered photo</option>
          <option>receipt</option>
          <option>seller reply</option>
        </select>
      </label>
      <label className="as-field">
        Add JPEG or PNG images (six maximum, 10 MB each)
        <input
          type="file"
          accept="image/jpeg,image/png"
          multiple
          disabled={busy || files.length >= 6}
          onChange={(e) => void add(e.currentTarget)}
        />
      </label>
      {files.map((file) => (
        <fieldset
          key={file.id}
          style={{
            margin: "16px 0",
            border: "1px solid #cbbfd1",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <legend>
            {file.kind}: {file.name}
          </legend>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={file.image}
            alt={file.note || `Attached ${file.kind}`}
            style={{ maxWidth: "100%", maxHeight: 240, objectFit: "contain" }}
          />
          <label className="as-field">
            Describe what this shows
            <textarea
              value={file.note}
              maxLength={2000}
              onChange={(e) => {
                setReviewed(false);
                setFiles(
                  files.map((f) =>
                    f.id === file.id ? { ...f, note: e.target.value } : f,
                  ),
                );
              }}
            />
          </label>
          <label className="as-checkbox">
            <input
              type="checkbox"
              checked={file.selected}
              onChange={(e) => {
                setReviewed(false);
                setFiles(
                  files.map((f) =>
                    f.id === file.id ? { ...f, selected: e.target.checked } : f,
                  ),
                );
              }}
            />
            Include this attachment in the download
          </label>
          <button
            className="as-secondary"
            onClick={() => {
              setReviewed(false);
              setFiles(files.filter((f) => f.id !== file.id));
            }}
          >
            Remove {file.name}
          </button>
        </fieldset>
      ))}
      <label className="as-field">
        Editable seller message
        <textarea
          rows={6}
          value={message}
          maxLength={12000}
          onChange={(e) => {
            setMessage(e.target.value);
            setReviewed(false);
          }}
        />
      </label>
      <p className="as-notice">
        Redact private details before attaching. Exports include original images
        and metadata.
      </p>
      <label className="as-checkbox">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        I reviewed the selected images, original listing evidence and message
        for private information and accuracy.
      </label>
      <button
        className="as-primary"
        disabled={busy || !reviewed || !message.trim()}
        onClick={exportPackage}
      >
        Download evidence package ({files.filter((f) => f.selected).length}{" "}
        attachments)
      </button>
      <p role="status" aria-live="polite">
        {busy ? "Reading attachments…" : status}
      </p>
    </section>
  );
}
