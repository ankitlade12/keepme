# AsShown preview operations

This is a hackathon preview, not a calibrated production service. Keep the preview environment isolated from KeepMe production.

## Before opening community access

1. Configure an accountable moderator using `ASSHOWN_MODERATOR_IDS` or verified `ASSHOWN_MODERATOR_EMAILS` and test the queue with that account.
2. Review each report's exact SKU, retailer, variant, date and source wording. Review every photo for people, receipts, addresses, order numbers and private details. Automated face/segmentation checks are fallible; garment-shaped objects can trigger segmentation.
3. Publish only after the explicit image-review acknowledgment. Reasons and corrections stay in the audit history. A disputed report no longer supports current shopping findings; withdrawal prevents republication.
4. Keep `ASSHOWN_COMMUNITY_ENABLED=false` if no moderator is available. Do not invent seeded shopping reports.

## Processing incident

Use the moderator controls under Support to pause new paid requests with a specific reason. The server also honors `ASSHOWN_PAID_FEATURES_ENABLED=false`. These controls stop new requests; they cannot recall provider work already submitted. Record the affected task IDs and avoid resubmitting an ambiguous provider request.

## Evidence and deletion

Private originals are limited to 10 MB, upload directly into private quarantine, and are validated and scanned before becoming owner-authorized evidence. Upload tokens expire after five minutes; maintenance verifies quarantine deletion after the 15-minute intent window. Originals expire after 30 days unless explicitly renewed. The browser can handle larger local originals for exports; paired provider/vision processing uses smaller JPEG copies. Do not describe those processing copies as original evidence.

Deletion revokes application access before physical storage cleanup. Verify an image route returns 404, then inspect the stored purge/deletion status. The authenticated maintenance endpoint retries pending cleanup and expires consent/workspace records. Preview cron scheduling is not a guarantee of execution: before public launch, verify actual maintenance runs and alert on failed cleanup. Provider-side retention and backup restoration behavior require separate verification.

## Live verification

Use development Clerk credentials only for `scripts/asshown-account-smoke.mjs` and `scripts/asshown-community-smoke.mjs`. Scripts create temporary `+clerk_test@example.com` users and delete them afterward; they do not send emails or publish test reports. Set `ASSHOWN_URL` to the intended environment. `TEST_COMMUNITY_PHOTO=true` adds the product-photo screening check.

`KEEPME_URL=<preview> npm run smoke:live` spends real YouCam task credits. `ASSHOWN_TEST_GARMENT` selects a synthetic fixture under `public/demo`. A successful generation, an integrity decision, and physical image deletion are separate checks. Five fixture jobs are not a 30-case accuracy evaluation.

## Remaining release evidence

- OPENAI_API_KEY is configured for Development/Preview. Re-run scripts/asshown-ai-smoke.mjs after provider/model changes to verify direct-OpenAI interpretation, translation, OCR and visual-review flows. Gateway is no longer used by these routes. Manual flows remain usable.
- Complete the PRD's owned/licensed case set, held-out evaluation and observed user tasks. Record failures and abstentions as well as passes.
- Verify manual keyboard/screen-reader flows, cleanup monitoring and backup/deletion replay.
- Set up a public judge-accessible deployment and production authentication configuration before distributing a submission URL. Current previews require Vercel access.
- Review the local captioned video draft, repository access, actual costs and Devpost fields before publication. No submission or external message is automated by these scripts.

Retailer link import was removed at the user’s request. Intake uses pasted product details and uploaded photos. The retired import endpoint returns HTTP 410 for older open tabs and makes no outbound requests.

For originals over 4 MB, the web service issues a five-minute, single-object, GET-only private Blob URL to the authenticated scanner. The scanner rejects redirects and non-private-Blob hosts, bounds its download to 10 MB, verifies SHA-256, and returns the scanned hash with its malware decision. The web service rejects a missing or mismatched hash. Never log these short-lived URLs. This avoids the internal service request-body ceiling without skipping original-byte scanning.
