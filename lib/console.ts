import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { activeMembership, membershipsFor, requireBusinessUser, type BusinessMembership, type SessionUser } from "./auth";
import { getDb } from "./db";
import { getBusiness, type BusinessRow } from "./services";

export const BUSINESS_COOKIE = "rp_biz";

export type ConsoleContext = {
  user: SessionUser;
  memberships: BusinessMembership[];
  active: BusinessMembership;
  role: "owner" | "staff";
  business: BusinessRow;
};

/**
 * Resolves the business a console page is acting on. Membership is the only
 * source of truth: the cookie merely remembers a choice the user already has.
 */
export async function consoleContext(): Promise<ConsoleContext> {
  const user = await requireBusinessUser("/biz");
  const memberships = membershipsFor(user.id);
  if (memberships.length === 0) redirect("/onboarding");

  const requested = Number((await cookies()).get(BUSINESS_COOKIE)?.value);
  const active = activeMembership(user.id, Number.isInteger(requested) ? requested : undefined) ?? memberships[0];
  const business = getBusiness(getDb(), active.businessId);
  if (!business) redirect("/biz/onboarding");

  return { user, memberships, active, role: active.role, business };
}
