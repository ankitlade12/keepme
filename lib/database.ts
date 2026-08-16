import "server-only";

import postgres from "postgres";
import { serverConfig } from "./server-config";

let client: ReturnType<typeof postgres> | null = null;
let initialized: Promise<void> | null = null;

export function databaseEnabled() {
  return Boolean(serverConfig.DATABASE_URL);
}

export function database() {
  if (!serverConfig.DATABASE_URL) return null;
  client ??= postgres(serverConfig.DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: serverConfig.DATABASE_URL.includes("localhost") ? false : "require",
    prepare: false,
  });
  return client;
}

export async function ensureDatabase() {
  const sql = database();
  if (!sql) return;
  initialized ??= (async () => {
    if (!serverConfig.KEEPME_AUTO_MIGRATE) {
      const [check] = await sql<{ sessions: string | null }[]>`select to_regclass('public.keepme_sessions')::text as sessions`;
      if (!check.sessions) throw new Error("KeepMe database migrations have not been applied.");
      return;
    }
    await sql.unsafe(`
      create table if not exists keepme_sessions (
        id text primary key,
        tenant_id text not null,
        actor_id text,
        stage text not null,
        created_at timestamptz not null,
        expires_at timestamptz not null,
        payload jsonb not null
      );
      create index if not exists keepme_sessions_tenant_idx on keepme_sessions (tenant_id, created_at desc);
      create index if not exists keepme_sessions_expiry_idx on keepme_sessions (expires_at) where stage <> 'deleted';
      create table if not exists keepme_jobs (
        id text primary key,
        tenant_id text not null,
        session_id text not null,
        kind text not null,
        status text not null,
        attempts integer not null default 0,
        available_at timestamptz not null default now(),
        locked_at timestamptz,
        payload jsonb not null default '{}'::jsonb,
        last_error text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists keepme_jobs_claim_idx on keepme_jobs (status, available_at);
      create table if not exists keepme_events (
        id bigserial primary key,
        tenant_id text not null,
        session_id text,
        category text not null,
        name text not null,
        payload jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
      create index if not exists keepme_events_tenant_idx on keepme_events (tenant_id, created_at desc);
      create table if not exists keepme_rate_limits (
        bucket text primary key,
        count integer not null,
        resets_at timestamptz not null
      );
      create table if not exists keepme_provider_usage (
        id bigserial primary key,
        tenant_id text not null,
        session_id text,
        provider text not null,
        operation text not null,
        units integer not null default 1,
        status text not null,
        latency_ms integer,
        created_at timestamptz not null default now()
      );
    `);
  })();
  await initialized;
}
