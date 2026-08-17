# Architecture

## Current product

```text
Next.js web experience
  ├─ Landing and retailer surfaces
  ├─ Clerk retailer access and opaque shopper capabilities
  ├─ Guided and live product orchestration
  └─ /api/v1 session boundary
       ├─ Versioned Identity Contract validation (Zod)
       ├─ Explicit integrity decision policy
       ├─ YouCam server adapter
       ├─ Signed receipt generation and verification
       ├─ Postgres metadata, jobs, events, usage, and rate limits
       ├─ Private Vercel Blob artifact storage
       └─ Verified deletion and expiry cleanup
```

The demo is deterministic so a three-minute judge flow cannot depend on a generative model happening to produce an unauthorized edit. It is labeled “controlled demo” in the UI and API responses.

## Production deployment

```text
Browser
  → Next.js app / API gateway
    → Postgres session metadata
    → encrypted, lifecycle-managed object storage
    → job queue
       ├─ YouCam AI Clothes upload/task/poll adapter
       ├─ YouCam Skin Analysis upload/task/poll adapter
       └─ integrity worker
          ├─ quality and alignment
          ├─ garment/uncertainty masks
          ├─ outside-region comparison
          ├─ face landmark displacement (not recognition)
          ├─ skin and silhouette consistency
          ├─ preserve-zone hard rules
          └─ repair and reverification
```

Production polling must use bounded backoff and idempotency keys; webhook completion is preferred where YouCam supports it. A cleanup worker must delete all temporary imagery and derived artifacts on expiry, including partial and failed sessions.

## Integrity decision policy

The weighted summary follows the PRD, but hard rules take precedence:

- unreliable alignment or low input confidence → `inconclusive`
- critical preserve-zone failure → `failed`
- low outside-region or face stability → `needs_review`
- no critical finding and calibrated score → `passed`
- repaired and reverified output → `passed_after_repair`

Skin Analysis is a secondary consistency signal. An unavailable skin check reduces confidence and is never an automatic failure.

## Implementation status

Implemented now:

- Complete product journey and responsive interaction design
- Identity Contract schema and toggles
- Preserve Map representation and custom glasses zone
- Result types, reason taxonomy, scoring, hard rules, and unit tests
- Deterministic compliant, violating, and repaired fixtures
- Receipt and deletion flows
- Session API with live/demo orchestration boundary
- YouCam AI Clothes v3 and Skin Analysis v2.1 adapters
- Retailer aggregate view and cohort-suppression communication
- Opaque shopper capabilities, Clerk retailer authentication, stable organization/user tenant IDs, and an exact retailer allowlist
- Upload decoding, pixel/size bounds, metadata stripping, safe re-encoding, and scanner adapter
- Postgres session/job/audit/provider-usage adapters with an in-process demo fallback
- Private Vercel Blob adapter with server-only access and deletion verification
- Rate limits and per-session/tenant provider credit budgets
- OpenTelemetry and privacy-filtered operational events
- Signed downloadable receipts and public verification endpoint
- Privately bound container service for MediaPipe face-landmark and person-segmentation analysis
- Five-minute GitHub Actions cleanup, daily Vercel fallback cron, lease-recovering retry queue, health route, Docker/Vercel configuration, CI, legal and security surfaces

Requires external provisioning or real-world evidence:

- Malware scanner, monitoring exporter, domain, and production secrets not supplied by managed integrations
- Credential rotation and verified YouCam production quota
- A consented, governed, independently labeled calibration dataset; tooling is included, but results cannot be fabricated
- Human screen-reader/keyboard audit, penetration test, processor/vendor review, incident drill, and jurisdiction-specific legal review
