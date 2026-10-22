import Link from "next/link";
import { Info } from "lucide-react";
import { Empty, Stat } from "@/components/ui";
import { consoleContext } from "@/lib/console";
import { getDb } from "@/lib/db";
import { money, points } from "@/lib/format";

export const metadata = { title: "Analytics" };

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

type Totals = { purchases: number; revenue: number; members: number; issued: number; redeemed: number; redemptions: number };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { business } = await consoleContext();
  const query = await searchParams;
  const days = RANGES.some((r) => String(r.days) === query.days) ? Number(query.days) : 30;
  const db = getDb();
  const id = business.id;

  const totals = (offsetDays: number): Totals => {
    const from = `-${days + offsetDays} days`;
    const to = offsetDays ? `-${offsetDays} days` : "now";
    const purchases = db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(amount_paise),0) AS revenue FROM purchases
          WHERE business_id = ? AND status = 'verified' AND created_at >= datetime('now', ?) AND created_at < datetime('now', ?)`,
      )
      .get(id, from, to) as { n: number; revenue: number };
    const members = (
      db.prepare(
        `SELECT COUNT(*) AS n FROM business_customers WHERE business_id = ?
          AND joined_at >= datetime('now', ?) AND joined_at < datetime('now', ?)`,
      ).get(id, from, to) as { n: number }
    ).n;
    const issued = (
      db.prepare(
        `SELECT COALESCE(SUM(delta),0) AS n FROM ledger WHERE business_id = ? AND delta > 0
          AND created_at >= datetime('now', ?) AND created_at < datetime('now', ?)`,
      ).get(id, from, to) as { n: number }
    ).n;
    const redeemed = (
      db.prepare(
        `SELECT COALESCE(SUM(-delta),0) AS n FROM ledger WHERE business_id = ? AND kind = 'redeem'
          AND created_at >= datetime('now', ?) AND created_at < datetime('now', ?)`,
      ).get(id, from, to) as { n: number }
    ).n;
    const redemptions = (
      db.prepare(
        `SELECT COUNT(*) AS n FROM redemptions WHERE business_id = ? AND status = 'redeemed'
          AND redeemed_at >= datetime('now', ?) AND redeemed_at < datetime('now', ?)`,
      ).get(id, from, to) as { n: number }
    ).n;
    return { purchases: purchases.n, revenue: purchases.revenue, members, issued, redeemed, redemptions };
  };

  const current = totals(0);
  const previous = totals(days);

  const repeat = db
    .prepare(
      `SELECT COUNT(*) AS repeat FROM (
         SELECT customer_id FROM purchases
          WHERE business_id = ? AND status = 'verified' AND created_at >= datetime('now', ?)
          GROUP BY customer_id HAVING COUNT(*) >= 2)`,
    )
    .get(id, `-${days} days`) as { repeat: number };
  const visiting = (
    db.prepare(
      `SELECT COUNT(DISTINCT customer_id) AS n FROM purchases
        WHERE business_id = ? AND status = 'verified' AND created_at >= datetime('now', ?)`,
    ).get(id, `-${days} days`) as { n: number }
  ).n;
  const repeatRate = visiting ? Math.round((repeat.repeat / visiting) * 100) : 0;

  const topRewards = db
    .prepare(
      `SELECT rw.name, COUNT(*) AS n FROM redemptions r JOIN rewards rw ON rw.id = r.reward_id
        WHERE r.business_id = ? AND r.status = 'redeemed' AND r.redeemed_at >= datetime('now', ?)
        GROUP BY rw.id ORDER BY n DESC LIMIT 5`,
    )
    .all(id, `-${days} days`) as Array<{ name: string; n: number }>;

  const topCustomers = db
    .prepare(
      `SELECT u.id, u.name, COUNT(*) AS visits, COALESCE(SUM(p.amount_paise),0) AS spend
         FROM purchases p JOIN users u ON u.id = p.customer_id
        WHERE p.business_id = ? AND p.status = 'verified' AND p.created_at >= datetime('now', ?)
        GROUP BY u.id ORDER BY spend DESC LIMIT 5`,
    )
    .all(id, `-${days} days`) as Array<{ id: number; name: string; visits: number; spend: number }>;

  const weekdays = db
    .prepare(
      `SELECT CAST(strftime('%w', created_at) AS INTEGER) AS dow, COUNT(*) AS n FROM purchases
        WHERE business_id = ? AND status = 'verified' AND created_at >= datetime('now', ?)
        GROUP BY dow ORDER BY dow`,
    )
    .all(id, `-${days} days`) as Array<{ dow: number; n: number }>;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const busiest = Math.max(1, ...weekdays.map((w) => w.n));

  const delta = (now: number, before: number) => {
    if (!before) return now ? { text: "new", tone: "up" as const } : { text: "—", tone: "flat" as const };
    const pct = Math.round(((now - before) / before) * 100);
    return { text: `${pct > 0 ? "+" : ""}${pct}% vs previous`, tone: pct > 0 ? ("up" as const) : pct < 0 ? ("down" as const) : ("flat" as const) };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Analytics</p>
          <h1 className="display text-[1.8rem] md:text-[2.2rem]">How the café is doing</h1>
          <p className="mt-1 text-[0.9rem] text-muted">All figures come from recorded purchases and redemptions.</p>
        </div>
        <div className="flex gap-1 rounded-full border border-line bg-white p-1">
          {RANGES.map((r) => (
            <Link
              key={r.days}
              href={`/biz/analytics?days=${r.days}`}
              className={`rounded-full px-3 py-1.5 text-[0.8rem] font-medium ${days === r.days ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep"}`}
              aria-current={days === r.days ? "page" : undefined}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Verified purchases" value={points(current.purchases)} sub={delta(current.purchases, previous.purchases).text} />
        <Stat label="Recorded revenue" value={money(current.revenue)} sub={delta(current.revenue, previous.revenue).text} />
        <Stat label="New members" value={points(current.members)} sub={delta(current.members, previous.members).text} />
        <Stat label="Rewards redeemed" value={points(current.redemptions)} sub={`${points(current.redeemed)} points spent`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="text-[0.98rem] font-semibold">Repeat visits</h2>
          <p className="mt-0.5 text-[0.78rem] text-muted">
            Of {visiting} member{visiting === 1 ? "" : "s"} who bought in the last {days} days, {repeat.repeat} came more than once.
          </p>
          <div className="mt-4 flex items-end gap-4">
            <p className="display text-[3rem] leading-none">{repeatRate}%</p>
            <p className="pb-1 text-[0.8rem] text-muted">repeat rate</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-deep">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${repeatRate}%` }} />
          </div>
          <p className="mt-4 flex items-start gap-1.5 text-[0.74rem] leading-relaxed text-muted">
            <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
            A purchase counts once per transaction. Reversals are excluded. This is a range metric, not a lifetime score.
          </p>
        </section>

        <section className="card card-pad">
          <h2 className="text-[0.98rem] font-semibold">Busiest days</h2>
          <p className="mt-0.5 text-[0.78rem] text-muted">Verified purchases by weekday, last {days} days.</p>
          {weekdays.length === 0 ? (
            <Empty title="No purchases in this range">Try a longer range, or record a sale at the counter.</Empty>
          ) : (
            <ul className="mt-4 space-y-2">
              {dayNames.map((name, index) => {
                const n = weekdays.find((w) => w.dow === index)?.n ?? 0;
                return (
                  <li key={name} className="flex items-center gap-3 text-[0.8rem]">
                    <span className="w-8 text-muted">{name}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper-deep">
                      <span className="block h-full rounded-full bg-copper" style={{ width: `${(n / busiest) * 100}%` }} />
                    </span>
                    <span className="w-8 text-right font-medium">{n}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="border-b border-line px-5 py-3"><h2 className="text-[0.95rem] font-semibold">Top rewards</h2></div>
          {topRewards.length === 0 ? (
            <Empty title="No rewards redeemed in this range">Reward performance appears once vouchers are accepted at the counter.</Empty>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <caption className="sr-only">Most redeemed rewards</caption>
                <thead><tr><th>Reward</th><th className="text-right">Redeemed</th></tr></thead>
                <tbody>{topRewards.map((r) => <tr key={r.name}><td>{r.name}</td><td className="text-right font-semibold">{r.n}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="border-b border-line px-5 py-3"><h2 className="text-[0.95rem] font-semibold">Top customers</h2></div>
          {topCustomers.length === 0 ? (
            <Empty title="No purchases in this range">Record a sale to see who spends most.</Empty>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <caption className="sr-only">Customers with highest recorded spend</caption>
                <thead><tr><th>Customer</th><th className="text-right">Visits</th><th className="text-right">Spend</th></tr></thead>
                <tbody>
                  {topCustomers.map((c) => (
                    <tr key={c.id}>
                      <td><Link href={`/biz/customers/${c.id}`} className="hover:underline">{c.name}</Link></td>
                      <td className="text-right">{c.visits}</td>
                      <td className="text-right font-semibold">{money(c.spend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <p className="text-[0.72rem] text-muted">
        Points issued in range: {points(current.issued)}. Points redeemed: {points(current.redeemed)}. Previous period:
        {" "}{previous.purchases} purchases, {money(previous.revenue)} revenue.
      </p>
    </div>
  );
}
