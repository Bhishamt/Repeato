import { describe, expect, it } from "vitest";
import {
  buildAuditRecord,
  formatAuditLog,
  generateAuditId,
  maskEmail,
  maskPhone,
  redactMetadata,
} from "../lib/audit";

describe("audit logging helper", () => {
  describe("redactMetadata", () => {
    it("redacts sensitive fields in shallow objects", () => {
      const input = {
        userId: 123,
        role: "owner",
        password: "SuperSecretPassword123!",
        token: "bearer_token_abc_xyz",
        session_hash: "hash_value_to_hide",
        clientIp: "127.0.0.1",
      };

      const redacted = redactMetadata(input) as Record<string, unknown>;

      expect(redacted.userId).toBe(123);
      expect(redacted.role).toBe("owner");
      expect(redacted.clientIp).toBe("127.0.0.1");
      expect(redacted.password).toBe("[REDACTED]");
      expect(redacted.token).toBe("[REDACTED]");
      expect(redacted.session_hash).toBe("[REDACTED]");
    });

    it("recursively redacts nested objects and arrays", () => {
      const input = {
        action: "login",
        details: {
          authHeader: "Bearer eyJhbGciOi...",
          nested: {
            apiKey: "sk_live_secret12345",
            safeValue: 42,
          },
        },
        items: [
          { card_cvv: "123", amount: 1500 },
          { pin: "9876", allowed: true },
        ],
      };

      const redacted = redactMetadata(input) as any;

      expect(redacted.details.authHeader).toBe("[REDACTED]");
      expect(redacted.details.nested.apiKey).toBe("[REDACTED]");
      expect(redacted.details.nested.safeValue).toBe(42);
      expect(redacted.items[0].card_cvv).toBe("[REDACTED]");
      expect(redacted.items[0].amount).toBe(1500);
      expect(redacted.items[1].pin).toBe("[REDACTED]");
      expect(redacted.items[1].allowed).toBe(true);
    });

    it("handles primitives, null, and undefined safely", () => {
      expect(redactMetadata(null)).toBeNull();
      expect(redactMetadata(undefined)).toBeUndefined();
      expect(redactMetadata("simple string")).toBe("simple string");
      expect(redactMetadata(42)).toBe(42);
    });
  });

  describe("maskEmail", () => {
    it("masks local part of valid email addresses", () => {
      expect(maskEmail("john.doe@example.com")).toBe("j***e@example.com");
      expect(maskEmail("alice@company.org")).toBe("a***e@company.org");
    });

    it("handles short usernames gracefully", () => {
      expect(maskEmail("ab@domain.com")).toBe("a***@domain.com");
      expect(maskEmail("a@domain.com")).toBe("a***@domain.com");
    });

    it("handles invalid or non-string inputs", () => {
      expect(maskEmail("not-an-email")).toBe("[INVALID_EMAIL]");
      expect(maskEmail(null)).toBe("");
      expect(maskEmail(123)).toBe("");
    });
  });

  describe("maskPhone", () => {
    it("masks phone numbers keeping only the last 4 digits visible", () => {
      expect(maskPhone("+1 (555) 234-5678")).toBe("*******5678");
      expect(maskPhone("9876543210")).toBe("******3210");
    });

    it("returns asterisks for short or non-standard numbers", () => {
      expect(maskPhone("123")).toBe("****");
      expect(maskPhone("")).toBe("");
      expect(maskPhone(null)).toBe("");
    });
  });

  describe("generateAuditId", () => {
    it("generates collision-resistant identifiers with aud_ prefix", () => {
      const id1 = generateAuditId();
      const id2 = generateAuditId();

      expect(id1).toMatch(/^aud_[0-9a-f]{24}$/);
      expect(id2).toMatch(/^aud_[0-9a-f]{24}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("buildAuditRecord", () => {
    it("builds a validated record with default fields and automated redaction", () => {
      const record = buildAuditRecord({
        actorId: 42,
        businessId: 10,
        action: "auth.login",
        entity: "user",
        entityId: 42,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        meta: {
          loginProvider: "credentials",
          userPassword: "PlainPasswordHere",
        },
      });

      expect(record.id).toMatch(/^aud_/);
      expect(record.actorId).toBe(42);
      expect(record.businessId).toBe(10);
      expect(record.action).toBe("auth.login");
      expect(record.entity).toBe("user");
      expect(record.entityId).toBe("42");
      expect(record.status).toBe("success");
      expect(record.ipAddress).toBe("192.168.1.1");
      expect(record.userAgent).toBe("Mozilla/5.0");
      expect(record.meta?.loginProvider).toBe("credentials");
      expect(record.meta?.userPassword).toBe("[REDACTED]");
      expect(new Date(record.timestamp).getTime()).not.toBeNaN();
    });

    it("handles null entityId, failure status, and string entityId", () => {
      const record = buildAuditRecord({
        actorId: null,
        action: "auth.failed_login",
        entity: "session",
        entityId: null,
        status: "failure",
        meta: { reason: "invalid_credentials" },
      });

      expect(record.actorId).toBeNull();
      expect(record.entityId).toBeNull();
      expect(record.status).toBe("failure");
      expect(record.businessId).toBeNull();
    });
  });

  describe("formatAuditLog", () => {
    it("produces a valid single-line JSON log entry matching SIEM requirements", () => {
      const record = buildAuditRecord({
        actorId: 7,
        action: "ledger.credit",
        entity: "ledger",
        entityId: 105,
        meta: { delta: 100, reason: "Purchase reward" },
      });

      const logLine = formatAuditLog(record);

      expect(() => JSON.parse(logLine)).not.toThrow();
      const parsed = JSON.parse(logLine);
      expect(parsed.level).toBe("audit");
      expect(parsed.audit_id).toBe(record.id);
      expect(parsed.action).toBe("ledger.credit");
      expect(parsed.actor_id).toBe(7);
      expect(parsed.meta).toEqual({ delta: 100, reason: "Purchase reward" });
    });
  });
});
