import { describe, expect, it } from "vitest";
import { addonRegistry } from "../lib/addons/registry";
import { checkEntitlement, getTenantEntitlements } from "../lib/entitlements";
import { createTestDb } from "../lib/db";
import type { AddonDefinition } from "../lib/addons/types";

describe("Addon Registry & Entitlement Gates", () => {
  it("registers valid add-ons and lists their manifests", () => {
    const testAddon: AddonDefinition = {
      manifest: {
        id: "marketing-campaigns",
        name: "Marketing Campaigns",
        description: "Automated customer win-back SMS/email campaigns",
        version: "1.0.0",
        requiredPlan: "growth",
        requiredRole: "owner",
        features: ["campaign.create", "campaign.send"],
      },
    };

    addonRegistry.register(testAddon);
    expect(addonRegistry.get("marketing-campaigns")).toBeDefined();
    expect(addonRegistry.list().some((m) => m.id === "marketing-campaigns")).toBe(true);
  });

  it("rejects invalid add-on identifiers", () => {
    expect(() =>
      addonRegistry.register({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        manifest: { id: "INVALID ID WITH SPACES", name: "Bad", description: "Bad" } as any,
      })
    ).toThrow();
  });

  it("checks tenant entitlements hierarchy correctly", async () => {
    const db = createTestDb();
    const entitlements = await getTenantEntitlements(db, 1);
    expect(entitlements.plan).toBe("growth");

    // Growth tenant can access free and growth features, but not pro
    expect(await checkEntitlement(db, 1, "free")).toBe(true);
    expect(await checkEntitlement(db, 1, "growth")).toBe(true);
    expect(await checkEntitlement(db, 1, "pro")).toBe(false);
    await db.close();
  });

  it("isolates hook execution failures so core caller never throws", async () => {
    const db = createTestDb();
    const faultyAddon: AddonDefinition = {
      manifest: {
        id: "faulty-hook-addon",
        name: "Faulty Addon",
        description: "Throws intentionally in hooks",
        version: "1.0.0",
        requiredPlan: "free",
        requiredRole: "owner",
        features: [],
      },
      hooks: {
        async onPointsAwarded() {
          throw new Error("Simulated 3rd-party webhook timeout or crash");
        },
      },
    };

    addonRegistry.register(faultyAddon);

    // Calling executeHook must never throw
    await expect(
      addonRegistry.executeHook(db, 1, "onPointsAwarded", { purchaseId: 10, points: 50, amountPaise: 50000 })
    ).resolves.not.toThrow();
    await db.close();
  });
});
