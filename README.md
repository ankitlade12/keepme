# AsShown

A clothing-shopping companion built on KeepMe: confirm an exact garment variant, set essential requirements, inspect source-backed findings, compare up to three items, and optionally open a consent-based YouCam preview.

The interface uses ivory, ink, and violet. No green UI theme. Examples are explicitly labeled illustrative listings and synthetic assets.

## Run locally

```sh
npm ci
npm run dev
```

Open the Local URL printed by Next.js. `/` is the product introduction, `/check` is the decision workspace, and `/studio` is the inherited preview workflow. No credentials are required for product-text checks or the controlled synthetic preview.

```sh
npm test
npx tsc --noEmit
npm run build
```

With a dev server on port 3001:

```sh
npm run test:asshown:api
npm run test:asshown:browser
npm run test:asshown:a11y
KEEPME_URL=http://localhost:3001 npm run smoke:guided
```

Browser checks require the Playwright Chromium executable. In this workspace it was downloaded to `/private/tmp/asshown-browsers`; set `PLAYWRIGHT_BROWSERS_PATH` to that directory. Screenshots are saved under ignored `artifacts/`.

## Configuration

Copy `.env.example` to `.env.local` and fill only the services you intend to enable. Keep secrets server-only and out of Git. Empty optional entries are ignored.

| Capability                              | Configuration                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Live YouCam Clothes v3                  | `YOUCAM_API_KEY`; optional `YOUCAM_API_BASE_URL`                                                                                                                                     |
| Durable preview sessions                | Separate development/staging `DATABASE_URL`, migrations, private `BLOB_READ_WRITE_TOKEN`                                                                                             |
| Production upload safety                | `MALWARE_SCAN_URL`, `MALWARE_SCAN_TOKEN`                                                                                                                                             |
| Appearance integrity                    | `INTEGRITY_WORKER_URL` or service binding `INTEGRITY_URL`, `INTEGRITY_WORKER_TOKEN`                                                                                                  |
| Signed preview receipts and cleanup     | `RECEIPT_SIGNING_SECRET`, `CRON_SECRET`                                                                                                                                              |
| Account history                         | Clerk publishable/server keys and PostgreSQL                                                                                                                                         |
| Community moderation                    | `ASSHOWN_MODERATOR_IDS` containing Clerk user IDs or `ASSHOWN_MODERATOR_EMAILS` containing verified Clerk email addresses; `ASSHOWN_COMMUNITY_ENABLED=true` only after launch review |
| Public retailer import                  | `ASSHOWN_RETAILER_HOSTS` containing exact, explicitly approved hostnames                                                                                                             |
| Text interpretation/Spanish translation | `OPENAI_API_KEY`, `ASSHOWN_AI_MODEL`                                                                                                                                                 |
| Optional visual observations            | The same OpenAI key and `ASSHOWN_VISION_MODEL` with image/structured-output support                                                                                                  |

Use a separate database from the original KeepMe production app. KeepMe migrations are in `db/migrations` and can be run with `npm run db:migrate`. AsShown’s independent records table is defined in `lib/asshown/records.ts`; production requires PostgreSQL. Single-process development uses an ignored, mode-0600 JSON file under `.asshown-data/`. This local fallback is not a deployment storage strategy.

The live provider version remains pinned to Clothes v3. Configuring a credential does not establish successful live verification. Do not use the controlled fixture as a live YouCam result.

## Product flows

- Import up to three JPEG/PNG product images and paste listing text; confirm variant.
- Set up to five essential/preferred requirements, including care, sleeves, functional pockets, closures, material, price, or custom needs.
- Inspect exact source spans, unknowns, conflicts, and seller-reported replies. Essentials cannot be outweighed by preferences.
- Compare up to three items, choose a next action, and export readable/JSON decision snapshots.
- Save/rename/update session profiles and explicitly save or load a server workspace. Account persistence requires configured authentication.
- Enter the YouCam studio with the selected garment when live mode is configured. Consent precedes provider uploads. Refresh resumes an existing task; ambiguous submissions are not blindly retried.
- Review separate appearance and garment observations. Unsupported/occluded or unvalidated checks cannot pass. Repairs preserve a separate original output.
- Review arrival photos against original product evidence and export a user-reviewed seller-message draft.
- Prepare public text contributions with explicit content preview/consent, moderation, disputes, appeals, and withdrawal. Optional product-only photos use opaque redaction, screened processing copies, separate consent and explicit moderator image review.
- Store private originals up to 4 MB with 30-day expiry, renewal, owner-only access and verified deletion. Keep larger originals locally; preview uploads use smaller processing copies.
- Use optional text translation, reviewed OCR, speech output/input, and image-free support reports. Direct OpenAI features require a project OpenAI API key and provider quota; Vercel AI Gateway is not used. Manual text flows remain available.
- Moderators can pause new paid processing with an audited reason.

## Current release status

**This is an implemented local prototype, not a completed all-phase public release.** See [the complete FR01–FR39 matrix](docs/asshown/STATUS.md) for implemented paths, partial coverage, and blocked acceptance criteria. No PRD requirement is silently removed from scope.

YouCam, Clerk, PostgreSQL/private Blob and hosted scanner/integrity services have passed live checks. Optional text/vision/OCR features now use OpenAI directly; all four passed local and hosted live app-route tests with the project OpenAI API key. See docs/asshown/STATUS.md for detailed evidence and remaining release work.

Garment/arrival model observations deliberately remain unvalidated, manual-review suggestions. The PRD’s 30-case demonstration evaluation, five real YouCam calls, larger held-out beta evaluation, participant interviews, moderation staffing, and provider-retention review are outstanding. Commercial prices/plans are unspecified in the PRD and no billing flow is invented.

## Evidence and privacy

The deterministic policy accepts only recognized explicit text statements. It does not claim comprehensive NLP/OCR extraction. Unknown phrases stay unknown. Optional language interpretation creates user-reviewed suggestions and never controls the decision policy.

Guest browser state has a 30-minute restore window; uploaded product images are omitted after refresh. Explicit account saves omit images. Preview images use separate authorized routes. Application deletion and provider retention are reported separately. A signature attests to a record, not the truth of its findings. Analytics are disabled by default.

## KeepMe baseline and substantial changes

Baseline: `ankitlade12/keepme` commit `2c4053db1c5b3144be29340f57a5419824db4b96` (MIT). The original project documentation is retained in [KEEPME_BASELINE_README.md](docs/asshown/KEEPME_BASELINE_README.md).

AsShown adds the requirement/evidence policy, variant-aware sources, seller questions/replies, shortlist comparison, account workspace storage, profiles/history, retailer import boundary, community moderation, arrival review, language assistance, support, and a new responsive UI. It also strengthens consent, generation reservation, refresh recovery, deletion behavior, repair lineage, and unchecked-verifier behavior in the inherited preview implementation.

Submission materials and remaining launch work are in [SUBMISSION.md](docs/asshown/SUBMISSION.md). Keep the MIT license and third-party notices when redistributing.

## Fresh development environment

The checkout is linked to `ankitlade12-3052s-projects/asshown`. A separate Neon free-plan database, private Blob store and Clerk Hobby instance are connected to Development and Preview. The initial database migration has been applied. Configuration is stored in Vercel and the ignored `.env.local`; no credential values belong in this repository. Use `localhost` when starting Next with Clerk enabled (`npm run dev -- --hostname localhost --port 3001`); binding to `127.0.0.1` can make the SDK’s normalized localhost rewrite loop.

Arrival check now supports a private evidence package with selected receipt, seller-reply and delivered-item JPEG/PNG attachments. The self-contained HTML download preserves selected original images and can be printed to PDF. Attachments are tab-local, omitted until selected, and require review before export.

Preview: https://asshown-k8wsuenzg-ankitlade12-3052s-projects.vercel.app (Vercel authentication required). The hosted synthetic live flow completed generation, integrity assessment, signed receipt and application-image deletion. Production remains unconfigured.
