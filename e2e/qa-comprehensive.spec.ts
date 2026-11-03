import { test, expect } from "@playwright/test";

const DEMO_PASSWORD = "Repeato!2026";

test.describe("Full Feature-by-Feature QA Suite", () => {
  // 1. Marketing & Public Pages
  test("1. Marketing and Public routes load properly", async ({ page }) => {
    const routes = ["/", "/features", "/how-it-works", "/for-businesses", "/pricing", "/about", "/contact", "/terms", "/privacy"];
    for (const r of routes) {
      await page.goto(r);
      await expect(page).toHaveTitle(/Repeato/i);
    }

    // Verify Contact Us page placeholder and form
    await page.goto("/contact");
    await expect(page.getByText(/Tell us about your café/i)).toBeVisible();
    await expect(page.getByLabel("Your name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Message")).toBeVisible();
    await expect(page.getByRole("button", { name: /send message/i })).toBeVisible();

    // Verify Pricing page options
    await page.goto("/pricing");
    await expect(page.getByText(/Early access pricing/i).first()).toBeVisible();
  });

  // 2. Customer Authentication, Wallet & Ledger
  test("2. Customer Sign-in, Wallet, Points, and Ledger", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Sign in as Asha
    await page.goto("/login?as=customer");
    await expect(page.getByText(/Customer wallet/i).first()).toBeVisible();
    await page.getByLabel("Email").fill("asha@example.test");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Lands on Customer /app
    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByText(/Asha Menon/i).first()).toBeVisible();

    // Check Wallet view
    await page.goto("/app/wallet");
    await expect(page.getByText(/Bluebird Coffee/i).first()).toBeVisible();

    // Check Activity / Ledger
    await page.goto("/app/activity");
    await expect(page.getByText(/Every visit, on the record/i).first()).toBeVisible();

    // Check Vouchers page
    await page.goto("/app/vouchers");
    await expect(page.getByText(/Show this at the counter/i).first()).toBeVisible();

    // Sign out
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
    await ctx.close();
  });

  // 3. QR Joining & Invalid QR handling
  test("3. QR Scanning, Joining, and Invalid QR Error Handling", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Valid QR join page
    await page.goto("/join/bluebird-coffee");
    await expect(page.getByText(/Scanned/i).first()).toBeVisible();
    await expect(page.getByText(/Bluebird Coffee/i).first()).toBeVisible();

    // Invalid QR slug
    await page.goto("/join/non-existent-cafe-999");
    await expect(page.getByText(/Page not found/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to home/i })).toBeVisible();

    await ctx.close();
  });

  // 4. Merchant Dashboard, Switching, Multi-business, and Staff actions
  test("4. Merchant Console, Transactions, Vouchers, and Switching", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Merchant sign-in as Priya (Owner of Bluebird Coffee)
    await page.goto("/login?as=business");
    await expect(page.getByText(/Merchant console/i).first()).toBeVisible();
    await page.getByLabel("Email").fill("priya@bluebird.test");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /sign in to console/i }).click();

    await expect(page).toHaveURL(/\/biz/);
    await expect(page.getByText(/Bluebird Coffee/i).first()).toBeVisible();

    // Check Navigation Tabs
    const tabs = [
      { path: "/biz/transactions", title: "Transactions" },
      { path: "/biz/redemptions", title: "Redemptions" },
      { path: "/biz/customers", title: "Customers" },
      { path: "/biz/menu", title: "Menu" },
      { path: "/biz/rewards", title: "Rewards" },
      { path: "/biz/loyalty", title: "Loyalty rules" },
      { path: "/biz/qr", title: "QR code" },
      { path: "/biz/analytics", title: "Analytics" },
      { path: "/biz/team", title: "Team" },
      { path: "/biz/settings", title: "Settings" },
    ];

    for (const t of tabs) {
      await page.goto(t.path);
      await expect(page).toHaveURL(new RegExp(t.path));
    }

    // Verify Business creation link
    await page.goto("/biz");
    const addBizBtn = page.getByRole("link", { name: /add business/i });
    await expect(addBizBtn).toBeVisible();
    await addBizBtn.click();
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByText(/Add a business/i)).toBeVisible();

    // Test Voucher redemption with invalid code
    await page.goto("/biz/redemptions");
    await page.getByLabel("Voucher code").fill("INVALID9");
    await page.getByRole("button", { name: /verify & redeem/i }).click();
    await expect(page.getByText(/not found|unknown|refused|does not match/i)).toBeVisible();

    await ctx.close();
  });

  // 5. 404 Not Found & Error boundaries
  test("5. Recovery & 404 boundaries", async ({ page }) => {
    await page.goto("/this-page-definitely-does-not-exist-404");
    await expect(page.getByText(/Page not found/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /back to home/i })).toBeVisible();
  });
});
