import type { Db } from "./db";

export type SubscriptionPlan = "free" | "growth" | "pro";

export type TenantEntitlements = {
  plan: SubscriptionPlan;
  maxBusinesses: number;
  maxProducts: number;
  maxStaffPerBusiness: number;
  analyticsRetentionDays: number;
  customBranding: boolean;
  webhookIntegrations: boolean;
};

const PLAN_LIMITS: Record<SubscriptionPlan, TenantEntitlements> = {
  free: {
    plan: "free",
    maxBusinesses: 2,
    maxProducts: 30,
    maxStaffPerBusiness: 2,
    analyticsRetentionDays: 30,
    customBranding: false,
    webhookIntegrations: false,
  },
  growth: {
    plan: "growth",
    maxBusinesses: 10,
    maxProducts: 200,
    maxStaffPerBusiness: 10,
    analyticsRetentionDays: 180,
    customBranding: true,
    webhookIntegrations: true,
  },
  pro: {
    plan: "pro",
    maxBusinesses: 50,
    maxProducts: 1000,
    maxStaffPerBusiness: 50,
    analyticsRetentionDays: 730,
    customBranding: true,
    webhookIntegrations: true,
  },
};

/**
 * Returns the tenant's entitlements. Currently reads the configured tier or defaults
 * safely to 'growth' for the foundation preview, without requiring live billing.
 */
export async function getTenantEntitlements(
  _db: Db,
  _businessId: number
): Promise<TenantEntitlements> {
  const defaultPlan: SubscriptionPlan = (process.env.DEFAULT_SUBSCRIPTION_PLAN as SubscriptionPlan) || "growth";
  return PLAN_LIMITS[defaultPlan] || PLAN_LIMITS.growth;
}

/**
 * Checks if a tenant is entitled to a specific add-on or feature tier.
 */
export async function checkEntitlement(
  db: Db,
  businessId: number,
  requiredPlan: SubscriptionPlan
): Promise<boolean> {
  const current = await getTenantEntitlements(db, businessId);
  const ranks: Record<SubscriptionPlan, number> = { free: 0, growth: 1, pro: 2 };
  return ranks[current.plan] >= ranks[requiredPlan];
}

