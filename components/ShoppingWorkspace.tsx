"use client";
import { AccountMenu } from "./AccountMenu";
import Link from "next/link";
import { refreshCommunityEvidence } from "@/lib/asshown/community-evidence";
import { SourceReview } from "./SourceReview";
import { PrivateEvidenceLibrary } from "./PrivateEvidenceLibrary";
import { readImage } from "@/lib/asshown/client-image";
import { EvidencePackage } from "./EvidencePackage";
import { VisualReviewPanel } from "./VisualReviewPanel";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ClipboardList,
  Download,
  History,
  ListChecks,
  LockKeyhole,
  MessageSquareText,
  Plus,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  defaults,
  evaluate,
  outcome,
  sellerQuestion,
  decisionRecord,
  variant,
  productSchema,
  requirementSchema,
  type Product,
  type Requirement,
  type Source,
} from "@/lib/asshown/policy";
import type { WorkspaceSnapshot } from "@/lib/asshown/workspace";
import { examples } from "@/lib/asshown/examples";
import { z } from "zod";
import {
  AccountPanel,
  CommunityPanel,
  SupportPanel,
  LanguagePanel,
} from "./WorkspaceServices";

type View =
  | "check"
  | "shortlist"
  | "history"
  | "profiles"
  | "arrival"
  | "community"
  | "privacy";
type Saved = WorkspaceSnapshot["history"][number];
const blank = {
  title: "",
  brand: "",
  retailer: "",
  sku: "",
  color: "",
  size: "",
  text: "",
  confirmed: false,
};
const options: Record<string, string[]> = {
  care: ["machine wash"],
  sleeves: ["long sleeves", "short sleeves", "sleeveless"],
  pockets: ["functional pockets"],
  closure: ["zipper", "buttons", "no buttons", "no small buttons"],
  material: ["100% cotton", "100% linen"],
  price: [],
  custom: [],
};
const stateLabels = {
  supported: "Source-supported",
  conflicts: "Requirement conflict",
  unknown: "Still unknown",
  "conflicting evidence": "Sources disagree",
};
function download(name: string, content: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ShoppingWorkspace({
  liveAvailable,
  accountAvailable = false,
}: {
  liveAvailable: boolean;
  accountAvailable?: boolean;
}) {
  const [view, setView] = useState<View>("check"),
    [step, setStep] = useState(0),
    [products, setProducts] = useState<Product[]>([]),
    [requirements, setRequirements] = useState<Requirement[]>(defaults),
    [version, setVersion] = useState(1),
    [selected, setSelected] = useState(""),
    [draft, setDraft] = useState(blank),
    [images, setImages] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [reply, setReply] = useState(""),
    [question, setQuestion] = useState(""),
    [attribute, setAttribute] = useState<Requirement["attribute"]>("care"),
    [value, setValue] = useState("machine wash"),
    [history, setHistory] = useState<Saved[]>([]),
    [profiles, setProfiles] = useState<
      Array<{ name: string; requirements: Requirement[] }>
    >([]),
    [profileName, setProfileName] = useState(""),
    [deleteOpen, setDeleteOpen] = useState(false),
    [arrival, setArrival] = useState(""),
    [arrivalConfirmed, setArrivalConfirmed] = useState(false),
    [deliveredColor, setDeliveredColor] = useState(""),
    [deliveredSize, setDeliveredSize] = useState(""),
    [note, setNote] = useState(""),
    [notes, setNotes] = useState<
      Array<{ id: string; text: string; variant: string; date: string }>
    >([]),
    [consent, setConsent] = useState(false);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (deleteOpen) deleteDialog.current?.showModal();
    else deleteDialog.current?.close();
  }, [deleteOpen]);
  const expires = useRef(0);
  const initialized = useRef(false);
  useEffect(() => {
    fetch("/api/asshown/workspace").catch(() => {});
  }, []);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    expires.current = Date.now() + 30 * 60 * 1000;
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    // Restore browser-only navigation after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v === "shortlist" || v === "privacy") setView(v);
    try {
      const raw = sessionStorage.getItem("asshown-work");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.expires > Date.now()) {
          expires.current = saved.expires;
          setProducts(
            refreshCommunityEvidence(
              z.array(productSchema).parse(saved.products),
              [],
            ),
          );
          setRequirements(z.array(requirementSchema).parse(saved.requirements));
          setVersion(saved.version);
          setSelected(saved.selected);
          setHistory(saved.history ?? []);
          setProfiles(saved.profiles ?? []);
          setNotes(saved.notes ?? []);
        }
      }
    } catch {
      setMessage(
        "The previous session could not be restored. Start a new check.",
      );
    }
    if (params.has("example")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("example");
      window.history.replaceState(window.history.state, "", url);
      setProducts(examples());
      setSelected("example-rust");
      setStep(2);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(
        "asshown-work",
        JSON.stringify({
          products: products.map((p) => ({
            ...p,
            image:
              p.image?.startsWith("/demo/") || p.assetIds?.length
                ? p.image
                : undefined,
            images: undefined,
          })),
          requirements,
          version,
          selected,
          history,
          profiles,
          notes,
          expires: expires.current,
        }),
      );
    } catch {
      // Report an external browser-storage failure.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("Browser storage is full. Export your decision before leaving.");
    }
  }, [
    products,
    requirements,
    version,
    selected,
    history,
    profiles,
    notes,
    ready,
  ]);
  const product = products.find((p) => p.id === selected) ?? products[0];
  const privateLibrary = product ? (
    <PrivateEvidenceLibrary
      key={`library:${product.id}`}
      productId={product.id}
      variant={variant(product)}
      onText={(asset, text) => {
        if (product.sources.length >= 20) {
          setError(
            "This item already has 20 sources. Export it before starting another check.",
          );
          return;
        }
        const source: Source = {
          id: crypto.randomUUID(),
          kind:
            asset.kind === "seller reply"
              ? "seller reply"
              : asset.kind === "product photo"
                ? "seller listing"
                : "user observation",
          text,
          date: new Date().toISOString(),
          variant: asset.variant,
        };
        setProducts(
          products.map((p) =>
            p.id === product.id ? { ...p, sources: [...p.sources, source] } : p,
          ),
        );
        setMessage(
          "Reviewed transcription added with its source variant. Findings updated.",
        );
      }}
      onUse={(asset) => {
        if (asset.kind !== "product photo") {
          setMessage(
            "Use saved receipt or delivery evidence in the evidence package below.",
          );
          return;
        }
        setProducts(
          products.map((p) =>
            p.id === product.id
              ? {
                  ...p,
                  assetIds: [
                    asset.id,
                    ...(p.assetIds ?? []).filter((id) => id !== asset.id),
                  ].slice(0, 3),
                  image: asset.url,
                }
              : p,
          ),
        );
        setMessage(
          "Saved product photo attached. Save your workspace to keep this association across devices.",
        );
      }}
    />
  ) : null;
  const findings = product ? evaluate(product, requirements) : [];
  const linkedSources = products
    .flatMap((p) =>
      p.sources.flatMap((s) => (s.communityId ? [s.communityId] : [])),
    )
    .sort()
    .join(",");
  useEffect(() => {
    if (!linkedSources) return;
    let active = true;
    async function refresh() {
      try {
        const r = await fetch("/api/asshown/community");
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (active)
          setProducts((current) =>
            refreshCommunityEvidence(current, data.published),
          );
      } catch {
        if (active)
          setProducts((current) => refreshCommunityEvidence(current, []));
      }
    }
    void refresh();
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, [linkedSources]);
  function navigate(v: View) {
    setView(v);
    setMessage("");
    setError("");
  }
  function revise(next: Requirement[]) {
    setRequirements(next);
    setVersion((n) => n + 1);
    setMessage(
      "Requirements updated. All current findings were reevaluated; saved reports retain their original version.",
    );
  }
  function loadExamples() {
    setProducts(examples());
    setSelected("example-rust");
    setStep(2);
    setView("check");
    setMessage(
      "Illustrative listings and synthetic assets loaded. These are not real retailer claims.",
    );
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    setError("");
    try {
      if (files.length > 3)
        throw new Error("Select up to three product images.");
      setImages(await Promise.all(Array.from(files).map(readImage)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function addProduct() {
    if (products.length >= 3) {
      setError(
        "Compare up to three items. Remove an item before adding another.",
      );
      return;
    }
    if (
      !draft.title.trim() ||
      !draft.text.trim() ||
      !draft.confirmed ||
      !draft.color.trim() ||
      !draft.size.trim()
    ) {
      setError(
        "Add a title, listing text, color, and size, then confirm the exact variant.",
      );
      return;
    }
    const id = crypto.randomUUID(),
      date = new Date().toISOString();
    const p: Product = {
      id,
      title: draft.title.trim(),
      brand: draft.brand,
      retailer: draft.retailer,
      sku: draft.sku,
      color: draft.color,
      size: draft.size,
      confirmed: true,
      decision: "undecided",
      image: images[0],
      images: [...images],
      sources: [
        {
          id: crypto.randomUUID(),
          kind: "seller listing",
          text: draft.text,
          date,
          variant: variant(draft),
        },
      ],
    };
    setProducts([...products, p]);
    setSelected(id);
    setStep(1);
    setDraft(blank);
    setImages([]);
    setError("");
  }
  function addRequirement() {
    if (requirements.length >= 5) {
      setError("Use up to five requirements so your essentials stay clear.");
      return;
    }
    if (!value.trim()) {
      setError("Describe the requirement first.");
      return;
    }
    revise([
      ...requirements,
      {
        id: crypto.randomUUID(),
        attribute,
        value: value.trim(),
        wording:
          attribute === "price" ? `Item price at most $${value}` : value.trim(),
        importance: "essential",
      },
    ]);
  }
  function record() {
    const data = decisionRecord(products, requirements, version);
    setHistory((h) => [
      { id: crypto.randomUUID(), date: data.createdAt, data },
      ...h,
    ]);
    setMessage(
      "An immutable decision report was saved for this browser session. Photos are omitted.",
    );
  }
  function addReply() {
    if (!product || !reply.trim()) return;
    const source: Source = {
      id: crypto.randomUUID(),
      kind: "seller reply",
      text: reply,
      date: new Date().toISOString(),
      variant: variant(product),
    };
    setProducts(
      products.map((p) =>
        p.id === product.id ? { ...p, sources: [...p.sources, source] } : p,
      ),
    );
    setReply("");
    setMessage(
      "Seller reply added. Previous statements remain visible; affected findings have been reevaluated.",
    );
  }
  function setDecision(decision: Product["decision"]) {
    if (product)
      setProducts(
        products.map((p) => (p.id === product.id ? { ...p, decision } : p)),
      );
    setMessage("Your next action was recorded.");
  }
  function exportText() {
    const data = decisionRecord(products, requirements, version);
    download(
      "AsShown-decision.txt",
      `AsShown decision report\n${data.createdAt}\nRequirement version ${version}\n\n${data.products.map((p) => `${p.title} — ${variant(p)}\n${p.outcome}\n${p.findings.map((f) => `${f.requirement.wording}: ${f.state}\n${f.claims.map((c) => `  ${c.source.kind}: “${c.quote}” (${c.source.date})`).join("\n")}`).join("\n")}\n`).join("\n")}\n${data.photoStatus}\n${data.limitation}`,
      "text/plain",
    );
  }
  const nav = [
    { id: "check", label: "Check an item", icon: ScanLine },
    { id: "shortlist", label: "Your shortlist", icon: ListChecks },
    { id: "history", label: "Saved checks", icon: History },
    { id: "profiles", label: "Your requirements", icon: Settings2 },
    { id: "arrival", label: "Arrival check", icon: ClipboardList },
    { id: "community", label: "Product notes", icon: MessageSquareText },
    { id: "privacy", label: "Privacy & data", icon: LockKeyhole },
  ] as const;
  return (
    <div className="as-work">
      <header className="as-work-header">
        <Link className="brand" href="/">
          <span className="brand-mark" />
          AsShown
        </Link>
        {accountAvailable && <AccountMenu />}
        <div>
          <small>YOUR REQUIREMENTS. A CLEARER CHOICE.</small>
          <span className="as-status">
            Private workspace · guest restore 30 min
          </span>
        </div>
      </header>
      <div className="as-app-grid">
        <aside className="as-sidebar">
          <p>YOUR WORKSPACE</p>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
          <div className="as-side-note">
            <ShieldCheck size={20} />
            <p>A good decision starts with knowing what you don’t know.</p>
            <Link href="/studio" className="as-quiet-link">
              YouCam preview studio ↗
            </Link>
          </div>
        </aside>
        <main className="as-content" id="main-content">
          <div className="as-page-title">
            <div>
              <span className="as-kicker">A LITTLE MORE CLARITY</span>
              <h1>{nav.find((n) => n.id === view)?.label}</h1>
              <p>
                {view === "check"
                  ? "Paste the details. Add photos. Check what matters."
                  : "Your shopping decisions, with the details kept in view."}
              </p>
            </div>
            <button className="as-secondary" onClick={loadExamples}>
              <Sparkles size={15} /> Explore example
            </button>
          </div>
          {error && (
            <div role="alert" className="as-notice error">
              {error}
            </div>
          )}
          {message && (
            <div role="status" className="as-notice">
              {message}
            </div>
          )}
          {view === "check" && (
            <>
              <div className="as-tabs">
                {[
                  "Add your item",
                  "Your requirements",
                  "Evidence & decision",
                  "YouCam preview",
                ].map((s, i) => (
                  <button
                    key={s}
                    className={step === i ? "active" : ""}
                    onClick={() => setStep(i)}
                  >
                    {i + 1}. {s}
                  </button>
                ))}
              </div>
              {step === 0 && (
                <div className="as-two">
                  <section className="as-panel">
                    <h2>What caught your eye?</h2>

                    <p className="as-muted">
                      Paste the exact listing. We’ll keep seller statements
                      separate from what remains unknown.
                    </p>
                    <label className="as-field">
                      Item name
                      <input
                        maxLength={150}
                        value={draft.title}
                        onChange={(e) =>
                          setDraft({ ...draft, title: e.target.value })
                        }
                        placeholder="e.g. Everyday utility jacket"
                      />
                    </label>
                    <div className="as-form-grid">
                      {(
                        ["brand", "retailer", "sku", "color", "size"] as const
                      ).map((k) => (
                        <label className="as-field" key={k}>
                          {k[0].toUpperCase() + k.slice(1)}
                          {k === "brand" || k === "retailer"
                            ? " (optional)"
                            : ""}
                          <input
                            maxLength={80}
                            value={draft[k]}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                [k]: e.target.value,
                                confirmed: false,
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <label className="as-field">
                      Listing text
                      <textarea
                        maxLength={12000}
                        value={draft.text}
                        onChange={(e) =>
                          setDraft({ ...draft, text: e.target.value })
                        }
                        placeholder="Include care, fabric, sleeves, closures, pockets, and price if supplied."
                      />
                    </label>
                    <label className="as-checkbox">
                      <input
                        type="checkbox"
                        checked={draft.confirmed}
                        onChange={(e) =>
                          setDraft({ ...draft, confirmed: e.target.checked })
                        }
                      />
                      I confirm this text and these images describe the color
                      and size above.
                    </label>
                    <button
                      className="as-primary"
                      disabled={busy}
                      onClick={addProduct}
                    >
                      Confirm sources <ArrowRight size={16} />
                    </button>
                  </section>
                  <div>
                    <section className="as-panel">
                      <h2>Add product photos</h2>
                      <p className="as-muted">
                        Optional for text checks. Upload 1–3 JPEG or PNG files,
                        up to 10 MB and 20 megapixels each.
                      </p>
                      <label className="as-upload">
                        <Upload size={25} />
                        {busy ? "Reading images…" : "Choose product photos"}
                        <input
                          className="sr-only"
                          type="file"
                          multiple
                          accept="image/png,image/jpeg"
                          onChange={(e) => upload(e.target.files)}
                        />
                      </label>
                      <div className="as-image-strip">
                        {images.map((s, i) => (
                          <img
                            key={i}
                            src={s}
                            alt={`Product source ${i + 1}`}
                          />
                        ))}
                      </div>
                      <p className="as-muted">
                        Photos stay in memory and are omitted after refresh. An
                        explicit preview handoff transfers the selected garment
                        to the studio. Nothing is sent to YouCam here.
                      </p>
                    </section>
                    <section className="as-panel">
                      <span className="as-kicker">NO SELFIE REQUIRED</span>
                      <h2 style={{ marginTop: 14 }}>
                        Useful before the preview.
                      </h2>
                      <p className="as-muted">
                        Care instructions can rule out a garment. A missing
                        pocket detail can tell you what to ask. Start there.
                      </p>
                      <button
                        className="as-quiet-link as-icon-btn"
                        onClick={loadExamples}
                      >
                        Try the two-item example →
                      </button>
                    </section>
                  </div>
                </div>
              )}
              {step === 1 && (
                <section className="as-panel">
                  <h2>What does it need to do for you?</h2>
                  <LanguagePanel
                    text={requirements.map((r) => r.wording).join(". ")}
                    onInterpret={(next) => revise(next)}
                  />
                  <p className="as-muted">
                    Essentials are firm constraints. Preferences never override
                    them. Version {version}.
                  </p>
                  {requirements.map((r) => (
                    <div className="as-require-row" key={r.id}>
                      <div>
                        <b>{r.wording}</b>
                        <small>
                          {r.attribute} · interpreted as “{r.value}”
                        </small>
                      </div>
                      <select
                        aria-label={`Importance for ${r.wording}`}
                        value={r.importance}
                        onChange={(e) =>
                          revise(
                            requirements.map((x) =>
                              x.id === r.id
                                ? {
                                    ...x,
                                    importance: e.target
                                      .value as Requirement["importance"],
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        <option value="essential">Essential</option>
                        <option value="preferred">Preferred</option>
                      </select>
                      <button
                        className="as-icon-btn"
                        aria-label={`Remove ${r.wording}`}
                        onClick={() =>
                          revise(requirements.filter((x) => x.id !== r.id))
                        }
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <div className="as-form-grid" style={{ marginTop: 25 }}>
                    <label className="as-field">
                      Attribute
                      <select
                        value={attribute}
                        onChange={(e) => {
                          const a = e.target.value as Requirement["attribute"];
                          setAttribute(a);
                          setValue(options[a][0] ?? "");
                        }}
                      >
                        {Object.keys(options).map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </label>
                    <label className="as-field">
                      Your requirement
                      {options[attribute].length ? (
                        <select
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                        >
                          {options[attribute].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          maxLength={200}
                          placeholder={
                            attribute === "price"
                              ? "USD item-price limit"
                              : "Your original wording"
                          }
                        />
                      )}
                    </label>
                  </div>
                  {attribute === "closure" && value === "no small buttons" && (
                    <p className="as-notice warning">
                      “No small buttons” is distinct from “no buttons.” Button
                      size needs direct confirmation and will remain unknown.
                    </p>
                  )}
                  <div className="as-row-actions">
                    <button className="as-secondary" onClick={addRequirement}>
                      <Plus size={15} /> Add requirement
                    </button>
                    <button className="as-primary" onClick={() => setStep(2)}>
                      Check requirements <ArrowRight size={16} />
                    </button>
                  </div>
                </section>
              )}
              {step === 2 &&
                (product ? (
                  <>
                    <div className="as-tabs">
                      {products.map((p) => (
                        <button
                          className={product.id === p.id ? "active" : ""}
                          key={p.id}
                          onClick={() => {
                            setSelected(p.id);
                            setQuestion("");
                            setReply("");
                          }}
                        >
                          {p.title}
                        </button>
                      ))}
                      <button onClick={() => setStep(0)}>+ Add item</button>
                    </div>
                    <div className="as-two">
                      <div>
                        <section className="as-panel">
                          <div className="as-product-card">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={`Original product source: ${product.title}`}
                              />
                            ) : (
                              <div
                                className="as-preview-box"
                                style={{ minHeight: 130 }}
                              >
                                <ScanLine />
                              </div>
                            )}
                            <div>
                              <span className="as-kicker">
                                {product.brand || "YOUR ITEM"}
                              </span>
                              <h2>{product.title}</h2>
                              <p className="as-muted">
                                {variant(product)} ·{" "}
                                {product.retailer || "User-supplied listing"}
                              </p>
                              <details>
                                <summary className="as-muted">
                                  Correct this variant
                                </summary>
                                <div className="as-form-grid">
                                  {(["color", "size"] as const).map((k) => (
                                    <label className="as-field" key={k}>
                                      {k}
                                      <input
                                        value={product[k]}
                                        maxLength={80}
                                        onChange={(e) =>
                                          setProducts(
                                            products.map((p) =>
                                              p.id === product.id
                                                ? {
                                                    ...p,
                                                    [k]: e.target.value,
                                                    confirmed: false,
                                                  }
                                                : p,
                                            ),
                                          )
                                        }
                                      />
                                    </label>
                                  ))}
                                </div>
                                <label className="as-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={product.confirmed}
                                    onChange={(e) =>
                                      setProducts(
                                        products.map((p) =>
                                          p.id === product.id
                                            ? {
                                                ...p,
                                                confirmed: e.target.checked,
                                              }
                                            : p,
                                        ),
                                      )
                                    }
                                  />
                                  Confirm this variant. Earlier sources keep
                                  their original variant and cannot silently
                                  apply here.
                                </label>
                              </details>
                              <span
                                className={`as-status ${outcome(findings) === "Essential conflict" ? "conflicts" : "unknown"}`}
                              >
                                {outcome(findings)}
                              </span>
                            </div>
                          </div>
                          {product.images && product.images.length > 1 && (
                            <div className="as-image-strip">
                              {product.images.map((src, i) => (
                                <img
                                  key={i}
                                  src={src}
                                  alt={`Original product source ${i + 1}`}
                                />
                              ))}
                            </div>
                          )}
                          {findings.map((f) => (
                            <article
                              className="as-evidence"
                              key={f.requirement.id}
                            >
                              <div className="as-evidence-top">
                                <h3>{f.requirement.wording}</h3>
                                <span className={`as-status ${f.state}`}>
                                  {stateLabels[f.state]}
                                </span>
                              </div>
                              <p>{f.reason}</p>
                              <details>
                                <summary>
                                  {f.claims.length
                                    ? `Inspect ${f.claims.length} source statement${f.claims.length > 1 ? "s" : ""}`
                                    : "What evidence is missing?"}
                                </summary>
                                {f.claims.length ? (
                                  f.claims.map((c, i) => (
                                    <blockquote key={i}>
                                      “{c.quote}”
                                      <small>
                                        {c.source.kind} · {c.source.variant} ·{" "}
                                        {new Date(
                                          c.source.date,
                                        ).toLocaleDateString()}{" "}
                                        · characters {c.start}–{c.end}
                                      </small>
                                      <small>
                                        Original text: {c.source.text}
                                      </small>
                                    </blockquote>
                                  ))
                                ) : (
                                  <p>
                                    Request a direct statement about{" "}
                                    {f.requirement.wording.toLowerCase()} for
                                    this exact variant. A generated image is not
                                    proof.
                                  </p>
                                )}
                              </details>
                            </article>
                          ))}
                        </section>
                      </div>
                      <div>
                        <section className="as-panel">
                          <span className="as-kicker">
                            YOUR NEXT BEST QUESTION
                          </span>
                          <h2 style={{ marginTop: 12 }}>
                            Resolve the decisive unknown.
                          </h2>
                          <label className="as-field">
                            Editable seller question
                            <textarea
                              value={
                                question || sellerQuestion(product, findings)
                              }
                              onChange={(e) => setQuestion(e.target.value)}
                            />
                          </label>
                          <button
                            className="as-secondary"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  question || sellerQuestion(product, findings),
                                );
                                setMessage(
                                  "Copied. Nothing was sent to the seller.",
                                );
                              } catch {
                                setError(
                                  "Clipboard unavailable. Select the question text and copy it.",
                                );
                              }
                            }}
                          >
                            <MessageSquareText size={15} /> Copy question
                          </button>
                          <label className="as-field" style={{ marginTop: 25 }}>
                            Paste the seller’s reply
                            <textarea
                              maxLength={12000}
                              value={reply}
                              onChange={(e) => setReply(e.target.value)}
                              placeholder="Replies remain seller-reported evidence."
                            />
                          </label>
                          <button
                            className="as-secondary"
                            disabled={!reply.trim()}
                            onClick={addReply}
                          >
                            Add reply as evidence
                          </button>
                        </section>
                        <section className="as-panel">
                          <h2>Your next step</h2>
                          <p className="as-muted">
                            Current choice: {product.decision}. You stay in
                            control, including when an essential conflicts.
                          </p>
                          <div className="as-row-actions">
                            <button
                              className="as-primary"
                              onClick={() => setDecision("shortlist")}
                            >
                              Keep on shortlist
                            </button>
                            <button
                              className="as-secondary"
                              onClick={() => setDecision("information")}
                            >
                              Need information
                            </button>
                            <button
                              className="as-secondary"
                              onClick={() => setDecision("removed")}
                            >
                              Remove from shortlist
                            </button>
                          </div>
                          <div className="as-row-actions">
                            <button
                              className="as-quiet-link as-icon-btn"
                              onClick={() => setStep(3)}
                            >
                              Optional YouCam preview →
                            </button>
                          </div>
                        </section>
                      </div>
                    </div>
                  </>
                ) : (
                  <Empty onStart={() => setStep(0)} />
                ))}
              {step === 3 && (
                <div className="as-two">
                  <section className="as-panel">
                    <span className="as-kicker">POWERED BY YOUCAM</span>
                    <h2 style={{ marginTop: 15 }}>
                      See the look. Keep the context.
                    </h2>
                    <p className="as-muted">
                      The preview studio uses YouCam AI Clothes v3 with an
                      explicit appearance contract. Product suitability, garment
                      checks, and personal appearance checks remain separate.
                    </p>
                    <div className="as-notice warning">
                      A preview cannot prove fit, comfort, fabric composition,
                      opacity, or functional pockets.
                    </div>
                    <h3>Before you continue</h3>
                    <p className="as-muted">
                      Your selected garment is passed to the configured live
                      studio. Choose your photo, review protected regions, and
                      approve processing there. Personal photos go to Perfect
                      Corp’s YouCam only after that approval. Your product
                      evidence remains in this tab.
                    </p>
                    <p className="as-notice">
                      {liveAvailable
                        ? "The live provider is configured. The studio will validate your uploads before generation."
                        : "Live generation is not configured on this installation. The studio offers a clearly labeled controlled example; it is not a live API result."}
                    </p>
                    <button
                      className="as-primary"
                      onClick={() => {
                        if (liveAvailable && product?.image)
                          sessionStorage.setItem(
                            "asshown-preview-garment",
                            JSON.stringify({
                              image: product.image,
                              title: product.title,
                            }),
                          );
                        window.location.assign("/studio");
                      }}
                    >
                      Open preview studio <ArrowUpRight size={16} />
                    </button>
                    <p className="as-muted">
                      Garment-attribute verification is not yet evaluated and
                      must remain unchecked. Inherited appearance checks require
                      their integrity service.
                    </p>
                  </section>
                  <section className="as-panel">
                    <div className="as-preview-box">
                      <img
                        src="/demo/youcam-live-tryon.jpg"
                        alt="Previously recorded YouCam result with a synthetic sample shopper"
                      />
                    </div>
                    <p className="as-muted">
                      Recorded example · synthetic shopper · not your item or a
                      fresh generation.
                    </p>
                  </section>
                </div>
              )}
            </>
          )}
          {view === "shortlist" &&
            (products.filter((p) => p.decision !== "removed").length ? (
              <>
                <section className="as-panel">
                  <h2>Compare the details, not just the look.</h2>
                  <p className="as-muted">
                    All items use requirement version {version}. Tax and
                    shipping are unknown; listed prices are not all-in totals.
                  </p>
                  <div className="as-table-wrap">
                    <table className="as-table">
                      <thead>
                        <tr>
                          <th>Your requirements</th>
                          {products
                            .filter((p) => p.decision !== "removed")
                            .map((p) => (
                              <th key={p.id}>
                                {p.image && (
                                  <img
                                    src={p.image}
                                    alt={`Product source: ${p.title}`}
                                  />
                                )}
                                <b>{p.title}</b>
                                <p>{variant(p)}</p>
                                <span className="as-status unknown">
                                  {outcome(evaluate(p, requirements))}
                                </span>
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {requirements.map((r) => (
                          <tr key={r.id}>
                            <th>
                              {r.wording}
                              <p className="as-muted">{r.importance}</p>
                            </th>
                            {products
                              .filter((p) => p.decision !== "removed")
                              .map((p) => (
                                <td key={p.id}>
                                  <span
                                    className={`as-status ${evaluate(p, requirements).find((f) => f.requirement.id === r.id)!.state}`}
                                  >
                                    {
                                      stateLabels[
                                        evaluate(p, requirements).find(
                                          (f) => f.requirement.id === r.id,
                                        )!.state
                                      ]
                                    }
                                  </span>
                                </td>
                              ))}
                          </tr>
                        ))}
                        <tr>
                          <th>Preview integrity</th>
                          {products
                            .filter((p) => p.decision !== "removed")
                            .map((p) => (
                              <td key={p.id}>
                                Not assessed in this comparison
                              </td>
                            ))}
                        </tr>
                        <tr>
                          <th>Inspect the decision</th>
                          {products
                            .filter((p) => p.decision !== "removed")
                            .map((p) => (
                              <td key={p.id}>
                                <button
                                  className="as-secondary"
                                  onClick={() => {
                                    setSelected(p.id);
                                    setQuestion("");
                                    setReply("");
                                    setStep(2);
                                    setView("check");
                                  }}
                                >
                                  View evidence
                                </button>
                              </td>
                            ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
                <div className="as-row-actions">
                  <button className="as-primary" onClick={record}>
                    <Check size={16} /> Approve & save report
                  </button>
                  <button className="as-secondary" onClick={exportText}>
                    <Download size={16} /> Readable report
                  </button>
                  <button
                    className="as-secondary"
                    onClick={() =>
                      download(
                        "AsShown-decision.json",
                        JSON.stringify(
                          decisionRecord(products, requirements, version),
                          null,
                          2,
                        ),
                      )
                    }
                  >
                    Export JSON
                  </button>
                </div>
              </>
            ) : (
              <Empty
                onStart={() => {
                  setView("check");
                  setStep(0);
                }}
              />
            ))}
          {view === "check" && step === 2 && privateLibrary}
          {view === "check" && step === 2 && product && (
            <SourceReview
              product={product}
              onChange={(sources) =>
                setProducts(
                  products.map((p) =>
                    p.id === product.id ? { ...p, sources } : p,
                  ),
                )
              }
            />
          )}
          {view === "history" && (
            <>
              <AccountPanel
                value={{
                  products: products.map((p) => ({
                    ...p,
                    image: undefined,
                    images: undefined,
                  })),
                  requirements,
                  version,
                  profiles,
                  history,
                }}
                onLoad={(data) => {
                  setProducts(
                    data.products.map((p) => ({
                      ...p,
                      image: p.assetIds?.[0]
                        ? `/api/asshown/assets/${p.assetIds[0]}`
                        : undefined,
                      images: p.assetIds?.map(
                        (id) => `/api/asshown/assets/${id}`,
                      ),
                    })),
                  );
                  setRequirements(data.requirements);
                  setVersion(data.version);
                  setProfiles(data.profiles);
                  setHistory(data.history);
                  setMessage("Saved account workspace loaded.");
                }}
              />
              <section className="as-panel">
                <h2>Snapshots, not rewritten history.</h2>
                <p className="as-muted">
                  Guest reports last for this browser session. Export to keep a
                  copy. Photos are omitted.
                </p>
                {history.length ? (
                  history.map((h) => (
                    <div className="as-history as-evidence" key={h.id}>
                      <div>
                        <h3>
                          {h.data.products.map((p) => p.title).join(" + ")}
                        </h3>
                        <p>
                          {new Date(h.date).toLocaleString()} · requirement
                          version {h.data.requirementVersion}
                        </p>
                      </div>
                      <div className="as-row-actions">
                        <button
                          className="as-secondary"
                          onClick={() =>
                            download(
                              "AsShown-snapshot.json",
                              JSON.stringify(h.data, null, 2),
                            )
                          }
                        >
                          Export
                        </button>
                        <button
                          className="as-icon-btn"
                          aria-label="Delete saved report"
                          onClick={() =>
                            setHistory(history.filter((x) => x.id !== h.id))
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="as-muted">
                    No saved decisions yet. Review your shortlist, then approve
                    a report.
                  </p>
                )}
              </section>
            </>
          )}
          {view === "profiles" && (
            <section className="as-panel">
              <h2>Requirements for your everyday.</h2>
              <p className="as-muted">
                Save a named set for this guest session. Applying it creates a
                new version; past decisions stay unchanged.
              </p>
              <label className="as-field">
                Profile name
                <input
                  value={profileName}
                  maxLength={80}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g. Work clothing"
                />
              </label>
              <button
                className="as-primary"
                disabled={!profileName.trim()}
                onClick={() => {
                  setProfiles([
                    ...profiles,
                    {
                      name: profileName.trim(),
                      requirements: structuredClone(requirements),
                    },
                  ]);
                  setProfileName("");
                }}
              >
                Save current requirements
              </button>
              {profiles.map((p, i) => (
                <div className="as-evidence" key={i}>
                  <label className="as-field">
                    Profile name
                    <input
                      value={p.name}
                      maxLength={80}
                      onChange={(e) =>
                        setProfiles(
                          profiles.map((x, n) =>
                            n === i ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <p>{p.requirements.map((r) => r.wording).join(" · ")}</p>
                  <div className="as-row-actions">
                    <button
                      className="as-secondary"
                      onClick={() => {
                        revise(structuredClone(p.requirements));
                        setView("check");
                        setStep(1);
                      }}
                    >
                      Apply & review
                    </button>
                    <button
                      className="as-secondary"
                      onClick={() =>
                        setProfiles(profiles.filter((_, n) => n !== i))
                      }
                    >
                      Delete profile
                    </button>
                    <button
                      className="as-secondary"
                      onClick={() =>
                        setProfiles(
                          profiles.map((x, n) =>
                            n === i
                              ? {
                                  ...x,
                                  requirements: structuredClone(requirements),
                                }
                              : x,
                          ),
                        )
                      }
                    >
                      Replace with current requirements
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}
          {view === "arrival" && (
            <>
              {privateLibrary}
              <VisualReviewPanel
                key={`arrival:${product?.id}`}
                source={product?.image}
                kind="arrival"
              />
              {product && (
                <EvidencePackage key={product.id} product={product} />
              )}
              <section className="as-panel">
                <span className="as-kicker">PRIVATE ARRIVAL REVIEW</span>
                <h2 style={{ marginTop: 12 }}>
                  Compare with the listing—not the preview.
                </h2>
                {product ? (
                  <>
                    <label className="as-field">
                      Purchased item
                      <select
                        value={product.id}
                        onChange={(e) => {
                          setSelected(e.target.value);
                          setArrivalConfirmed(false);
                          setDeliveredColor("");
                          setDeliveredSize("");
                        }}
                      >
                        {products.map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.title} · {variant(p)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="as-form-grid">
                      <label className="as-field">
                        Delivered color (from label/order)
                        <input
                          value={deliveredColor}
                          maxLength={80}
                          onChange={(e) => {
                            setDeliveredColor(e.target.value);
                            setArrivalConfirmed(false);
                          }}
                        />
                      </label>
                      <label className="as-field">
                        Delivered size (from label/order)
                        <input
                          value={deliveredSize}
                          maxLength={40}
                          onChange={(e) => {
                            setDeliveredSize(e.target.value);
                            setArrivalConfirmed(false);
                          }}
                        />
                      </label>
                    </div>
                    {deliveredColor &&
                      deliveredSize &&
                      (deliveredColor.trim().toLowerCase() !==
                        product.color.trim().toLowerCase() ||
                        deliveredSize.trim().toLowerCase() !==
                          product.size.trim().toLowerCase()) && (
                        <p className="as-notice warning">
                          These details differ from the checked variant. A
                          comparison cannot establish a seller discrepancy until
                          you review the order and acknowledge this mismatch.
                        </p>
                      )}
                    <label className="as-checkbox">
                      <input
                        disabled={
                          !deliveredColor.trim() || !deliveredSize.trim()
                        }
                        type="checkbox"
                        checked={arrivalConfirmed}
                        onChange={(e) => setArrivalConfirmed(e.target.checked)}
                      />
                      I reviewed the delivered color and size against{" "}
                      {variant(product)} and acknowledge any mismatch shown
                      above.
                    </label>
                    <blockquote className="as-notice">
                      Original listing: {product.sources[0]?.text}
                    </blockquote>
                    <label className="as-field">
                      Your observations
                      <textarea
                        value={arrival}
                        maxLength={12000}
                        onChange={(e) => setArrival(e.target.value)}
                        placeholder="Describe what you can directly observe. Avoid treating lighting differences as a confirmed color defect."
                      />
                    </label>
                    <p className="as-muted">
                      Manual review only. Automated arrival-image comparison is
                      not validated. This draft makes no claim about refunds or
                      return eligibility.
                    </p>
                    <button
                      className="as-primary"
                      disabled={!arrivalConfirmed || !arrival.trim()}
                      onClick={() =>
                        download(
                          "seller-message.txt",
                          `Hello, I’d like to clarify details of ${product.title} (${variant(product)}).\n\nThe listing states:\n${product.sources[0]?.text}\n\nDelivered variant I supplied: ${deliveredColor} / ${deliveredSize}\n\nMy observations:\n${arrival}\n\nCould you help clarify these differences?\n\nDraft prepared by AsShown. Review before sending.`,
                          "text/plain",
                        )
                      }
                    >
                      Export editable seller-message draft{" "}
                      <Download size={15} />
                    </button>
                  </>
                ) : (
                  <p className="as-muted">
                    Add a product first to preserve its original listing and
                    variant.
                  </p>
                )}
              </section>
            </>
          )}
          {view === "community" && (
            <>
              <CommunityPanel
                product={product}
                onUse={(note) => {
                  if (!product || product.sources.length >= 20) {
                    setError("Choose an item with room for another source.");
                    return;
                  }
                  const source: Source = {
                    id: crypto.randomUUID(),
                    kind: "community report",
                    text: note.text,
                    date: note.date,
                    variant: `${note.color} / ${note.size}`,
                    communityId: note.id,
                    communityStatus: "published",
                  };
                  setProducts((current) =>
                    refreshCommunityEvidence(
                      current.map((p) =>
                        p.id === product.id
                          ? { ...p, sources: [...p.sources, source] }
                          : p,
                      ),
                      [note],
                    ),
                  );
                  setMessage(
                    "Linked contributor report. It will stop supporting current findings if disputed, withdrawn, unavailable, or no longer matched to this item.",
                  );
                }}
              />
              <section className="as-panel">
                <span className="as-kicker">PRODUCT NOTES</span>
                <h2 style={{ marginTop: 12 }}>
                  Useful details deserve good evidence.
                </h2>
                <div className="as-notice warning">
                  Public publication is not enabled. Notes stay private in this
                  guest session until moderation and redaction controls are
                  ready.
                </div>
                {product ? (
                  <>
                    <p className="as-muted">
                      Item: {product.title} · {variant(product)}. Do not include
                      addresses, names, order numbers, personal photos, or
                      unsupported seller accusations.
                    </p>
                    <label className="as-field">
                      Your product-only observation
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
                      I reviewed this text and it contains only product details
                      for the variant shown.
                    </label>
                    <button
                      className="as-primary"
                      disabled={!note.trim() || !consent}
                      onClick={() => {
                        if (
                          /\b\S+@\S+\.\S+\b|\b\d{3}[-. ]\d{3}[-. ]\d{4}\b|\b\d+\s+[^\n,]{0,40}\b(?:street|st|road|rd|avenue|ave)\b/i.test(
                            note,
                          )
                        ) {
                          setError(
                            "Possible personal information detected. Remove it and review again.",
                          );
                          return;
                        }
                        setNotes([
                          ...notes,
                          {
                            id: crypto.randomUUID(),
                            text: note,
                            variant: variant(product),
                            date: new Date().toISOString(),
                          },
                        ]);
                        setNote("");
                        setConsent(false);
                      }}
                    >
                      Save private note
                    </button>
                  </>
                ) : (
                  <p className="as-muted">
                    Add an item before writing a variant-specific note.
                  </p>
                )}
                {notes.map((n) => (
                  <article className="as-evidence" key={n.id}>
                    <span className="as-status">
                      Private contributor report
                    </span>
                    <p>{n.text}</p>
                    <small>
                      {n.variant} · {new Date(n.date).toLocaleDateString()}
                    </small>
                    <div>
                      <button
                        className="as-icon-btn as-quiet-link"
                        onClick={() =>
                          setNotes(notes.filter((x) => x.id !== n.id))
                        }
                      >
                        Withdraw note
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            </>
          )}
          {view === "privacy" && (
            <>
              <SupportPanel />
              <section className="as-panel">
                <h2>Your data, explained plainly.</h2>
                <p className="as-muted">
                  Product text, requirements, reports, profiles, and private
                  notes are stored in this tab’s session storage with a
                  30-minute restore window. Product images are kept in memory
                  and omitted on refresh. This is not authenticated cross-device
                  history.
                </p>
                <p className="as-muted">
                  The separate YouCam studio has its own session and deletion
                  controls. Deleting this workspace does not delete studio
                  assets or promise deletion from Perfect Corp. Use the studio’s
                  delete action for those assets.
                </p>
                <div className="as-notice">
                  No product notes are public. Nothing is sent to sellers. No
                  personal photo is required for the evidence workspace.
                </div>
                <div className="as-row-actions">
                  <button
                    className="as-secondary"
                    onClick={() =>
                      download(
                        "AsShown-data.json",
                        JSON.stringify(
                          {
                            decision: decisionRecord(
                              products,
                              requirements,
                              version,
                            ),
                            history,
                            profiles,
                            notes,
                          },
                          null,
                          2,
                        ),
                      )
                    }
                  >
                    <Download size={16} /> Export workspace data
                  </button>
                  <button
                    className="as-secondary"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 size={16} /> Delete workspace data
                  </button>
                </div>
                <p>
                  <Link
                    className="as-quiet-link"
                    href="/studio"
                    target="_blank"
                  >
                    Open studio deletion controls ↗
                  </Link>
                </p>
              </section>
            </>
          )}
        </main>
      </div>
      {deleteOpen && (
        <dialog
          className="as-modal"
          ref={deleteDialog}
          onCancel={() => setDeleteOpen(false)}
          aria-labelledby="delete-title"
        >
          <h2 id="delete-title">Delete this workspace?</h2>
          <p className="as-muted">
            This removes product text, images in memory, requirements, saved
            reports, profiles, and private notes from this tab. The separate
            preview studio must be deleted there.
          </p>
          <div className="as-row-actions">
            <button
              autoFocus
              className="as-secondary"
              onClick={() => setDeleteOpen(false)}
            >
              Keep my workspace
            </button>
            <button
              className="as-primary"
              onClick={() => {
                sessionStorage.removeItem("asshown-work");
                setProducts([]);
                setRequirements(defaults);
                setHistory([]);
                setProfiles([]);
                setNotes([]);
                setImages([]);
                setDraft(blank);
                setVersion(1);
                setProfileName("");
                setArrivalConfirmed(false);
                setConsent(false);
                setReply("");
                setQuestion("");
                setArrival("");
                setNote("");
                setSelected("");
                setDeleteOpen(false);
                setMessage("Workspace data deleted.");
              }}
            >
              Delete workspace
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
function Empty({ onStart }: { onStart: () => void }) {
  return (
    <section className="as-panel as-empty">
      <ClipboardList size={35} />
      <h2>A clearer decision starts with an item.</h2>
      <p>Add a product listing or explore the example.</p>
      <button className="as-primary" onClick={onStart}>
        Add your first item <Plus size={16} />
      </button>
    </section>
  );
}
