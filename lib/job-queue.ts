import "server-only";

import { database, ensureDatabase } from "./database";

export type JobKind = "session_cleanup";
export interface KeepMeJob { id: string; tenantId: string; sessionId: string; kind: JobKind; attempts: number; payload: Record<string, unknown> }

const localJobs = new Map<string, KeepMeJob & { status: string; availableAt: number }>();

export async function enqueueJob(input: Omit<KeepMeJob, "id" | "attempts">, availableAt = new Date()) {
  const job: KeepMeJob = { ...input, id: `job_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`, attempts: 0 };
  const sql = database();
  if (!sql) {
    localJobs.set(job.id, { ...job, status: "queued", availableAt: availableAt.getTime() });
    return job;
  }
  await ensureDatabase();
  await sql`insert into keepme_jobs (id, tenant_id, session_id, kind, status, available_at, payload) values (${job.id}, ${job.tenantId}, ${job.sessionId}, ${job.kind}, 'queued', ${availableAt}, ${sql.json(job.payload as never)})`;
  return job;
}

export async function claimJobs(limit = 25): Promise<KeepMeJob[]> {
  const sql = database();
  if (!sql) {
    const now = Date.now();
    return [...localJobs.values()].filter((job) => job.status === "queued" && job.availableAt <= now).slice(0, limit).map((job) => {
      job.status = "processing";
      job.attempts += 1;
      return job;
    });
  }
  await ensureDatabase();
  return sql.begin(async (transaction) => {
    const jobs = await transaction<{ id: string; tenant_id: string; session_id: string; kind: JobKind; attempts: number; payload: Record<string, unknown> }[]>`
      select id, tenant_id, session_id, kind, attempts, payload from keepme_jobs
      where status = 'queued' and available_at <= now()
      order by available_at asc for update skip locked limit ${limit}
    `;
    if (jobs.length) await transaction`update keepme_jobs set status = 'processing', attempts = attempts + 1, locked_at = now(), updated_at = now() where id in ${transaction(jobs.map((job) => job.id))}`;
    return jobs.map((job) => ({ id: job.id, tenantId: job.tenant_id, sessionId: job.session_id, kind: job.kind, attempts: job.attempts + 1, payload: job.payload }));
  }) as unknown as KeepMeJob[];
}

export async function finishJob(job: KeepMeJob, error?: string) {
  const sql = database();
  if (!sql) {
    if (!error) localJobs.delete(job.id);
    else {
      const local = localJobs.get(job.id);
      if (local) { local.status = job.attempts >= 5 ? "failed" : "queued"; local.availableAt = Date.now() + Math.min(60_000, 2 ** job.attempts * 1000); }
    }
    return;
  }
  await ensureDatabase();
  if (!error) await sql`update keepme_jobs set status = 'completed', locked_at = null, updated_at = now() where id = ${job.id}`;
  else await sql`update keepme_jobs set status = ${job.attempts >= 5 ? "failed" : "queued"}, last_error = ${error.slice(0, 500)}, available_at = now() + (${Math.min(60, 2 ** job.attempts)} * interval '1 second'), locked_at = null, updated_at = now() where id = ${job.id}`;
}
