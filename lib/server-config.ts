import "server-only";

import { z } from "zod";

const booleanValue = z.enum(["true", "false"]).transform((value) => value === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  RETAILER_EMAIL_ALLOWLIST: z.string().default(""),
  RECEIPT_SIGNING_SECRET: z.string().min(32).optional(),
  CRON_SECRET: z.string().min(24).optional(),
  MALWARE_SCAN_URL: z.string().url().optional(),
  MALWARE_SCAN_TOKEN: z.string().min(1).optional(),
  INTEGRITY_WORKER_URL: z.string().url().optional(),
  INTEGRITY_URL: z.string().url().optional(),
  INTEGRITY_WORKER_TOKEN: z.string().min(24).optional(),
  KEEPME_ALLOW_EPHEMERAL: booleanValue.default(true),
  KEEPME_AUTO_MIGRATE: booleanValue.default(false),
  SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  MAX_PROVIDER_TASKS_PER_SESSION: z.coerce.number().int().min(1).max(10).default(3),
  MAX_PROVIDER_TASKS_PER_HOUR: z.coerce.number().int().min(1).default(100),
});

export const serverConfig = schema.parse(process.env);

export function retailerAllowlist() {
  return new Set(serverConfig.RETAILER_EMAIL_ALLOWLIST.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
}
