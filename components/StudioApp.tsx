"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleUserRound,
  Download,
  Glasses,
  ImageIcon,
  LockKeyhole,
  Scissors,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { createContract } from "@/lib/contract";
import { demoResult } from "@/lib/demo";
import type { IdentityContract, IntegrityResult, PreserveZone, ResultState, SessionReceipt } from "@/lib/types";
import { PreserveMap } from "@/components/PreserveMap";

const steps = ["Your photos", "Identity Contract", "Generate", "Verify", "Receipt", "Delete"];
const progressCopy = [
  "Preparing encrypted session files…",
  "YouCam is applying the selected garment…",
  "Aligning source and generated images…",
  "Checking protected regions and Skin AI signals…",
];

const protectionIcons = [CircleUserRound, Sparkles, Scissors, ImageIcon, Glasses];
let pendingSessionRequest: Promise<{ sessionId: string }> | null = null;

function createPrivateSession() {
  if (!pendingSessionRequest) {
    pendingSessionRequest = fetch("/api/v1/sessions", { method: "POST" })
      .then(async (response): Promise<{ sessionId: string }> => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "A private session could not be created.");
        return payload;
      });
    pendingSessionRequest.then(
      () => { pendingSessionRequest = null; },
      () => { pendingSessionRequest = null; },
    );
  }
  return pendingSessionRequest;
}

const garmentCatalog = [
  { id: "rust-utility", name: "Rust utility jacket", detail: "Cotton twill", image: "/demo/rust-jacket.png" },
  { id: "indigo-overshirt", name: "Indigo overshirt", detail: "Dark denim", image: "/demo/indigo-overshirt.png" },
  { id: "forest-cardigan", name: "Forest cardigan", detail: "Chunky knit", image: "/demo/forest-cardigan.png" },
] as const;

const resultCopy: Record<ResultState, { title: string; detail: string; tone: "pass" | "review" }> = {
  passed: {
    title: "No material drift detected",
    detail: "The result follows the Identity Contract within calibrated thresholds.",
    tone: "pass",
  },
  passed_after_repair: {
    title: "Passed after your repair",
    detail: "The restored source zone was reverified and now meets the contract thresholds.",
    tone: "pass",
  },
  needs_review: {
    title: "One protected check needs review",
    detail: "A preserve-zone measurement is below the pass threshold. Restore it or approve with the finding retained.",
    tone: "review",
  },
  failed: {
    title: "A protected region changed",
    detail: "This result does not satisfy the Identity Contract. Restore the highlighted zone or regenerate.",
    tone: "review",
  },
  inconclusive: {
    title: "Verification is inconclusive",
    detail: "The evidence quality was insufficient for a reliable assessment. Try another photo or regenerate.",
    tone: "review",
  },
};

export function StudioApp() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [experienceMode, setExperienceMode] = useState<"guided" | "live">("guided");
  const [step, setStep] = useState(0);
  const [contract, setContract] = useState<IdentityContract>(() => createContract("pending"));
  const [consented, setConsented] = useState(false);
  const [presetRequest, setPresetRequest] = useState(0);
  const [personUrl, setPersonUrl] = useState("/demo/source-shopper.png");
  const [garmentUrl, setGarmentUrl] = useState("/demo/rust-jacket.png");
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [selectedGarmentId, setSelectedGarmentId] = useState("rust-utility");
  const [selectedGarmentName, setSelectedGarmentName] = useState("Rust utility jacket");
  const [generatedUrl, setGeneratedUrl] = useState("/demo/youcam-live-tryon.png");
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState(progressCopy[0]);
  const [result, setResult] = useState<IntegrityResult>(() => demoResult("ic_demo", "pass"));
  const [receipt, setReceipt] = useState<SessionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const objectUrls = useRef<string[]>([]);

  const updateCustomZones = useCallback((zones: PreserveZone[]) => {
    setContract((current) => {
      if (JSON.stringify(current.customZones) === JSON.stringify(zones)) return current;
      return { ...current, customZones: zones };
    });
  }, []);

  useEffect(() => {
    let active = true;
    createPrivateSession()
      .then((payload) => {
        if (!active) return;
        setSessionId(payload.sessionId);
        setContract(createContract(payload.sessionId));
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "A private session could not be created."));
    return () => {
      active = false;
      objectUrls.current.forEach(URL.revokeObjectURL);
    };
  }, []);

  function updateUpload(file: File | undefined, target: "person" | "garment") {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Please choose a JPEG or PNG image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Images must be 10 MB or smaller.");
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    if (target === "person") {
      setPersonUrl(url);
      setPersonFile(file);
    } else {
      setGarmentUrl(url);
      setGarmentFile(file);
      setSelectedGarmentId("uploaded");
      setSelectedGarmentName("Your uploaded garment");
      setContract((current) => ({ ...current, garment: { id: "uploaded", name: "Your uploaded garment", source: "upload" } }));
    }
  }

  function selectCatalogGarment(garment: (typeof garmentCatalog)[number]) {
    setGarmentUrl(garment.image);
    setGarmentFile(null);
    setSelectedGarmentId(garment.id);
    setSelectedGarmentName(garment.name);
    setContract((current) => ({ ...current, garment: { id: garment.id, name: garment.name, source: "catalog" } }));
  }

  function chooseExperienceMode(mode: "guided" | "live") {
    setExperienceMode(mode);
    if (mode === "guided") {
      setPersonUrl("/demo/source-shopper.png");
      setPersonFile(null);
      selectCatalogGarment(garmentCatalog[0]);
    }
  }

  async function responseJson<T>(response: Response): Promise<T> {
    const payload = await response.json().catch(() => ({})) as T & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "The request could not be completed.");
    return payload;
  }

  async function defaultFile(url: string, name: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`The ${name} demo asset is unavailable.`);
    const blob = await response.blob();
    return new File([blob], name, { type: blob.type || "image/png" });
  }

  async function beginGeneration() {
    if (!sessionId) {
      setError("The private session is still being prepared. Please try again.");
      return;
    }
    const approvedContract = {
      ...contract,
      consentedAt: new Date().toISOString(),
    };
    setContract(approvedContract);
    setError(null);
    setBusy(true);
    setStep(2);
    setProgress(8);
    setProgressMessage("Saving your Identity Contract…");
    try {
      await responseJson(await fetch(`/api/v1/sessions/${sessionId}/identity-contract`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(approvedContract),
      }));

      let generationPayload: { sourceFileId?: string; referenceFileId?: string; demoMode: boolean } = { demoMode: true };
      if (experienceMode === "live") {
        setProgress(18);
        setProgressMessage("Uploading encrypted session files to YouCam…");
        const [source, reference] = await Promise.all([
          personFile ?? defaultFile("/demo/source-shopper.png", "keepme-source.png"),
          garmentFile ?? defaultFile(garmentUrl, "keepme-garment.png"),
        ]);
        const form = new FormData();
        form.append("source", source);
        form.append("reference", reference);
        const uploaded = await responseJson<{ sourceFileId: string; referenceFileId: string }>(await fetch(`/api/v1/sessions/${sessionId}/uploads`, { method: "POST", body: form }));
        generationPayload = { ...uploaded, demoMode: false };
      } else {
        setProgress(25);
        setProgressMessage("Loading the disclosed glasses-removal scenario…");
      }

      setProgress(30);
      setProgressMessage(experienceMode === "guided" ? "Replaying a known identity-drift case…" : progressCopy[1]);
      await responseJson(await fetch(`/api/v1/sessions/${sessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generationPayload),
      }));

      let completed = false;
      const maximumAttempts = experienceMode === "guided" ? 3 : 60;
      for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, experienceMode === "guided" ? 700 : Math.min(1200 + attempt * 150, 3000)));
        const status = await responseJson<{ taskStatus: string; resultUrl?: string; error?: string }>(await fetch(`/api/v1/sessions/${sessionId}/generation-status`, { cache: "no-store" }));
        setProgress(Math.min(74, 34 + attempt * 4));
        setProgressMessage(experienceMode === "guided" ? "Running the same integrity checks used for live results…" : `YouCam generation: ${status.taskStatus} · check ${attempt}`);
        if (status.taskStatus === "error") throw new Error(status.error ?? "YouCam generation failed.");
        if (status.taskStatus === "success" && status.resultUrl) {
          setGeneratedUrl(`${status.resultUrl}?v=${Date.now()}`);
          completed = true;
          break;
        }
      }
      if (!completed) throw new Error("YouCam generation timed out. No additional task was created.");

      setProgress(82);
      setProgressMessage(progressCopy[3]);
      const verified = await responseJson<IntegrityResult>(await fetch(`/api/v1/sessions/${sessionId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(experienceMode === "guided" ? { fixture: "violation" } : {}),
      }));
      setResult(verified);
      setProgress(100);
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The protected try-on could not be completed.");
      setStep(1);
    } finally {
      setBusy(false);
    }
  }

  async function repair() {
    if (!sessionId) return;
    setProgressMessage("Restoring the selected source region and reverifying…");
    setStep(2);
    setProgress(40);
    setBusy(true);
    setError(null);
    try {
      const repaired = await responseJson<IntegrityResult>(await fetch(`/api/v1/sessions/${sessionId}/repair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
      setResult(repaired);
      setGeneratedUrl(`/api/v1/sessions/${sessionId}/result-image?v=${Date.now()}`);
      setProgress(100);
      setStep(3);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The preserve-zone repair failed.");
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  async function approveResult() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const approved = await responseJson<SessionReceipt>(await fetch(`/api/v1/sessions/${sessionId}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
      setReceipt(approved);
      setStep(4);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The result could not be approved.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSession() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      await responseJson(await fetch(`/api/v1/sessions/${sessionId}`, { method: "DELETE" }));
      if (receipt) setReceipt({ ...receipt, retentionOutcome: "deleted" });
      objectUrls.current.forEach(URL.revokeObjectURL);
      objectUrls.current = [];
      setStep(5);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The session could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  function tryAnotherGarment() {
    setExperienceMode("live");
    setConsented(false);
    setReceipt(null);
    setContract((current) => ({ ...current, contractId: `ic_${crypto.randomUUID().slice(0, 8)}`, consentedAt: null }));
    setStep(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const garmentFinding = result.findings.find((finding) => finding.code === "GARMENT_NOT_APPLIED");
  const resultPresentation = garmentFinding
    ? {
        title: result.state === "failed" ? "The garment was not applied" : "Garment application needs review",
        detail: garmentFinding.message,
        tone: "review" as const,
      }
    : resultCopy[result.state];
  const preserveFinding = result.findings.find((finding) => finding.code === "PRESERVE_ZONE_CHANGED");
  const findingRegion = preserveFinding?.region;
  const isPassingResult = result.state === "passed" || result.state === "passed_after_repair";
  const receiptNeedsReview = receipt?.state === "needs_review";

  return (
    <div className="studio-layout">
      <aside className="studio-sidebar" aria-label="Try-on progress">
        <p className="sidebar-label">Safe try-on</p>
        <div className="step-list">
          {steps.map((label, index) => (
            <div className={`step-item ${index === step ? "active" : ""} ${index < step ? "complete" : ""}`} key={label} aria-current={index === step ? "step" : undefined}>
              <span className="step-number">{index < step ? <Check size={12} /> : index + 1}</span><span>{label}</span>
            </div>
          ))}
        </div>
        <div className="privacy-mini"><strong><LockKeyhole size={13} /> Private by design</strong>Images live only for this session and are excluded from analytics.</div>
      </aside>

      <main className="studio-main" id="main-content">
        {error && <div className="error-banner" role="alert"><AlertTriangle size={18} /><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError(null)}>×</button></div>}
        {step === 0 && (
          <>
            <StudioTopline eyebrow="Step 1 of 6" title={experienceMode === "guided" ? "See why KeepMe exists" : "Choose your look"} subtitle={experienceMode === "guided" ? "Run a repeatable 90-second scenario where a virtual try-on removes the shopper’s glasses." : "Pick a catalog garment or upload your own JPEG/PNG up to 10 MB. Nothing leaves this page before contract approval."} sessionId={sessionId ?? "Creating…"} />
            <div className="experience-picker" role="radiogroup" aria-label="Try-on experience">
              <button type="button" role="radio" aria-checked={experienceMode === "guided"} className={`experience-option ${experienceMode === "guided" ? "selected" : ""}`} onClick={() => chooseExperienceMode("guided")}>
                <span className="experience-icon"><AlertTriangle size={19} /></span><span><strong>Identity drift demo</strong><small>Glasses removed → detect → restore → reverify</small></span><em>Recommended demo</em>
              </button>
              <button type="button" role="radio" aria-checked={experienceMode === "live"} className={`experience-option ${experienceMode === "live" ? "selected" : ""}`} onClick={() => chooseExperienceMode("live")}>
                <span className="experience-icon"><Sparkles size={19} /></span><span><strong>Live virtual try-on</strong><small>Choose any garment and generate with YouCam Clothes v3</small></span>
              </button>
            </div>
            <section className="studio-card">
              <div className="card-heading"><div><h2>{experienceMode === "guided" ? "Scenario inputs" : "Person and garment"}</h2><p>{experienceMode === "guided" ? "A fixed synthetic shopper makes the safety behavior clear and repeatable." : "Use a clear, front-facing person photo, then choose what to try on."}</p></div><span className="demo-pill"><Check size={12} /> {experienceMode === "guided" ? "Controlled fixture" : selectedGarmentName}</span></div>
              <div className="upload-grid">
                <label className={`upload-box ${experienceMode === "guided" ? "locked" : ""}`}>
                  <input className="sr-only" type="file" accept="image/jpeg,image/png" disabled={experienceMode === "guided"} onChange={(event) => updateUpload(event.target.files?.[0], "person")} />
                  {/* Object URLs cannot be optimized by next/image. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="upload-image" src={personUrl} alt="Selected person for virtual try-on" />
                  <span className="upload-overlay"><span><strong>Source photo</strong><br />{experienceMode === "guided" ? "Synthetic shopper · glasses protected" : personFile ? `${(personFile.size / 1024 / 1024).toFixed(1)} MB · ${personFile.type.replace("image/", "").toUpperCase()}` : "Validated synthetic subject"}</span><span className="quality-chip">{experienceMode === "guided" ? <><LockKeyhole size={13} /> Fixed demo</> : <><Upload size={13} /> Replace</>}</span></span>
                </label>
                {experienceMode === "guided" ? (
                  <div className="guided-scenario">
                    <div className="scenario-visual"><Image src="/demo/rust-jacket.png" alt="Rust utility jacket selected for the guided demo" fill sizes="400px" /></div>
                    <div className="scenario-copy"><span className="section-kicker">The contract</span><h3>Change the jacket. Keep the glasses.</h3><p>The fixture intentionally removes the eyewear after the garment edit. KeepMe must catch it before the shopper accepts the image.</p></div>
                    <div className="scenario-rules"><span><Check size={14} /><strong>Allowed</strong> Upper-body garment</span><span><ShieldCheck size={14} /><strong>Protected</strong> Glasses, face, hair, skin</span><span><AlertTriangle size={14} /><strong>Known drift</strong> Glasses removed</span></div>
                    <small className="scenario-disclosure">Controlled, synthetic evaluation fixture. It demonstrates product behavior and is not represented as a fresh YouCam failure.</small>
                  </div>
                ) : <div className="garment-picker">
                  <div className="garment-picker-head"><span>Demo catalog</span><small>Select one to change the result</small></div>
                  <div className="garment-catalog" role="radiogroup" aria-label="Demo garments">
                    {garmentCatalog.map((garment) => (
                      <button className={`garment-option ${selectedGarmentId === garment.id ? "selected" : ""}`} type="button" role="radio" aria-checked={selectedGarmentId === garment.id} onClick={() => selectCatalogGarment(garment)} key={garment.id}>
                        <span className="garment-thumb"><Image src={garment.image} alt="" fill sizes="120px" /></span>
                        <span><strong>{garment.name}</strong><small>{garment.detail}</small></span>
                        {selectedGarmentId === garment.id && <CheckCircle2 className="garment-check" size={17} />}
                      </button>
                    ))}
                  </div>
                  <label className="upload-box compact garment-preview">
                    <input className="sr-only" type="file" accept="image/jpeg,image/png" onChange={(event) => updateUpload(event.target.files?.[0], "garment")} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="upload-image" src={garmentUrl} alt={`Selected garment: ${selectedGarmentName}`} />
                    <span className="upload-overlay"><span><strong>{selectedGarmentName}</strong><br />{garmentFile ? `${(garmentFile.size / 1024 / 1024).toFixed(1)} MB · ${garmentFile.type.replace("image/", "").toUpperCase()}` : "Upper body · Ready for YouCam"}</span><span className="quality-chip"><Upload size={13} /> Upload yours</span></span>
                  </label>
                </div>}
              </div>
              <div className="quality-row">
                <div className="quality-item"><strong><CheckCircle2 size={13} /> Resolution</strong>1536 × 2048 · Good</div>
                <div className="quality-item"><strong><CheckCircle2 size={13} /> Pose</strong>Front-facing · Good</div>
                <div className="quality-item"><strong><CheckCircle2 size={13} /> Lighting</strong>Even exposure · Good</div>
              </div>
              <div className="studio-actions"><span className="privacy-note"><LockKeyhole size={13} /> {experienceMode === "guided" ? "Synthetic fixture · no personal image or API credit used." : "Your original filename is never used as identity metadata."}</span><button className="btn btn-primary btn-wide" disabled={!sessionId || busy} onClick={() => setStep(1)}>{sessionId ? experienceMode === "guided" ? "Protect the glasses" : "Build my contract" : "Creating private session…"} <ArrowRight size={15} /></button></div>
            </section>
          </>
        )}

        {step === 1 && (
          <>
            <StudioTopline eyebrow="Step 2 of 6" title="Define what stays you" subtitle={`The ${selectedGarmentName.toLowerCase()} area may change. Draw directly on the image to add critical preserve zones.`} sessionId={sessionId ?? "Creating…"} />
            {experienceMode === "guided" && <div className="guided-disclosure"><AlertTriangle size={18} /><span><strong>Demo goal:</strong> Keep the glasses inside the preserve zone while allowing the jacket to change.</span></div>}
            <section className="studio-card contract-layout">
              <div>
                <div className="card-heading"><div><h2>Preserve Map</h2><p>The bright area may change. Draw over anything extra you want to preserve.</p></div></div>
                <PreserveMap imageUrl={personUrl} protections={contract.protections} onZonesChange={updateCustomZones} presetRequest={presetRequest} />
              </div>
              <div className="contract-panel">
                <div className="card-heading" style={{ marginBottom: 0 }}><div><h2>Your Identity Contract</h2><p>Version 1.0 · Current generation only</p></div></div>
                <div className="allow-card"><span className="allow-icon"><Sparkles size={17} /></span><div><strong>Allowed: upper-body garment</strong><p>Garment and immediate occlusion boundary only.</p></div></div>
                <div className="protection-list">
                  {contract.protections.map((protection, index) => {
                    const Icon = protectionIcons[index];
                    return (
                      <div className="protection-row" key={protection.id}>
                        <span className="protection-icon"><Icon size={16} /></span>
                        <span><strong>{protection.label}</strong><small>{protection.description}</small></span>
                        <button
                          className={`toggle ${protection.enabled ? "on" : ""}`}
                          aria-label={`${protection.enabled ? "Disable" : "Enable"} ${protection.label} protection`}
                          aria-pressed={protection.enabled}
                          onClick={() => setContract((current) => ({ ...current, protections: current.protections.map((item) => item.id === protection.id ? { ...item, enabled: !item.enabled } : item) }))}
                        />
                      </div>
                    );
                  })}
                </div>
                <button className="btn btn-secondary" onClick={() => setPresetRequest((value) => value + 1)}><Check size={15} />{contract.customZones.length ? "Reset to glasses preset" : "Add glasses preset"}</button>
                <label className="consent-box"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} /><span>{experienceMode === "guided" ? "I approve this Identity Contract for the disclosed synthetic failure scenario. No personal image is sent to YouCam." : "I approve this contract for one live virtual try-on. The images will be sent to YouCam and removed from this session when I delete it."}</span></label>
                <div className="studio-actions"><button className="btn btn-ghost" disabled={busy} onClick={() => setStep(0)}><ArrowLeft size={15} /> Back</button><button className="btn btn-primary" disabled={!consented || busy || !sessionId} onClick={beginGeneration}>{busy ? "Starting…" : experienceMode === "guided" ? "Run identity drift demo" : "Approve & generate"} <ArrowRight size={15} /></button></div>
              </div>
            </section>
          </>
        )}

        {step === 2 && (
          <section className="progress-stage" aria-live="polite">
            <span className="eyebrow">{experienceMode === "guided" ? "Controlled integrity scenario" : "Protected generation in progress"}</span>
            <div className="progress-visual"><Image src={personUrl} alt="Selected source being analyzed" fill unoptimized sizes="300px" /><span className="scan-line" /></div>
            <h2>{result.repaired ? "Repairing carefully" : experienceMode === "guided" ? "Can KeepMe catch the missing glasses?" : "Changing the garment—not you"}</h2>
            <p>{progressMessage}</p>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
            <div className="progress-steps"><span className={progress >= 30 ? "progress-step done" : "progress-step"}>Generate</span><span className={progress >= 60 ? "progress-step done" : "progress-step"}>Align</span><span className={progress >= 82 ? "progress-step done" : "progress-step"}>Verify</span><span className={progress >= 100 ? "progress-step done" : "progress-step"}>Explain</span></div>
          </section>
        )}

        {step === 3 && (
          <>
            <StudioTopline eyebrow="Step 4 of 6" title="Your integrity check" subtitle="Measured source/result evidence is shown before any overall assessment." sessionId={sessionId ?? "Session"} />
            <div className={`result-banner ${resultPresentation.tone}`} role="status">
              <div className="result-status"><span className="result-icon">{isPassingResult ? <ShieldCheck size={23} /> : <AlertTriangle size={23} />}</span><div><h2>{resultPresentation.title}</h2><p>{resultPresentation.detail}</p></div></div>
              <div className="confidence"><strong>{Math.round(result.confidence * 100)}%</strong><span>evaluation confidence</span></div>
            </div>
            {experienceMode === "guided" && <div className="guided-disclosure"><AlertTriangle size={18} /><span><strong>{result.repaired ? "Controlled repair:" : "Controlled scenario:"}</strong> {result.repaired ? "The glasses have been restored and the fixture passed reverification." : "The missing glasses are intentional. The same contract, finding, repair, and receipt workflow is used for live results."}</span></div>}
            <section className="studio-card">
              <div className="card-heading"><div><h2>Source vs. virtual try-on</h2><p>The garment edit is expected. Changes outside the permitted region are measured.</p></div><span className="demo-pill">{experienceMode === "guided" ? result.repaired ? <><ShieldCheck size={12} /> Controlled repair result</> : <><AlertTriangle size={12} /> Controlled drift fixture</> : <><Sparkles size={12} /> Live YouCam result</>}</span></div>
              <div className="comparison">
                <div className="compare-image"><span className="compare-label">Source</span><Image src={personUrl} alt="Original selected source" fill unoptimized sizes="(max-width: 650px) 90vw, 42vw" /></div>
                <div className="compare-image"><span className="compare-label">{result.repaired ? "Source-zone repair · reverified" : experienceMode === "guided" ? "Controlled VTO result · glasses removed" : "YouCam Clothes v3 · live"}</span><Image src={generatedUrl} alt={experienceMode === "guided" ? "Controlled virtual try-on fixture with the shopper's glasses removed" : "Virtual try-on generated by YouCam Clothes v3"} fill unoptimized sizes="(max-width: 650px) 90vw, 42vw" />{findingRegion && <span className="finding-ring" style={{ left: `${findingRegion.x * 100}%`, top: `${findingRegion.y * 100}%`, width: `${findingRegion.width * 100}%`, height: `${findingRegion.height * 100}%` }} aria-label="Unexpected change highlighted in the measured preserve zone" />}</div>
              </div>
            </section>
            <div className="evidence-grid">
              <section className="studio-card">
                <div className="card-heading"><div><h3>Component evidence</h3><p>Threshold profile: mvp_conservative_v1</p></div></div>
                <div className="component-list">
                  {result.components.map((component) => (
                    <div className="component-row" key={component.id}>
                      <div className="component-label"><strong>{component.label}</strong><small>{component.detail}</small></div>
                      <div className="meter"><div className={`meter-fill ${component.status !== "pass" ? "review" : ""}`} style={{ width: `${(component.score ?? 0) * 100}%` }} /></div>
                      <div className="component-score">{component.score === null ? "N/A" : Math.round(component.score * 100)}</div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="studio-card">
                <div className="findings-card">
                  <h3>{result.findings.length ? `${result.findings.length} finding${result.findings.length > 1 ? "s" : ""}` : "All protected checks are clear"}</h3>
                  {result.findings.length ? result.findings.map((finding) => <div className="finding" key={finding.code}><span className="finding-code">{finding.severity.toUpperCase()} · {finding.code}</span><p>{finding.message}</p></div>) : <div className="all-clear"><CheckCircle2 size={18} /><span>No material change was detected outside the selected garment area.</span></div>}
                </div>
                <div className="studio-actions" style={{ alignItems: "stretch", flexDirection: "column" }}>
                  {result.repairSupported && <button className="btn btn-accent" disabled={busy} onClick={repair}><Sparkles size={15} /> Restore source zone &amp; reverify</button>}
                  {result.state !== "failed" && result.state !== "inconclusive" && <button className="btn btn-primary" disabled={busy} onClick={approveResult}>{busy ? "Saving…" : result.state === "needs_review" ? "Approve with finding retained" : "Approve this result"} <ArrowRight size={15} /></button>}
                  {result.state !== "failed" && result.state !== "inconclusive" && <button className="btn btn-secondary" disabled={busy} onClick={tryAnotherGarment}>Try a different garment</button>}
                  {(result.state === "failed" || result.state === "inconclusive") && <button className="btn btn-secondary" disabled={busy} onClick={tryAnotherGarment}>{garmentFinding ? "Choose another garment" : result.state === "inconclusive" ? "Choose another photo" : "Adjust inputs and regenerate"}</button>}
                </div>
              </section>
            </div>
          </>
        )}

        {step === 4 && receipt && (
          <>
            <StudioTopline eyebrow="Step 5 of 6" title="Your integrity receipt" subtitle="A plain-language record of what was requested, checked, and retained." sessionId={sessionId ?? "Session"} />
            <section className="studio-card receipt">
              <div className="receipt-head"><div><span className="brand" style={{ color: "white" }}><span className="brand-mark" style={{ borderColor: "white" }} />KeepMe</span><h2>Integrity Receipt</h2><p>{receipt.receiptId} · {new Date(receipt.timestamp).toLocaleString()}</p></div><div className={`verified-seal ${receiptNeedsReview ? "review" : ""}`}><span>{receiptNeedsReview ? <AlertTriangle size={23} /> : <ShieldCheck size={23} />}<br />{receiptNeedsReview ? <>User<br />reviewed</> : <>Contract<br />passed</>}</span></div></div>
              <div className="receipt-body">
                <div className={`receipt-state ${receiptNeedsReview ? "review" : ""}`}>{receiptNeedsReview ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}{receiptNeedsReview ? "Approved with an unresolved review finding" : receipt.state === "passed_after_repair" ? "Passed after user-approved repair" : "Passed — no material drift detected"}</div>
                <div className="receipt-grid">
                  <div className="receipt-field"><span>Requested edit</span><strong>{receipt.requestedEdit}</strong></div>
                  <div className="receipt-field"><span>Generator</span><strong>{receipt.generator}</strong></div>
                  <div className="receipt-field"><span>Protected</span><strong>{receipt.protectedItems.join(", ")}{contract.customZones.length ? `, ${contract.customZones.length} custom zone${contract.customZones.length === 1 ? "" : "s"}` : ""}</strong></div>
                  <div className="receipt-field"><span>Consistency signal</span><strong>{receipt.skinSignal}</strong></div>
                  <div className="receipt-field"><span>Repair status</span><strong>{receipt.repairStatus.replaceAll("_", " ")}</strong></div>
                  <div className="receipt-field"><span>Image retention</span><strong>{receipt.retentionOutcome.replaceAll("_", " ")}</strong></div>
                </div>
                <div className="receipt-limit">This receipt is a visual-consistency assessment. It is not identity verification, a statement of universal fairness, medical analysis, or a guarantee that the garment will physically fit.</div>
                <div className="studio-actions"><a className="btn btn-secondary" href={`/api/v1/sessions/${sessionId}/receipt-download`} download><Download size={15} /> Download signed JSON</a><button className="btn btn-secondary" onClick={() => window.print()}><Download size={15} /> Print / save PDF</button><button className="btn btn-danger" disabled={busy} onClick={deleteSession}><Trash2 size={15} /> {busy ? "Deleting…" : "Delete images now"}</button></div>
              </div>
            </section>
          </>
        )}

        {step === 5 && (
          <section className="deletion-panel" aria-live="polite">
            <div className="deletion-icon"><CheckCircle2 size={34} /></div>
            <span className="eyebrow">Deletion confirmed</span>
            <h2>Your images are gone.</h2>
            <p>The source photo, garment upload, generated image, preserve masks, heatmaps, and repair artifacts are no longer accessible. We retained only a non-identifying deletion event.</p>
            <div className="studio-actions" style={{ justifyContent: "center" }}><Link className="btn btn-secondary" href="/">Back to home</Link><button className="btn btn-primary" onClick={() => window.location.reload()}>Start another try-on</button></div>
          </section>
        )}
      </main>
    </div>
  );
}

function StudioTopline({ eyebrow, title, subtitle, sessionId }: { eyebrow: string; title: string; subtitle: string; sessionId: string }) {
  return <div className="studio-topline"><div><span className="section-kicker">{eyebrow}</span><h1 className="studio-title">{title}</h1><p className="studio-subtitle">{subtitle}</p></div><span className="session-pill">Private session · {sessionId.slice(-6)}</span></div>;
}
