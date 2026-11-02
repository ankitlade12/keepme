"use client";
import { ProcessingControls } from "./ProcessingControls";
import { CommunityPhoto } from "./CommunityPhoto";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { type Product, type Requirement } from "@/lib/asshown/policy";
import {
  workspaceSchema,
  type WorkspaceSnapshot,
} from "@/lib/asshown/workspace";
import type { Contribution } from "@/lib/asshown/community";
import { personalInfo } from "@/lib/asshown/community";
async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/asshown/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "Request could not complete.");
  return data;
}
export function AccountPanel({
  value,
  onLoad,
}: {
  value: WorkspaceSnapshot;
  onLoad: (data: WorkspaceSnapshot) => void;
}) {
  const [account, setAccount] = useState<{
      accountAvailable: boolean;
      signedIn: boolean;
      workspace: { data: unknown; revision: number } | null;
    } | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("workspace")
      .then(setAccount)
      .catch((e) => setMessage(e.message));
  }, []);
  async function save() {
    setBusy(true);
    try {
      const result = await api("workspace", "PUT", {
        ...value,
        revision: account?.workspace?.revision ?? 0,
      });
      setMessage(
        result.saved
          ? "Saved to your account."
          : "Saved for this guest session. Sign in for persistent history.",
      );
      setAccount(await api("workspace"));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="as-panel">
      <h2>Keep your decisions with you.</h2>
      <p className="as-muted">
        Account saves last until deleted. Guest saves expire after 30 minutes.
        Unsaved photos are excluded.
      </p>
      {account && !account.accountAvailable && (
        <p className="as-notice warning">
          Account sign-in is awaiting authentication configuration. Guest saving
          is available locally.
        </p>
      )}
      <div className="as-row-actions">
        {account?.accountAvailable && !account.signedIn && (
          <Link className="as-primary" href="/signin?callbackUrl=/check">
            Sign in to save across devices
          </Link>
        )}
        <button
          className="as-secondary"
          disabled={busy || !account}
          onClick={save}
        >
          Save workspace
        </button>
        <button
          className="as-secondary"
          disabled={!account?.workspace}
          onClick={() => {
            const parsed = workspaceSchema.safeParse(account!.workspace!.data);
            if (parsed.success) onLoad(parsed.data);
            else
              setMessage(
                "The saved workspace has an unsupported format and was not loaded.",
              );
          }}
        >
          Load saved version
        </button>
        <button
          className="as-secondary"
          disabled={!account?.workspace}
          onClick={async () => {
            try {
              await api("workspace", "DELETE");
              setAccount(await api("workspace"));
              setMessage(
                "Server workspace and saved evidence access deleted. Your unsaved browser copy remains until you delete it in Privacy.",
              );
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          Delete saved workspace and evidence
        </button>
      </div>
      {message && (
        <p role="status" className="as-notice">
          {message}
        </p>
      )}
    </section>
  );
}
type PublicNote = Pick<
  Contribution,
  | "id"
  | "title"
  | "retailer"
  | "productId"
  | "color"
  | "size"
  | "confirmed"
  | "text"
  | "date"
  | "status"
> & { hasImage?: boolean };
export function CommunityPanel({
  product,
  onUse,
}: {
  product?: Product;
  onUse?: (note: PublicNote) => void;
}) {
  const [state, setState] = useState<{
      enabled: boolean;
      moderator: boolean;
      published: PublicNote[];
      own: Contribution[];
      queue: Contribution[];
    } | null>(null),
    [text, setText] = useState(""),
    [sku, setSku] = useState(product?.sku ?? ""),
    [corrections, setCorrections] = useState<Record<string, string>>({}),
    [mediaId, setMediaId] = useState<string | undefined>(),
    [imageReviews, setImageReviews] = useState<Record<string, boolean>>({}),
    [consent, setConsent] = useState(false),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function reload() {
    try {
      setState(await api("community"));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  useEffect(() => {
    api("community")
      .then(setState)
      .catch((e) => setMessage(e.message));
  }, []);
  async function act(id: string, action: string) {
    setBusy(true);
    try {
      await api("community", "PATCH", {
        id,
        action,
        reason,
        replacement: action === "correct" ? corrections[id] : undefined,
        imageReviewed: action === "publish" ? imageReviews[id] : undefined,
      });
      await reload();
      setMessage(
        "Contribution updated. Public views use its current status; withdrawn reports are no longer published.",
      );
      setReason("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!product) return;
    setBusy(true);
    try {
      await api("community", "POST", {
        title: product.title,
        retailer: product.retailer,
        productId: sku,
        color: product.color,
        size: product.size,
        confirmed: product.confirmed,
        text,
        date: new Date().toISOString(),
        consent,
        mediaId,
      });
      setText("");
      setMediaId(undefined);
      setConsent(false);
      await reload();
      setMessage("Submitted for moderation. It is not public yet.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="as-panel">
      <h2>Community evidence, with context.</h2>
      <p className="as-muted">
        Community observations · not product certification.
      </p>
      {!state?.enabled && (
        <p className="as-notice warning">
          Public submissions are paused until a moderation owner and launch
          review are configured.
        </p>
      )}
      <Link className="as-quiet-link" href="/signin?callbackUrl=/check">
        Sign in to manage contributions
      </Link>
      {product && (
        <details style={{ marginTop: 20 }}>
          <summary>Prepare a product contribution</summary>
          <label className="as-field">
            Exact retailer product identifier
            <input
              value={sku}
              maxLength={150}
              onChange={(e) => setSku(e.target.value)}
            />
          </label>
          <label className="as-field">
            Product-only observation
            <textarea
              value={text}
              maxLength={2000}
              onChange={(e) => {
                setText(e.target.value);
                setConsent(false);
              }}
            />
          </label>
          {personalInfo(text) && (
            <p className="as-notice error">
              Possible personal information detected. Remove it before
              submitting.
            </p>
          )}
          <CommunityPhoto onReady={setMediaId} />
          <div className="as-notice">
            <b>Public preview</b>
            {mediaId && (
              <p>
                A reviewed product-only photo will be included after moderation.
              </p>
            )}
            <p>
              {product.title} · {product.color} / {product.size} · {sku}
            </p>
            <p>{text || "Your observation will appear here."}</p>
            <small>
              Contributor report · exact variant{" "}
              {product.confirmed ? "confirmed by contributor" : "unconfirmed"}
            </small>
          </div>
          <label className="as-checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I approve this exact product-only text for public moderation. This
            does not authorize sharing photos or research use.
          </label>
          <button
            className="as-primary"
            disabled={
              busy || !state?.enabled || !consent || !sku || personalInfo(text)
            }
            onClick={submit}
          >
            Submit for moderation
          </button>
        </details>
      )}
      <h3>Published reports</h3>
      <p className="as-muted">
        Only matching variants support your check. Disputed or withdrawn notes
        are excluded.
      </p>
      {state?.published.length ? (
        state.published.map((n) => (
          <article className="as-evidence" key={n.id}>
            <span className="as-status">
              {n.status === "disputed"
                ? "Disputed contributor report"
                : "Contributor report"}
            </span>
            <h3>
              {n.title} · {n.color} / {n.size}
            </h3>
            <p>{n.text}</p>
            {n.hasImage && (
              <a
                className="as-secondary"
                href={`/api/asshown/community/${n.id}/image`}
                target="_blank"
                rel="noreferrer"
              >
                View reviewed product photo
              </a>
            )}
            <small>
              {n.productId} · {new Date(n.date).toLocaleDateString()} ·{" "}
              {n.confirmed
                ? "Variant contributor-confirmed"
                : "Variant unconfirmed"}
            </small>
            <div>
              {onUse && product && (
                <button
                  className="as-secondary"
                  disabled={
                    n.status !== "published" ||
                    !n.confirmed ||
                    !product.sku ||
                    product.sku.trim().toLowerCase() !==
                      n.productId.trim().toLowerCase() ||
                    product.retailer.trim().toLowerCase() !==
                      n.retailer.trim().toLowerCase() ||
                    product.color.trim().toLowerCase() !==
                      n.color.trim().toLowerCase() ||
                    product.size.trim().toLowerCase() !==
                      n.size.trim().toLowerCase()
                  }
                  onClick={() => onUse(n)}
                >
                  Link this exact-variant report
                </button>
              )}
              <button
                className="as-icon-btn as-quiet-link"
                disabled={busy || reason.trim().length < 5}
                onClick={() => act(n.id, "dispute")}
              >
                Dispute with reason below
              </button>
            </div>
          </article>
        ))
      ) : (
        <p className="as-muted">No published notes yet.</p>
      )}
      <label className="as-field">
        Reason for a dispute, withdrawal, appeal, or moderation decision
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={2000}
          placeholder="Describe the specific evidence or publication concern."
        />
      </label>
      {state?.own.length ? (
        <>
          <h3>Your submissions</h3>
          {state.own.map((n) => (
            <article className="as-evidence" key={n.id}>
              <b>{n.title}</b>
              <p>{n.text}</p>
              <span className="as-status">{n.status}</span>
              {n.status !== "withdrawn" && (
                <details>
                  <summary>Correct this report</summary>
                  <label className="as-field">
                    Corrected report text
                    <textarea
                      value={corrections[n.id] ?? n.text}
                      maxLength={2000}
                      onChange={(e) =>
                        setCorrections({
                          ...corrections,
                          [n.id]: e.target.value,
                        })
                      }
                    />
                  </label>
                  <p className="as-muted">
                    Corrections return the note to moderation.
                  </p>
                  <button
                    className="as-secondary"
                    disabled={
                      busy ||
                      reason.trim().length < 5 ||
                      !corrections[n.id]?.trim()
                    }
                    onClick={() => act(n.id, "correct")}
                  >
                    Submit correction for review
                  </button>
                </details>
              )}
              <div className="as-row-actions">
                <button
                  disabled={
                    busy || n.status === "withdrawn" || reason.length < 5
                  }
                  className="as-secondary"
                  onClick={() => act(n.id, "withdraw")}
                >
                  Withdraw
                </button>
                {n.status === "removed" && (
                  <button
                    disabled={busy || reason.length < 5}
                    className="as-secondary"
                    onClick={() => act(n.id, "appeal")}
                  >
                    Appeal removal
                  </button>
                )}
              </div>
            </article>
          ))}
        </>
      ) : null}
      {state?.moderator && (
        <>
          <h3>Moderation queue</h3>

          {state.queue.map((n) => (
            <article className="as-evidence" key={n.id}>
              <h3>
                {n.title} · {n.color} / {n.size}
              </h3>
              <p>{n.text}</p>
              {n.mediaId && (
                <>
                  <a
                    className="as-secondary"
                    href={`/api/asshown/community/${n.id}/image`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Inspect pending redacted photo
                  </a>
                  <label className="as-checkbox">
                    <input
                      type="checkbox"
                      checked={imageReviews[n.id] ?? false}
                      onChange={(e) =>
                        setImageReviews({
                          ...imageReviews,
                          [n.id]: e.target.checked,
                        })
                      }
                    />
                    I inspected the full photo: no people or identifying private
                    details are visible, and publication consent is recorded.
                  </label>
                </>
              )}
              <details>
                <summary>Audit history</summary>
                {n.audit.map((a, i) => (
                  <p key={i}>
                    {a.at} · {a.action}: {a.reason}
                  </p>
                ))}
              </details>
              <div className="as-row-actions">
                <button
                  className="as-secondary"
                  disabled={busy || reason.length < 5}
                  onClick={() => act(n.id, "publish")}
                >
                  Publish reviewed report
                </button>
                <button
                  className="as-secondary"
                  disabled={busy || reason.length < 5}
                  onClick={() => act(n.id, "remove")}
                >
                  Remove with reason
                </button>
              </div>
            </article>
          ))}
        </>
      )}
      {message && (
        <p role="status" className="as-notice">
          {message}
        </p>
      )}
    </section>
  );
}
export function SupportPanel() {
  const [category, setCategory] = useState("incorrect finding"),
    [text, setText] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [resolution, setResolution] = useState("");
  const [inbox, setInbox] = useState<{
    moderator: boolean;
    tickets: Array<{
      id: string;
      own: boolean;
      data: {
        category: string;
        message: string;
        status: string;
        response?: string;
        createdAt: string;
      };
    }>;
  }>({ moderator: false, tickets: [] });
  async function reload() {
    try {
      setInbox(await api("support"));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  useEffect(() => {
    api("workspace")
      .then(() => api("support"))
      .then(setInbox)
      .catch((e) => setMessage(e.message));
  }, []);
  async function resolve(id: string, status: string) {
    setBusy(true);
    try {
      await api("support", "PATCH", { id, status, response: resolution });
      await reload();
      setResolution("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="as-panel">
      <h2>Something doesn’t look right?</h2>
      <p className="as-muted">
        Text only. Do not include credentials or private information.
      </p>
      <label className="as-field">
        Report category
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {["incorrect finding", "billing", "privacy", "accessibility"].map(
            (v) => (
              <option key={v}>{v}</option>
            ),
          )}
        </select>
      </label>
      <label className="as-field">
        What happened?
        <textarea
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <button
        className="as-secondary"
        disabled={busy || text.trim().length < 10}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api("support", "POST", { category, message: text });
            setMessage(
              `Report saved: ${r.id}. Status: open. No images attached.`,
            );
            setText("");
            await reload();
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        File report
      </button>
      {inbox.tickets.map((t) => (
        <article className="as-evidence" key={t.id}>
          <span className="as-status">
            {t.data.status.replaceAll("_", " ")}
          </span>
          <h3>{t.data.category}</h3>
          <p>{t.data.message}</p>
          {t.data.response && (
            <blockquote>Support response: {t.data.response}</blockquote>
          )}
          <small>
            {new Date(t.data.createdAt).toLocaleString()} · no images attached
          </small>
          <div className="as-row-actions">
            {t.own && (
              <button
                className="as-secondary"
                onClick={async () => {
                  try {
                    await api("support", "DELETE", { id: t.id });
                    await reload();
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                Delete my report
              </button>
            )}
            {inbox.moderator && (
              <>
                <button
                  className="as-secondary"
                  disabled={busy || resolution.length < 5}
                  onClick={() => resolve(t.id, "under_review")}
                >
                  Mark under review
                </button>
                <button
                  className="as-secondary"
                  disabled={busy || resolution.length < 5}
                  onClick={() => resolve(t.id, "resolved")}
                >
                  Resolve with note
                </button>
              </>
            )}
          </div>
        </article>
      ))}
      {inbox.moderator && <ProcessingControls />}
      {inbox.moderator && (
        <label className="as-field">
          Resolution note
          <textarea
            value={resolution}
            maxLength={2000}
            onChange={(e) => setResolution(e.target.value)}
          />
        </label>
      )}
      {message && (
        <p role="status" className="as-notice">
          {message}
        </p>
      )}
    </section>
  );
}
export function LanguagePanel({
  text,
  onInterpret,
}: {
  text: string;
  onInterpret: (r: Requirement[]) => void;
}) {
  const recognition = useRef<{
    start: () => void;
    stop: () => void;
    lang: string;
    onresult:
      | ((event: {
          results: {
            [index: number]: { [index: number]: { transcript: string } };
          };
        }) => void)
      | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  useEffect(
    () => () => {
      recognition.current?.stop();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  function dictate() {
    const Recognition =
      (
        window as unknown as {
          SpeechRecognition?: new () => NonNullable<typeof recognition.current>;
          webkitSpeechRecognition?: new () => NonNullable<
            typeof recognition.current
          >;
        }
      ).SpeechRecognition ??
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => NonNullable<
            typeof recognition.current
          >;
        }
      ).webkitSpeechRecognition;
    if (!Recognition) {
      setMessage(
        "Speech input is not supported in this browser. Type your requirements instead.",
      );
      return;
    }
    const instance = new Recognition();
    recognition.current = instance;
    instance.lang = "en-US";
    instance.onresult = (e) => {
      setInput(e.results[0][0].transcript);
      setMessage("Review and correct the transcript before interpreting it.");
    };
    instance.onerror = () => {
      setMessage("Speech input could not complete. You can type instead.");
      setRecording(false);
    };
    instance.onend = () => setRecording(false);
    instance.start();
    setRecording(true);
  }
  const [consent, setConsent] = useState(false);
  const [input, setInput] = useState(""),
    [output, setOutput] = useState(""),
    [suggested, setSuggested] = useState<Requirement[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function assist(action: "interpret" | "translate") {
    setBusy(true);
    try {
      const r = await api("assist", "POST", {
        action,
        text: action === "interpret" ? input : text,
        language: "Spanish",
        consent,
      });
      if (action === "interpret") setSuggested(r.requirements);
      else setOutput(r.translation);
      setMessage(
        "AI-assisted draft. Review the original and every interpretation before applying.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details style={{ marginBottom: 20 }}>
      <summary className="as-muted">
        Describe your needs, translate, or hear a summary
      </summary>
      <label className="as-field">
        Describe practical requirements
        <input
          value={input}
          maxLength={1000}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Machine washable, long sleeves, no small buttons"
        />
      </label>
      <p className="as-muted">
        Dictation may use your browser’s speech service. Review the transcript
        before sending.
      </p>
      <button
        className="as-secondary"
        onClick={() => (recording ? recognition.current?.stop() : dictate())}
      >
        {recording ? "Stop microphone" : "Dictate requirements"}
      </button>
      <label className="as-checkbox">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        Send this text directly to OpenAI for this request. Keep sensitive
        personal details out of the text.
      </label>
      <div className="as-row-actions">
        <button
          className="as-secondary"
          disabled={busy || !consent || !input.trim()}
          onClick={() => assist("interpret")}
        >
          Suggest structured requirements
        </button>
        <button
          className="as-secondary"
          disabled={busy || !consent}
          onClick={() => assist("translate")}
        >
          Translate summary to Spanish
        </button>
        <button
          className="as-secondary"
          onClick={() => {
            if (!("speechSynthesis" in window)) {
              setMessage(
                "Speech is unavailable in this browser. All content is available as text.",
              );
              return;
            }
            speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = "en-US";
            u.onerror = () =>
              setMessage(
                "Speech could not complete. Read or edit the text instead.",
              );
            speechSynthesis.speak(u);
          }}
        >
          Read aloud
        </button>
        <button
          className="as-secondary"
          onClick={() => window.speechSynthesis?.cancel()}
        >
          Stop speech
        </button>
      </div>
      {output && (
        <div className="as-notice">
          <b>Machine translation · Spanish · unverified</b>
          <p lang="es">{output}</p>
          <b>Original</b>
          <p>{text}</p>
          <p>Translations do not change your requirements or evidence.</p>
        </div>
      )}
      {suggested.length > 0 && (
        <div className="as-notice">
          <b>Review before replacing your current requirements</b>
          {suggested.map((r) => (
            <p key={r.id}>
              {r.wording} → {r.attribute}: {r.value} ({r.importance})
            </p>
          ))}
          <button
            className="as-secondary"
            onClick={() => {
              onInterpret(suggested);
              setSuggested([]);
            }}
          >
            Confirm these interpretations
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="as-notice">
          {message}
        </p>
      )}
    </details>
  );
}
