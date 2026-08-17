# Production Runbook

This runbook is for operators deploying KeepMe beyond the synthetic local demo. The current hosted environment is a protected preview; completing this document’s checks does not replace independent security, privacy, accessibility, and legal review.

## Deployment Topology

| Layer | Production expectation |
|---|---|
| Web/API | Next.js service on Vercel or the included standalone container |
| Metadata/jobs/audit | Managed Postgres through `DATABASE_URL` |
| Sensitive artifacts | Private Vercel Blob with server-only access |
| Authentication | Clerk with an exact retailer allowlist and organization/user tenant isolation |
| Virtual try-on | YouCam Clothes v3 and optional Skin Analysis v2.1 through server-only credentials |
| Integrity analysis | Authenticated private `services/integrity-worker` deployment |
| Upload scanning | Authenticated scanner returning `{ "clean": true }` |
| Proof | Stable, rotated receipt-signing secret |
| Telemetry | OpenTelemetry plus privacy-filtered events and operator alerts |
| Cleanup | Authenticated maintenance route invoked on a monitored schedule |

[`vercel.json`](../vercel.json) defines a Vercel Services deployment with a private integrity-service binding and a daily fallback cron. Other platforms must deploy the worker separately and set `INTEGRITY_WORKER_URL`.

## Required Roles

Assign named owners before release:

- release owner;
- database/migration owner;
- security and incident owner;
- privacy/deletion owner;
- YouCam quota/cost owner;
- on-call escalation contact.

No single shared administrator account should be the only path to production recovery.

## Preflight

### 1. Verify Source and CI

Deploy only a reviewed commit for which the following pass:

```bash
npm ci
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npm run build
```

Record the commit SHA and CI run URL in the release record.

### 2. Provision Configuration

Set the deployment’s encrypted variables from [`.env.example`](../.env.example). At minimum, production readiness requires:

```text
DATABASE_URL
BLOB_READ_WRITE_TOKEN
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
RETAILER_EMAIL_ALLOWLIST
RECEIPT_SIGNING_SECRET
CRON_SECRET
MALWARE_SCAN_URL
INTEGRITY_WORKER_TOKEN
INTEGRITY_WORKER_URL or INTEGRITY_URL
YOUCAM_API_KEY
NEXT_PUBLIC_SITE_URL
KEEPME_ALLOW_EPHEMERAL=false
```

Use unique production credentials. Do not copy development secrets, commit `.env.local`, or expose server-only values through `NEXT_PUBLIC_*` names.

Run the fail-closed gate inside the deployment environment:

```bash
npm run check:production
```

### 3. Prepare Postgres

1. Create separate migration and runtime roles.
2. Give the migration role schema-change permissions.
3. Give the runtime role only required DML permissions.
4. Keep `KEEPME_AUTO_MIGRATE=false` in production.
5. Run:

```bash
npm run db:migrate
```

6. Confirm backups, point-in-time recovery, connection limits, TLS, and tested restore procedures.

### 4. Prepare Private Artifact Storage

- Deny all public bucket access.
- Use a server-only token scoped to the intended store.
- Review versioning and soft-delete behavior against the published deletion promise.
- Test write, read, delete, and post-delete absence checks with synthetic files.
- Configure alerts for policy or access changes.

### 5. Deploy Supporting Services

Deploy the integrity worker from [`services/integrity-worker`](../services/integrity-worker/) and the authenticated malware scanner.

Verify:

- `/health` succeeds for the worker from the private application network;
- unauthenticated analysis requests return 401;
- the configured worker token is at least 24 characters and unique to the environment;
- the scanner rejects missing/invalid authentication;
- scanner failure blocks uploads when ephemeral fallbacks are disabled;
- worker/scanner timeouts and payload limits match the web function limits.

## Deployment Procedure

1. Freeze the release commit and configuration change set.
2. Apply the database migration.
3. Deploy or update the integrity worker and scanner.
4. Deploy the Next.js web/API service.
5. Confirm the custom domain, TLS, Clerk production domain, and allowed redirect/origin settings.
6. Verify `GET /api/health` returns HTTP 200 with `database: "connected"` and `objectStorage: "durable"`.
7. Run the guided smoke test against the deployment:

```bash
KEEPME_URL=https://your-domain.example npm run smoke:guided
```

8. Run the automated accessibility audit:

```bash
KEEPME_URL=https://your-domain.example npm run audit:a11y
```

9. Test Clerk retailer access with allowed and denied accounts.
10. Run one approved synthetic live-provider session and verify provider usage, receipt download/verification, immediate deletion, and absence confirmation.
11. Inspect runtime logs and traces for errors and confirm no image URLs, filenames, credentials, or free-form personal data were recorded.
12. Enable traffic only after the release owner signs the checklist.

## Cleanup Scheduling

Vercel Cron calls `/api/internal/maintenance` daily as a fallback according to [`vercel.json`](../vercel.json). A production pilot should use a more frequent monitored scheduler appropriate to the session TTL.

If GitHub Actions or another external scheduler is used, configure it to call the same endpoint with `CRON_SECRET` and keep the deployment URL in a protected variable. This repository does not currently include a five-minute maintenance workflow; operators must add and monitor one before relying on that cadence.

Verify on every release:

- invalid or missing cleanup credentials are rejected;
- expired and failed sessions are claimed once through leases;
- stale leases recover after worker failure;
- artifact deletion retries are bounded;
- deletion failure does not produce a success confirmation;
- cleanup age and failure alerts reach the on-call owner.

## Gradual Rollout

1. Start with a capped internal retailer tenant and synthetic inputs.
2. Set conservative per-session and hourly provider budgets.
3. Review generation success, integrity states, inconclusive rate, provider units, cleanup lag, and deletion outcomes.
4. Enable real personal-image processing only after calibration, policy, security, and legal approvals are recorded.
5. Expand tenants and quota deliberately; never remove hard failure or deletion gates to improve demo conversion.

## Rollback

Rollback is appropriate for runtime regressions, elevated errors, authorization concerns, unexpected provider cost, integrity-policy regressions, or deletion failures.

1. Stop new uploads or set provider budget to zero when data/cost exposure is possible.
2. Preserve privacy-filtered operational events and failed cleanup jobs; do not preserve extra image artifacts for debugging without documented authority.
3. Roll back the web service to the last verified commit.
4. Do not reverse a database migration unless a reviewed down-migration exists. Prefer forward repair.
5. Confirm the previous release is compatible with the current schema and receipt format.
6. Rerun health, guided smoke, authorization, and cleanup checks.
7. Record the incident, affected interval, decision owner, and follow-up work.

## Incident Playbooks

### Provider Cost Spike

1. Set the affected tenant’s hourly provider limit to zero or disable live generation.
2. Preserve privacy-filtered usage events.
3. Check duplicate-task protection, polling attempts, request fingerprints, and provider dashboards.
4. Rotate the provider key if misuse is suspected.
5. Restore quota gradually after the cause is fixed.

### Deletion Verification Failure

1. Stop new personal-image uploads.
2. Keep the cleanup job in a retryable failed state.
3. Do not show deletion confirmation.
4. Inspect storage policy, versioning, permissions, replication, and provider-side retention.
5. Notify the privacy/security owner and follow the published response procedure.
6. Record verified absence before closing the incident.

### Suspected Credential Disclosure

1. Revoke the credential first.
2. Replace it in the encrypted deployment store.
3. Redeploy affected services.
4. Review provider, database, storage, Clerk, GitHub, and runtime logs.
5. Assess whether notification or user action is required.

### Integrity Regression

1. Disable automatic approval and route results to review.
2. Pin the last reviewed threshold profile and fixture set.
3. Compare component signals, hard-rule behavior, worker version, and provider version.
4. Re-run calibration and mutation checks only with governed data.
5. Restore automatic decisions only after independent review.

### Tenant-Isolation Concern

1. Disable retailer exports and dashboard access.
2. Preserve privacy-filtered audit evidence.
3. Test the suspected path with synthetic tenant accounts.
4. Rotate affected session/auth secrets if needed.
5. Complete incident and notification review before re-enabling access.

## Routine Operations

| Cadence | Task |
|---|---|
| Continuous | Alert on health degradation, 5xx errors, cleanup failures, and provider-budget anomalies |
| Daily | Review expired-session backlog, failed jobs, provider usage, and scanner/worker availability |
| Weekly | Review dependency advisories, access changes, Clerk allowlist, and privacy-filtered log samples |
| Monthly | Test credential inventory, restore procedure, deletion behavior, and incident contacts |
| Each release | Run the full preflight, smoke, authorization, telemetry, and cleanup checks |
| Each threshold change | Re-run governed calibration, regression fixtures, review, and profile versioning |

## Decommissioning

Before shutting down an environment:

1. Stop new sessions and provider tasks.
2. Process or cancel active sessions according to the published policy.
3. Run cleanup and verify artifact absence.
4. Export only approved non-image operational records required by policy.
5. Revoke provider, database, storage, Clerk, scanner, worker, cron, and signing credentials.
6. Delete or archive infrastructure according to the retention schedule.
7. Verify DNS, callbacks, schedulers, and public status pages no longer target the environment.
8. Record final deletion and ownership sign-off.

## Related Documentation

- [Project overview](../README.md)
- [Architecture and integrity policy](architecture.md)
- [Privacy and data handling](privacy.md)
- [Security review](security-review.md)
- [Requirements traceability](requirements-traceability.md)
