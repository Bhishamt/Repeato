import pg from "pg";
import type { Db, RunResult, Statement } from "../db";

const { Pool, types } = pg;

// The application treats every id and aggregate as a JS number and every
// timestamp as an ISO string (that is what SQLite returns), so normalise here
// instead of scattering Number()/Date conversions through the domain layer.
types.setTypeParser(20, (value) => Number(value)); // int8 / bigint
types.setTypeParser(1184, (value) => new Date(value).toISOString()); // timestamptz
types.setTypeParser(1114, (value) => new Date(`${value}Z`).toISOString()); // timestamp

/**
 * PostgreSQL driver (production / Supabase). Statements go through a pool;
 * transactions take a dedicated client so BEGIN/COMMIT bracket exactly the work
 * of one call. `?` placeholders are rewritten to $1..$n so the SQL in
 * lib/services.ts is written once and runs on both engines.
 */
export function createPostgresDb(connectionString = process.env.DATABASE_URL as string): Db {
  const pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "repeato",
    ssl: process.env.PG_SSL === "disable" ? false : undefined,
  });

  type Runner = { query: (text: string, values?: unknown[]) => Promise<pg.QueryResult> };

  const statement = (runner: Runner, sql: string): Statement => {
    const text = toPostgresPlaceholders(sql);
    return {
      async get<T>(...params: unknown[]) {
        const result = await runner.query(text, params);
        return result.rows[0] as T | undefined;
      },
      async all<T>(...params: unknown[]) {
        const result = await runner.query(text, params);
        return result.rows as T[];
      },
      async run(...params: unknown[]) {
        const result = await runner.query(text, params);
        return { changes: result.rowCount ?? 0, id: Number(result.rows[0]?.id ?? 0) } as RunResult;
      },
    };
  };

  const make = (runner: Runner): Db => ({
    engine: "postgres",
    prepare: (sql) => statement(runner, sql),
    async insert(sql, ...params) {
      const result = await runner.query(`${toPostgresPlaceholders(sql)} returning id`, params);
      return Number(result.rows[0].id);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn(make(client));
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    day: (column) => `to_char(${column}, 'YYYY-MM-DD')`,
    now: () => "now()",
    daysAgo: (days) => `now() - interval '${Math.trunc(Number(days))} days'`,
    listConcat: (expr, separator) => `string_agg(${expr}, '${separator}')`,
    async close() {
      await pool.end();
    },
  });

  return make(pool);
}

/**
 * Rewrites positional `?` placeholders to $1..$n, leaving question marks inside
 * string literals, quoted identifiers and dollar-quoted blocks untouched.
 */
export function toPostgresPlaceholders(sql: string): string {
  let out = "";
  let index = 0;
  let i = 0;
  while (i < sql.length) {
    const char = sql[i];
    if (char === "'" || char === '"') {
      const quote = char;
      out += char;
      i += 1;
      while (i < sql.length) {
        out += sql[i];
        if (sql[i] === quote) {
          // Doubled quote is an escaped quote, not a terminator.
          if (sql[i + 1] === quote) {
            out += sql[i + 1];
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (char === "$" && sql[i + 1] === "$") {
      const end = sql.indexOf("$$", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      out += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (char === "?") {
      index += 1;
      out += `$${index}`;
      i += 1;
      continue;
    }
    out += char;
    i += 1;
  }
  return out;
}
