import "server-only";

import { z } from "zod";

const booleanValue = z.enum(["true", "false"]).transform((value) => value === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  OBJECT_STORAGE_BUCKET: z.string().min(1).optional(),
  OBJECT_STORAGE_REGION: z.string().min(1).default("us-east-1"),
  OBJECT_STORAGE_ENDPOINT: z.string().url().optional(),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  OBJECT_STORAGE_KMS_KEY_ID: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_GITHUB_ID: z.string().min(1).optional(),
  AUTH_GITHUB_SECRET: z.string().min(1).optional(),
  RETAILER_EMAIL_ALLOWLIST: z.string().default(""),
  RECEIPT_SIGNING_SECRET: z.string().min(32).optional(),
  CRON_SECRET: z.string().min(24).optional(),
  MALWARE_SCAN_URL: z.string().url().optional(),
  MALWARE_SCAN_TOKEN: z.string().min(1).optional(),
  INTEGRITY_WORKER_URL: z.string().url().optional(),
  INTEGRITY_WORKER_TOKEN: z.string().min(24).optional(),
  KEEPME_ALLOW_EPHEMERAL: booleanValue.default(true),
  KEEPME_AUTO_MIGRATE: booleanValue.default(false),
  SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  MAX_PROVIDER_TASKS_PER_SESSION: z.coerce.number().int().min(1).max(10).default(3),
  MAX_PROVIDER_TASKS_PER_HOUR: z.coerce.number().int().min(1).default(100),
});

export const serverConfig = schema.parse(process.env);

export function assertProductionConfiguration() {
  if (serverConfig.NODE_ENV !== "production" || serverConfig.KEEPME_ALLOW_EPHEMERAL) return;
  const missing = [
    ["DATABASE_URL", serverConfig.DATABASE_URL],
    ["OBJECT_STORAGE_BUCKET", serverConfig.OBJECT_STORAGE_BUCKET],
    ["OBJECT_STORAGE_ACCESS_KEY_ID", serverConfig.OBJECT_STORAGE_ACCESS_KEY_ID],
    ["OBJECT_STORAGE_SECRET_ACCESS_KEY", serverConfig.OBJECT_STORAGE_SECRET_ACCESS_KEY],
    ["OBJECT_STORAGE_KMS_KEY_ID", serverConfig.OBJECT_STORAGE_KMS_KEY_ID],
    ["AUTH_SECRET", serverConfig.AUTH_SECRET],
    ["RECEIPT_SIGNING_SECRET", serverConfig.RECEIPT_SIGNING_SECRET],
    ["CRON_SECRET", serverConfig.CRON_SECRET],
    ["MALWARE_SCAN_URL", serverConfig.MALWARE_SCAN_URL],
    ["INTEGRITY_WORKER_URL", serverConfig.INTEGRITY_WORKER_URL],
    ["INTEGRITY_WORKER_TOKEN", serverConfig.INTEGRITY_WORKER_TOKEN],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Production configuration is incomplete: ${missing.join(", ")}`);
}

export function retailerAllowlist() {
  return new Set(serverConfig.RETAILER_EMAIL_ALLOWLIST.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
}
