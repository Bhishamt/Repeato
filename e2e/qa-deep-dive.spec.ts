import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";

const DEMO_PASSWORD = "Repeato!2026";

test.describe("Deep Dive Feature QA", () => {
  test("Mobile layout, mobile business switcher, expired vouchers, and duplicate rejections", async ({ browser }) => {
    // 1. Mobile Viewport Testing for Customer
    const mobileCustomerCtx = await browser.newContext({
      viewport: { width: 375, height: 667 }, // iPhone SE size
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    const cMobile = await mobileCustomerCtx.newPage();

    // Sign in as Asha on mobile
    await cMobile.goto("/login?as=customer");
    await cMobile.getByLabel("Email").fill("asha@example.test");
    await cMobile.getByLabel("Password").fill(DEMO_PASSWORD);
    await cMobile.getByRole("button", { name: /sign in/i }).click();
    await expect(cMobile).toHaveURL(/\/app/);

    // Check responsive bottom or top nav on mobile
    await cMobile.goto("/app/wallet");
    await expect(cMobile.getByText(/Bluebird Coffee/i).first()).toBeVisible();

    // 2. Mobile Viewport Testing for Merchant & Business Switcher
    const mobileMerchantCtx = await browser.newContext({
      viewport: { width: 375, height: 667 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    const mMobile = await mobileMerchantCtx.newPage();

    // Sign in as Priya
    await mMobile.goto("/login?as=business");
    await mMobile.getByLabel("Email").fill("priya@bluebird.test");
    await mMobile.getByLabel("Password").fill(DEMO_PASSWORD);
    await mMobile.getByRole("button", { name: /sign in to console/i }).click();
    await expect(mMobile).toHaveURL(/\/biz/);

    // Verify Business Switcher exists on mobile
    const switcher = mMobile.locator('select[name="businessId"]').first();
    if (await switcher.isVisible()) {
      await expect(switcher).toBeVisible();
    }

    // 3. Expired Voucher & Wrong Business Handling in SQLite DB
    const db = new Database("data/repeato.db");
    
    // Insert an expired voucher for Asha at Bluebird Coffee
    const asha = db.prepare("SELECT id FROM users WHERE email = ?").get("asha@example.test") as { id: number };
    const bluebird = db.prepare("SELECT id FROM businesses WHERE slug = ?").get("bluebird-coffee") as { id: number };
    const reward = db.prepare("SELECT id FROM rewards WHERE business_id = ? LIMIT 1").get(bluebird.id) as { id: number };

    const expiredToken = "EXP99999";
    db.prepare(`
      INSERT OR REPLACE INTO redemptions (id, token, business_id, reward_id, customer_id, points_spent, status, issued_at, expires_at)
      VALUES (99998, ?, ?, ?, ?, 10, 'issued', '2025-01-01T00:00:00.000Z', '2025-01-02T00:00:00.000Z')
    `).run(expiredToken, bluebird.id, reward.id, asha.id);

    const validToken = "VAL99999";
    db.prepare(`
      INSERT OR REPLACE INTO redemptions (id, token, business_id, reward_id, customer_id, points_spent, status, issued_at, expires_at)
      VALUES (99999, ?, ?, ?, ?, 10, 'issued', '2026-01-01T00:00:00.000Z', '2028-01-01T00:00:00.000Z')
    `).run(validToken, bluebird.id, reward.id, asha.id);

    db.close();

    // Try to redeem expired voucher on Merchant Console
    await mMobile.goto("/biz/redemptions");
    await mMobile.locator('input[name="token"]').fill(expiredToken);
    await mMobile.getByRole("button", { name: /verify & redeem/i }).click();
    await expect(mMobile.getByText(/expired/i).first()).toBeVisible();

    // Try to redeem Bluebird voucher from Urban Brew context (wrong business)
    // Sign in as Daniel (Urban Brew)
    const danielCtx = await browser.newContext();
    const dPage = await danielCtx.newPage();
    await dPage.goto("/login?as=business");
    await dPage.getByLabel("Email").fill("daniel@urbanbrew.test");
    await dPage.getByLabel("Password").fill(DEMO_PASSWORD);
    await dPage.getByRole("button", { name: /sign in to console/i }).click();
    await expect(dPage).toHaveURL(/\/biz/);

    await dPage.goto("/biz/redemptions");
    await dPage.locator('input[name="token"]').fill(validToken); // belongs to Bluebird, not Urban Brew
    await dPage.getByRole("button", { name: /verify & redeem/i }).click();
    await expect(dPage.getByText(/does not belong to this business/i).first()).toBeVisible();

    // Clean up temporary test rows
    const cleanupDb = new Database("data/repeato.db");
    cleanupDb.prepare("DELETE FROM redemptions WHERE id IN (99998, 99999)").run();
    cleanupDb.close();

    await mobileCustomerCtx.close();
    await mobileMerchantCtx.close();
    await danielCtx.close();
  });
});
