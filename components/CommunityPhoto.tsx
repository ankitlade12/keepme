"use client";
import { useEffect, useRef, useState } from "react";
import { readImage } from "@/lib/asshown/client-image";
export function CommunityPhoto({
  onReady,
}: {
  onReady: (id: string | undefined) => void;
}) {
  const [ready, setReady] = useState(false),
    [source, setSource] = useState(""),
    [boxes, setBoxes] = useState<
      Array<{ x: number; y: number; width: number; height: number }>
    >([]),
    [box, setBox] = useState({ x: 0, y: 0, width: 25, height: 25 }),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!source) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active || !canvas.current) return;
      const c = canvas.current,
        scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      c.width = Math.round(image.width * scale);
      c.height = Math.round(image.height * scale);
      const context = c.getContext("2d")!;
      context.drawImage(image, 0, 0, c.width, c.height);
      context.fillStyle = "#1e1825";
      for (const b of boxes)
        context.fillRect(
          (b.x * c.width) / 100,
          (b.y * c.height) / 100,
          (b.width * c.width) / 100,
          (b.height * c.height) / 100,
        );
      setReady(true);
    };
    image.src = source;
    return () => {
      active = false;
    };
  }, [source, boxes]);
  async function save() {
    setBusy(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.current?.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("Could not prepare photo.")),
          "image/jpeg",
          0.92,
        ),
      );
      const form = new FormData();
      form.set(
        "image",
        new File([blob], "redacted-product.jpg", { type: "image/jpeg" }),
      );
      form.set("consent", "true");
      form.set("redactionReviewed", "true");
      const r = await fetch("/api/asshown/community-media", {
        method: "POST",
        body: form,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onReady(d.mediaId);
      setMessage(
        "Screened photo attached to this draft. Submit the report below to send it for human moderation.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Add an optional product-only photo</summary>
      <p className="as-muted">
        Product-only photos. Mask private details; only your reviewed copy is
        shared.
      </p>
      <label className="as-field">
        Product-only JPEG or PNG
        <input
          type="file"
          accept="image/jpeg,image/png"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setReady(false);
            setReviewed(false);
            onReady(undefined);
            try {
              setSource(await readImage(file));
              setBoxes([]);
            } catch (err) {
              setMessage((err as Error).message);
            }
          }}
        />
      </label>
      {source && (
        <>
          <canvas
            ref={canvas}
            role="img"
            aria-label={`Public photo preview with ${boxes.length} opaque redactions`}
            style={{ maxWidth: "100%", maxHeight: 400, objectFit: "contain" }}
          />
          <fieldset>
            <legend>Cover a private area (percent of image)</legend>
            <div className="as-form-grid">
              {(["x", "y", "width", "height"] as const).map((key) => (
                <label key={key} className="as-field">
                  {key}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={box[key]}
                    onChange={(e) =>
                      setBox({ ...box, [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className="as-secondary"
              disabled={
                busy ||
                box.width <= 0 ||
                box.height <= 0 ||
                Object.values(box).some((v) => !Number.isFinite(v) || v < 0) ||
                box.x + box.width > 100 ||
                box.y + box.height > 100
              }
              onClick={() => {
                setReady(false);
                setBoxes([...boxes, box]);
                setReady(false);
                setReviewed(false);
                onReady(undefined);
              }}
            >
              Apply opaque redaction
            </button>
            <button
              type="button"
              className="as-secondary"
              disabled={busy || !boxes.length}
              onClick={() => {
                setReady(false);
                setBoxes(boxes.slice(0, -1));
                setReady(false);
                setReviewed(false);
                onReady(undefined);
              }}
            >
              Undo last redaction
            </button>
          </fieldset>
          <p>
            {boxes.length} area(s) masked. Review the whole image; automated
            screening can miss people or private details.
          </p>
          <label className="as-checkbox">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => {
                setReviewed(e.target.checked);
                if (!e.target.checked) onReady(undefined);
              }}
            />
            I own or may share this product-only photo, reviewed every
            redaction, and consent to publish this copy only after moderation.
          </label>
          <button
            type="button"
            className="as-secondary"
            disabled={!reviewed || busy || !ready}
            onClick={save}
          >
            {busy ? "Screening photo…" : "Attach reviewed photo to draft"}
          </button>
        </>
      )}
      <p role="status">{message}</p>
    </details>
  );
}
