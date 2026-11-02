import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { database } from "../database";
export type RecordRow = {
  id: string;
  owner: string;
  category: string;
  data: unknown;
  revision: number;
  expires: string | null;
};
// shortcut: file storage is single-process development only; deployed environments require PostgreSQL.
const directory =
  process.env.ASSHOWN_DATA_DIRECTORY ??
  path.join(process.cwd(), ".asshown-data");
let queue: Promise<unknown> = Promise.resolve();
let schemaReady: Promise<unknown> | undefined;
async function db() {
  const sql = database();
  if (sql) {
    schemaReady ??= (async () => {
      await sql`create table if not exists asshown_records (id text primary key, owner text not null, category text not null, data jsonb not null, revision integer not null default 1, expires timestamptz)`;
      await sql`create index if not exists asshown_records_owner_category on asshown_records(category,owner)`;
    })();
    await schemaReady;
  } else if (process.env.NODE_ENV === "production")
    throw new Error("Durable storage must be configured for saved data.");
  return sql;
}
async function localRead(): Promise<RecordRow[]> {
  try {
    return JSON.parse(
      await readFile(path.join(directory, "records.json"), "utf8"),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}
export async function listRecords(category: string, owner?: string) {
  const sql = await db();
  if (sql)
    return sql<
      RecordRow[]
    >`select * from asshown_records where category=${category} and (${owner ?? null}::text is null or owner=${owner ?? ""}) and (expires is null or expires>now())`;
  return (await localRead()).filter(
    (r) =>
      r.category === category &&
      (!owner || r.owner === owner) &&
      (!r.expires || new Date(r.expires) > new Date()),
  );
}
export async function changeRecord(
  id: string,
  owner: string,
  category: string,
  update: (row: RecordRow | null) => unknown | null,
  expires: string | null = null,
) {
  const sql = await db();
  if (sql)
    return sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext(${id}))`;
      const [row] = await tx<
        RecordRow[]
      >`select * from asshown_records where id=${id} for update`;
      if (row && row.owner !== owner) throw new Error("Record access denied.");
      const data = update(row ?? null);
      if (data === null) {
        await tx`delete from asshown_records where id=${id} and owner=${owner}`;
        return null;
      }
      const revision = (row?.revision ?? 0) + 1;
      await tx`insert into asshown_records(id,owner,category,data,revision,expires) values(${id},${owner},${category},${tx.json(data as never)},${revision},${expires}) on conflict(id) do update set data=excluded.data,revision=excluded.revision,expires=excluded.expires`;
      return { id, owner, category, data, revision, expires };
    }) as unknown as Promise<RecordRow | null>;
  const operation = queue.then(async () => {
    const rows = await localRead();
    const row = rows.find((r) => r.id === id);
    if (row && row.owner !== owner) throw new Error("Record access denied.");
    const data = update(row ?? null);
    const result =
      data === null
        ? null
        : {
            id,
            owner,
            category,
            data,
            revision: (row?.revision ?? 0) + 1,
            expires,
          };
    const next = rows.filter(
      (r) => r.id !== id && (!r.expires || new Date(r.expires) > new Date()),
    );
    if (result) next.push(result);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = path.join(directory, `${crypto.randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
    await rename(temporary, path.join(directory, "records.json"));
    return result;
  });
  queue = operation.catch(() => {});
  return operation;
}

export async function purgeExpiredRecords() {
  const sql = await db();
  if (!sql) return 0;
  const removed =
    await sql`delete from asshown_records where expires is not null and expires<=now() and category in ('workspace','consent') returning id`;
  return removed.length;
}
