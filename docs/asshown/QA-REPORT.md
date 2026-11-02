# Full-feature QA — 2026-11-01

Scope: all 39 M/B/G functional requirements. A passing workflow is not a validated model accuracy claim or a production release approval. This report supersedes historical verification counts in STATUS.md.

## App copy cleanup and demo kit — 2026-11-01

Removed or shortened more than 40 helper blocks across the shopping workspace, studio, account storage, community, support, OCR, evidence export and footer. Removed the extra advice card and repeated page introductions. Kept field labels, error/status messages, explicit processing/publication consent, source provenance and concise decision limitations.

`public/demo-kit/index.html` provides a gallery and copyable descriptions; `public/demo-kit.zip` contains 16 files including seven images, both product descriptions, seller replies, arrival observations, source HTML cards and the full README walkthrough. Products and document screenshots are explicitly fictional; the shopper is synthetic. The recorded preview is labeled as an older reference, not a new result. All images fit upload limits, and the ZIP passed integrity checks.

81 tests and the production build pass; six browser scenarios and automated workspace accessibility checks pass. `scripts/asshown-demo-kit-smoke.mjs` verifies the seven gallery images, exact ZIP download, the supplied rust listing's two-supported/one-unknown result, seller-reply resolution, garment handoff, shopper upload, consent gating and studio cleanup. It deliberately does not request a new paid generation. Earlier live-generation evidence remains historical. Final preview `asshown-p947wymc4-ankitlade12-3052s-projects.vercel.app` is READY. All six hosted workspace scenarios passed. The full kit walkthrough passed using the same temporary share session as a user, including the exact ZIP download and studio cleanup. The initial agent-header download test timed out; user-session download and the rerun succeeded.

## Current scope: retailer link import removed — 2026-11-01

At the user's explicit request, Amazon/retailer link import and its variant dropdowns were removed from the product. The active entry flow is pasted listing details plus product photos. The scraper, HTML parser dependency and obsolete importer tests/scripts were removed. Old open tabs receive HTTP 410 with a clear manual-entry message; no retailer request is made.

81 tests pass across 21 files after retiring the importer-specific suite. Production build and six browser regression scenarios pass, including absence of link-import controls and variant confirmation reset on edits. Final preview `asshown-8fuco4snk-ankitlade12-3052s-projects.vercel.app` is READY. All six hosted browser scenarios passed; the retired endpoint returned HTTP 410. Fresh-browser review access and the absence of import controls were verified. Historical import results below describe retired behavior, not a current feature. The remaining PRD phases are unchanged; FR07 is explicitly removed from current scope by the user.

## Amazon variant dropdowns — 2026-11-01 client date

Amazon import now reads bounded, inert JSON variant metadata rather than executing retailer scripts. It preselects the exact requested ASIN's color and size and presents only combinations listed for the same other dimensions (for example, material). The captured B096YM16SV page provides Black / X-Large and 66 combinations for recycled polyester. This is not a stock/price guarantee.

Changing color or size fetches that combination's ASIN and replaces its source text and SKU only after successful import. Confirmation resets, and prior attached photos clear to avoid carrying the wrong variant into the preview. A failed request preserves the previous successful selection. Missing, malformed, ambiguous or mismatched metadata falls back to editable fields; no options are fabricated. Deleting/resetting the draft clears variant metadata.

94 tests and the production build pass; lint has zero errors and 12 pre-existing warnings. Controlled browser checks pass initial selection, changing to Black / Small (B096YJMFDJ), confirmation reset, and failed-request recovery. Live local testing encountered a larger uncompressed response, then an Amazon automated-access restriction page. Downloaded and decoded bodies are now both bounded at 4 MB, and supported compression is explicitly negotiated. Final preview `asshown-fwyjgsnf9-ankitlade12-3052s-projects.vercel.app` is READY. Hosted controlled browser tests passed dropdown population, variant switching, confirmation reset and failed-request recovery. The live hosted test returned manual fallback because the response did not identify the requested ASIN. No validation was bypassed. Live automatic variant import remains blocked in this run; approved product-data access is needed for reliable operation. Fresh-browser temporary review access passed. Controlled UI checks are not evidence of reliable retailer access.

## Amazon import correction — 2026-11-02

The earlier manual fallback did not prove Amazon had blocked this product. Diagnosis found that the HTTP client treated gzip-compressed bytes as UTF-8 HTML. After decompression, the 2.7 MB page was readable but did not contain the JSON-LD Product format the original parser required.

The importer now bounds both downloaded and decompressed bodies, supports gzip/deflate/Brotli, and extracts Amazon title, brand and product facts only when the page has one matching selected ASIN. It excludes reviews and scripts. CAPTCHA, ambiguous/mismatched identity and missing facts remain manual fallback with an actionable reason. Color/size remain unconfirmed; no product-specific fixture is served as live data.

Local real-network import of B096YM16SV returned `mode: imported`, the correct jacket title, Amazon Essentials brand and care instructions. The updated regression suite has 92 passing tests; production build passes. Hosted browser verification on `asshown-ft1i8b6za-ankitlade12-3052s-projects.vercel.app` confirmed real product fields populate and color/size remain unconfirmed. An Amazon search URL is used for invalid-input testing. The old B000000000 fixture unexpectedly resolves to a product and must not be assumed nonexistent. CAPTCHA/mismatch/missing facts are covered by controlled unit fixtures. Other retailers and arbitrary Amazon variants are not guaranteed by this single-case check.

## Earlier retailer results (before the correction above)

- Hosted Amazon `/dp/B0CM6S894C?tag=qa-tracking`: HTTP 200 **manual fallback**, canonical URL and ASIN preserved, tracking removed, no invented title/text, variant remains unconfirmed. This ASIN comes from a published catalog; current stock/listing availability is not established.
- Amazon search URL: HTTP 422 with request for a full product link.
- Patagonia product URL: hosted HTTP 422 because the domain is not enabled. Running the real importer with that host explicitly allowlisted still rejects its crawl restrictions. Restrictions were respected.
- **Automatic retailer listing extraction has no successful live acceptance result.** Pasted listing text remains the working intake path. The separate Amazon confirmation regression uses a clearly controlled response to make the browser test repeatable.

## Defects found and fixed

1. Reloading `?example=1` restored example products after deleting the workspace. The example action now consumes its URL parameter, preserving subsequent state and deletion on reload.
2. Amazon manual fallback retained an earlier checked confirmation. Every new import now clears confirmation before evaluating the newly supplied source.
3. Private vault photo handoffs were silently ignored by the studio. Exact same-origin asset UUID routes are now accepted, with existing owner authorization intact. Arbitrary external URLs remain rejected.

## Coverage matrix

“Pass” below means the stated tested boundary, not every possible input or acceptance study. “Partial” explicitly retains outstanding work.

| Requirement                 | Evidence and limits                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR01 Guest/account access   | Pass: hosted guest isolation, real Clerk account save/restore, cross-account denial; synthetic test users removed.                                                                               |
| FR02 Product intake         | Pass: text and image validation, three-item bound, large private originals and OCR fixtures. Partial: retailer automation and broad OCR accuracy.                                                |
| FR03 Exact variant          | Pass: corrections invalidate prior support; arrival mismatch and import confirmation regressions.                                                                                                |
| FR04 Interpretation         | Pass: live direct OpenAI editable suggestions. Partial: broad language accuracy.                                                                                                                 |
| FR05 Essentials/preferences | Pass: unit policy tests and browser importance changes.                                                                                                                                          |
| FR06 Profiles               | Pass: browser create, rename, apply, replace, delete and persistence.                                                                                                                            |
| FR07 Website import         | Partial: live Amazon canonicalization/fallback and blocked URL tests; automatic extraction unverified.                                                                                           |
| FR08 Claims/provenance      | Pass: original text retained; source exclusion/restoration with reason.                                                                                                                          |
| FR09 Evidence cards         | Pass: quotations, source classes and unknown states in browser/unit checks.                                                                                                                      |
| FR10 Conflicts              | Pass: contradictory seller reply, exclusion and restoration recompute findings.                                                                                                                  |
| FR11 Evaluation             | Pass: deterministic policy regression suite; no inferred fit.                                                                                                                                    |
| FR12 Shortlist              | Pass: three-item comparison, fourth item blocked, shared requirements.                                                                                                                           |
| FR13 Missing evidence       | Pass: deterministic essential-first question tests and seller-reply browser path.                                                                                                                |
| FR14 Decisions/history      | Pass: approved snapshot export unchanged after requirement changes and reload.                                                                                                                   |
| FR15 Storage/history        | Pass: guest restore and real account persistence/isolation; snapshot immutability.                                                                                                               |
| FR16 Preview handoff        | Uploaded data URLs passed prior live demo. Private asset UUID handoff fixed and separately browser tested; no assertion that an appearance preview verifies garment suitability.                 |
| FR17 Input quality          | Pass: malformed image rejection and hosted scanner on private uploads. Partial: pose/quality threshold calibration.                                                                              |
| FR18 Async YouCam           | Prior real Clothes v3 demo completed generation, integrity, signed receipt, deletion. Partial: lost provider-submission-ID reconciliation and exhaustive network interruptions.                  |
| FR19 Garment assessment     | Partial: structured manual-review suggestions; automated garment verification remains disabled pending evaluation.                                                                               |
| FR20 Appearance integrity   | Real hosted service passed synthetic fixtures. Partial: held-out human/pose accuracy.                                                                                                            |
| FR21 Repair/review          | Pass: hosted controlled violation → repair → signed receipt → deletion. Partial: evaluated live repair accuracy.                                                                                 |
| FR22 Budget/cancellation    | Unit reservation/late result tests; isolated moderator pause/resume. Partial: billing reconciliation and provider-side cancellation.                                                             |
| FR23 Private assets         | Pass: owner access, exact original bytes, scan, large direct upload, workspace linking and deletion.                                                                                             |
| FR24 Purpose separation     | Pass: missing consent rejection, separate storage/publication/model controls. Partial: downstream processor audit.                                                                               |
| FR25 Deletion               | Pass: workspace delete/reload regression, image access revocation, hosted storage deletion, isolated withdrawn-media cleanup; race unit tests. Partial: backups/provider deletion.               |
| FR26 Security boundaries    | Pass: CSRF, capability/account isolation, import guards, duplicate/replay and consent checks. Partial: production penetration/load testing.                                                      |
| FR27 Core accessibility     | Automated axe: home, evidence, privacy, terms and six additional workspace sections; deletion keyboard focus/Escape and mobile overflow. Partial: manual screen reader.                          |
| FR28 Visual accessibility   | Text alternatives and region/uncertainty structure covered. Partial: assistive-technology usability.                                                                                             |
| FR29 Localization           | Live Spanish translation preserves fixture numbers. Partial: negation corpus, human linguistic review and full UI localization.                                                                  |
| FR30 Speech                 | Implemented editable dictation/read-aloud and fallback. **Manual OS/browser speech and audio output not verified.**                                                                              |
| FR31 Contributions          | Pass: real-account pending submission, private photo screening, owner correction/withdrawal and blocked self-publication.                                                                        |
| FR32 Redaction/consent      | Pass: PII rejection, publication consent and mandatory moderator image review. Partial: redaction usability and detector calibration.                                                            |
| FR33 Moderation             | Pass: isolated real Clerk owner/other/moderator tests for publish, dispute, remove, appeal, republish and private/public image access. Partial: complete moderator browser journey and staffing. |
| FR34 Corrections/withdrawal | Pass: prior revision/audit preserved, withdrawal cannot be republished, photo inaccessible; downstream source invalidation unit coverage. Partial: full multi-user browser propagation timing.   |
| FR35 Abuse controls         | Pass: duplicate fingerprint, role denial and submission limits in regression coverage. Partial: broad adversarial/abuse evaluation.                                                              |
| FR36 Arrival matching       | Pass: ordered versus delivered color/size mismatch, confirmation revoked on editing.                                                                                                             |
| FR37 Arrival comparison     | Manual comparison and reviewed OCR/vision fixture path. Partial: evaluated defect recognition.                                                                                                   |
| FR38 Seller export          | Pass: editable draft retains both variants; original images/provenance embedded in reviewed HTML export.                                                                                         |
| FR39 Support/operations     | Pass: isolated ticket ownership, moderator resolution audit, owner deletion, processing pause and resume. Partial: operational incident drills and named owners.                                 |

## Final hosted verification

Fixed preview: https://asshown-j01wd3q4g-ankitlade12-3052s-projects.vercel.app (deployment `dpl_DQ9vDFdtR6dbQh1t7rLX338tzEdt`, READY).

All six browser scenarios passed on this deployment. Authenticated account browser tests passed save/restore, >4.5 MB upload, decoded owner-authorized private photo in the studio, and cleanup. Account API tests passed exact bytes, cross-account rejection, explicit renewal consent and deletion. Concurrent controlled generation created exactly one task; the violation/repair/signed receipt/deletion sequence passed. Fresh-browser temporary review access passed without agent credentials.

Hosted API/community/evidence export, four live OpenAI actions and expanded accessibility checks ran against the immediately preceding preview; their application handlers were unchanged by these three client fixes. Lint: zero errors, 12 warnings. Production build and 89 unit/component tests passed after the fixes.

## Reproduction and evidence

Raw, ignored local evidence: `artifacts/full-qa/`. Browser screenshots are captured on failure. The prior real-provider recording is `artifacts/live-demo/asshown-end-to-end.mp4`.

- `npm test`: 89 tests / 22 files pass. Scanner: 3 Python tests pass. Production build passes.
- `scripts/asshown-full-browser-qa.mjs`: six browser scenarios, with explicit assertions and independent contexts.
- `scripts/asshown-api-smoke.mjs`: hosted API guards, guest isolation, revisions and support access.
- `scripts/asshown-account-smoke.mjs`: real two-account private asset bytes/access, renewal consent, workspace and deletion.
- `scripts/asshown-account-browser.mjs`: real sign-in, saved workspace recovery, >4.5 MB original upload, private image handoff and cleanup.
- `scripts/asshown-community-smoke.mjs`: hosted screening and private contribution lifecycle.
- `scripts/asshown-role-qa.mjs`: isolated local Next app with real Clerk and hosted-screened private Blob media. Global hosted processing was never paused and no test reports were published into the shared community.
- `scripts/asshown-evidence-smoke.mjs`: reviewed original-image export.
- `scripts/asshown-ai-smoke.mjs`: real OpenAI interpretation, Spanish translation, OCR and visual observations using synthetic fixtures. This checks integration, not general model accuracy.
- `scripts/guided-flow-smoke.mjs`: controlled concurrent submission, repair, signed receipt and verified cleanup. Not a paid YouCam generation.
- `scripts/asshown-a11y.mjs`: automated WCAG A/AA checks. Not accessibility certification.

## Outstanding acceptance/release work

No requirement was silently dropped. Open work remains: successful permitted retailer extraction; 30 licensed evaluation cases; held-out model accuracy and human raters; eight user interviews; manual accessibility/speech/localization; production load/security review; provider retention/cancellation and backup recovery; moderator/support staffing; production configuration and public submission assets. The scanner build also warns its ClamAV engine is behind the available upstream version; npm audit alone does not audit Python/container dependencies.
