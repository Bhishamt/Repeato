import { describe, expect, it } from "vitest";
import {
  calculateCustomerTier,
  calculatePoints,
  calculatePointsExpiration,
  calculatePromotionalBonus,
  calculateTierUpgradeRequirements,
  getTierPerks,
  nextRewardProgress,
} from "../lib/points";
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

describe("calculateCustomerTier", () => {
  it("assigns Bronze by default for new or low-activity customers", () => {
    expect(calculateCustomerTier(0, 0)).toBe("Bronze");
    expect(calculateCustomerTier(150, 150_000)).toBe("Bronze");
  });

  it("assigns Silver when points or spend thresholds are reached", () => {
    expect(calculateCustomerTier(200, 0)).toBe("Silver");
    expect(calculateCustomerTier(50, 200_000)).toBe("Silver");
  });

  it("assigns Gold when points or spend reach gold thresholds", () => {
    expect(calculateCustomerTier(500, 0)).toBe("Gold");
    expect(calculateCustomerTier(100, 500_000)).toBe("Gold");
  });

  it("assigns Platinum when points or spend reach top thresholds", () => {
    expect(calculateCustomerTier(1000, 0)).toBe("Platinum");
    expect(calculateCustomerTier(250, 1_000_000)).toBe("Platinum");
  });
});

describe("getTierPerks", () => {
  it("returns appropriate benefits and discounts for each tier", () => {
    expect(getTierPerks("Bronze")).toMatchObject({ discountPercent: 0, pointsMultiplier: 1.0 });
    expect(getTierPerks("Silver")).toMatchObject({ discountPercent: 5, pointsMultiplier: 1.1 });
    expect(getTierPerks("Gold")).toMatchObject({ discountPercent: 10, pointsMultiplier: 1.25 });
    expect(getTierPerks("Platinum")).toMatchObject({ discountPercent: 15, pointsMultiplier: 1.5 });
  });
});

describe("calculateTierUpgradeRequirements", () => {
  it("calculates progression toward Silver for Bronze members", () => {
    const res = calculateTierUpgradeRequirements(100, 100_000);
    expect(res).toEqual({
      currentTier: "Bronze",
      nextTier: "Silver",
      pointsNeeded: 100,
      spendPaiseNeeded: 100_000,
      progressPercent: 50,
      isMaxTier: false,
    });
  });

  it("calculates progression toward Gold for Silver members", () => {
    const res = calculateTierUpgradeRequirements(300, 250_000);
    expect(res).toEqual({
      currentTier: "Silver",
      nextTier: "Gold",
      pointsNeeded: 200,
      spendPaiseNeeded: 250_000,
      progressPercent: 60,
      isMaxTier: false,
    });
  });

  it("calculates progression toward Platinum for Gold members", () => {
    const res = calculateTierUpgradeRequirements(700, 600_000);
    expect(res).toEqual({
      currentTier: "Gold",
      nextTier: "Platinum",
      pointsNeeded: 300,
      spendPaiseNeeded: 400_000,
      progressPercent: 70,
      isMaxTier: false,
    });
  });

  it("handles Platinum members at maximum tier", () => {
    const res = calculateTierUpgradeRequirements(1500, 1_500_000);
    expect(res).toEqual({
      currentTier: "Platinum",
      nextTier: null,
      pointsNeeded: 0,
      spendPaiseNeeded: 0,
      progressPercent: 100,
      isMaxTier: true,
    });
  });
});

describe("calculatePromotionalBonus", () => {
  it("applies points multiplier and flat bonus correctly", () => {
    expect(calculatePromotionalBonus(100, 2, 0)).toBe(200);
    expect(calculatePromotionalBonus(100, 1.5, 25)).toBe(175);
    expect(calculatePromotionalBonus(0, 2, 50)).toBe(50);
    expect(calculatePromotionalBonus(-10, 2, 0)).toBe(0);
  });
});

describe("calculatePointsExpiration", () => {
  const referenceNow = new Date("2026-10-23T12:00:00Z");

  it("indicates active points well before expiry window", () => {
    const lastActivity = new Date("2026-08-01T12:00:00Z");
    const status = calculatePointsExpiration(lastActivity, 365, referenceNow);
    expect(status.isExpired).toBe(false);
    expect(status.warningThreshold).toBe(false);
    expect(status.daysRemaining).toBeGreaterThan(30);
  });

  it("triggers warning threshold when within 30 days of expiry", () => {
    const lastActivity = new Date("2025-11-01T12:00:00Z");
    const status = calculatePointsExpiration(lastActivity, 365, referenceNow);
    expect(status.isExpired).toBe(false);
    expect(status.warningThreshold).toBe(true);
    expect(status.daysRemaining).toBeLessThanOrEqual(30);
  });

  it("marks points as expired when past retention period", () => {
    const lastActivity = new Date("2025-01-01T12:00:00Z");
    const status = calculatePointsExpiration(lastActivity, 365, referenceNow);
    expect(status.isExpired).toBe(true);
    expect(status.daysRemaining).toBe(0);
  });
});
