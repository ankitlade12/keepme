import { readFile } from "node:fs/promises";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const migration = await readFile(new URL("../db/migrations/001_initial.sql", import.meta.url), "utf8");
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: process.env.DATABASE_URL.includes("localhost") ? false : "require", prepare: false });
try {
  await sql.unsafe(migration);
  console.log("Applied KeepMe database migration 001_initial.");
} finally {
  await sql.end();
}
