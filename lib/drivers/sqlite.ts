import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Db, RunResult, Statement } from "../db";
import { SCHEMA } from "../schema";

/**
 * SQLite driver: one connection, synchronous under the hood, exposed through the
 * shared async interface. Transactions take a mutex so a second request can never
 * interleave statements inside another request's transaction — without it, the
 * awaits between statements would let two redemptions read the same balance.
 */
export function createSqliteDb(path = ":memory:", schema = SCHEMA): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const handle = new Database(path);
  handle.pragma("foreign_keys = ON");
  handle.pragma("journal_mode = WAL");
  if (schema) handle.exec(schema);
  // SQLite has no ADD COLUMN IF NOT EXISTS, so older dev databases get the
  // column here. New databases already have it from the CREATE TABLE above.
  const userColumns = handle.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!userColumns.some((column) => column.name === "email_verified")) {
    handle.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
  }

  let lock: Promise<unknown> = Promise.resolve();

  const exclusive = <T>(fn: () => Promise<T> | T): Promise<T> => {
    const next = lock.then(fn, fn);
    lock = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  const statement = (sql: string): Statement => {
    const prepared = handle.prepare(sql);
    return {
      get: <T>(...params: unknown[]) => Promise.resolve(prepared.get(...params) as T | undefined),
      all: <T>(...params: unknown[]) => Promise.resolve(prepared.all(...params) as T[]),
      run: (...params: unknown[]) => {
        const info = prepared.run(...params);
        return Promise.resolve<RunResult>({ changes: info.changes, id: Number(info.lastInsertRowid) });
      },
    };
  };

  const db: Db = {
    engine: "sqlite",
    prepare: statement,
    insert: async (sql, ...params) => (await statement(sql).run(...params)).id,
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      return exclusive(async () => {
        handle.exec("BEGIN IMMEDIATE");
        try {
          const result = await fn(db);
          handle.exec("COMMIT");
          return result;
        } catch (error) {
          handle.exec("ROLLBACK");
          throw error;
        }
      });
    },
    day: (column) => `date(${column})`,
    now: () => "datetime('now')",
    daysAgo: (days) => `datetime('now','-${Math.trunc(Number(days))} days')`,
    listConcat: (expr, separator) => `GROUP_CONCAT(${expr}, '${separator}')`,
    async close() {
      handle.close();
    },
  };

  return db;
}
