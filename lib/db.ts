import type Database from "better-sqlite3";
import { SCHEMA } from "./schema";
import { createPostgresDb } from "./drivers/postgres";
import { createSqliteDb } from "./drivers/sqlite";

/**
 * The one database interface the application talks to. Two drivers implement it:
 * SQLite (lib/drivers/sqlite.ts, local dev and tests) and PostgreSQL
 * (lib/drivers/postgres.ts, production/Supabase). Both are async so a request
 * never blocks the event loop on a network round trip.
 *
 * SQL written against it must stay portable: `?` placeholders, `CURRENT_TIMESTAMP`
 * instead of engine-specific now(), `ON CONFLICT DO NOTHING`, and `TRUE`/`FALSE`.
 * Anything that cannot be portable goes through `db.day()` or `db.insert()`.
 */
export type RunResult = { changes: number; id: number };

export type Row = Record<string, unknown>;

export interface Statement {
  get<T = Row>(...params: unknown[]): Promise<T | undefined>;
  all<T = Row>(...params: unknown[]): Promise<T[]>;
  run(...params: unknown[]): Promise<RunResult>;
}

export interface Db {
  readonly engine: "sqlite" | "postgres";
  prepare(sql: string): Statement;
  /** INSERT that needs the generated primary key back. */
  insert(sql: string, ...params: unknown[]): Promise<number>;
  /** Runs fn inside a real transaction. Statements inside must use the handle passed to fn. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  /** Day bucket expression for GROUP BY, e.g. day("created_at"). */
  day(column: string): string;
  /** Current-timestamp SQL expression for the active engine. */
  now(): string;
  /** "N days ago" SQL expression for the active engine. */
  daysAgo(days: number): string;
  /** Aggregates text values into one string: GROUP_CONCAT (SQLite) / string_agg (Postgres). */
  listConcat(expr: string, separator: string): string;
  close(): Promise<void>;
}

export type Rules = {
  pointsPer100: number;
  minPurchasePaise: number;
  signupBonus: number;
  minRedeemPoints: number;
  maxPointsPerTxn: number;
};

export const DEFAULT_RULES: Rules = {
  pointsPer100: 10,
  minPurchasePaise: 10_000,
  signupBonus: 20,
  minRedeemPoints: 100,
  maxPointsPerTxn: 1_000,
};

export function rulesFromBusiness(row: {
  pointsPer100: number;
  minPurchasePaise: number;
  signupBonus: number;
  minRedeemPoints: number;
  maxPointsPerTxn: number;
}): Rules {
  return {
    pointsPer100: row.pointsPer100,
    minPurchasePaise: row.minPurchasePaise,
    signupBonus: row.signupBonus,
    minRedeemPoints: row.minRedeemPoints,
    maxPointsPerTxn: row.maxPointsPerTxn,
  };
}

let db: Db | null = null;

/**
 * DATABASE_URL selects PostgreSQL (production/Supabase). Without it the app uses
 * SQLite at DATABASE_PATH, which is what local development and tests expect.
 */
export function databaseEngine(): "sqlite" | "postgres" {
  return process.env.DATABASE_URL ? "postgres" : "sqlite";
}

export function getDb(): Db {
  if (db) return db;
  db = databaseEngine() === "postgres" ? createPostgresDb() : createSqliteDb(process.env.DATABASE_PATH || "./data/repeato.db");
  return db;
}

/** Fresh in-memory SQLite database for tests. */
export function createTestDb(path = ":memory:"): Db {
  return createSqliteDb(path, SCHEMA);
}

export async function closeDb() {
  await db?.close();
  db = null;
}

/** Used by the seed script and tests to talk to a specific handle. */
export type { Database };
