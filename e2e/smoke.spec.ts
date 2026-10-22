import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Repeato!2026";

const MARKETING_ROUTES = [
  "/",
  "/features",
  "/how-it-works",
  "/for-businesses",
  "/pricing",
  "/about",
  "/contact",
  "/login",
  "/signup",
  "/privacy",
  "/terms",
];

test("every marketing route renders", async ({ request }) => {
  for (const route of MARKETING_ROUTES) {
    const res = await request.get(route);
    expect(res.status(), route).toBe(200);
    expect((await res.text()).length, route).toBeGreaterThan(2000);
  }
});

test("protected areas redirect signed-out visitors to login", async ({ request }) => {
  for (const route of ["/biz", "/admin", "/app", "/biz/transactions"]) {
    const res = await request.get(route, { maxRedirects: 0 });
    expect([302, 307], route).toContain(res.status());
    expect(res.headers()["location"], route).toContain("/login?next=");
  }
});

test("QR join, staff-verified sale, one-time voucher", async ({ browser }) => {
  const email = `e2e.${Date.now()}@example.test`;
  const name = "E2E Tester";

  const customer = await browser.newContext();
  const c = await customer.newPage();

  // Scan the business QR landing page signed out, then create an account without losing context.
  await c.goto("/join/bluebird-coffee");
  await expect(c.getByText(/Scanned/i).first()).toBeVisible();
  await c.getByRole("button", { name: /create an account and join/i }).click();
  await expect(c).toHaveURL(/\/signup\?next=%2Fjoin%2Fbluebird-coffee/);
  await c.getByLabel("Your name").fill(name);
  await c.getByLabel("Email").fill(email);
  await c.getByLabel("Password", { exact: true }).fill("E2eTester!2026");
  await c.getByLabel("Confirm password").fill("E2eTester!2026");
  await c.getByRole("button", { name: /create account/i }).click();

  await expect(c).toHaveURL(/\/join\/bluebird-coffee/);
  await c.getByRole("button", { name: /join bluebird coffee/i }).click();
  await expect(c.getByText(/20|welcome/i).first()).toBeVisible();

  // Owner records a real, staff-verified purchase for that customer.
  const owner = await browser.newContext();
  const o = await owner.newPage();
  await o.goto("/login");
  await o.getByLabel("Email").fill("priya@bluebird.test");
  await o.getByLabel("Password").fill(DEMO_PASSWORD);
  await o.getByRole("button", { name: /sign in/i }).click();
  await expect(o).toHaveURL(/\/biz/);

  await o.goto("/biz/transactions");
  await o.getByLabel("Customer").selectOption({ label: `${name} · ${email}` });
  await o.getByLabel("Bill amount (₹)").fill("1500");
  await o.getByLabel("Receipt / bill number").fill("E2E-1");
  await o.getByRole("button", { name: /record sale/i }).click();
  await expect(o.getByText(/E2E-1/).first()).toBeVisible();

  // Customer sees server-calculated points.
  await c.goto("/app/wallet");
  await expect(c.getByText(/170/).first()).toBeVisible();

  // Redeem: the issued token comes back on the URL, then works exactly once.
  await c.goto("/app/rewards?b=bluebird-coffee");
  await c.getByRole("button", { name: /redeem/i }).first().click();
  await expect(c).toHaveURL(/issued=/);
  const token = new URL(c.url()).searchParams.get("issued")!;
  expect(token).toMatch(/^[A-Z0-9]{8}$/);
  await expect(c.getByText(token)).toBeVisible();

  await o.goto("/biz/redemptions");
  await o.locator('input[name="token"]').fill(token);
  await o.getByRole("button", { name: /accept|verify|redeem/i }).click();
  await expect(o.getByText(/accepted|verified|redeemed/i).first()).toBeVisible();

  // Replaying the same voucher must be refused.
  await o.goto("/biz/redemptions");
  await o.locator('input[name="token"]').fill(token);
  await o.getByRole("button", { name: /accept|verify|redeem/i }).click();
  await expect(o.getByText(/already/i).first()).toBeVisible();

  await customer.close();
  await owner.close();
});

test("a business never sees another tenant's data", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill("daniel@urbanbrew.test");
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/biz/);

  await page.goto("/biz/menu");
  await expect(page.getByText(/Poha bowl/)).toBeVisible();
  await expect(page.getByText(/Filter coffee/)).toHaveCount(0);

  const crossTenantQr = await page.request.get("/api/qr/bluebird-coffee");
  expect(crossTenantQr.status()).not.toBe(200);

  await ctx.close();
});
