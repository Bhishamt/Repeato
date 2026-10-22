import { describe, expect, it } from "vitest";
import { calculatePoints, nextRewardProgress } from "../lib/points";
import { DEFAULT_RULES } from "../lib/db";

const rules = { ...DEFAULT_RULES, minPurchasePaise: 10_000, pointsPer100: 10, maxPointsPerTxn: 500 };

describe("calculatePoints", () => {
  it("awards 10 points per whole ₹100", () => {
    expect(calculatePoints({ amountPaise: 10_000, rules }).points).toBe(10);
    expect(calculatePoints({ amountPaise: 25_050, rules }).points).toBe(25);
    expect(calculatePoints({ amountPaise: 9_999, rules }).points).toBe(0);
  });

  it("rejects purchases below the minimum", () => {
    const result = calculatePoints({ amountPaise: 5_000, rules });
    expect(result.eligible).toBe(false);
    expect(result.points).toBe(0);
    expect(result.reason).toMatch(/do not earn/);
  });

  it("caps a single transaction", () => {
    const result = calculatePoints({ amountPaise: 2_000_000, rules });
    expect(result.points).toBe(500);
    expect(result.capped).toBe(true);
  });

  it("uses product points instead of spend for overridden lines", () => {
    const result = calculatePoints({
      amountPaise: 20_000,
      rules,
      lines: [
        { name: "Filter coffee", unitPricePaise: 15_000, quantity: 1, pointsOverride: 40 },
        { name: "Croissant", unitPricePaise: 5_000, quantity: 1 },
      ],
    });
    expect(result.points).toBe(45);
    expect(result.lines.find((l) => l.name === "Filter coffee")?.mode).toBe("product");
  });

  it("does not double count when every line has an override", () => {
    const result = calculatePoints({
      amountPaise: 50_000,
      rules,
      lines: [{ name: "Gift box", unitPricePaise: 25_000, quantity: 2, pointsOverride: 5 }],
    });
    expect(result.points).toBe(10);
  });

  it("ignores unsafe integers", () => {
    expect(calculatePoints({ amountPaise: Number.NaN, rules }).eligible).toBe(false);
    expect(calculatePoints({ amountPaise: -100, rules }).eligible).toBe(false);
  });
});

describe("nextRewardProgress", () => {
  const rewards = [
    { id: 1, name: "Coffee", pointsCost: 100 },
    { id: 2, name: "Brunch", pointsCost: 500 },
  ];
  it("returns the best affordable reward", () => {
    expect(nextRewardProgress(650, rewards)).toMatchObject({ ready: true, reward: { id: 2 }, percent: 100 });
  });
  it("returns progress toward the next reward", () => {
    expect(nextRewardProgress(40, rewards)).toMatchObject({ ready: false, remaining: 60, percent: 40 });
  });
  it("handles an empty catalogue", () => {
    expect(nextRewardProgress(10, [])).toBeNull();
  });
});
