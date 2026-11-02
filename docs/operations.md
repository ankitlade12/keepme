# Operations

AsShown is a working hackathon preview. Use an isolated environment and synthetic inputs until the remaining release evidence is complete. See [architecture](architecture.md) and [privacy](privacy.md).

## Provisioning

1. Configure PostgreSQL, private Vercel Blob, Clerk, YouCam, and optional direct OpenAI credentials through host secrets. Keep development/preview separate from production.
2. Set `KEEPME_ALLOW_EPHEMERAL=false` and `KEEPME_AUTO_MIGRATE=false` in deployed environments.
3. Apply `db/migrations/001_initial.sql` using `npm run db:migrate` with `DATABASE_URL` exported, or `node --env-file=.env.local scripts/migrate.mjs` locally.
4. AsShown’s records adapter also executes `CREATE TABLE IF NOT EXISTS asshown_records` and creates its owner/category index on first use. Provision that schema from `lib/asshown/records.ts` and review the database role’s DDL permissions; do not assume the session migration covers it.
5. Deploy the scanner and integrity worker. Vercel service bindings supply `MALWARE_SCAN_URL` and `INTEGRITY_URL`; other hosts must provide private URLs. Set matching scanner/worker tokens and test unauthenticated rejection.
6. Configure a unique receipt secret of at least 32 characters and cron/worker secrets of at least 24 characters. Configure the site origin and Clerk environment for the intended domain.
7. Set explicit request budgets. Configure `ASSHOWN_AI_MODEL` and `ASSHOWN_VISION_MODEL` alongside the OpenAI key; a key alone does not select a model.

The root Dockerfile contains only the web service. Durable storage and private services are still required when using it outside Vercel.

## Verify a release

Run unit checks, TypeScript, lint, build, guided smoke, and browser journeys described in the [README](../README.md). Verify account isolation, owner-only image access, scanner failure behavior, signed receipt downloads, and deletion/absence checks with synthetic inputs.

`GET /api/health` reports configured runtime dependencies; it does not verify YouCam unit balance or complete a live provider task. The application checks unit availability before reserving live generation. On November 2, 2026, the account had zero units; the deployed guard returned HTTP 402, reserved zero tasks, and the synthetic session was deleted.

Live checks spend provider units. They must report generation, integrity assessment, approval, and deletion separately. Never substitute a controlled fixture for a live success or reset an ambiguous reservation simply to retry.

## Maintenance and deletion

`/api/internal/maintenance` requires the cron secret. Vercel supplies a daily fallback schedule. `.github/workflows/maintenance.yml` can run every five minutes when `KEEPME_MAINTENANCE_URL` and `KEEPME_CRON_SECRET` are configured in repository settings.

Confirm real executions, job lease recovery, bounded retries, expired upload-intent cleanup, and alerts for overdue purges. Access revocation happens before physical deletion; inspect purge outcomes and verified absence. Private originals expire after 30 days unless renewed. Provider retention and backups need separate review.

## Community launch

Keep `ASSHOWN_COMMUNITY_ENABLED=false` until a named moderator is available. Configure `ASSHOWN_MODERATOR_IDS` or verified `ASSHOWN_MODERATOR_EMAILS`. Review SKU/retailer/variant, source wording, redaction, and each image before publication. A disputed or withdrawn report must stop supporting current findings; withdrawn reports cannot simply be republished.

## Incidents and rollback

- **Cost spike or provider incident:** pause new paid requests through moderator operations or `ASSHOWN_PAID_FEATURES_ENABLED=false`. Preserve privacy-filtered task/usage metadata. Pausing cannot recall an already submitted task.
- **Unknown submission:** retain its reservation and reconcile provider history; do not blindly create another paid task.
- **Deletion failure:** revoke access, retain retryable cleanup work, investigate storage permissions/versioning, and verify absence before claiming deletion.
- **Credential disclosure:** revoke and replace the credential, redeploy, and inspect affected provider/storage/access logs without retaining extra personal images.
- **Integrity regression:** stop relying on automatic passing outcomes, review worker/provider changes, and evaluate against a governed holdout set.
- **Rollback:** restore a reviewed compatible application version, prefer forward schema repair, and repeat authorization, health, guided-flow, and cleanup checks.

## Remaining release evidence

Complete the owned/licensed case set, held-out accuracy evaluation, human raters, user interviews, keyboard/screen-reader checks, moderator/support staffing, independent security review, and backup/cleanup incident drills. The [calibration tooling](../calibration/README.md) does not establish that current thresholds are validated.

Provide stable judge access and repository access, replenish provider units, publish the reviewed demo video, and complete the hackathon submission separately. Temporary Vercel share links expire; do not place their bypass tokens in Git. Production rollout, billing, and external publication are not implied by a passing preview.
