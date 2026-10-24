import { describe, expect, it } from "vitest";
import {
  dateShort,
  dateTime,
  fileSize,
  formatPhone,
  money,
  percent,
  points,
  relative,
  toDate,
  truncate,
  withQuery,
} from "../lib/format";

describe("format helpers", () => {
  describe("money", () => {
    it("formats paise into currency strings", () => {
      expect(money(10000)).toMatch(/100/);
      expect(money(10050)).toMatch(/100\.5/);
      expect(money(0)).toMatch(/0/);
    });

    it("supports other currencies with fallback handling", () => {
      const res = money(2500, "USD");
      expect(res).toContain("25");
    });
  });

  describe("points", () => {
    it("formats integer point numbers with indian numbering system", () => {
      expect(points(1000)).toBe("1,000");
      expect(points(100000)).toBe("1,00,000");
      expect(points(0)).toBe("0");
    });
  });

  describe("withQuery", () => {
    it("appends query parameter to URL paths cleanly", () => {
      expect(withQuery("/login", "next", "/dashboard")).toBe("/login?next=%2Fdashboard");
      expect(withQuery("/search?q=coffee", "page", "2")).toBe("/search?q=coffee&page=2");
    });
  });

  describe("toDate, dateShort, & dateTime", () => {
    it("parses SQLite space-separated and ISO dates", () => {
      const d1 = toDate("2026-09-26 23:02:29");
      expect(d1).toBeInstanceOf(Date);
      expect(d1?.getFullYear()).toBe(2026);

      const d2 = toDate("2026-09-26T23:02:29Z");
      expect(d2).toBeInstanceOf(Date);
      expect(toDate("invalid-date")).toBeNull();
      expect(toDate(null)).toBeNull();
    });

    it("formats short date and date-time with fallback", () => {
      expect(dateShort(null)).toBe("—");
      expect(dateTime(undefined)).toBe("—");
      expect(dateShort("2026-01-15T10:00:00Z")).toContain("2026");
      expect(dateTime("2026-01-15T10:00:00Z")).toContain("Jan");
    });
  });

  describe("relative", () => {
    it("returns 'just now' for very recent dates", () => {
      const nowIso = new Date().toISOString();
      expect(relative(nowIso)).toBe("just now");
    });

    it("returns minutes or hours ago for timestamps in the past", () => {
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      expect(relative(tenMinsAgo)).toBe("10m ago");

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(relative(twoHoursAgo)).toBe("2h ago");
    });
  });

  describe("formatPhone", () => {
    it("formats 10-digit numbers into grouped format", () => {
      expect(formatPhone("9876543210")).toBe("98765 43210");
    });

    it("formats 12-digit Indian numbers with +91 prefix", () => {
      expect(formatPhone("919876543210")).toBe("+91 98765 43210");
    });

    it("handles null, empty, and irregular formats", () => {
      expect(formatPhone(null)).toBe("—");
      expect(formatPhone("")).toBe("—");
      expect(formatPhone("12345")).toBe("12345");
    });
  });

  describe("truncate", () => {
    it("truncates strings longer than maxLength with ellipsis", () => {
      expect(truncate("Hello World", 8)).toBe("Hello...");
      expect(truncate("Short", 10)).toBe("Short");
      expect(truncate("", 5)).toBe("");
      expect(truncate(null, 5)).toBe("");
    });
  });

  describe("percent", () => {
    it("formats numbers as percentages", () => {
      expect(percent(15)).toBe("15%");
      expect(percent(12.345, 1)).toBe("12.3%");
      expect(percent(NaN)).toBe("0%");
    });
  });

  describe("fileSize", () => {
    it("formats byte values into human readable sizes", () => {
      expect(fileSize(0)).toBe("0 B");
      expect(fileSize(500)).toBe("500 B");
      expect(fileSize(1024)).toBe("1.0 KB");
      expect(fileSize(1024 * 1024 * 2.5)).toBe("2.5 MB");
    });
  });
});
