# Privacy and Data Handling

KeepMe treats person photos, garment images, generated results, masks, heatmaps, preserve zones, repair artifacts, and provider references as sensitive session data.

This document describes the implemented data boundary. It is technical documentation, not a substitute for a reviewed privacy notice or jurisdiction-specific legal advice.

## Privacy Principles

- **Purpose limitation:** process images only for the shopper-approved try-on and integrity check.
- **Session scope:** consent and artifacts belong to one generation, not a persistent identity profile.
- **Data minimization:** retain only what the active session and verifiable deletion process require.
- **Separation:** retailers receive aggregate quality signals, never individual shopper imagery.
- **Verifiable deletion:** do not claim deletion until configured storage confirms artifact absence.
- **No sensitive inference:** do not infer demographics, protected traits, identity, or medical conditions.

## Data Inventory

| Data | Purpose | Storage | Default retention | Included in analytics |
|---|---|---|---|---|
| Source person image | Generate and compare the try-on | Session artifact store | Until immediate deletion or session expiry | No |
| Garment image | Generate the try-on | Session artifact store | Until immediate deletion or session expiry | No |
| Generated/repaired image | Present, verify, and optionally approve | Session artifact store | Until immediate deletion or session expiry | No |
| Masks, heatmaps, crops | Integrity checks and explanation | Session artifact store | Until immediate deletion or session expiry | No |
| Preserve zones | Apply shopper-selected hard rules | Session metadata/artifacts | Until immediate deletion or session expiry | No raw geometry in product analytics |
| Identity Contract and consent | Record the authorized edit | Session metadata | Active session; receipt keeps only bounded proof fields/digests | No free-form data |
| Provider task/file references | Poll and retrieve provider work | Session metadata | Until deletion or expiry cleanup | No URLs or credentials |
| Integrity Receipt | Give the shopper verifiable evidence | Downloaded by shopper; bounded server record | According to deployment policy | No raw images |
| Operational event | Reliability, cost, deletion, and aggregate quality | Postgres/log platform | Deployment-defined | Privacy-filtered fields only |

Local guided mode uses static synthetic assets and may use in-process metadata/artifact adapters. Public production must use durable tenant-scoped Postgres and private object storage.

## Default Lifecycle

1. A private session and opaque shopper capability are created.
2. The shopper reviews an Identity Contract and approves it for one generation.
3. Uploads are decoded, bounded, stripped of metadata, re-encoded, and scanned before provider use.
4. Images move through short-lived, server-only references; provider credentials remain server-side.
5. Integrity checks return bounded measurements and reason codes to the product UI.
6. If approved, a signed receipt binds digests and decision metadata without embedding image content.
7. The shopper may delete immediately; otherwise an expiry job claims the session.
8. Cleanup removes source, garment, generated, repaired, mask, heatmap, crop, URL, and cached representations.
9. Deletion is reported as complete only after configured storage confirms absence.
10. A privacy-filtered deletion event or aggregate count may remain.

The default local session lifetime is 30 minutes and can be configured from 5 to 120 minutes with `SESSION_TTL_MINUTES`.

## Telemetry Boundary

Allowed operational fields include:

- event category and bounded event name;
- opaque session or tenant identifier;
- reason codes, decision state, counts, duration, and provider-unit totals;
- deletion outcome and non-identifying health status.

Disallowed telemetry includes:

- image bytes, crops, masks, heatmaps, or base64 content;
- source or provider URLs;
- credentials, tokens, cookie values, or receipt-signing secrets;
- original filenames;
- names, email addresses, free-form shopper descriptions, or inferred identity attributes.

Vercel Analytics and Speed Insights are limited to navigation and performance telemetry. Sensitive session artifacts are not sent to those products.

## Explicit Exclusions

KeepMe does not implement or permit:

- cross-session face matching;
- persistent face embeddings;
- demographic or protected-class inference;
- medical or dermatological diagnosis;
- training use without a separate, explicit program and opt-in;
- retailer access to individual customer images;
- free-form shopper descriptions in analytics;
- representation of the controlled fixture as a fresh live-provider failure.

## Access Boundaries

- Shopper session access is bound to an opaque capability cookie.
- Retailer access requires Clerk authentication, exact allowlisting, and a stable tenant identifier.
- Individual session imagery is not available on retailer routes.
- Unknown and unauthorized sessions share the same 404 response to reduce enumeration signal.
- Private object paths and provider URLs are never returned directly to the browser.
- Signed receipts contain bounded evidence and digests, not raw image data.

## Environment Boundary

| Environment | Allowed behavior |
|---|---|
| Local guided demo | Synthetic fixtures and ephemeral adapters are allowed |
| Local live development | Personal test images may be used only by the developer under their own provider/storage policies |
| Protected preview | Team review with synthetic data; not approved for public uploads |
| Public production | Must set `KEEPME_ALLOW_EPHEMERAL=false` and pass every readiness, legal, security, and operational gate |

When ephemeral fallbacks are disabled, production startup/readiness requires Postgres, private object storage, Clerk, receipt signing, cleanup authorization, malware scanning, the integrity worker, and the configured YouCam provider.

## Operator Responsibilities

Before accepting personal images, the operator must publish and enforce:

- a reviewed privacy notice and retention schedule;
- processor/vendor terms and data-location decisions;
- a contact and process for access, deletion, consent withdrawal, and incident requests;
- backup and restore behavior that matches deletion promises;
- log, receipt, and aggregate-event retention periods;
- breach response and notification procedures;
- documented handling for storage versioning, failed deletion, and provider-side retention.

## Related Documentation

- [Project overview](../README.md)
- [Architecture and integrity policy](architecture.md)
- [Security review](security-review.md)
- [Production runbook](production-runbook.md)
- [Calibration protocol](../calibration/README.md)
