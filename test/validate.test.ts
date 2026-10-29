import { describe, expect, it } from "vitest";
import {
  currencyCode,
  email,
  optionalText,
  password,
  percentage,
  phone,
  positiveInt,
  safeNext,
  sanitizeFilename,
  slug,
  text,
  toPaise,
  voucherCode,
} from "../lib/validate";

describe("validation helpers", () => {
  describe("toPaise", () => {
    it("parses whole rupees, decimals, and formatted input", () => {
      expect(toPaise("480")).toBe(48_000);
      expect(toPaise("480.50")).toBe(48_050);
      expect(toPaise("1,299.5")).toBe(129_950);
      expect(toPaise("₹250")).toBe(25_000);
      expect(toPaise("₹ 1,500.00")).toBe(150_000);
      expect(toPaise(" 2,499.99 ")).toBe(249_999);
      expect(toPaise(250)).toBe(25_000);
    });

    it("accepts amounts up to the documented ₹2,00,000 purchase ceiling", () => {
      expect(toPaise("200000")).toBe(20_000_000);
      expect(toPaise("150000")).toBe(15_000_000);
    });

    it("rejects amounts above ₹2,00,000", () => {
      expect(toPaise("200000.01")).toBeNull();
      expect(toPaise("999999")).toBeNull();
    });

    it("rejects malformed, zero, and negative values", () => {
      expect(toPaise("")).toBeNull();
      expect(toPaise("abc")).toBeNull();
      expect(toPaise("12.345")).toBeNull();
      expect(toPaise("0")).toBeNull();
      expect(toPaise("-50")).toBeNull();
      expect(toPaise(null)).toBeNull();
      expect(toPaise(undefined)).toBeNull();
    });
  });

  describe("text & optionalText", () => {
    it("collapses internal whitespace and enforces boundaries for text", () => {
      expect(text("  hello   world  ", 3, 20)).toBe("hello world");
      expect(text("ab", 3, 20)).toBeNull();
      expect(text("this is too long text", 3, 10)).toBeNull();
      expect(text(123 as unknown, 1, 10)).toBeNull();
    });

    it("trims and truncates optionalText", () => {
      expect(optionalText("   notes here   ", 20)).toBe("notes here");
      expect(optionalText("   ", 20)).toBeNull();
      expect(optionalText(null, 20)).toBeNull();
      expect(optionalText("abcdefghij", 5)).toBe("abcde");
    });
  });

  describe("email", () => {
    it("normalizes and accepts valid emails", () => {
      expect(email("  Test@Example.COM ")).toBe("test@example.com");
      expect(email("user.name+tag@sub.domain.co.in")).toBe("user.name+tag@sub.domain.co.in");
    });

    it("rejects invalid emails", () => {
      expect(email("not-an-email")).toBeNull();
      expect(email("@missing-user.com")).toBeNull();
      expect(email("missing-domain@")).toBeNull();
      expect(email(123 as unknown)).toBeNull();
    });
  });

  describe("phone", () => {
    it("strips non-digits and validates length", () => {
      expect(phone("+91 (987) 654-3210")).toBe("919876543210");
      expect(phone("9876543210")).toBe("9876543210");
      expect(phone("123")).toBeNull(); // too short
      expect(phone(null)).toBeNull();
    });
  });

  describe("password", () => {
    it("validates password length requirements", () => {
      expect(password("secret123")).toBe("secret123");
      expect(password("short")).toBeNull();
      expect(password(null)).toBeNull();
    });
  });

  describe("positiveInt", () => {
    it("accepts valid positive integers up to max", () => {
      expect(positiveInt("42")).toBe(42);
      expect(positiveInt(10)).toBe(10);
      expect(positiveInt("0")).toBeNull();
      expect(positiveInt("-5")).toBeNull();
      expect(positiveInt("1.5")).toBeNull();
      expect(positiveInt("1001", 1000)).toBeNull();
    });
  });

  describe("safeNext", () => {
    it("allows valid relative redirect paths", () => {
      expect(safeNext("/console")).toBe("/console");
      expect(safeNext("/app/wallet?tab=points")).toBe("/app/wallet?tab=points");
    });

    it("rejects protocol-relative, absolute, or backslash paths", () => {
      expect(safeNext("//evil.com")).toBeNull();
      expect(safeNext("https://evil.com")).toBeNull();
      expect(safeNext("/\\evil.com")).toBeNull();
      expect(safeNext(null)).toBeNull();
    });
  });

  describe("slug", () => {
    it("validates clean lowercase kebab-case slugs", () => {
      expect(slug("bluebird-coffee")).toBe("bluebird-coffee");
      expect(slug("Urban-Brew-123")).toBe("urban-brew-123");
      expect(slug("cafe")).toBe("cafe");
    });

    it("rejects invalid characters, double hyphens, and leading/trailing hyphens", () => {
      expect(slug("-leading-hyphen")).toBeNull();
      expect(slug("trailing-hyphen-")).toBeNull();
      expect(slug("double--hyphens")).toBeNull();
      expect(slug("has spaces")).toBeNull();
      expect(slug("special!chars")).toBeNull();
      expect(slug("ab")).toBeNull(); // default min is 3
    });
  });

  describe("voucherCode", () => {
    it("accepts and uppercases 8-character alphanumeric voucher codes", () => {
      expect(voucherCode("AB12CD34")).toBe("AB12CD34");
      expect(voucherCode("ab12cd34")).toBe("AB12CD34");
      expect(voucherCode("  XY89KL01  ")).toBe("XY89KL01");
    });

    it("rejects invalid voucher codes", () => {
      expect(voucherCode("SHORT")).toBeNull();
      expect(voucherCode("TOOLONGCODE123")).toBeNull();
      expect(voucherCode("AB12-CD3")).toBeNull();
      expect(voucherCode(null)).toBeNull();
    });
  });

  describe("percentage", () => {
    it("validates and rounds percentages", () => {
      expect(percentage(15)).toBe(15);
      expect(percentage("12.5")).toBe(12.5);
      expect(percentage("33.3333")).toBe(33.33);
      expect(percentage(0)).toBe(0);
      expect(percentage(100)).toBe(100);
    });

    it("rejects out of bounds and non-numbers", () => {
      expect(percentage(-1)).toBeNull();
      expect(percentage(101)).toBeNull();
      expect(percentage("abc")).toBeNull();
    });
  });

  describe("currencyCode", () => {
    it("validates 3-letter currency codes", () => {
      expect(currencyCode("inr")).toBe("INR");
      expect(currencyCode("USD")).toBe("USD");
      expect(currencyCode("eur")).toBe("EUR");
    });

    it("rejects invalid currency codes", () => {
      expect(currencyCode("IN")).toBeNull();
      expect(currencyCode("USDT")).toBeNull();
      expect(currencyCode("123")).toBeNull();
      expect(currencyCode(null)).toBeNull();
    });
  });

  describe("sanitizeFilename", () => {
    it("cleans forbidden characters and path traversals", () => {
      expect(sanitizeFilename("report_2026.csv")).toBe("report_2026.csv");
      expect(sanitizeFilename("../../etc/passwd")).toBe("etc_passwd");
      expect(sanitizeFilename("bluebird:oct*sales?.csv")).toBe("bluebird_oct_sales_.csv");
    });

    it("falls back to default if input is empty or invalid", () => {
      expect(sanitizeFilename("")).toBe("export");
      expect(sanitizeFilename(null)).toBe("export");
      expect(sanitizeFilename("???", "backup")).toBe("backup");
    });
  });
});
