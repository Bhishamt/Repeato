/*
 * Proves the least-privilege application role is actually least-privilege.
 *
 *   node scripts/verify-db-role.mjs
 *
 * Admin URL (defaults to the local cluster) sets the app role's password, then
 * the app role is exercised directly. Exits non-zero if the role can change the
 * schema or delete ledger history.
 */
const ADMIN_URL = process.env.ADMIN_DATABASE_URL || "postgres://postgres@127.0.0.1:55432/repeato_demo";
const APP_USER = process.env.APP_DB_USER || "repeato_app";
const APP_PASSWORD = process.env.APP_DB_PASSWORD || "repeato_app_dev";

const { Client } = await import("pg");

const admin = new Client({ connectionString: ADMIN_URL });
await admin.connect();
await admin.query(`alter role ${APP_USER} password '${APP_PASSWORD.replace(/'/g, "''")}'`);
await admin.end();

const url = new URL(ADMIN_URL);
url.username = APP_USER;
url.password = APP_PASSWORD;
const app = new Client({ connectionString: url.toString() });
await app.connect();

const failures = [];
const read = await app.query("select count(*)::int as n from businesses");
console.log(`read businesses: ${read.rows[0].n} rows`);

const forbidden = [
  "create table should_fail (id int)",
  "drop table ledger",
  "alter table users add column should_fail int",
  "delete from ledger where false",
  "delete from purchases where false",
];
for (const sql of forbidden) {
  try {
    await app.query(sql);
    failures.push(`allowed: ${sql}`);
    console.log(`ALLOWED (bad): ${sql}`);
  } catch (error) {
    console.log(`denied (${error.code}): ${sql}`);
  }
}
await app.end();

if (failures.length) {
  console.error(`\n${failures.length} privilege check(s) failed.`);
  process.exit(1);
}
console.log("\nleast-privilege checks passed");
