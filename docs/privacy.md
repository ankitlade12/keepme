# Privacy and Evidence Provenance

This describes the implemented application boundary. Production policies, processor terms, and operational retention still require review. See the [README](../README.md) and [operations guide](operations.md).

## Data and retention

| Data                                                          | Scope and handling                                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Guest shopping state                                          | Browser restore window of 30 minutes; uploaded product images are omitted after refresh             |
| Saved account workspace                                       | Explicit owner-authorized save/load; raw browser photos are not embedded in workspace snapshots     |
| Private original evidence                                     | Private quarantine and scanning, up to 10 MB; 30-day expiry with explicit renewal or deletion       |
| Studio source, generated, original-result and repaired images | Authorized session routes; default 30-minute session lifetime and immediate deletion option         |
| Consent and operational records                               | Purpose-specific metadata; expiry/retention depends on record category and deployment configuration |
| Community reports and photos                                  | Preview and publication consent, moderation, corrections, disputes, and withdrawal                  |
| Downloaded reports and receipts                               | Under the downloader’s control; deleting a session does not delete previously downloaded copies     |

## What each source means

- Listing and seller-reply text remain seller-reported evidence, matched to the recorded variant.
- Contributor reports remain contributor observations. Publication is not independent product verification.
- Demo listings and shopper images are fictional/synthetic and labelled accordingly.
- A YouCam preview explores appearance; it does not prove fit, comfort, care instructions, fabric composition, opacity, or pocket function.
- OpenAI interpretation, OCR, and visual observations require review. They do not turn unknown requirements into supported findings automatically.
- Appearance checks compare selected regions. They do not identify people, infer protected traits, or make medical judgments.
- A receipt signature authenticates the recorded payload, not the truth or accuracy of every finding.

## Consent and image processing

Generation, OpenAI assistance, account storage, and public contribution have separate consent gates. Browser dictation may use the browser’s speech service. Review transcripts before sending them onward.

Image validation bounds type, dimensions, and payload size. Provider processing uses sanitized copies; retained originals remain separately identified. Private upload tokens are short-lived and object-scoped. Larger-object scanning verifies the downloaded hash before the original can become available evidence.

Live provider credentials stay server-side. Sensitive application routes require owner/session authorization and avoid public caching. Never commit keys, personal images, private account data, temporary provider URLs, or preview bypass tokens.

## Deletion boundary

Application deletion revokes access and removes configured storage artifacts, with absence checks and retryable cleanup. Missing and unauthorized session/image routes return 404. Inspect physical purge status as well as route access when operating the service.

YouCam/OpenAI retention, storage backups, versioning, downloaded exports, and external recordings are separate from application deletion. The app must not describe a local deletion result as verified erasure from every downstream system. Maintenance execution and backup restore behavior require operational verification.

## Community privacy

Public product notes must exclude receipts, addresses, order numbers, personal allegations, and unrelated private details. Optional images support opaque redaction and screening, but automated screening is fallible; moderators must inspect every image before publication. Withdrawal stops publication and access according to the stored lifecycle; corrections return to review and retain audit history.

## Before public personal-data use

Publish an accountable contact, reviewed processor/retention terms, data-subject request procedures, and incident response. Verify backup deletion behavior, maintenance monitoring, moderator staffing, human accessibility, and independently evaluated appearance thresholds. Automated checks and synthetic demonstrations do not complete these obligations.
