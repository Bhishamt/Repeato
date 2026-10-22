import Link from "next/link";
import { Bell } from "lucide-react";
import { Wordmark } from "@/components/ui";
import { CustomerBottomBar, CustomerTabs } from "@/components/customer-nav";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { signOut } from "@/app/actions/auth";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/app");
  const unread = (
    getDb().prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL").get(user.id) as { n: number }
  ).n;

  return (
    <div className="min-h-dvh bg-paper pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="wrap flex h-16 items-center justify-between gap-4">
          <Wordmark href="/app" />
          <CustomerTabs />
          <div className="flex items-center gap-1">
            <Link
              href="/app/notifications"
              className="relative grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-paper-deep"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            >
              <Bell size={17} aria-hidden />
              {unread > 0 ? (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-copper px-1 text-[0.6rem] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <form action={signOut}>
              <button className="rounded-full px-2.5 py-1.5 text-[0.78rem] text-muted hover:text-ink" type="submit">Sign out</button>
            </form>
          </div>
        </div>
        <div className="wrap hidden border-t border-line py-2 md:block">
          <div className="flex items-center justify-between text-[0.78rem] text-muted">
            <span>{user.name} · {user.email}</span>
            <Link href="/app/businesses" className="hover:text-ink">Find a café to join</Link>
          </div>
        </div>
      </header>
      <main id="main" className="wrap py-6 md:py-9">{children}</main>
      <CustomerBottomBar />
    </div>
  );
}
