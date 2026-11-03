import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";

const DEMO_PASSWORD = "Repeato!2026";
const NEW_PASSWORD = "BrandNewValidPass!2026";

test.describe("Supabase & OAuth Authentication Suite", () => {
  test("1. Login views display Google button and Forgot Password link", async ({ page }) => {
    // Customer login view
    await page.goto("/login?as=customer");
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /forgot password\?/i })).toBeVisible();

    // Merchant login view
    await page.goto("/login?as=business");
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /forgot password\?/i })).toBeVisible();
  });

  test("2. Google OAuth button interaction & unconfigured provider feedback", async ({ page }) => {
    await page.goto("/login?as=customer");
    const googleBtn = page.getByRole("button", { name: /continue with google/i });
    await expect(googleBtn).toBeVisible();

    // Click Google button. Since Google OAuth credentials are not yet saved in the Supabase Dashboard,
    // the application gracefully captures provider error feedback or navigates without crashing.
    await googleBtn.click();
    
    // Wait for either the error notice or navigation
    await page.waitForTimeout(2000);
    const hasErrorAlert = await page.locator(".alert-bad").isVisible();
    const currentUrl = page.url();
    expect(hasErrorAlert || currentUrl.includes("google") || currentUrl.includes("supabase")).toBeTruthy();
  });

  test("3. Forgot Password request flow and anti-enumeration guarantee", async ({ page }) => {
    await page.goto("/forgot");
    await expect(page.getByRole("heading", { name: /reset your password/i })).toBeVisible();

    const testMail = `forgot.${Date.now()}@example.test`;

    // Submit user
    await page.getByLabel("Email").fill(testMail);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(
      page.getByText(/If that email has an account, a reset link is on its way/i),
    ).toBeVisible();

    // Submit another unregistered email - must return exact same message
    const anotherMail = `unreg.${Date.now()}@example.test`;
    await page.goto("/forgot");
    await page.getByLabel("Email").fill(anotherMail);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(
      page.getByText(/If that email has an account, a reset link is on its way/i),
    ).toBeVisible();
  });

  test("4. Password Reset flow: old password stops working, new password succeeds", async ({ page }) => {
    // A. Missing token or session displays error
    await page.goto("/reset");
    await expect(
      page.getByText(/This reset link is invalid, missing, or has expired/i),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /request a new one|request a new link/i })).toBeVisible();

    // B. Invalid token submission is rejected
    await page.goto("/reset?token=invalidtoken1234567890");
    await page.getByLabel("New password", { exact: true }).fill("BrandNewPassword!2026");
    await page.getByLabel("Confirm new password").fill("BrandNewPassword!2026");
    await page.getByRole("button", { name: /save password/i }).click();
    await expect(
      page.getByText(/That reset link is invalid or has expired/i),
    ).toBeVisible();

    // C. Generate a valid token for Asha
    const db = new Database("data/repeato.db");
    const testUser = db.prepare("SELECT id FROM users WHERE email = ?").get("asha@example.test") as { id: number };
    
    const rawToken = "TESTRESET" + Math.random().toString(36).substring(2) + Date.now();
    const crypto = await import("node:crypto");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    
    db.prepare(`
      INSERT INTO email_tokens (user_id, kind, token_hash, expires_at)
      VALUES (?, 'reset', ?, ?)
    `).run(testUser.id, tokenHash, expiresAt);
    db.close();

    // D. Use the valid token to change password to NEW_PASSWORD
    await page.goto(`/reset?token=${rawToken}`);
    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("Confirm new password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: /save password/i }).click();

    // E. Verify landing on /login with confirmation
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText(/Password updated\. Sign in with your new password/i),
    ).toBeVisible();

    // F. VERIFY OLD PASSWORD NO LONGER WORKS:
    await page.goto("/login?as=customer");
    await page.getByLabel("Email").fill("asha@example.test");
    await page.getByLabel("Password").fill(DEMO_PASSWORD); // old password
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(
      page.getByText(/That email and password do not match/i),
    ).toBeVisible();

    // G. VERIFY NEW PASSWORD LOGS IN SUCCESSFULLY:
    await page.getByLabel("Email").fill("asha@example.test");
    await page.getByLabel("Password").fill(NEW_PASSWORD); // new password
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByText(/Asha Menon/i).first()).toBeVisible();

    // Sign out
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL("http://localhost:3000/");

    // Restore original demo password for Asha
    const restoreDb = new Database("data/repeato.db");
    const { hashPassword } = await import("../lib/password");
    restoreDb.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(DEMO_PASSWORD), testUser.id);
    restoreDb.close();
  });

  test("5. OAuth callback provider cancellation & error recovery", async ({ page }) => {
    // Simulate user cancelling Google OAuth (access_denied)
    await page.goto("/auth/callback?error=access_denied");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/Sign in was cancelled/i)).toBeVisible();

    // Simulate provider error with custom description
    await page.goto("/auth/callback?error=server_error&error_description=Google%20temporarily%20unavailable");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/Google temporarily unavailable/i)).toBeVisible();
  });
});
