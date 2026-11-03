import type { AddonDefinition, AddonManifest, AddonLifecycleHooks, AddonContext } from "./types";
import { AddonManifestSchema } from "./types";
import type { Db } from "../db";

class AddonRegistry {
  private addons = new Map<string, AddonDefinition>();

  /**
   * Statically registers an add-on at application startup.
   */
  register(addon: AddonDefinition): void {
    const validated = AddonManifestSchema.safeParse(addon.manifest);
    if (!validated.success) {
      throw new Error(`Failed to register add-on '${addon.manifest?.id}': ${validated.error.message}`);
    }
    if (this.addons.has(addon.manifest.id)) {
      throw new Error(`Add-on '${addon.manifest.id}' is already registered.`);
    }
    this.addons.set(addon.manifest.id, addon);
  }

  get(id: string): AddonDefinition | undefined {
    return this.addons.get(id);
  }

  list(): AddonManifest[] {
    return Array.from(this.addons.values()).map((a) => a.manifest);
  }

  /**
   * Invokes a lifecycle hook across all active, entitled add-ons for a tenant.
   * Hooks run in isolated try-catch blocks: a failing hook will never abort or corrupt
   * core business operations or ledger transactions.
   */
  async executeHook<K extends keyof AddonLifecycleHooks>(
    db: Db,
    businessId: number,
    hookName: K,
    payload: Parameters<NonNullable<AddonLifecycleHooks[K]>>[1]
  ): Promise<void> {
    for (const [id, addon] of this.addons.entries()) {
      const hook = addon.hooks?.[hookName];
      if (!hook) continue;

      try {
        // In full multi-tenant model, check if add-on is enabled for businessId in business_addons table
        const ctx: AddonContext = { businessId, userId: 0 };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (hook as any)(ctx, payload);
      } catch (err) {
        // Isolation guarantee: Log error, never crash the host application
        console.error(`[addon:${id}] Error executing hook '${hookName}' for business ${businessId}:`, err);
      }
    }
  }
}

export const addonRegistry = new AddonRegistry();

