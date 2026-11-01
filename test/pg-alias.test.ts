import { describe, expect, it } from "vitest";
import { toPostgresPlaceholders } from "../lib/drivers/postgres";

describe("toPostgresPlaceholders", () => {
  it("numbers placeholders outside literals", () => {
    expect(toPostgresPlaceholders("SELECT * FROM t WHERE a = ? AND b = ?")).toBe(
      "SELECT * FROM t WHERE a = $1 AND b = $2",
    );
    expect(toPostgresPlaceholders("SELECT '?' AS q WHERE a = ?")).toBe("SELECT '?' AS q WHERE a = $1");
  });

  it("quotes camelCase aliases so Postgres keeps their case", () => {
    expect(toPostgresPlaceholders("SELECT entity_id AS entityId FROM t")).toBe(
      'SELECT entity_id AS "entityId" FROM t',
    );
    expect(toPostgresPlaceholders("SELECT b.name AS businessName, u.id AS customerId FROM t")).toBe(
      'SELECT b.name AS "businessName", u.id AS "customerId" FROM t',
    );
  });

  it("leaves lowercase aliases, keywords and already-quoted aliases alone", () => {
    expect(toPostgresPlaceholders("SELECT a AS b FROM t")).toBe("SELECT a AS b FROM t");
    expect(toPostgresPlaceholders('SELECT a AS "camelId" FROM t')).toBe('SELECT a AS "camelId" FROM t');
    expect(toPostgresPlaceholders("SELECT CAST(a AS BIGINT) FROM t")).toBe("SELECT CAST(a AS BIGINT) FROM t");
    expect(toPostgresPlaceholders("SELECT 1 AS isMember FROM t")).toBe('SELECT 1 AS "isMember" FROM t');
  });
});
