# KeepMe

**Change the clothes, not the person.**

KeepMe is a consent and visual-integrity layer for generative apparel virtual try-on. A shopper defines what AI may edit, reviews a machine-readable Identity Contract, generates a clothing preview, checks protected regions, repairs supported drift, approves the output, and deletes sensitive imagery.

This repository contains a live vertical slice using YouCam AI Clothes v3 and Skin Analysis v2.1, plus deterministic fixtures for presentation fallback.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Live generation requires a server-only YouCam API key and consumes provider units.

Useful commands:

```bash
npm run test
npm run lint
npm run build
npm run smoke:guided
npm run audit:a11y
```

## Product surfaces

- `/` — consumer story and product positioning
- `/studio` — complete safe try-on journey
- `/dashboard` — privacy-preserving retailer quality view with clearly labeled demo data
- `/api/v1/sessions` — privacy-first session API

## Recommended 90-second demo

1. Open `/studio`; **Identity drift demo** is selected by default.
2. Select **Protect the glasses** and review the pre-drawn glasses preserve zone.
3. Approve the disclosed synthetic scenario and run it.
4. Point out the missing glasses, highlighted region, hard failure, and reason code.
5. Select **Restore source zone & reverify** to produce a distinct repaired pass.
6. Approve the result, show the controlled-demo label on the receipt, then delete the session.

The fixture is intentionally altered and disclosed throughout the UI. It demonstrates KeepMe's behavior without claiming the controlled failure came from a fresh YouCam request. Verify the complete path with `npm run smoke:guided`.

## Live YouCam mode

1. Put a server-only API key in `YOUCAM_API_KEY`.
2. Start the app, open `/studio`, and select **Live virtual try-on**. The browser creates a private session, submits the approved contract, uploads both images through the server, starts Clothes v3, polls with a bounded loop, retrieves the result through a private same-origin endpoint, runs measured pixel checks and Skin Analysis, then supports approval and deletion.

The adapter uses the current official paths:

- AI Clothes v3: `/s2s/v2.0/file/cloth-v3` and `/s2s/v2.0/task/cloth-v3`
- Skin Analysis v2.1: `/s2s/v2.1/file/skin-analysis` and `/s2s/v2.1/task/skin-analysis`

The browser never receives the API key or provider result URL. In local demo mode, artifacts use a short-lived in-process store. A public deployment sets `KEEPME_ALLOW_EPHEMERAL=false`, which makes KeepMe fail closed unless Postgres, KMS-backed object storage, Auth.js secrets, malware scanning, receipt signing, cleanup authorization, and the integrity worker are configured.

## Production beta stack

- Auth.js GitHub OAuth for allowlisted retailer users; anonymous shoppers receive an opaque, HttpOnly session capability.
- Tenant-scoped Postgres records for sessions, cleanup jobs, rate limits, privacy-filtered events, and provider usage.
- Private S3-compatible object storage with SSE-KMS, opaque keys, SHA-256 evidence, and deletion-then-absence verification.
- Strict JPEG/PNG byte decoding, 10 MB and 24 MP limits, metadata removal, safe re-encoding, and an authenticated malware scanner.
- IP/session/tenant rate limits and explicit YouCam credit budgets.
- OpenTelemetry startup instrumentation and structured events that exclude image bytes, identity attributes, source filenames, secrets, and URLs.
- MediaPipe face-landmark alignment and person-segmentation worker under `services/integrity-worker`.
- Signed receipt JSON binding the approved contract and integrity result digests, plus `/api/v1/receipts/verify`.
- Scheduled, retryable expiry deletion through `/api/internal/maintenance` and `vercel.json`.
- Automated unit, production build, guided smoke, dependency, and WCAG A/AA gates in `.github/workflows/ci.yml`.

Deployment configuration is documented in [docs/production-runbook.md](docs/production-runbook.md). Copy `.env.example`, provision each service, set `KEEPME_ALLOW_EPHEMERAL=false`, and run `npm run check:production` before accepting personal images.

## Privacy model

- Session-only sensitive images and derived artifacts
- Explicit, scoped contract approval before generation
- No source filenames in identity metadata
- No face matching or demographic inference
- No raw image URLs or biometric content in analytics
- Immediate deletion endpoint and visible deletion outcome
- Retail cohorts under a minimum size are suppressed

See [docs/privacy.md](docs/privacy.md) and [docs/architecture.md](docs/architecture.md).

Public product notices are available at `/privacy`, `/terms`, and `/security`. They require counsel and retailer-specific review before a real pilot.

## Demo assets

All images under `public/demo/` are synthetic assets generated for this prototype. They depict no real person and contain no logos. The source, apparel reference, and try-on output are intentionally stable enough for a repeatable product demonstration.

## Important limitation

KeepMe performs visual consistency assessment. It does not verify a person’s identity, infer sensitive traits, diagnose skin conditions, certify universal fairness, or guarantee garment fit.
