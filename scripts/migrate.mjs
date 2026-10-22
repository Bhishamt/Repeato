#!/usr/bin/env node
// Applies supabase/migrations/*.sql in order and records each version, so the
// same command works locally and against Supabase.
//
//   DATABASE_URL=postgres://... node scripts/migrate.mjs            # apply
//   DATABASE_URL=postgres://... node scripts/migrate.mjs --local    # apply + test shim
//   DATABASE_URL=postgres://... node scripts/migrate.mjs --status
//
// Every migration runs inside its own transaction: a failure leaves the database
// exactly as it was and the process exits non-zero.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const url = process.env.DATABASE_URL || "postgres://postgres@127.0.0.1:55432/repeato_test";
const local = process.argv.includes("--local");
const statusOnly = process.argv.includes("--status");

const client = new pg.Client({ connectionString: url });
await client.connect();

async function ensureLedger() {
  await client.query(`create table if not exists schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )`);
}

async function applied() {
  const { rows } = await client.query("select version from schema_migrations order by version");
  return new Set(rows.map((r) => r.version));
}

const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

if (statusOnly) {
  const done = await ensureLedger().then(applied);
  for (const file of files) console.log(`${done.has(file) ? "applied" : "pending"}  ${file}`);
  await client.end();
  process.exit(0);
}

const done = await ensureLedger().then(applied);
for (const file of files) {
  if (done.has(file)) {
    console.log(`skip     ${file}`);
    continue;
  }
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into schema_migrations (version) values ($1)", [file]);
    await client.query("commit");
    console.log(`applied  ${file}`);
  } catch (error) {
    await client.query("rollback");
    console.error(`failed   ${file}\n${error.message}`);
    await client.end();
    process.exit(1);
  }
}

if (local) {
  // Grants are applied last: they must see the tables created above.
  await client.query(readFileSync(join(root, "scripts", "pg-shim.sql"), "utf8"));
  console.log("test shim applied (anon/authenticated roles + grants)");
}

await client.end();
