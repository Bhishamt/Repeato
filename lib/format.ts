export function money(paise: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
    }).format(paise / 100);
  } catch {
    return `${(paise / 100).toFixed(2)} ${currency}`;
  }
}

export function points(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

/** Adds a query parameter without producing "?a=1?b=2" when the path already has one. */
export function withQuery(path: string, key: string, value: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // SQLite stores "2026-09-26 23:02:29", Postgres hands back ISO strings already.
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateShort(value: string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(value: string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function relative(value: string): string {
  const d = toDate(value);
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return dateShort(value);
}

/** Formats phone number into readable grouped digits (e.g., +91 98765 43210 or 98765 43210). */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return raw;
}

/** Truncates text with an ellipsis if it exceeds maxLength. */
export function truncate(str: string | null | undefined, maxLength: number, suffix = "..."): string {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, Math.max(0, maxLength - suffix.length)) + suffix;
}

/** Formats a percentage value (e.g. 5% or 12.5%). */
export function percent(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Number(value.toFixed(decimals))}%`;
}

/** Formats byte sizes into human-readable strings (e.g. 1.2 KB, 4.5 MB). */
export function fileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, i);
  return `${size >= 10 || i === 0 ? Math.round(size) : size.toFixed(1)} ${units[i]}`;
}

