import { Wordmark } from "@/components/ui";
import { NavLink } from "@/components/nav-link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";

const LINKS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/businesses", label: "Businesses" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin("/admin");

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-ink text-paper">
        <div className="wrap flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Wordmark href="/admin" tone="paper" />
            <span className="pill pill-warn">Platform admin</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[0.78rem] opacity-70 sm:inline">{admin.email}</span>
            <form action={signOut}>
              <button type="submit" className="rounded-full px-2.5 py-1.5 text-[0.78rem] opacity-80 hover:opacity-100">Sign out</button>
            </form>
          </div>
        </div>
        <div className="wrap">
          <nav className="scroll-x flex gap-1 pb-2" aria-label="Administration">
            {LINKS.map(({ href, label, exact }) => (
              <NavLink
                key={href}
                href={href}
                exact={exact}
                className="rounded-full px-3 py-1.5 text-[0.82rem] font-medium text-paper/70 hover:text-paper aria-[current=page]:bg-paper aria-[current=page]:text-ink"
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" className="wrap py-6">{children}</main>
    </div>
  );
}
