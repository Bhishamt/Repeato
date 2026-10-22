import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { Alert, Empty, Pill, Stat } from "@/components/ui";
import { consoleContext } from "@/lib/console";
import { getDb } from "@/lib/db";
import { adjustCustomerPoints } from "@/app/actions/business";
import { dateShort, dateTime, money, points } from "@/lib/format";

export const metadata = { title: "Customer" };

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { business, role } = await consoleContext();
  const { id: rawId } = await params;
  const query = await searchParams;
  const customerId = Number(rawId);
  if (!Number.isInteger(customerId) || customerId < 1) notFound();

  const db = getDb();
  const customer = await db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, bc.joined_at AS "joinedAt"
         FROM business_customers bc JOIN users u ON u.id = bc.user_id
        WHERE bc.business_id = ? AND u.id = ?`,
    )
    .get<{ id: number; name: string; email: string; phone: string | null; joinedAt: string }>(business.id, customerId);
  if (!customer) notFound();

  const balance =
    (await db
      .prepare("SELECT COALESCE(SUM(delta),0) AS n FROM ledger WHERE business_id = ? AND customer_id = ?")
      .get<{ n: number }>(business.id, customerId))?.n ?? 0;
  const stats = await db
    .prepare(
      `SELECT COUNT(*) AS visits, COALESCE(SUM(amount_paise),0) AS spend, MAX(created_at) AS "lastVisit"
         FROM purchases WHERE business_id = ? AND customer_id = ? AND status = 'verified'`,
    )
    .get<{ visits: number; spend: number; lastVisit: string | null }>(business.id, customerId) ?? { visits: 0, spend: 0, lastVisit: null };
  const issued =
    (await db
      .prepare("SELECT COALESCE(SUM(delta),0) AS n FROM ledger WHERE business_id = ? AND customer_id = ? AND delta > 0")
      .get<{ n: number }>(business.id, customerId))?.n ?? 0;
  const spent =
    (await db
      .prepare("SELECT COALESCE(SUM(-delta),0) AS n FROM ledger WHERE business_id = ? AND customer_id = ? AND delta < 0")
      .get<{ n: number }>(business.id, customerId))?.n ?? 0;

  const purchases = await db
    .prepare(
      `SELECT p.id, p.amount_paise AS "amountPaise", p.points_awarded AS "pointsAwarded", p.status, p.reference, p.created_at AS "createdAt",
              s.name AS "staffName"
         FROM purchases p JOIN users s ON s.id = p.staff_id
        WHERE p.business_id = ? AND p.customer_id = ? ORDER BY p.id DESC LIMIT 30`,
    )
    .all<{
      id: number; amountPaise: number; pointsAwarded: number; status: string; reference: string | null; createdAt: string; staffName: string;
    }>(business.id, customerId);

  const ledger = await db
    .prepare(
      `SELECT id, delta, kind, note, created_at AS "createdAt" FROM ledger
        WHERE business_id = ? AND customer_id = ? ORDER BY id DESC LIMIT 30`,
    )
    .all<{ id: number; delta: number; kind: string; note: string | null; createdAt: string }>(business.id, customerId);

  const vouchers = await db
    .prepare(
      `SELECT r.token, r.status, r.points_spent AS "pointsSpent", r.issued_at AS "issuedAt", rw.name AS "rewardName"
         FROM redemptions r JOIN rewards rw ON rw.id = r.reward_id
        WHERE r.business_id = ? AND r.customer_id = ? ORDER BY r.id DESC LIMIT 10`,
    )
    .all<{ token: string; status: string; pointsSpent: number; issuedAt: string; rewardName: string }>(business.id, customerId);

  return (
    <div className="space-y-5">
      <Link href="/biz/customers" className="inline-flex items-center gap-1 text-[0.8rem] text-muted hover:text-ink">
        <ArrowLeft size={13} aria-hidden /> All customers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Member since {dateShort(customer.joinedAt)}</p>
          <h1 className="display text-[1.8rem] md:text-[2.2rem]">{customer.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.84rem] text-muted">
            <span className="inline-flex items-center gap-1"><Mail size={12} aria-hidden /> {customer.email}</span>
            {customer.phone ? <span>{customer.phone}</span> : null}
            {stats.lastVisit ? <span>last visit {dateShort(stats.lastVisit)}</span> : <span>no visits yet</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="display text-[2.4rem] leading-none">{points(balance)}</p>
          <p className="mono mt-1 text-[0.6rem]">points balance</p>
        </div>
      </div>

      {query.ok ? <Alert kind="ok">{query.ok}</Alert> : null}
      {query.error ? <Alert kind="bad">{query.error}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Visits" value={stats.visits} sub="verified purchases" />
        <Stat label="Spend" value={money(stats.spend)} sub="recorded total" />
        <Stat label="Points earned" value={points(issued)} sub="incl. adjustments" />
        <Stat label="Points used" value={points(spent)} sub="redeemed / reversed" />
      </div>

      {role === "owner" ? (
        <form action={adjustCustomerPoints} className="card card-pad">
          <input type="hidden" name="businessId" value={business.id} />
          <input type="hidden" name="customerId" value={customer.id} />
          <input type="hidden" name="back" value={`/biz/customers/${customer.id}`} />
          <h2 className="text-[0.95rem] font-semibold">Manual adjustment</h2>
          <p className="mt-0.5 text-[0.8rem] text-muted">
            For goodwill or correction only. The reason is written to the ledger and the audit log. Negative values remove points.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label className="label" htmlFor="delta">Points (+/−)</label>
              <input id="delta" name="delta" className="input w-28" inputMode="numeric" placeholder="50" required />
            </div>
            <div className="min-w-48 flex-1">
              <label className="label" htmlFor="reason">Reason</label>
              <input id="reason" name="reason" className="input" placeholder="Goodwill after a delayed order" required maxLength={160} />
            </div>
            <button className="btn btn-ghost" type="submit">Apply</button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="border-b border-line px-5 py-3"><h2 className="text-[0.95rem] font-semibold">Purchases</h2></div>
          {purchases.length === 0 ? (
            <Empty title="No purchases yet">Record a sale from the Transactions page to start this customer&apos;s history.</Empty>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <caption className="sr-only">Purchases by {customer.name}</caption>
                <thead><tr><th>When</th><th className="text-right">Amount</th><th className="text-right">Points</th><th>Status</th></tr></thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap text-muted">{dateShort(p.createdAt)}</td>
                      <td className="text-right">{money(p.amountPaise)}</td>
                      <td className="text-right font-semibold">+{points(p.pointsAwarded)}</td>
                      <td><Pill kind={p.status === "verified" ? "ok" : "bad"}>{p.status}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="border-b border-line px-5 py-3"><h2 className="text-[0.95rem] font-semibold">Points ledger</h2></div>
          {ledger.length === 0 ? (
            <Empty title="No ledger entries">Every award, redemption and adjustment is written here.</Empty>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <caption className="sr-only">Points ledger for {customer.name}</caption>
                <thead><tr><th>When</th><th>Type</th><th>Note</th><th className="text-right">Points</th></tr></thead>
                <tbody>
                  {ledger.map((l) => (
                    <tr key={l.id}>
                      <td className="whitespace-nowrap text-muted">{dateShort(l.createdAt)}</td>
                      <td><span className="pill pill-muted">{l.kind}</span></td>
                      <td className="text-ink-soft">{l.note || "—"}</td>
                      <td className={`text-right font-semibold ${l.delta > 0 ? "text-brand" : "text-copper"}`}>
                        {l.delta > 0 ? "+" : ""}{points(l.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="border-b border-line px-5 py-3"><h2 className="text-[0.95rem] font-semibold">Vouchers</h2></div>
        {vouchers.length === 0 ? (
          <Empty title="No redemptions yet">Rewards this customer redeems appear here with their one-time codes.</Empty>
        ) : (
          <ul className="divide-y divide-[#f0e9de]">
            {vouchers.map((v) => (
              <li key={v.token} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div>
                  <p className="text-[0.88rem] font-semibold">{v.rewardName}</p>
                  <p className="text-[0.74rem] text-muted">issued {dateTime(v.issuedAt)} · {points(v.pointsSpent)} pts</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.76rem] tracking-[0.14em]">{v.token}</span>
                  <Pill kind={v.status === "issued" ? "warn" : v.status === "redeemed" ? "ok" : "muted"}>{v.status}</Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
