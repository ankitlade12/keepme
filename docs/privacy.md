# Privacy and data handling

KeepMe treats source photos, generated images, masks, heatmaps, and repair artifacts as sensitive session data.

## Default lifecycle

1. The user reviews a scoped Identity Contract.
2. Consent is recorded only for the current generation.
3. Images are processed through short-lived references.
4. Telemetry records reason codes and timings, never image content or URLs.
5. The user can delete immediately; otherwise the session expires automatically.
6. Deletion removes source, garment, generated output, masks, heatmaps, repair artifacts, URLs, and cached representations.
7. A non-identifying deletion count may remain.

## Explicit exclusions

- Cross-session face matching
- Persistent face embeddings
- Demographic or protected-class inference
- Medical diagnosis
- Training use without a separate opt-in
- Retailer access to individual customer images
- Free-form descriptions in analytics

## Environment boundary

Local guided mode uses in-process metadata/artifact adapters and static synthetic images. Public production is configured to fail closed unless durable tenant-scoped Postgres, KMS-backed private object storage, OAuth, receipt signing, malware scanning, cleanup authorization, and the landmark/segmentation worker are connected. Production includes scheduled cleanup, privacy-filtered logs, rate and provider-credit limits, same-origin mutation checks, byte-level image decoding, and deletion verification.
