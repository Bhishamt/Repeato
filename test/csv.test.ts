import { describe, expect, it } from "vitest";
import {
  escapeCsvCell,
  formatCustomersCsv,
  formatTransactionsCsv,
  generateCsv,
  toCsvRow,
} from "../lib/csv";

describe("csv utilities", () => {
  describe("escapeCsvCell", () => {
    it("returns empty string for null and undefined", () => {
      expect(escapeCsvCell(null)).toBe("");
      expect(escapeCsvCell(undefined)).toBe("");
    });

    it("leaves simple alphanumeric strings and numbers unquoted", () => {
      expect(escapeCsvCell("Bluebird")).toBe("Bluebird");
      expect(escapeCsvCell(42)).toBe("42");
    });

    it("encloses cells with commas or newlines in double quotes", () => {
      expect(escapeCsvCell("Bluebird Coffee, Bengaluru")).toBe('"Bluebird Coffee, Bengaluru"');
      expect(escapeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    });

    it("escapes existing double quotes by doubling them", () => {
      expect(escapeCsvCell('Priya "Owner"')).toBe('"Priya ""Owner"""');
    });

    it("neutralises spreadsheet formula injection (CWE-1236)", () => {
      expect(escapeCsvCell("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(escapeCsvCell("+123456789")).toBe("'+123456789");
      expect(escapeCsvCell("-500")).toBe("'-500");
      expect(escapeCsvCell("@admin")).toBe("'@admin");
      expect(escapeCsvCell("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
      expect(escapeCsvCell('=HYPERLINK("http://evil.com")')).toBe("\"'=HYPERLINK(\"\"http://evil.com\"\")\"");
    });
  });

  describe("toCsvRow & generateCsv", () => {
    it("joins row values with commas", () => {
      const row = toCsvRow(["101", "Asha", 2500, "Active"]);
      expect(row).toBe("101,Asha,2500,Active");
    });

    it("generates structured multi-line CSV with CRLF endings", () => {
      const headers = ["ID", "Name", "City"];
      const rows = [
        [1, "Bluebird", "Bengaluru"],
        [2, "Urban Brew", "Mumbai"],
      ];
      const csv = generateCsv(headers, rows);
      expect(csv).toBe("ID,Name,City\r\n1,Bluebird,Bengaluru\r\n2,Urban Brew,Mumbai\r\n");
    });
  });

  describe("formatTransactionsCsv", () => {
    it("formats transactions with rupee conversion and headers", () => {
      const csv = formatTransactionsCsv([
        {
          id: 1,
          date: "2026-10-24 10:00:00",
          customerName: "Asha Rao",
          amountPaise: 45000,
          pointsEarned: 45,
          status: "completed",
          idempotencyKey: "sale_001",
        },
      ]);

      expect(csv).toContain("Transaction ID,Date,Customer Name,Amount (INR),Points Earned,Status,Idempotency Key");
      expect(csv).toContain("1,2026-10-24 10:00:00,Asha Rao,450.00,45,completed,sale_001");
    });
  });

  describe("formatCustomersCsv", () => {
    it("formats customer rows with tier and formatted spend", () => {
      const csv = formatCustomersCsv([
        {
          id: 10,
          name: "Ravi Kumar",
          email: "ravi@example.test",
          phone: "9876543210",
          totalSpendPaise: 250000,
          pointsBalance: 250,
          tier: "Silver",
          joinedAt: "2026-09-01",
        },
      ]);

      expect(csv).toContain("Customer ID,Name,Email,Phone,Lifetime Spend (INR),Points Balance,Loyalty Tier,Joined Date");
      expect(csv).toContain("10,Ravi Kumar,ravi@example.test,9876543210,2500.00,250,Silver,2026-09-01");
    });
  });
});
