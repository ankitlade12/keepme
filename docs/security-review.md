# Security review

## Assets and trust boundaries

- Sensitive: source, garment, result, repaired image, preserve zones, provider identifiers, consent record.
- Server-only secrets: YouCam, Clerk, Postgres, object storage, malware scanner, worker, cron, receipt signer.
- Public: controlled synthetic fixtures, aggregate demo metrics, signed receipt supplied by its owner.

## Implemented controls

- Opaque, high-entropy shopper capability in an HttpOnly, Secure-in-production, SameSite=Strict cookie.
- Clerk authentication with an exact retailer email allowlist and stable active-organization or user tenant identifier.
- Authorization at each session data access; unknown and unauthorized sessions share a 404 response.
- Same-origin mutation checks, CSP, frame denial, MIME sniffing denial, restrictive permissions policy, HSTS, no-store sensitive responses.
- Byte-decoded JPEG/PNG allowlist, size and pixel bounds, generated filenames, metadata removal, re-encoding, optional malware scanner that is mandatory when production runs fail closed.
- Per-IP session limits, per-session upload/provider limits, and tenant hourly provider budgets.
- Private Vercel Blob storage with server-only access, opaque paths, SHA-256 evidence, and deletion followed by absence verification.
- Postgres tenant columns, bounded connection pool, durable expiry jobs with retries and `SKIP LOCKED` claims.
- Structured events exclude image data, secrets, identity attributes, original filenames, and URLs.
- Receipts bind contract/result digests in a signed JWS and can be independently submitted to the verification endpoint.

## Required operational review

- Configure MFA and least-privilege roles in hosting, database, storage, GitHub, Clerk, YouCam, scanner, and monitoring accounts.
- Enable database backups with tested restore and matching retention/deletion policy.
- Restrict storage bucket public access, require TLS, rotate keys, and alert on policy changes.
- Conduct dependency, SAST, DAST, container, authorization, SSRF, CSRF, upload-parser, and tenant-isolation testing before pilot traffic.
- Establish incident response, vulnerability intake, processor agreements, breach notification, and data-subject request procedures.
- Obtain legal review for the target countries and retailer relationship. Repository notices are product copy, not legal advice.
