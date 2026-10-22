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
