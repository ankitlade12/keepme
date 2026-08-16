const required = ["DATABASE_URL", "OBJECT_STORAGE_BUCKET", "OBJECT_STORAGE_ACCESS_KEY_ID", "OBJECT_STORAGE_SECRET_ACCESS_KEY", "OBJECT_STORAGE_KMS_KEY_ID", "AUTH_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET", "RETAILER_EMAIL_ALLOWLIST", "RECEIPT_SIGNING_SECRET", "CRON_SECRET", "MALWARE_SCAN_URL", "INTEGRITY_WORKER_URL", "INTEGRITY_WORKER_TOKEN", "YOUCAM_API_KEY", "NEXT_PUBLIC_SITE_URL"];
const missing = required.filter((name) => !process.env[name]);
if (process.env.KEEPME_ALLOW_EPHEMERAL !== "false") missing.push("KEEPME_ALLOW_EPHEMERAL=false");
if (missing.length) {
  console.error(`Production is not ready. Missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Production configuration is complete and ephemeral fallbacks are disabled.");
