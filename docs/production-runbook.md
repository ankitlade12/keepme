# Production runbook

## Stack

- Next.js web/API: Vercel or the included standalone Docker image.
- Metadata/jobs/audit: managed Postgres through `DATABASE_URL`.
- Sensitive artifacts: private S3-compatible bucket with SSE-KMS.
- Vision: `services/integrity-worker` on a private container service.
- Upload malware scanning: authenticated service returning `{ "clean": true }`.
- Authentication: GitHub OAuth through Auth.js, restricted by `RETAILER_EMAIL_ALLOWLIST`.
- Telemetry: OpenTelemetry through the hosting platform; operational event rows remain privacy-filtered.

## Release gates

1. Rotate all previously shared credentials.
2. Set every variable in `.env.example`, set `KEEPME_ALLOW_EPHEMERAL=false`, and run `npm run check:production` in CI.
3. Apply `npm run db:migrate` with a migration-only database role. Keep `KEEPME_AUTO_MIGRATE=false` and give the runtime role only DML permissions.
4. Apply least-privilege runtime database and bucket credentials. Block all public bucket access.
5. Deploy the vision worker and scanner; verify their health and authentication.
6. Run unit, build, guided smoke, accessibility, authorization, upload-abuse, cleanup, and restore drills.
7. Add the custom domain, TLS, OAuth callback, security contact, privacy contact, processor terms, alert routing, and on-call owner.
8. Start with a capped internal tenant, inspect provider usage and deletion telemetry, then expand deliberately.

## Incidents

- Provider cost spike: set the tenant hourly provider limit to zero, preserve non-image audit events, and investigate request fingerprints.
- Deletion verification failure: stop new uploads, retain the cleanup job for retry, inspect storage policy/versioning, and do not show deletion confirmation.
- Suspected credential disclosure: revoke first, replace hosting secrets, redeploy, then review provider and audit logs.
- Integrity regression: pin the last calibrated threshold profile, disable automatic approval, and route results to review.
