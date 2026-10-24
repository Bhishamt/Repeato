/** Input normalisation shared by server actions. All trust boundaries pass through here. */

export function toPaise(input: unknown): number | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const raw = String(input).replace(/[,\s₹]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) return null;
  const value = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 10_000_000) return null;
  return value;
}

export function text(input: unknown, min: number, max: number): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim().replace(/\s+/g, " ");
  return value.length >= min && value.length <= max ? value : null;
}

export function optionalText(input: unknown, max: number): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim().slice(0, max);
  return value.length ? value : null;
}

export function email(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(value) && value.length <= 254 ? value : null;
}

export function phone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.replace(/[^\d]/g, "");
  return value.length >= 7 && value.length <= 15 ? value : null;
}

export function password(input: unknown): string | null {
  if (typeof input !== "string") return null;
  return input.length >= 8 && input.length <= 200 ? input : null;
}

export function positiveInt(input: unknown, max = 1_000_000): number | null {
  const n = Number(input);
  return Number.isInteger(n) && n > 0 && n <= max ? n : null;
}

/** Only same-site relative paths are accepted as post-login destinations. */
export function safeNext(input: unknown): string | null {
  if (typeof input !== "string") return null;
  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return null;
  return input.slice(0, 200);
}

/** URL slug for businesses, categories, and promotions. */
export function slug(input: unknown, min = 3, max = 60): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toLowerCase();
  if (value.length < min || value.length > max) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return null;
  return value;
}

/** 8-character uppercase alphanumeric redemption token. */
export function voucherCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toUpperCase();
  return /^[A-Z0-9]{8}$/.test(value) ? value : null;
}

/** Valid percentage value between min and max (inclusive). */
export function percentage(input: unknown, min = 0, max = 100): number | null {
  const n = Number(input);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n * 100) / 100;
}

/** 3-letter ISO 4217 currency code. */
export function currencyCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(value) ? value : null;
}

/** Sanitises a filename for safe download/export, preventing path traversal. */
export function sanitizeFilename(input: unknown, fallback = "export"): string {
  if (typeof input !== "string") return fallback;
  const cleaned = input
    .trim()
    .replace(/[\\/:\*\?"<>\|\x00-\x1f]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 100) : fallback;
}

