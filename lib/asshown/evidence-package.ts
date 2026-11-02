import { type Product, variant } from "./policy";
export type EvidenceAttachment = {
  id: string;
  name: string;
  kind: "receipt" | "delivered photo" | "seller reply" | "product photo";
  image: string;
  selected: boolean;
  note: string;
};
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function evidencePackage(
  product: Product,
  message: string,
  attachments: EvidenceAttachment[],
) {
  const selected = attachments.filter((a) => a.selected);
  if (
    selected.some(
      (a) => !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(a.image),
    )
  )
    throw new Error("Only validated JPEG and PNG evidence can be exported.");
  const e = escapeHtml;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>AsShown evidence package</title><style>body{font:17px/1.6 system-ui;max-width:800px;margin:40px auto;padding:20px;color:#252032;background:#fff}img{max-width:100%;max-height:700px;object-fit:contain}pre{white-space:pre-wrap;font:inherit}figure{margin:32px 0;border-top:1px solid #bbb;padding-top:20px}small{color:#62566d}@media print{figure{break-inside:avoid}}</style><h1>${e(product.title)}</h1><p>${e(variant(product))}</p><small>Prepared ${e(new Date().toISOString())}. User-reviewed draft; no automated authenticity, fit, refund or defect determination.</small><h2>Message draft</h2><pre>${e(message)}</pre><h2>Original listing evidence</h2>${product.sources.map((s) => `<section><h3>${e(s.kind)}</h3><p>${e(s.date)} · ${e(s.variant)}</p><pre>${e(s.text)}</pre></section>`).join("")}<h2>Selected attachments (${selected.length})</h2>${selected.map((a) => `<figure><figcaption><strong>${e(a.kind)}: ${e(a.name)}</strong><p>${e(a.note)}</p></figcaption><img src="${a.image}" alt="${e(a.note || a.kind)}"></figure>`).join("")}<p>Nothing was sent automatically. This file contains only the attachments selected by its author. Keep private until reviewed.</p></html>`;
}
