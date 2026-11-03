import { z } from "zod";

/**
 * Validated schema for an add-on manifest.
 * Add-ons must register statically at startup and declare their entitlements and permissions.
 */
export const AddonManifestSchema = z.object({
  id: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/),
  name: z.string().min(2).max(80),
  description: z.string().max(250),
  version: z.string().default("1.0.0"),
  requiredPlan: z.enum(["free", "growth", "pro"]).default("growth"),
  requiredRole: z.enum(["owner", "manager"]).default("owner"),
  features: z.array(z.string()).default([]),
});

export type AddonManifest = z.infer<typeof AddonManifestSchema>;

export type AddonContext = {
  businessId: number;
  userId: number;
  config?: Record<string, unknown>;
};

export type AddonLifecycleHooks = {
  onPointsAwarded?: (ctx: AddonContext, event: { purchaseId: number; points: number; amountPaise: number }) => Promise<void>;
  onVoucherRedeemed?: (ctx: AddonContext, event: { redemptionId: number; token: string; pointsSpent: number }) => Promise<void>;
  onCustomerJoined?: (ctx: AddonContext, event: { customerId: number; bonus: number }) => Promise<void>;
};

export interface AddonDefinition {
  manifest: AddonManifest;
  hooks?: AddonLifecycleHooks;
}

