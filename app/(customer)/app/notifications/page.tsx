import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Alert, Empty } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { markNotificationsRead } from "@/app/actions/customer";
import { relative } from "@/lib/format";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const user = await requireUser("/app/notifications");
  const query = await searchParams;
  const rows = getDb()
    .prepare(
      `SELECT n.id, n.title, n.body, n.read_at AS readAt, n.created_at AS createdAt, b.name AS businessName, b.slug AS businessSlug
         FROM notifications n LEFT JOIN businesses b ON b.id = n.business_id
        WHERE n.user_id = ? ORDER BY n.id DESC LIMIT 100`,
    )
    .all(user.id) as Array<{
    id: number; title: string; body: string | null; readAt: string | null; createdAt: string;
    businessName: string | null; businessSlug: string | null;
  }>;

  const unread = rows.filter((r) => !r.readAt).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Notifications</p>
          <h1 className="display text-[1.9rem] md:text-[2.3rem]">What happened.</h1>
          <p className="mt-2 text-[0.9rem] text-muted">{unread ? `${unread} unread` : "You are all caught up."}</p>
        </div>
        {unread ? (
          <form action={markNotificationsRead}>
            <button className="btn btn-ghost btn-sm" type="submit"><CheckCheck size={14} aria-hidden /> Mark all read</button>
          </form>
        ) : null}
      </div>

      {query.msg ? <Alert kind="ok">{query.msg}</Alert> : null}

      {rows.length === 0 ? (
        <div className="card">
          <Empty title="No notifications yet">
            Points earned, rewards unlocked and vouchers used will show up here. Repeato does not send email or SMS.
          </Empty>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li key={n.id} className={`card px-5 py-4 ${n.readAt ? "" : "border-brand/30 bg-brand-soft/30"}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${n.readAt ? "bg-paper-deep text-muted" : "bg-brand-soft text-brand"}`} aria-hidden>
                  <Bell size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[0.92rem] font-semibold">{n.title}</p>
                    <time className="text-[0.72rem] text-muted" dateTime={n.createdAt}>{relative(n.createdAt)}</time>
                  </div>
                  {n.body ? <p className="mt-0.5 text-[0.84rem] leading-relaxed text-ink-soft">{n.body}</p> : null}
                  {n.businessSlug ? (
                    <Link href={`/app/wallet?b=${n.businessSlug}`} className="mt-1 inline-block text-[0.78rem] text-brand hover:underline">
                      {n.businessName} wallet
                    </Link>
                  ) : null}
                </div>
                {!n.readAt ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-copper" aria-label="Unread" /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
