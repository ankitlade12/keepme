import "server-only";

import type {
  IdentityContract,
  IntegrityResult,
  SessionReceipt,
  SessionStage,
} from "./types";
import type { ArtifactRef } from "./object-store";
import { database, ensureDatabase } from "./database";
import { serverConfig } from "./server-config";

export interface KeepMeSession {
  id: string;
  stage: SessionStage;
  createdAt: string;
  expiresAt: string;
  contract: IdentityContract | null;
  result: IntegrityResult | null;
  receipt: SessionReceipt | null;
  tenantId: string;
  actorId: string | null;
  accessTokenDigest: string;
  approved: boolean;
  deletedAt: string | null;
  generationTaskId: string | null;
  generationError?: string;
  sourceFileId: string | null;
  referenceFileId: string | null;
  sourceImage: ArtifactRef | null;
  referenceImage: ArtifactRef | null;
  resultImage: ArtifactRef | null;
  originalResultImage?: ArtifactRef | null;
  provider: "controlled_demo" | "youcam" | null;
  providerTaskCount: number;
  deletionEvidence: Array<{
    keyHash: string;
    deleted: boolean;
    verifiedAbsent: boolean;
  }> | null;
}

declare global {
  var __keepMeSessions: Map<string, KeepMeSession> | undefined;
}

const sessions =
  globalThis.__keepMeSessions ?? new Map<string, KeepMeSession>();
if (process.env.NODE_ENV !== "production")
  globalThis.__keepMeSessions = sessions;

export async function createSession(input: {
  tenantId: string;
  actorId?: string | null;
  accessTokenDigest: string;
}): Promise<KeepMeSession> {
  const now = new Date();
  const session: KeepMeSession = {
    id: `ses_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
    stage: "draft",
    createdAt: now.toISOString(),
    expiresAt: new Date(
      now.getTime() + serverConfig.SESSION_TTL_MINUTES * 60_000,
    ).toISOString(),
    contract: null,
    result: null,
    receipt: null,
    tenantId: input.tenantId,
    actorId: input.actorId ?? null,
    accessTokenDigest: input.accessTokenDigest,
    approved: false,
    deletedAt: null,
    generationTaskId: null,
    sourceFileId: null,
    referenceFileId: null,
    sourceImage: null,
    referenceImage: null,
    resultImage: null,
    provider: null,
    providerTaskCount: 0,
    deletionEvidence: null,
  };
  await persist(session);
  return session;
}

export async function getSession(id: string): Promise<KeepMeSession | null> {
  const session = await getSessionRecord(id);
  if (
    !session ||
    session.deletedAt ||
    new Date(session.expiresAt) <= new Date()
  )
    return null;
  return session;
}

export async function getSessionRecord(
  id: string,
): Promise<KeepMeSession | null> {
  const sql = database();
  let session: KeepMeSession | undefined;
  if (sql) {
    await ensureDatabase();
    const rows = await sql<
      { payload: KeepMeSession }[]
    >`select payload from keepme_sessions where id = ${id} limit 1`;
    session = rows[0]?.payload;
  } else {
    session = sessions.get(id);
  }
  return session ?? null;
}

export async function mutateSession(
  id: string,
  mutate: (current: KeepMeSession) => Partial<KeepMeSession> | null,
  allowInactive = false,
): Promise<KeepMeSession | null> {
  const sql = database();
  const apply = (current: KeepMeSession | undefined) => {
    if (
      !current ||
      (!allowInactive &&
        (current.deletedAt || new Date(current.expiresAt) <= new Date()))
    )
      return null;
    const patch = mutate(current);
    return patch ? { ...current, ...patch } : null;
  };
  if (!sql) {
    const updated = apply(sessions.get(id));
    if (updated) sessions.set(id, updated);
    return updated;
  }
  await ensureDatabase();
  return sql.begin(async (tx) => {
    const [row] = await tx<
      { payload: KeepMeSession }[]
    >`select payload from keepme_sessions where id = ${id} for update`;
    const updated = apply(row?.payload);
    if (!updated) return null;
    await tx`update keepme_sessions set stage = ${updated.stage}, expires_at = ${updated.expiresAt}, payload = ${tx.json(updated as never)} where id = ${id}`;
    return updated;
  }) as unknown as Promise<KeepMeSession | null>;
}

export async function updateSession(
  id: string,
  patch: Partial<KeepMeSession>,
): Promise<KeepMeSession | null> {
  return mutateSession(id, () => patch);
}

export async function reserveGeneration(
  id: string,
  key: string,
  limit: number,
  paid = true,
) {
  return mutateSession(id, (current) => {
    if (current.generationTaskId || current.providerTaskCount >= limit)
      return null;
    return {
      generationTaskId: `pending:${key}`,
      stage: "generating",
      providerTaskCount: current.providerTaskCount + (paid ? 1 : 0),
    };
  });
}

export async function revokeSession(id: string) {
  return mutateSession(
    id,
    () => ({
      deletedAt: new Date().toISOString(),
      stage: "deleted",
      accessTokenDigest: "",
    }),
    true,
  );
}

export async function deleteSession(
  id: string,
  deletionEvidence: KeepMeSession["deletionEvidence"] = [],
): Promise<boolean> {
  return Boolean(
    await mutateSession(
      id,
      () => ({
        stage: "deleted",
        contract: null,
        result: null,
        receipt: null,
        generationTaskId: null,
        sourceFileId: null,
        referenceFileId: null,
        sourceImage: null,
        referenceImage: null,
        resultImage: null,
        originalResultImage: null,
        provider: null,
        deletedAt: new Date().toISOString(),
        accessTokenDigest: "",
        deletionEvidence,
      }),
      true,
    ),
  );
}

async function persist(session: KeepMeSession) {
  const sql = database();
  if (!sql) {
    sessions.set(session.id, session);
    return;
  }
  await ensureDatabase();
  await sql`
    insert into keepme_sessions (id, tenant_id, actor_id, stage, created_at, expires_at, payload)
    values (${session.id}, ${session.tenantId}, ${session.actorId}, ${session.stage}, ${session.createdAt}, ${session.expiresAt}, ${sql.json(session as never)})
    on conflict (id) do update set tenant_id = excluded.tenant_id, actor_id = excluded.actor_id, stage = excluded.stage, expires_at = excluded.expires_at, payload = excluded.payload
  `;
}

export async function expiredSessions(limit = 100) {
  const sql = database();
  if (!sql)
    return [...sessions.values()]
      .filter(
        (session) =>
          !session.deletedAt && new Date(session.expiresAt) <= new Date(),
      )
      .slice(0, limit);
  await ensureDatabase();
  const rows = await sql<
    { payload: KeepMeSession }[]
  >`select payload from keepme_sessions where stage <> 'deleted' and expires_at <= now() order by expires_at asc limit ${limit}`;
  return rows.map((row) => row.payload);
}
