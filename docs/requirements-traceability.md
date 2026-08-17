# Beta Requirements Traceability

This matrix connects product requirements to repository evidence and separates implemented behavior from production evidence that must come from configured services, governed data, or independent review.

## Status Definitions

| Status | Meaning |
|---|---|
| Implemented | The behavior and its primary verification exist in this repository |
| Conditional | The code path exists but depends on external configuration or credentials |
| External evidence required | Completion cannot be established from repository code alone |

## Product Requirements

| Requirement area | Status | Repository evidence | Production follow-up |
|---|---|---|---|
| Person and garment intake | Implemented | [`StudioApp.tsx`](../components/StudioApp.tsx), [`upload-security.ts`](../lib/upload-security.ts), and [`upload-security.test.ts`](../lib/upload-security.test.ts) implement catalog selection, JPEG/PNG validation, 10 MB/24 MP bounds, metadata stripping, safe reconstruction, and scanner integration | Connect the production scanner and complete adversarial parser testing |
| Identity Contract | Implemented | [`contract.ts`](../lib/contract.ts), [`types.ts`](../lib/types.ts), and [`PreserveMap.tsx`](../components/PreserveMap.tsx) implement defaults, toggles, consent fields, custom zones, and schema-backed state | Validate retailer-specific consent copy and retention language with counsel |
| Shopper session authorization | Implemented | [`session-auth.ts`](../lib/session-auth.ts), [`security.ts`](../lib/security.ts), and [`security.test.ts`](../lib/security.test.ts) implement opaque capabilities, same-origin mutation checks, and authorization behavior | Complete external enumeration, CSRF, and authorization testing |
| Retailer authentication and isolation | Conditional | [`proxy.ts`](../proxy.ts), [`session-auth.ts`](../lib/session-auth.ts), and [`dashboard/page.tsx`](../app/dashboard/page.tsx) integrate Clerk, exact allowlisting, and stable tenant ownership | Provision a Clerk production instance and run independent tenant-isolation tests |
| Apparel virtual try-on | Conditional | [`youcam.ts`](../lib/youcam.ts) and [`StudioApp.tsx`](../components/StudioApp.tsx) implement disclosed fixtures plus live File API upload, Clothes v3 task creation, bounded polling, result proxying, and provider budgets | Provision production YouCam quota, confirm API/version eligibility, and load-test polling |
| Skin consistency | Conditional | [`youcam.ts`](../lib/youcam.ts) and [`live-integrity.ts`](../lib/live-integrity.ts) implement optional Skin Analysis v2.1 submission and normalized comparison | Validate production responses, eligibility, data handling, and unavailable-signal behavior |
| Integrity engine | Implemented | [`integrity.ts`](../lib/integrity.ts), [`integrity.test.ts`](../lib/integrity.test.ts), [`live-integrity.ts`](../lib/live-integrity.ts), and [`services/integrity-worker`](../services/integrity-worker/) implement hard rules, five states, pixel checks, garment no-op detection, face-landmark/silhouette signals, and controlled fixtures | Calibrate and freeze a reviewed profile using governed evaluation data |
| Explanation | Implemented | [`StudioApp.tsx`](../components/StudioApp.tsx) provides side-by-side comparison, highlighted regions, component evidence, confidence, and plain-language findings | Add a pixel-derived heatmap with a patterned accessible legend |
| Repair and reverification | Implemented | [`StudioApp.tsx`](../components/StudioApp.tsx), [`live-integrity.ts`](../lib/live-integrity.ts), and session action routes implement controlled repair, feathered source-zone compositing, and reverification | Add occlusion and alignment safety gates for broader repair eligibility |
| Approval and receipt | Implemented | [`receipt-factory.ts`](../lib/receipt-factory.ts), [`receipt-signing.ts`](../lib/receipt-signing.ts), [`receipt-signing.test.ts`](../lib/receipt-signing.test.ts), and receipt API routes implement explicit approval, signed JSON, evidence digests, download, and verification | Add public-key provenance if cross-organization verification is required |
| Immediate and expiry deletion | Implemented | [`maintenance.ts`](../lib/maintenance.ts), [`job-queue.ts`](../lib/job-queue.ts), [`object-store.ts`](../lib/object-store.ts), and session delete routes implement immediate deletion, expiry jobs, retries, and absence checks | Run storage-versioning, provider-retention, restore, and disaster-recovery deletion drills |
| Retailer analytics | Conditional | [`retailer-analytics.ts`](../lib/retailer-analytics.ts), [`database.ts`](../lib/database.ts), dashboard, and export route implement tenant-scoped events, provider usage, CSV output, and minimum-cohort suppression | Validate configured Postgres queries and cohort definitions in an approved pilot |
| Rate and cost controls | Implemented | [`security.ts`](../lib/security.ts), [`job-queue.ts`](../lib/job-queue.ts), and [`server-config.ts`](../lib/server-config.ts) enforce per-IP, per-session, and hourly provider constraints | Tune limits against production quota and alerting data |
| Operational telemetry | Conditional | [`observability.ts`](../lib/observability.ts), [`instrumentation.ts`](../instrumentation.ts), and Vercel components in [`layout.tsx`](../app/layout.tsx) provide structured events, OpenTelemetry, Web Analytics, and Speed Insights | Configure monitoring destinations, alerts, retention, and privacy review |
| Fail-closed production readiness | Implemented | [`server-config.ts`](../lib/server-config.ts), [`production-readiness.mjs`](../scripts/production-readiness.mjs), and [`.env.example`](../.env.example) reject missing durable dependencies when ephemeral fallbacks are disabled | Run the gate inside every release environment and retain the result |
| Accessibility | Implemented with external review pending | Semantic controls, skip link, visible focus, keyboard controls, reduced motion, and [`accessibility-audit.mjs`](../scripts/accessibility-audit.mjs) provide automated WCAG A/AA coverage | Complete independent keyboard, screen-reader, zoom, contrast, and cognitive walkthroughs |
| CI and reproducible demo | Implemented | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), [`guided-flow-smoke.mjs`](../scripts/guided-flow-smoke.mjs), and package scripts run audit, lint, tests, build, guided smoke, browser-rendering, and accessibility checks | Add monitored deployment smoke checks and release evidence retention |
| Calibration and decision quality | Tooling implemented; external evidence required | [`calibrate-integrity.mjs`](../scripts/calibrate-integrity.mjs) and the [calibration protocol](../calibration/README.md) define input, false-negative constraint, and immutable output behavior | Obtain consented, independently labeled data; review subgroup coverage without sensitive-trait inference |
| Legal and operational readiness | External evidence required | Public privacy, terms, security pages and the [production runbook](production-runbook.md) document the intended boundary | Complete vendor, jurisdiction, incident, backup, deletion, accessibility, and security reviews |

## Verification Commands

| Evidence | Command |
|---|---|
| Static quality | `npm run lint` |
| Unit/component behavior | `npm test` |
| Production compilation | `npm run build` |
| Guided lifecycle | `npm run smoke:guided` |
| Automated browser rendering and accessibility | `npm run audit:a11y` |
| Required production dependencies | `npm run check:production` |
| Threshold generation | `npm run calibrate -- <consented-evaluation.jsonl>` |

Passing these commands establishes repository behavior only. It does not establish production credentials, vendor compliance, real-world calibration quality, penetration-test results, or legal readiness.

## Related Documentation

- [Project overview](../README.md)
- [Architecture and integrity policy](architecture.md)
- [Privacy and data handling](privacy.md)
- [Security review](security-review.md)
- [Production runbook](production-runbook.md)
- [Calibration protocol](../calibration/README.md)
