import type { Rules } from "./db";

export type PurchaseLine = {
  name: string;
  unitPricePaise: number;
  quantity: number;
  productId?: number | null;
  /** Product-specific points per unit. When set, it replaces the spend formula for that line. */
  pointsOverride?: number | null;
};

export type PointsResult = {
  eligible: boolean;
  points: number;
  basePoints: number;
  capped: boolean;
  reason?: string;
  lines: Array<{ name: string; points: number; mode: "product" | "spend" }>;
};

/**
 * Loyalty policy (documented in docs/PRODUCT_REQUIREMENTS.md):
 * - 1 point per whole ₹100 by default, configurable per business.
 * - Purchases below the business minimum earn nothing.
 * - A line with a product-level points override earns that many points per unit
 *   and is excluded from the spend formula, so nothing is counted twice.
 * - The per-transaction cap applies to the final total.
 */
export function calculatePoints(input: {
  amountPaise: number;
  rules: Rules;
  lines?: PurchaseLine[];
}): PointsResult {
  const { amountPaise, rules } = input;
  const lines = input.lines ?? [];

  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    return { eligible: false, points: 0, basePoints: 0, capped: false, reason: "Enter a purchase amount.", lines: [] };
  }
  if (amountPaise < rules.minPurchasePaise) {
    return {
      eligible: false,
      points: 0,
      basePoints: 0,
      capped: false,
      reason: `Purchases under ${formatMinor(rules.minPurchasePaise)} do not earn points.`,
      lines: [],
    };
  }

  const spendLines = lines.filter((l) => l.pointsOverride == null);
  const productLines = lines.filter((l) => l.pointsOverride != null);

  const lineBreakdown: PointsResult["lines"] = [];
  let productPoints = 0;
  for (const line of productLines) {
    const pts = Math.max(0, Math.floor(line.pointsOverride ?? 0)) * line.quantity;
    productPoints += pts;
    lineBreakdown.push({ name: line.name, points: pts, mode: "product" });
  }

  const spendBase = spendLines.length
    ? spendLines.reduce((sum, l) => sum + l.unitPricePaise * l.quantity, 0)
    : productLines.length
      ? 0
      : amountPaise;

  const basePoints = Math.floor((spendBase / 10_000) * rules.pointsPer100);
  for (const line of spendLines) {
    const pts = Math.floor((line.unitPricePaise * line.quantity / 10_000) * rules.pointsPer100);
    lineBreakdown.push({ name: line.name, points: pts, mode: "spend" });
  }

  const raw = productPoints + basePoints;
  const capped = raw > rules.maxPointsPerTxn;
  return {
    eligible: true,
    points: Math.min(raw, rules.maxPointsPerTxn),
    basePoints: raw,
    capped,
    lines: lineBreakdown,
  };
}

function formatMinor(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function nextRewardProgress(balance: number, rewards: Array<{ id: number; name: string; pointsCost: number }>) {
  const affordable = rewards.filter((r) => r.pointsCost <= balance);
  const upcoming = rewards.filter((r) => r.pointsCost > balance).sort((a, b) => a.pointsCost - b.pointsCost)[0];
  if (affordable.length) {
    const best = affordable.sort((a, b) => b.pointsCost - a.pointsCost)[0];
    return { reward: best, ready: true, remaining: 0, percent: 100 };
  }
  if (!upcoming) return null;
  return {
    reward: upcoming,
    ready: false,
    remaining: upcoming.pointsCost - balance,
    percent: Math.min(100, Math.floor((balance / upcoming.pointsCost) * 100)),
  };
}

export type LoyaltyTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface TierUpgradeRequirements {
  currentTier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  pointsNeeded: number;
  spendPaiseNeeded: number;
  progressPercent: number;
  isMaxTier: boolean;
}

export interface TierPerks {
  discountPercent: number;
  pointsMultiplier: number;
  description: string;
}

export interface PointsExpirationStatus {
  isExpired: boolean;
  daysRemaining: number;
  expiryDate: Date;
  warningThreshold: boolean;
}

export function calculateCustomerTier(
  totalPoints: number,
  lifetimeSpendPaise = 0
): LoyaltyTier {
  const safePoints = Math.max(0, totalPoints || 0);
  const safeSpend = Math.max(0, lifetimeSpendPaise || 0);

  if (safePoints >= 1000 || safeSpend >= 1_000_000) return "Platinum";
  if (safePoints >= 500 || safeSpend >= 500_000) return "Gold";
  if (safePoints >= 200 || safeSpend >= 200_000) return "Silver";
  return "Bronze";
}

export function getTierPerks(tier: LoyaltyTier): TierPerks {
  switch (tier) {
    case "Platinum":
      return {
        discountPercent: 15,
        pointsMultiplier: 1.5,
        description: "15% bill discount + 50% points accelerator + priority service",
      };
    case "Gold":
      return {
        discountPercent: 10,
        pointsMultiplier: 1.25,
        description: "10% bill discount + 25% points accelerator",
      };
    case "Silver":
      return {
        discountPercent: 5,
        pointsMultiplier: 1.1,
        description: "5% bill discount + 10% points accelerator",
      };
    case "Bronze":
    default:
      return {
        discountPercent: 0,
        pointsMultiplier: 1.0,
        description: "Standard earning rate (1 pt per ₹100 spend)",
      };
  }
}

export function calculateTierUpgradeRequirements(
  currentPoints: number,
  lifetimeSpendPaise = 0
): TierUpgradeRequirements {
  const safePoints = Math.max(0, currentPoints || 0);
  const safeSpend = Math.max(0, lifetimeSpendPaise || 0);
  const currentTier = calculateCustomerTier(safePoints, safeSpend);

  if (currentTier === "Platinum") {
    return {
      currentTier,
      nextTier: null,
      pointsNeeded: 0,
      spendPaiseNeeded: 0,
      progressPercent: 100,
      isMaxTier: true,
    };
  }

  let nextTier: LoyaltyTier = "Silver";
  let targetPoints = 200;
  let targetSpendPaise = 200_000;

  if (currentTier === "Silver") {
    nextTier = "Gold";
    targetPoints = 500;
    targetSpendPaise = 500_000;
  } else if (currentTier === "Gold") {
    nextTier = "Platinum";
    targetPoints = 1000;
    targetSpendPaise = 1_000_000;
  }

  const pointsNeeded = Math.max(0, targetPoints - safePoints);
  const spendPaiseNeeded = Math.max(0, targetSpendPaise - safeSpend);

  const pointsProgress = Math.min(100, Math.floor((safePoints / targetPoints) * 100));
  const spendProgress = Math.min(100, Math.floor((safeSpend / targetSpendPaise) * 100));
  const progressPercent = Math.max(pointsProgress, spendProgress);

  return {
    currentTier,
    nextTier,
    pointsNeeded,
    spendPaiseNeeded,
    progressPercent,
    isMaxTier: false,
  };
}

export function calculatePromotionalBonus(
  basePoints: number,
  multiplier = 1,
  flatBonus = 0
): number {
  if (basePoints <= 0 && flatBonus <= 0) return 0;
  const safeBase = Math.max(0, basePoints);
  const safeMultiplier = Math.max(1, multiplier);
  const safeFlatBonus = Math.max(0, flatBonus);
  return Math.floor(safeBase * safeMultiplier) + safeFlatBonus;
}

export function calculatePointsExpiration(
  lastActivity: string | Date | null | undefined,
  retentionPeriodDays = 365,
  currentDate: Date = new Date()
): PointsExpirationStatus {
  const baseDate = lastActivity instanceof Date
    ? lastActivity
    : lastActivity
      ? new Date(lastActivity)
      : new Date();

  const safeDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const expiryDate = new Date(safeDate.getTime() + retentionPeriodDays * 24 * 60 * 60 * 1000);
  const msRemaining = expiryDate.getTime() - currentDate.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
  const isExpired = msRemaining <= 0;
  const warningThreshold = !isExpired && daysRemaining <= 30;

  return {
    isExpired,
    daysRemaining,
    expiryDate,
    warningThreshold,
  };
}
