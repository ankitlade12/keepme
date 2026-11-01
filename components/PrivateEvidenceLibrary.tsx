"use client";
import { EvidenceTranscription } from "./EvidenceTranscription";
import Link from "next/link";
import { useEffect, useState } from "react";
export type SavedEvidence = {
  id: string;
  productId: string;
  variant: string;
  kind: "product photo" | "receipt" | "delivered photo" | "seller reply";
  note: string;
  createdAt: string;
  expiresAt?: string;
  url: string;
  sha256: string;
};
export function PrivateEvidenceLibrary({
  productId,
  variant,
  onUse,
  onText,
}: {
  productId: string;
  variant: string;
  onUse?: (asset: SavedEvidence) => void;
  onText?: (asset: SavedEvidence, text: string) => void;
}) {
  const [assets, setAssets] = useState<SavedEvidence[]>([]),
    [signedOut, setSignedOut] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [kind, setKind] = useState<SavedEvidence["kind"]>("product photo"),
    [note, setNote] = useState("");
  async function reload() {
    const r = await fetch("/api/asshown/assets");
    if (r.status === 401) {
      setSignedOut(true);
      return;
    }
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? "Evidence library is unavailable.");
    setSignedOut(false);
    setAssets(d.assets.filter((a: SavedEvidence) => a.productId === productId));
  }
  useEffect(() => {
    let active = true;
    fetch("/api/asshown/assets")
      .then(async (r) => {
        if (!active) return;
        if (r.status === 401) {
          setSignedOut(true);
          return;
        }
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Evidence library unavailable.");
        if (active)
          setAssets(
            d.assets.filter((a: SavedEvidence) => a.productId === productId),
          );
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [productId]);
  async function save() {
    if (!file || !consent) return;
    setBusy(true);
    try {
      const form = new FormData();
      for (const [key, value] of Object.entries({
        productId,
        variant,
        kind,
        note,
        consent: "true",
      }))
        form.set(key, value);
      form.set("image", file);
      const r = await fetch("/api/asshown/assets", {
        method: "POST",
        body: form,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setFile(null);
      setConsent(false);
      await reload();
      setMessage("Original evidence saved privately to your account.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="as-panel">
      <span className="as-kicker">YOUR PRIVATE EVIDENCE</span>
      <h2>Keep the original, with the item</h2>
      <p className="as-muted">
        Save product photos, receipts and seller replies for {variant}.
        Originals remain private to your account for 30 days, unless you renew
        or delete them. They are never published to the community automatically.
      </p>
      {signedOut ? (
        <Link className="as-secondary" href="/signin?callbackUrl=/check">
          Sign in to save evidence across devices
        </Link>
      ) : (
        <>
          <label className="as-field">
            Evidence type
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as SavedEvidence["kind"])}
            >
              <option>product photo</option>
              <option>receipt</option>
              <option>delivered photo</option>
              <option>seller reply</option>
            </select>
          </label>
          <label className="as-field">
            Original JPEG or PNG (4 MB maximum)
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => {
                const next = e.target.files?.[0];
                if (next && next.size > 4 * 1024 * 1024) {
                  setFile(null);
                  setMessage(
                    "Private originals must be 4 MB or smaller. Keep larger originals on your device.",
                  );
                  return;
                }
                setFile(next ?? null);
                setConsent(false);
              }}
            />
          </label>
          <label className="as-field">
            Evidence description
            <textarea
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <label className="as-checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Save this original and a processing copy privately in my account for
            30 days. I have permission to use this image.
          </label>
          <button
            className="as-primary"
            disabled={busy || !file || !consent}
            onClick={save}
          >
            {busy ? "Saving securely…" : "Save private evidence"}
          </button>
          {assets.map((asset) => (
            <article key={asset.id} className="as-notice">
              <strong>{asset.kind}</strong>
              <p>{asset.note || "No description added."}</p>
              <p className="as-muted">
                {asset.variant} ·{" "}
                {new Date(asset.createdAt).toLocaleDateString()}
              </p>
              {asset.expiresAt && (
                <p className="as-muted">
                  Private storage expires{" "}
                  {new Date(asset.expiresAt).toLocaleDateString()}
                </p>
              )}
              <div className="as-row-actions">
                <button
                  className="as-secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await fetch(asset.url, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ consent: true }),
                      });
                      if (!r.ok)
                        throw new Error("Evidence could not be renewed.");
                      await reload();
                      setMessage("Private storage renewed for 30 days.");
                    } catch (e) {
                      setMessage((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Renew private storage for 30 days
                </button>
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="as-secondary"
                >
                  View original
                </a>
                {onUse && (
                  <button
                    className="as-secondary"
                    disabled={busy}
                    onClick={() => onUse(asset)}
                  >
                    Use this evidence
                  </button>
                )}
                <button
                  className="as-secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await fetch(asset.url, { method: "DELETE" });
                      const d = await r.json();
                      await reload();
                      setMessage(r.ok ? "Evidence deleted." : d.error);
                    } catch {
                      setMessage("Deletion could not complete. Try again.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Delete evidence
                </button>
              </div>
              <EvidenceTranscription
                asset={asset}
                onConfirm={onText ? (text) => onText(asset, text) : undefined}
              />
            </article>
          ))}
          {!assets.length && (
            <p className="as-muted">No saved evidence for this item yet.</p>
          )}
        </>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
