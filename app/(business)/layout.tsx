import Link from "next/link";
import {
  BarChart3,
  Coffee,
  Gift,
  LayoutDashboard,
  QrCode,
  Receipt,
  Settings,
  Sparkles,
  Ticket,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { Wordmark } from "@/components/ui";
import { NavLink } from "@/components/nav-link";
import { consoleContext } from "@/lib/console";
import { signOut } from "@/app/actions/auth";
import { switchBusiness } from "@/app/actions/business";

const LINKS = [
  { href: "/biz", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/biz/transactions", label: "Transactions", icon: Receipt },
  { href: "/biz/redemptions", label: "Redemptions", icon: Ticket },
  { href: "/biz/customers", label: "Customers", icon: Users },
  { href: "/biz/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/biz/rewards", label: "Rewards", icon: Gift },
  { href: "/biz/loyalty", label: "Loyalty rules", icon: Sparkles },
  { href: "/biz/qr", label: "QR code", icon: QrCode },
  { href: "/biz/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/biz/team", label: "Team", icon: Users },
  { href: "/biz/settings", label: "Settings", icon: Settings },
];

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const { user, memberships, active, role, business } = await consoleContext();

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-white">
        <div className="wrap flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Wordmark href="/biz" />
            <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
            <div className="hidden sm:block">
              <p className="text-[0.82rem] font-semibold leading-tight">{business.name}</p>
              <p className="mono text-[0.58rem]">{role} console</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {memberships.length > 1 ? (
              <form action={switchBusiness} className="hidden md:block">
                <label htmlFor="switch" className="sr-only">Switch business</label>
                <select
                  id="switch"
                  name="businessId"
                  defaultValue={active.businessId}
                  className="select h-9 w-auto py-1 text-[0.8rem]"
                >
                  {memberships.map((m) => (
                    <option key={m.businessId} value={m.businessId}>{m.businessName}</option>
                  ))}
                </select>
                <button className="btn btn-ghost btn-sm ml-1" type="submit">Switch</button>
              </form>
            ) : null}
            <Link href="/app" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              <Coffee size={13} aria-hidden /> My wallet
            </Link>
            <form action={signOut}>
              <button type="submit" className="rounded-full px-2.5 py-1.5 text-[0.78rem] text-muted hover:text-ink">Sign out</button>
            </form>
          </div>
        </div>

        <div className="scroll-x border-t border-line md:hidden">
          <nav className="flex gap-1 px-3 py-2" aria-label="Business sections">
            {LINKS.map(({ href, label, exact }) => (
              <NavLink key={href} href={href} exact={exact} className="rounded-full px-3 py-1.5 text-[0.78rem] font-medium text-ink-soft aria-[current=page]:bg-ink aria-[current=page]:text-paper">
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <div className="wrap flex gap-6 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-6 space-y-0.5" aria-label="Business console">
            {LINKS.map(({ href, label, icon: Icon, exact }) => (
              <NavLink key={href} href={href} exact={exact} className="sidebar-link">
                <Icon aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-6 rounded-xl border border-line bg-white p-3.5">
            <p className="text-[0.78rem] font-semibold">{user.name}</p>
            <p className="mt-0.5 break-all text-[0.72rem] text-muted">{user.email}</p>
            <p className="mt-2 text-[0.72rem] text-muted">
              {role === "owner" ? "You can manage every setting." : "You can record sales and check vouchers."}
            </p>
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
