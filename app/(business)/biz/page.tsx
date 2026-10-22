import Link from "next/link";
import { ArrowRight, Gift, QrCode, Receipt, Ticket, TrendingUp, Users } from "lucide-react";
import { Empty, Pill, Stat } from "@/components/ui";
import { TrendChart, type TrendPoint } from "@/components/trend-chart";
import { consoleContext } from "@/lib/console";
import { getDb } from "@/lib/db";
import { getBalance } from "@/lib/services";
import { money, points } from "@/lib/format";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const { business, role, user } = await consoleContext();
  const db = getDb();
  const id = business.id;

  const members = (db.prepare("SELECT COUNT(*) AS n FROM business_customers WHERE business_id = ?").get(id) as { n: number }).n;
  const newMembers = (
    db.prepare("SELECT COUNT(*) AS n FROM business_customers WHERE business_id = ? AND joined_at >= datetime('now','-30 days')").get(id) as { n: number }
  ).n;
  const purchases = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(amount_paise),0) AS amount
         FROM purchases WHERE business_id = ? AND status = 'verified' AND created_at >= datetime('now','-30 days')`,
    )
    .get(id) as { n: number; amount: number };
  const issued = (
    db.prepare("SELECT COALESCE(SUM(delta),0) AS n FROM ledger WHERE business_id = ? AND delta > 0 AND created_at >= datetime('now','-30 days')").get(id) as { n: number }
  ).n;
  const redeemed = (
    db.prepare("SELECT COALESCE(SUM(-delta),0) AS n FROM ledger WHERE business_id = ? AND kind = 'redeem' AND created_at >= datetime('now','-30 days')").get(id) as { n: number }
  ).n;
  const openVouchers = (
    db.prepare("SELECT COUNT(*) AS n FROM redemptions WHERE business_id = ? AND status = 'issued'").get(id) as { n: number }
  ).n;
  const activeRewards = (db.prepare("SELECT COUNT(*) AS n FROM rewards WHERE business_id = ? AND active = 1").get(id) as { n: number }).n;
  const returning = (
    db.prepare(
      `SELECT COUNT(*) AS n FROM (SELECT customer_id FROM purchases WHERE business_id = ? AND status = 'verified'
         GROUP BY customer_id HAVING COUNT(*) >= 2)`,
    ).get(id) as { n: number }
  ).n;

  const recent = db
    .prepare(
      `SELECT p.id, p.amount_paise AS amountPaise, p.points_awarded AS pointsAwarded, p.status, p.created_at AS createdAt,
              u.name AS customerName
         FROM purchases p JOIN users u ON u.id = p.customer_id
        WHERE p.business_id = ? ORDER BY p.id DESC LIMIT 6`,
    )
    .all(id) as Array<{ id: number; amountPaise: number; pointsAwarded: number; status: string; createdAt: string; customerName: string }>;

  const pending = openVouchers;

  // Eight weekly buckets built in JS so the axis is complete even with no data.
  const weeks: TrendPoint[] = [];
  const now = Date.now();
  for (let i = 7; i >= 0; i -= 1) {
    const start = new Date(now - i * 7 * 86400000);
    weeks.push({ label: start.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), purchases: 0, members: 0 });
  }
  const since = new Date(now - 8 * 7 * 86400000).toISOString().slice(0, 19).replace("T", " ");
  const purchaseRows = db
    .prepare("SELECT created_at AS at FROM purchases WHERE business_id = ? AND status = 'verified' AND created_at >= ?")
    .all(id, since) as Array<{ at: string }>;
  const memberRows = db
    .prepare("SELECT joined_at AS at FROM business_customers WHERE business_id = ? AND joined_at >= ?")
    .all(id, since) as Array<{ at: string }>;
  const bucket = (at: string) => {
    const days = (now - new Date(at.replace(" ", "T") + "Z").getTime()) / 86400000;
    return 7 - Math.min(7, Math.max(0, Math.floor(days / 7)));
  };
  for (const row of purchaseRows) weeks[bucket(row.at)].purchases += 1;
  for (const row of memberRows) weeks[bucket(row.at)].members += 1;

  const topCustomer = db
    .prepare(
      `SELECT u.id, u.name, COALESCE(SUM(l.delta),0) AS balance FROM business_customers bc
         JOIN users u ON u.id = bc.user_id
         LEFT JOIN ledger l ON l.customer_id = u.id AND l.business_id = bc.business_id
        WHERE bc.business_id = ? GROUP BY u.id ORDER BY balance DESC LIMIT 1`,
    )
    .get(id) as { id: number; name: string; balance: number } | undefined;

  const returningRate = members ? Math.round((returning / members) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Overview · last 30 days</p>
          <h1 className="display text-[1.9rem] md:text-[2.3rem]">{business.name}</h1>
          <p className="mt-1 text-[0.88rem] text-muted">
            {role === "owner" ? "Owner view" : "Staff view"} · points are issued only from recorded purchases.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/biz/transactions" className="btn btn-primary btn-sm"><Receipt size={14} aria-hidden /> Record a sale</Link>
          <Link href="/biz/redemptions" className="btn btn-ghost btn-sm"><Ticket size={14} aria-hidden /> Check a voucher</Link>
        </div>
      </div>

      {members === 0 ? (
        <div className="card card-pad border-brand/25 bg-brand-soft/30">
          <h2 className="text-[1rem] font-semibold">Your console is ready — no members yet.</h2>
          <p className="mt-1 max-w-2xl text-[0.86rem] leading-relaxed text-ink-soft">
            Print the QR code and put it at the counter. New members get your welcome points. When staff record a
            purchase, the points and the analytics below start filling in. Nothing here is simulated.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/biz/qr" className="btn btn-primary btn-sm"><QrCode size={14} aria-hidden /> Get the QR code</Link>
            <Link href="/biz/loyalty" className="btn btn-ghost btn-sm">Set loyalty rules</Link>
            <Link href="/biz/rewards" className="btn btn-ghost btn-sm">Add a reward</Link>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Members" value={points(members)} sub={`+${newMembers} in 30 days`} />
        <Stat label="Verified purchases" value={points(purchases.n)} sub={`${money(purchases.amount)} recorded`} />
        <Stat label="Points issued" value={points(issued)} sub={`${points(redeemed)} redeemed`} />
        <Stat label="Open vouchers" value={points(openVouchers)} sub={openVouchers ? "waiting at the counter" : "none outstanding"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <section className="card card-pad">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-[0.98rem] font-semibold">Visits and growth</h2>
              <p className="mt-0.5 text-[0.78rem] text-muted">Weekly verified purchases and new members, last 8 weeks.</p>
            </div>
            <TrendingUp size={18} className="text-brand" aria-hidden />
          </div>
          <div className="mt-3"><TrendChart data={weeks} /></div>
          <div className="mt-2 flex flex-wrap gap-3 text-[0.72rem] text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-brand" aria-hidden /> Purchases</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-copper" aria-hidden /> New members</span>
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="text-[0.98rem] font-semibold">Retention snapshot</h2>
          <p className="mt-0.5 text-[0.78rem] text-muted">A returning customer has 2+ verified purchases here.</p>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-baseline justify-between text-[0.8rem]">
                <span className="text-ink-soft">Returning customers</span>
                <span className="font-semibold">{returning} of {members}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-deep">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${returningRate}%` }} />
              </div>
              <p className="mt-1 text-[0.72rem] text-muted">{returningRate}% repeat rate</p>
            </div>
            <div className="divide-line pt-3 text-[0.82rem]">
              <div className="flex justify-between"><span className="text-muted">Active rewards</span><span className="font-semibold">{activeRewards}</span></div>
              <div className="mt-2 flex justify-between"><span className="text-muted">Vouchers to honour</span><span className="font-semibold">{pending}</span></div>
              {topCustomer ? (
                <div className="mt-2 flex justify-between gap-3">
                  <span className="text-muted">Top balance</span>
                  <Link href={`/biz/customers/${topCustomer.id}`} className="truncate font-semibold hover:underline">
                    {topCustomer.name} · {points(getBalance(db, id, topCustomer.id))}
                  </Link>
                </div>
              ) : null}
            </div>
            <Link href="/biz/analytics" className="link inline-flex items-center gap-1 text-[0.8rem]">
              Full analytics <ArrowRight size={12} aria-hidden />
            </Link>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-[0.95rem] font-semibold">Latest purchases</h2>
          <Link href="/biz/transactions" className="text-[0.8rem] font-semibold text-brand hover:underline">All transactions</Link>
        </div>
        {recent.length === 0 ? (
          <Empty title="No purchases recorded yet">
            {user.role === "staff" ? "Record a sale when a member pays at the counter." : "Use “Record a sale”, or invite staff to do it at the counter."}
          </Empty>
        ) : (
          <div className="table-wrap border-0">
            <table className="table">
              <caption className="sr-only">Latest purchases</caption>
              <thead><tr><th>Customer</th><th>When</th><th className="text-right">Amount</th><th className="text-right">Points</th><th>Status</th></tr></thead>
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.customerName}</td>
                    <td className="whitespace-nowrap text-muted">{new Date(p.createdAt.replace(" ", "T") + "Z").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                    <td className="text-right">{money(p.amountPaise)}</td>
                    <td className="text-right font-semibold text-brand">+{points(p.pointsAwarded)}</td>
                    <td><Pill kind={p.status === "verified" ? "ok" : "bad"}>{p.status}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink href="/biz/qr" icon={QrCode} title="Counter QR" text="Print or download the join code." />
        <QuickLink href="/biz/rewards" icon={Gift} title="Rewards" text="What members can spend points on." />
        <QuickLink href="/biz/customers" icon={Users} title="Customers" text="Balances, visits and history." />
      </div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, title, text }: { href: string; icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>; title: string; text: string }) {
  return (
    <Link href={href} className="card flex items-start gap-3 p-4 no-underline transition-colors hover:border-[#cfc4b3]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand" aria-hidden>
        <Icon size={16} />
      </span>
      <span>
        <span className="block text-[0.9rem] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[0.78rem] text-muted">{text}</span>
      </span>
    </Link>
  );
}
