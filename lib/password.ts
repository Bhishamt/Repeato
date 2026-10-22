import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/* scrypt is deliberately isolated from auth.ts so scripts and tests can hash
 * passwords without importing request-scoped Next APIs. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64).toString("hex");
  return `s1$${salt}$${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [version, salt, hash] = stored.split("$");
  if (version !== "s1" || !salt || !hash) return false;
  const candidate = scryptSync(plain, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
