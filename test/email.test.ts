import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appUrl,
  buildPasswordResetEmail,
  buildPointsUpdateEmail,
  buildRewardUnlockedEmail,
  buildVerificationEmail,
  emailConfigured,
  escapeHtml,
  renderEmailLayout,
  sendMail,
} from "../lib/email";

describe("email utilities", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("escapeHtml", () => {
    it("escapes sensitive HTML characters", () => {
      expect(escapeHtml("<script>alert('xss & \"danger\"')</script>")).toBe(
        "&lt;script&gt;alert(&#039;xss &amp; &quot;danger&quot;&#039;)&lt;/script&gt;",
      );
    });

    it("returns plain strings untouched", () => {
      expect(escapeHtml("Hello world 123")).toBe("Hello world 123");
    });
  });

  describe("renderEmailLayout", () => {
    it("renders email structure with title, heading, and body HTML", () => {
      const html = renderEmailLayout({
        title: "Test Title",
        heading: "Welcome to Repeato",
        bodyHtml: "<p>Thank you for joining.</p>",
      });

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<title>Test Title</title>");
      expect(html).toContain("Welcome to Repeato");
      expect(html).toContain("<p>Thank you for joining.</p>");
      expect(html).toContain("Repeato Loyalty SaaS");
    });

    it("renders call-to-action button when buttonText and buttonUrl are supplied", () => {
      const html = renderEmailLayout({
        title: "Confirm Email",
        heading: "Please Confirm",
        bodyHtml: "<p>Click the button below.</p>",
        buttonText: "Verify Account",
        buttonUrl: "https://repeato.app/verify?token=abc",
      });

      expect(html).toContain("Verify Account");
      expect(html).toContain("href=\"https://repeato.app/verify?token=abc\"");
    });

    it("includes optional footer text when specified", () => {
      const html = renderEmailLayout({
        title: "Notice",
        heading: "Important update",
        bodyHtml: "<p>Details here.</p>",
        footerText: "If you did not request this, please contact support.",
      });

      expect(html).toContain("If you did not request this, please contact support.");
    });
  });

  describe("template builders", () => {
    describe("buildVerificationEmail", () => {
      it("creates verification email with link and personalized greeting", () => {
        const mail = buildVerificationEmail({
          to: "user@example.com",
          name: "Alice Smith",
          token: "verify_token_12345",
          appBaseUrl: "https://myloyalty.test",
        });

        expect(mail.to).toBe("user@example.com");
        expect(mail.subject).toBe("Confirm your Repeato email");
        expect(mail.text).toContain("Hi Alice Smith,");
        expect(mail.text).toContain("https://myloyalty.test/verify?token=verify_token_12345");
        expect(mail.html).toContain("Hi Alice Smith,");
        expect(mail.html).toContain("https://myloyalty.test/verify?token=verify_token_12345");
        expect(mail.html).toContain("Confirm Email Address");
      });
    });

    describe("buildPasswordResetEmail", () => {
      it("creates password reset email with token link and security notice", () => {
        const mail = buildPasswordResetEmail({
          to: "user@example.com",
          name: "Bob Jones",
          token: "reset_token_67890",
          appBaseUrl: "https://myloyalty.test",
        });

        expect(mail.to).toBe("user@example.com");
        expect(mail.subject).toBe("Reset your Repeato password");
        expect(mail.text).toContain("Hi Bob Jones,");
        expect(mail.text).toContain("https://myloyalty.test/reset?token=reset_token_67890");
        expect(mail.text).toContain("expires in 60 minutes");
        expect(mail.html).toContain("Reset Password");
        expect(mail.html).toContain("https://myloyalty.test/reset?token=reset_token_67890");
      });
    });

    describe("buildRewardUnlockedEmail", () => {
      it("creates reward notification with voucher code", () => {
        const mail = buildRewardUnlockedEmail({
          to: "customer@example.com",
          customerName: "Charlie",
          businessName: "Artisan Cafe",
          rewardTitle: "Free Cappuccino",
          voucherCode: "CAPPU123",
          appBaseUrl: "https://myloyalty.test",
        });

        expect(mail.subject).toBe("You unlocked a reward at Artisan Cafe!");
        expect(mail.text).toContain("Free Cappuccino");
        expect(mail.text).toContain("CAPPU123");
        expect(mail.html).toContain("CAPPU123");
        expect(mail.html).toContain("Artisan Cafe");
        expect(mail.html).toContain("Free Cappuccino");
      });

      it("handles reward email without specific voucher code", () => {
        const mail = buildRewardUnlockedEmail({
          to: "customer@example.com",
          customerName: "Charlie",
          businessName: "Artisan Cafe",
          rewardTitle: "10% Discount",
        });

        expect(mail.text).not.toContain("Your voucher code is:");
        expect(mail.html).toContain("10% Discount");
      });
    });

    describe("buildPointsUpdateEmail", () => {
      it("creates balance update email formatting positive points delta", () => {
        const mail = buildPointsUpdateEmail({
          to: "customer@example.com",
          customerName: "Dana",
          businessName: "Roast & Toast",
          delta: 50,
          newBalance: 250,
          appBaseUrl: "https://myloyalty.test",
        });

        expect(mail.subject).toBe("Points update: +50 points at Roast & Toast");
        expect(mail.text).toContain("earned +50 points at Roast & Toast");
        expect(mail.text).toContain("balance is now 250 points");
        expect(mail.html).toContain("+50 points");
        expect(mail.html).toContain("250 pts");
      });

      it("handles negative points delta appropriately", () => {
        const mail = buildPointsUpdateEmail({
          to: "customer@example.com",
          customerName: "Dana",
          businessName: "Roast & Toast",
          delta: -100,
          newBalance: 150,
        });

        expect(mail.subject).toBe("Points update: -100 points at Roast & Toast");
        expect(mail.text).toContain("earned -100 points");
      });
    });
  });

  describe("sendMail & configuration", () => {
    it("reports emailConfigured based on environment variables", () => {
      expect(emailConfigured()).toBe(false);

      process.env.RESEND_API_KEY = "test_key";
      expect(emailConfigured()).toBe(false);

      process.env.MAIL_FROM = "Repeato <noreply@repeato.app>";
      expect(emailConfigured()).toBe(true);
    });

    it("logs message to console and marks delivered false in dev mode without API key", async () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const result = await sendMail({
        to: "recipient@example.com",
        subject: "Hello Dev",
        text: "This is a test message.",
      });

      expect(result).toEqual({ delivered: false });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[email:dev] to=recipient@example.com subject=Hello Dev"),
      );
    });

    it("sends request to Resend API when credentials are present", async () => {
      process.env.RESEND_API_KEY = "re_mock_api_key_123";
      process.env.MAIL_FROM = "Repeato <hello@repeato.app>";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await sendMail({
        to: "client@example.com",
        subject: "Welcome",
        text: "Welcome text",
        html: "<p>Welcome HTML</p>",
      });

      expect(result).toEqual({ delivered: true });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.resend.com/emails");
      expect(options.method).toBe("POST");
      expect(options.headers).toEqual({
        Authorization: "Bearer re_mock_api_key_123",
        "Content-Type": "application/json",
      });

      const body = JSON.parse(options.body);
      expect(body).toEqual({
        from: "Repeato <hello@repeato.app>",
        to: ["client@example.com"],
        subject: "Welcome",
        text: "Welcome text",
        html: "<p>Welcome HTML</p>",
      });
    });

    it("throws a descriptive error when Resend API returns non-200 status", async () => {
      process.env.RESEND_API_KEY = "re_mock_api_key_123";
      process.env.MAIL_FROM = "Repeato <hello@repeato.app>";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: "Invalid API Key" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        sendMail({
          to: "client@example.com",
          subject: "Test",
          text: "Test content",
        }),
      ).rejects.toThrow("email provider rejected the message (403)");
    });
  });
});
