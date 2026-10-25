import { describe, expect, it } from "vitest";
import { toPaise } from "../lib/validate";

describe("toPaise", () => {
  it("parses whole rupees, decimals, and formatted input", () => {
    expect(toPaise("480")).toBe(48_000);
    expect(toPaise("480.50")).toBe(48_050);
    expect(toPaise("1,299.5")).toBe(129_950);
    expect(toPaise("₹250")).toBe(25_000);
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
    expect(toPaise("-5")).toBeNull();
    expect(toPaise(null)).toBeNull();
  });
});
