import { test, expect } from "@playwright/test";

test.describe.serial("Complete End-to-End Functional QA Audit", () => {
  const ts = Date.now();
  const customerEmail = `qa-customer-${ts}@example.test`;
  const merchantEmail = `qa-merchant-${ts}@example.test`;
  const staffEmail = `qa-staff-${ts}@example.test`;
  const testPassword = "TestPassword!2026";
  const businessName = `QA Bakery ${ts}`;
  let businessSlug = "";
  let voucherToken = "";

  test("1. User Registrations (Merchant, Customer, Staff) via Normal UI", async ({ browser }) => {
    // A. Merchant Registration via /signup?as=business
    const mCtx = await browser.newContext();
    const mPage = await mCtx.newPage();
    await mPage.goto("/signup?as=business");
    await mPage.getByLabel("Your name").fill("QA Merchant Owner");
    await mPage.getByLabel("Business name").fill(businessName);
    await mPage.locator('select[name="category"]').selectOption("Bakery");
    await mPage.getByLabel("City").fill("Bengaluru");
    await mPage.getByLabel("Email").fill(merchantEmail);
    await mPage.getByLabel("Password", { exact: true }).fill(testPassword);
    await mPage.getByLabel("Confirm password").fill(testPassword);
    await mPage.getByRole("button", { name: /create business/i }).click();

    // Merchant lands on console
    await expect(mPage).toHaveURL(/\/biz/);
    await expect(mPage.getByText(businessName).first()).toBeVisible();

    // Grab business slug from QR page
    await mPage.goto("/biz/qr");
    const qrLink = await mPage.locator('a[href*="/join/"]').first().getAttribute("href");
    expect(qrLink).toBeTruthy();
    businessSlug = qrLink!.split("/join/")[1];
    await mCtx.close();

    // B. Customer Registration via /signup?as=customer
    const cCtx = await browser.newContext();
    const cPage = await cCtx.newPage();
    await cPage.goto("/signup?as=customer");
    await cPage.getByLabel("Your name").fill("QA Customer Person");
    await cPage.getByLabel("Email").fill(customerEmail);
    await cPage.getByLabel("Password", { exact: true }).fill(testPassword);
    await cPage.getByLabel("Confirm password").fill(testPassword);
    await cPage.getByRole("button", { name: /create account/i }).click();
    await expect(cPage).toHaveURL(/\/app/);
    await expect(cPage.getByText(/QA Customer Person/i).first()).toBeVisible();
    await cCtx.close();

    // C. Staff Registration via /signup?as=customer
    const sCtx = await browser.newContext();
    const sPage = await sCtx.newPage();
    await sPage.goto("/signup?as=customer");
    await sPage.getByLabel("Your name").fill("QA Staff Member");
    await sPage.getByLabel("Email").fill(staffEmail);
    await sPage.getByLabel("Password", { exact: true }).fill(testPassword);
    await sPage.getByLabel("Confirm password").fill(testPassword);
    await sPage.getByRole("button", { name: /create account/i }).click();
    await expect(sPage).toHaveURL(/\/app/);
    await sCtx.close();
  });

  test("2. Business Team Setup & Staff Membership Authorization", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const o = await ownerCtx.newPage();

    // Merchant Owner signs in
    await o.goto("/login?as=business");
    await o.getByLabel("Email").fill(merchantEmail);
    await o.getByLabel("Password").fill(testPassword);
    await o.getByRole("button", { name: /sign in to console/i }).click();
    await expect(o).toHaveURL(/\/biz/);

    // Navigate to Team management
    await o.goto("/biz/team");
    await expect(o.getByRole("heading", { name: /Team & permissions/i })).toBeVisible();

    // Invite the registered staff member
    await o.getByLabel(/Their account email/i).fill(staffEmail);
    await o.getByRole("button", { name: /Grant counter access/i }).click();
    await expect(o.getByText(/QA Staff Member/i)).toBeVisible();

    // Staff member signs in to merchant console
    const staffCtx = await browser.newContext();
    const s = await staffCtx.newPage();
    await s.goto("/login?as=business");
    await s.getByLabel("Email").fill(staffEmail);
    await s.getByLabel("Password").fill(testPassword);
    await s.getByRole("button", { name: /sign in to console/i }).click();

    // Staff user successfully enters console with active business
    await expect(s).toHaveURL(/\/biz/);
    await expect(s.getByText(businessName).first()).toBeVisible();

    await ownerCtx.close();
    await staffCtx.close();
  });

  test("3. Configure Loyalty Rules, Menu Product, and Reward", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const o = await ownerCtx.newPage();

    await o.goto("/login?as=business");
    await o.getByLabel("Email").fill(merchantEmail);
    await o.getByLabel("Password").fill(testPassword);
    await o.getByRole("button", { name: /sign in to console/i }).click();
    await expect(o).toHaveURL(/\/biz/);

    // A. Configure Loyalty Rules
    await o.goto("/biz/loyalty");
    await o.getByLabel(/Points per ₹100 spent/i).fill("10"); // 10%
    await o.getByLabel(/Welcome points/i).fill("50");
    await o.getByLabel(/Minimum purchase/i).fill("100");
    await o.getByLabel(/Minimum redemption/i).fill("20");
    await o.getByLabel(/Points cap per purchase/i).fill("1000");
    await o.getByRole("button", { name: /Save rules/i }).click();
    await expect(o.locator('input[name="pointsPer100"]')).toHaveValue("10");

    // B. Add Menu Item (Product)
    await o.goto("/biz/menu");
    await o.getByLabel("Name", { exact: true }).fill("Artisan Croissant");
    await o.getByLabel("Price (₹)").fill("150");
    await o.getByLabel(/Description \(optional\)/i).fill("Flaky butter croissant");
    await o.getByRole("button", { name: /Add product/i }).click();
    await expect(o.getByText(/Artisan Croissant/i).first()).toBeVisible();

    // C. Add Reward
    await o.goto("/biz/rewards");
    await o.getByLabel("Name", { exact: true }).fill("Complimentary Cappuccino");
    await o.getByLabel("Points cost", { exact: true }).fill("50");
    await o.getByLabel(/Description \(optional\)/i).fill("Hot freshly brewed coffee");
    await o.getByRole("button", { name: /Create reward/i }).click();
    await expect(o.getByText(/Complimentary Cappuccino/i).first()).toBeVisible();

    await ownerCtx.close();
  });

  test("4. Customer Joins via Business QR Page & Earns Welcome Bonus", async ({ browser }) => {
    const custCtx = await browser.newContext();
    const c = await custCtx.newPage();

    // Customer logs in
    await c.goto("/login?as=customer");
    await c.getByLabel("Email").fill(customerEmail);
    await c.getByLabel("Password").fill(testPassword);
    await c.getByRole("button", { name: /sign in/i }).click();
    await expect(c).toHaveURL(/\/app/);

    // Customer navigates to the QR Join page for this business
    await c.goto(`/join/${businessSlug}`);
    await expect(c.getByText(businessName).first()).toBeVisible();
    await expect(c.getByText(/\+50 pts/i).first()).toBeVisible();

    // Click "Join <business>"
    await c.getByRole("button", { name: new RegExp(`join ${businessName}`, "i") }).click();
    await expect(c.getByText(/You're in/i).first()).toBeVisible();

    // Customer wallet shows the 50 welcome points
    await c.goto("/app/wallet");
    await expect(c.getByText(businessName).first()).toBeVisible();
    await expect(c.getByText("50").first()).toBeVisible();

    await custCtx.close();
  });

  test("5. Staff Records Purchase & Points Awarded Accurately", async ({ browser }) => {
    const staffCtx = await browser.newContext();
    const s = await staffCtx.newPage();

    // Staff logs in
    await s.goto("/login?as=business");
    await s.getByLabel("Email").fill(staffEmail);
    await s.getByLabel("Password").fill(testPassword);
    await s.getByRole("button", { name: /sign in to console/i }).click();
    await expect(s).toHaveURL(/\/biz/);

    // Staff opens /biz/transactions
    await s.goto("/biz/transactions");
    // Select customer from dropdown
    const customerSelect = s.getByLabel("Customer");
    await customerSelect.selectOption({ label: `QA Customer Person · ${customerEmail}` });
    await s.getByLabel("Bill amount (₹)").fill("500");
    await s.getByLabel("Receipt / bill number").fill("QA-INV-1001");
    await s.getByRole("button", { name: /record sale/i }).click();

    await expect(s.getByText("QA-INV-1001").first()).toBeVisible();

    // Customer verifies updated balance and activity
    const custCtx = await browser.newContext();
    const c = await custCtx.newPage();
    await c.goto("/login?as=customer");
    await c.getByLabel("Email").fill(customerEmail);
    await c.getByLabel("Password").fill(testPassword);
    await c.getByRole("button", { name: /sign in/i }).click();

    // 50 (welcome) + 50 (10% of ₹500) = 100 points
    await c.goto("/app/wallet");
    await expect(c.getByText("100").first()).toBeVisible();

    // Activity check
    await c.goto("/app/activity");
    await expect(c.getByText("QA-INV-1001").first()).toBeVisible();
    await expect(c.getByText("+50").first()).toBeVisible();

    await staffCtx.close();
    await custCtx.close();
  });

  test("6. Customer Redeems Voucher & Balance Decreases Accurately", async ({ browser }) => {
    const custCtx = await browser.newContext();
    const c = await custCtx.newPage();

    await c.goto("/login?as=customer");
    await c.getByLabel("Email").fill(customerEmail);
    await c.getByLabel("Password").fill(testPassword);
    await c.getByRole("button", { name: /sign in/i }).click();
    await expect(c).toHaveURL(/\/app/);

    // Open rewards page for business
    await c.goto(`/app/rewards?b=${businessSlug}`);
    await expect(c.getByText("Complimentary Cappuccino").first()).toBeVisible();

    // Click Redeem (costs 50 points)
    await c.getByRole("button", { name: /redeem/i }).first().click();
    await expect(c).toHaveURL(/issued=/);

    // Extract issued token
    const url = new URL(c.url());
    voucherToken = url.searchParams.get("issued")!;
    expect(voucherToken).toMatch(/^[A-Z0-9]{8}$/);

    // Verify balance is now 100 - 50 = 50 points
    await c.goto("/app/wallet");
    await expect(c.getByText("50").first()).toBeVisible();

    // Verify active voucher shows on /app/vouchers
    await c.goto("/app/vouchers");
    await expect(c.getByText(voucherToken)).toBeVisible();

    await custCtx.close();
  });

  test("7. Counter Voucher Redemption & Fraud/Duplicate Protections", async ({ browser }) => {
    const staffCtx = await browser.newContext();
    const s = await staffCtx.newPage();

    await s.goto("/login?as=business");
    await s.getByLabel("Email").fill(staffEmail);
    await s.getByLabel("Password").fill(testPassword);
    await s.getByRole("button", { name: /sign in to console/i }).click();
    await expect(s).toHaveURL(/\/biz/);

    // A. Redeem valid voucher token
    await s.goto("/biz/redemptions");
    await s.locator('input[name="token"]').fill(voucherToken);
    await s.getByRole("button", { name: /verify & redeem/i }).click();
    await expect(s.getByText(/redeemed for QA Customer Person/i).first()).toBeVisible();

    // B. Replay Attack: Re-entering the exact same redeemed voucher must be refused
    await s.goto("/biz/redemptions");
    await s.locator('input[name="token"]').fill(voucherToken);
    await s.getByRole("button", { name: /verify & redeem/i }).click();
    await expect(s.getByText(/That reward has already been redeemed/i).first()).toBeVisible();

    // C. Invalid Voucher Code: Non-existent code must be rejected
    await s.goto("/biz/redemptions");
    await s.locator('input[name="token"]').fill("INVALID99");
    await s.getByRole("button", { name: /verify & redeem/i }).click();
    await expect(s.getByText(/That code does not belong to this business/i).first()).toBeVisible();

    // D. Cross-Tenant Protection: Urban Brew staff tries to redeem this voucher
    const danielCtx = await browser.newContext();
    const d = await danielCtx.newPage();
    await d.goto("/login?as=business");
    await d.getByLabel("Email").fill("daniel@urbanbrew.test");
    await d.getByLabel("Password").fill("Repeato!2026");
    await d.getByRole("button", { name: /sign in to console/i }).click();
    await expect(d).toHaveURL(/\/biz/);

    await d.goto("/biz/redemptions");
    await d.locator('input[name="token"]').fill(voucherToken);
    await d.getByRole("button", { name: /verify & redeem/i }).click();
    await expect(d.getByText(/That code does not belong to this business/i).first()).toBeVisible();

    await staffCtx.close();
    await danielCtx.close();
  });

  test("8. Complete Control & Navigation Audit (Desktop and Mobile Viewports)", async ({ browser }) => {
    // Desktop audit
    const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const d = await desktopCtx.newPage();
    await d.goto("/login?as=business");
    await d.getByLabel("Email").fill(merchantEmail);
    await d.getByLabel("Password").fill(testPassword);
    await d.getByRole("button", { name: /sign in to console/i }).click();
    await expect(d).toHaveURL(/\/biz/);

    const consoleTabs = [
      "/biz",
      "/biz/transactions",
      "/biz/redemptions",
      "/biz/customers",
      "/biz/menu",
      "/biz/rewards",
      "/biz/loyalty",
      "/biz/qr",
      "/biz/analytics",
      "/biz/team",
      "/biz/settings",
    ];

    for (const tab of consoleTabs) {
      await d.goto(tab);
      await expect(d).toHaveURL(new RegExp(tab));
      expect(await d.title()).toContain("Repeato");
    }

    // Mobile Viewport Audit (375x667)
    const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const m = await mobileCtx.newPage();
    await m.goto("/login?as=customer");
    await m.getByLabel("Email").fill(customerEmail);
    await m.getByLabel("Password").fill(testPassword);
    await m.getByRole("button", { name: /sign in/i }).click();
    await expect(m).toHaveURL(/\/app/);

    const customerTabs = ["/app", "/app/wallet", "/app/activity", "/app/vouchers", "/app/profile"];
    for (const tab of customerTabs) {
      await m.goto(tab);
      await expect(m).toHaveURL(new RegExp(tab));
    }

    await desktopCtx.close();
    await mobileCtx.close();
  });
});
