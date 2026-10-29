import { randomBytes } from "node:crypto";

export type AuditStatus = "success" | "failure";

export type KnownAuditAction =
  | "auth.signup"
  | "auth.login"
  | "auth.failed_login"
  | "auth.logout"
  | "auth.password_reset_request"
  | "auth.password_reset"
  | "auth.email_verified"
  | "ledger.credit"
  | "ledger.debit"
  | "ledger.reversal"
  | "reward.create"
  | "reward.redeem"
  | "reward.verify"
  | "business.create"
  | "business.settings_update"
  | "team.member_added"
  | "team.member_removed"
  | "admin.user_suspended"
  | "admin.user_unsuspended";

export interface AuditRecord {
  id: string;
  timestamp: string;
  actorId: number | null;
  businessId?: number | null;
  action: string;
  entity: string;
  entityId: string | null;
  status: AuditStatus;
  ipAddress?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown> | null;
}

const SENSITIVE_KEY_PATTERN = /(?:password|token|secret|auth|key|cookie|card|cvv|hash|pin|bearer|credential|session_id)/i;

/** Recursively redacts sensitive keys (passwords, tokens, cookies, secrets) from metadata objects. */
export function redactMetadata(data: unknown): unknown {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map(redactMetadata);
  }

  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        result[key] = redactMetadata(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return data;
}

/** Masks email addresses for privacy preservation in audit trails (e.g. j***n@example.com). */
export function maskEmail(emailAddress: unknown): string {
  if (typeof emailAddress !== "string") return "";
  const trimmed = emailAddress.trim().toLowerCase();
  const parts = trimmed.split("@");
  if (parts.length !== 2) return "[INVALID_EMAIL]";
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0] ?? "*"}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/** Masks phone numbers for audit privacy, leaving only last 4 digits visible. */
export function maskPhone(phoneNumber: unknown): string {
  if (typeof phoneNumber !== "string") return "";
  const digits = phoneNumber.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length < 4) return "****";
  const visible = digits.slice(-4);
  return `${"*".repeat(digits.length - 4)}${visible}`;
}

/** Generates a cryptographically random, collision-resistant audit event ID. */
export function generateAuditId(): string {
  return `aud_${randomBytes(12).toString("hex")}`;
}

export interface BuildAuditParams {
  actorId: number | null;
  action: KnownAuditAction | string;
  entity: string;
  entityId: string | number | null;
  businessId?: number | null;
  status?: AuditStatus;
  ipAddress?: string | null;
  userAgent?: string | null;
  meta?: unknown;
  timestamp?: string;
  id?: string;
}

/** Builds and validates a structured audit record with automated redaction of sensitive parameters. */
export function buildAuditRecord(params: BuildAuditParams): AuditRecord {
  const sanitizedMeta = params.meta ? (redactMetadata(params.meta) as Record<string, unknown>) : null;

  return {
    id: params.id ?? generateAuditId(),
    timestamp: params.timestamp ?? new Date().toISOString(),
    actorId: params.actorId,
    businessId: params.businessId ?? null,
    action: params.action.trim(),
    entity: params.entity.trim(),
    entityId: params.entityId === null || params.entityId === undefined ? null : String(params.entityId),
    status: params.status ?? "success",
    ipAddress: params.ipAddress ? params.ipAddress.slice(0, 45) : null,
    userAgent: params.userAgent ? params.userAgent.slice(0, 255) : null,
    meta: sanitizedMeta,
  };
}

/** Formats an audit record as a single-line JSON log entry for ingestion by log collectors and SIEMs. */
export function formatAuditLog(record: AuditRecord): string {
  return JSON.stringify({
    level: "audit",
    audit_id: record.id,
    timestamp: record.timestamp,
    actor_id: record.actorId,
    business_id: record.businessId,
    action: record.action,
    entity: record.entity,
    entity_id: record.entityId,
    status: record.status,
    ip: record.ipAddress,
    ua: record.userAgent,
    meta: record.meta,
  });
}
