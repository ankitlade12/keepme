const required = ["DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "RETAILER_EMAIL_ALLOWLIST", "RECEIPT_SIGNING_SECRET", "CRON_SECRET", "MALWARE_SCAN_URL", "INTEGRITY_WORKER_TOKEN", "YOUCAM_API_KEY", "NEXT_PUBLIC_SITE_URL"];
const missing = required.filter((name) => !process.env[name]);
if (!process.env.INTEGRITY_WORKER_URL && !process.env.INTEGRITY_URL) missing.push("INTEGRITY_WORKER_URL or INTEGRITY_URL");
if (process.env.KEEPME_ALLOW_EPHEMERAL !== "false") missing.push("KEEPME_ALLOW_EPHEMERAL=false");
if (missing.length) {
  console.error(`Production is not ready. Missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Production configuration is complete and ephemeral fallbacks are disabled.");
