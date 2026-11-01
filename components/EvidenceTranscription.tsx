"use client";
import { useState } from "react";
import type { SavedEvidence } from "./PrivateEvidenceLibrary";
export function EvidenceTranscription({
  asset,
  onConfirm,
}: {
  asset: SavedEvidence;
  onConfirm?: (text: string) => void;
}) {
  const [text, setText] = useState(""),
    [consent, setConsent] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function extract() {
    setBusy(true);
    setReviewed(false);
    try {
      const r = await fetch("/api/asshown/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id, consent: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setText(d.text);
      setMessage(
        d.uncertainties.join(" · ") ||
          "Compare every statement with the original before confirming.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Read text from this evidence</summary>
      <p className="as-muted">
        Copy visible wording manually, or request an editable AI transcription.
        An image alone does not prove fabric, fit or function.
      </p>
      <label className="as-checkbox">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        Allow this saved image to be processed by the AI service for text
        extraction.
      </label>
      <button
        className="as-secondary"
        disabled={!consent || busy}
        onClick={extract}
      >
        {busy ? "Reading text…" : "Extract visible text"}
      </button>
      <label className="as-field">
        Reviewed transcription
        <textarea
          maxLength={12000}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setReviewed(false);
          }}
        />
      </label>
      <label className="as-checkbox">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        I compared this text with the original and corrected mistakes.
      </label>
      {onConfirm && (
        <button
          className="as-secondary"
          disabled={!reviewed || !text.trim()}
          onClick={() => {
            onConfirm(text);
            setMessage(
              "Added as reviewed evidence. The original image remains unchanged.",
            );
          }}
        >
          Add reviewed text to this item
        </button>
      )}
      <p role="status">{message}</p>
    </details>
  );
}
