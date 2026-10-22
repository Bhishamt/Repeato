import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA } from "./schema";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const path = process.env.DATABASE_PATH || "./data/repeato.db";
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

/** Tests get a fresh in-memory database and can close it afterwards. */
export function createTestDb(path = ":memory:"): Database.Database {
  const test = new Database(path);
  test.pragma("foreign_keys = ON");
  test.exec(SCHEMA);
  return test;
}

export function closeDb() {
  db?.close();
  db = null;
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
