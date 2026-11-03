import { test, expect } from "@playwright/test";

test.describe.serial("Create & QA Gmail Demo Accounts", () => {
  const merchantEmail = "merchant@gmail.com";
  const customerEmail = "customer@gmail.com";
  const testPassword = "12345678";
  let businessSlug = "";
  let voucherCode = "";

  test("1. Create Merchant Account (merchant.repeato@gmail.com)", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto("/signup?as=business");
    await page.getByLabel("Your name").fill("Demo Merchant Owner");
    await page.getByLabel("Business name").fill("Artisan Cafe");
    await page.getByLabel("City").fill("Bangalore");
    await page.getByLabel("Email").fill(merchantEmail);
    await page.locator('input[name="password"]').fill(testPassword);
    await page.locator('input[name="confirm"]').fill(testPassword);
    await page.getByRole("button", { name: /create business/i }).click();

    await page.waitForTimeout(1000);
    if (!page.url().includes("/biz")) {
      await page.goto("/login?as=business");
      await page.getByLabel("Email").fill(merchantEmail);
      await page.getByLabel("Password").fill(testPassword);
      await page.getByRole("button", { name: /sign in to console/i }).click();
    }
    await expect(page).toHaveURL(/\/biz/);

    // Get the business slug from QR page
    await page.goto("/biz/qr");
    const previewLink = await page.getByRole("link", { name: /preview join page/i }).getAttribute("href");
    businessSlug = previewLink?.split("/join/")[1]?.trim() ?? "artisan-cafe";
    console.log(`Created/Found Business Slug: ${businessSlug}`);

    // Ensure reward exists
    await page.goto("/biz/rewards");
    const rewardCount = await page.getByText(/Free Cappuccino/i).count();
    if (rewardCount === 0) {
      await page.locator('form input[name="name"]').fill("Free Cappuccino");
      await page.locator('form input[name="pointsCost"]').fill("50");
      await page.locator('form input[name="description"]').fill("One fresh hot cappuccino on the house");
      await page.getByRole("button", { name: /create reward/i }).click();
      await expect(page.getByText(/Free Cappuccino/i).first()).toBeVisible();
    }

    // Ensure loyalty rules
    await page.goto("/biz/loyalty");
    await page.locator('input[name="pointsPer100"]').fill("10");
    await page.locator('input[name="signupBonus"]').fill("50");
    await page.locator('input[name="minRedeemPoints"]').fill("10");
    await page.getByRole("button", { name: /save rules/i }).click();

    await ctx.close();
  });

  test("2. Create Customer Account (customer.repeato@gmail.com) & Join Business", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto("/signup?as=customer");
    await page.getByLabel("Your name").fill("Demo Customer");
    await page.getByLabel("Email").fill(customerEmail);
    await page.locator('input[name="password"]').fill(testPassword);
    await page.locator('input[name="confirm"]').fill(testPassword);
    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForTimeout(1000);
    if (!page.url().includes("/app")) {
      await page.goto("/login?as=customer");
      await page.getByLabel("Email").fill(customerEmail);
      await page.getByLabel("Password").fill(testPassword);
      await page.getByRole("button", { name: /sign in/i }).click();
    }

    await expect(page).toHaveURL(/\/app/);

    // Join the merchant business via QR join page
    await page.goto(`/join/${businessSlug}`);
    const joinBtn = page.getByRole("button", { name: /join/i });
    if (await joinBtn.isVisible()) {
      await joinBtn.click();
    }

    // Check points balance
    await page.goto("/app/wallet");
    await expect(page.getByText("50").first()).toBeVisible();

    await ctx.close();
  });

  test("3. Merchant Records Purchase for Customer", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto("/login?as=business");
    await page.getByLabel("Email").fill(merchantEmail);
    await page.getByLabel("Password").fill(testPassword);
    await page.getByRole("button", { name: /sign in to console/i }).click();
    await expect(page).toHaveURL(/\/biz/);

    await page.goto("/biz/transactions");
    const customerSelect = page.getByLabel("Customer");
    await customerSelect.selectOption({ label: `Demo Customer · ${customerEmail}` });
    await page.getByLabel("Bill amount (₹)").fill("500");
    await page.getByLabel("Receipt / bill number").fill("DEMO-INV-500");
    await page.getByRole("button", { name: /record sale/i }).click();
    await expect(page.getByText("DEMO-INV-500").first()).toBeVisible();

    await ctx.close();
  });

  test("4. Customer Redeems Reward & Generates Voucher", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto("/login?as=customer");
    await page.getByLabel("Email").fill(customerEmail);
    await page.getByLabel("Password").fill(testPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app/);

    // Customer balance should now be 100 points (50 welcome + 50 purchase)
    await page.goto("/app/wallet");
    await expect(page.getByText("100").first()).toBeVisible();

    // Redeem reward (50 points)
    await page.goto("/app/rewards");
    const redeemBtn = page.getByRole("button", { name: /redeem/i }).first();
    await redeemBtn.click();

    // Redirected to /app/vouchers
    await expect(page).toHaveURL(/\/app\/vouchers/);
    const searchParams = new URL(page.url()).searchParams;
    voucherCode = searchParams.get("issued") ?? "";
    if (!voucherCode) {
      voucherCode = (await page.locator('p[aria-label^="Code "]').first().textContent())?.trim() ?? "";
    }
    console.log(`Generated Voucher Code: ${voucherCode}`);
    expect(voucherCode.length).toBeGreaterThanOrEqual(8);

    await ctx.close();
  });

  test("5. Merchant Accepts Voucher & Confirms Redemption", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto("/login?as=business");
    await page.getByLabel("Email").fill(merchantEmail);
    await page.getByLabel("Password").fill(testPassword);
    await page.getByRole("button", { name: /sign in to console/i }).click();
    await expect(page).toHaveURL(/\/biz/);

    await page.goto("/biz/redemptions");
    await page.locator('input[name="token"]').fill(voucherCode);
    await page.getByRole("button", { name: /verify & redeem/i }).click();
    await expect(page.getByText(/redeemed for Demo Customer/i).first()).toBeVisible();

    await ctx.close();
  });
});
