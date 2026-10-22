#!/usr/bin/env node
// Disposable PostgreSQL cluster for local verification (no Docker required).
// Uses the real server binaries shipped by the `embedded-postgres` dev dependency.
// Usage: node scripts/pg.mjs start|stop|status|reset
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.PG_DATA_DIR || join(root, ".pgdata");
const port = Number(process.env.PG_PORT || 55432);
const dbName = process.env.PG_DB || "repeato_test";
const binDir = join(root, "node_modules", "@embedded-postgres", "windows-x64", "native", "bin");
const exe = (name) => join(binDir, `${name}.exe`);

function run(name, args, opts = {}) {
  const result = spawnSync(exe(name), args, { encoding: "utf8", ...opts });
  if (result.error) throw new Error(`${name} failed to start: ${result.error.message}`);
  return result;
}

function assertBinaries() {
  if (!existsSync(exe("initdb"))) {
    throw new Error(
      `PostgreSQL binaries not found at ${binDir}. Run: npm install -D embedded-postgres`,
    );
  }
}

function init() {
  assertBinaries();
  if (existsSync(join(dataDir, "PG_VERSION"))) return false;
  mkdirSync(dataDir, { recursive: true });
  const result = run("initdb", ["-D", dataDir, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--locale=C"]);
  if (result.status !== 0) throw new Error(`initdb failed:\n${result.stderr || result.stdout}`);
  return true;
}

function start() {
  const created = init();
  const status = run("pg_ctl", ["-D", dataDir, "status"]);
  if (status.status === 0) {
    console.log(`already running on port ${port}`);
  } else {
    const result = run("pg_ctl", ["-D", dataDir, "-l", join(dataDir, "server.log"), "-o", `-p ${port} -c listen_addresses=127.0.0.1`, "start"]);
    if (result.status !== 0) throw new Error(`pg_ctl start failed:\n${result.stdout}\n${result.stderr}`);
  }
  return { created, port, dbName };
}

async function ensureDatabase() {
  // pg_ctl returns as soon as the postmaster forks, before it accepts sockets.
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const admin = new pg.Client({ host: "127.0.0.1", port, user: "postgres", database: "postgres" });
    try {
      await admin.connect();
      const { rowCount } = await admin.query("select 1 from pg_database where datname = $1", [dbName]);
      if (!rowCount) await admin.query(`create database ${JSON.stringify(dbName)}`);
      await admin.end();
      return;
    } catch (error) {
      lastError = error;
      admin.end().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("postgres did not accept connections");
}

function stop() {
  const result = run("pg_ctl", ["-D", dataDir, "-m", "fast", "stop"]);
  console.log(result.status === 0 ? "stopped" : (result.stdout || result.stderr).trim());
}

const command = process.argv[2] || "start";
if (command === "start") {
  const info = start();
  await ensureDatabase();
  console.log(`postgres ${info.created ? "initialised" : "reused"} at 127.0.0.1:${info.port}/${dbName}`);
  console.log(`DATABASE_URL=postgres://postgres@127.0.0.1:${info.port}/${dbName}`);
} else if (command === "stop") {
  stop();
} else if (command === "status") {
  const result = run("pg_ctl", ["-D", dataDir, "status"]);
  process.stdout.write(result.stdout || result.stderr);
  process.exitCode = result.status === 0 ? 0 : 1;
} else if (command === "reset") {
  run("pg_ctl", ["-D", dataDir, "-m", "immediate", "stop"]);
  rmSync(dataDir, { recursive: true, force: true });
  console.log("cluster removed");
} else {
  console.error("usage: node scripts/pg.mjs start|stop|status|reset");
  process.exitCode = 1;
}
