import Link from "next/link";
import { Receipt, Ticket } from "lucide-react";
import { Empty, Pill } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dateTime, money, points } from "@/lib/format";

export const metadata = { title: "Activity" };

const PAGE_SIZE = 20;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string; page?: string }>;
}) {
  const user = await requireUser("/app/activity");
  const query = await searchParams;
  const db = getDb();
  const page = Math.max(1, Math.min(500, Number(query.page) || 1));

  const memberships = await db
    .prepare(
      `SELECT b.id, b.name, b.slug FROM business_customers bc JOIN businesses b ON b.id = bc.business_id
        WHERE bc.user_id = ? ORDER BY b.name`,
    )
    .all<{ id: number; name: string; slug: string }>(user.id);
  const selected = query.b ? memberships.find((m) => m.slug === query.b) : null;
  const scope = selected ? "AND p.business_id = ?" : "";
  const args = selected ? [user.id, selected.id] : [user.id];

  const total =
    (await db
      .prepare(`SELECT COUNT(*) AS n FROM purchases p WHERE p.customer_id = ? ${scope}`)
      .get<{ n: number }>(...args))?.n ?? 0;

  const purchases = await db
    .prepare(
      `SELECT p.id, p.amount_paise AS amountPaise, p.points_awarded AS pointsAwarded, p.status, p.reference, p.note,
              p.created_at AS createdAt, b.name AS businessName, b.slug AS businessSlug,
              (SELECT ${db.listConcat("CAST(pi.quantity AS TEXT) || '× ' || pi.name", ', ')} FROM purchase_items pi WHERE pi.purchase_id = p.id) AS items
         FROM purchases p JOIN businesses b ON b.id = p.business_id
        WHERE p.customer_id = ? ${scope}
        ORDER BY p.id DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    )
    .all<{
    id: number; amountPaise: number; pointsAwarded: number; status: string; reference: string | null; note: string | null;
    createdAt: string; businessName: string; businessSlug: string; items: string | null;
  }>(...args);

  const redemptions = await db
    .prepare(
      `SELECT r.id, r.token, r.status, r.points_spent AS pointsSpent, r.issued_at AS issuedAt, r.expires_at AS expiresAt,
              rw.name AS rewardName, b.name AS businessName
         FROM redemptions r JOIN rewards rw ON rw.id = r.reward_id JOIN businesses b ON b.id = r.business_id
        WHERE r.customer_id = ?
        ORDER BY r.id DESC LIMIT 20`,
    )
    .all<{
    id: number; token: string; status: string; pointsSpent: number; issuedAt: string; expiresAt: string; rewardName: string; businessName: string;
  }>(user.id);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">History</p>
        <h1 className="display text-[1.9rem] md:text-[2.3rem]">Every visit, on the record.</h1>
        <p className="mt-2 max-w-xl text-[0.9rem] leading-relaxed text-muted">
          Purchases are recorded by café staff. If a purchase was reversed, the points are removed here too.
        </p>
      </div>

      {memberships.length > 1 ? (
        <div className="scroll-x flex gap-2 pb-1">
          <Link href="/app/activity" className={`pill ${selected ? "pill-muted" : "pill-brand"}`}>All cafés</Link>
          {memberships.map((m) => (
            <Link key={m.id} href={`/app/activity?b=${m.slug}`} className={`pill whitespace-nowrap ${selected?.id === m.id ? "pill-brand" : "pill-muted"}`}>
              {m.name}
            </Link>
          ))}
        </div>
      ) : null}

      <section className="card">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <Receipt size={15} className="text-brand" aria-hidden />
          <h2 className="text-[0.95rem] font-semibold">Purchases</h2>
          <span className="ml-auto text-[0.76rem] text-muted">{total} recorded</span>
        </div>
        {purchases.length === 0 ? (
          <Empty title="No purchases yet">Ask the counter to record your purchase against your account. It takes a few seconds.</Empty>
        ) : (
          <div className="table-wrap border-0">
            <table className="table">
              <caption className="sr-only">Purchase history</caption>
              <thead>
                <tr><th>When</th><th>Café</th><th className="hidden lg:table-cell">Items</th><th className="hidden sm:table-cell">Receipt</th><th className="hidden text-right sm:table-cell">Amount</th><th className="text-right">Points</th></tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap text-muted">{dateTime(p.createdAt)}</td>
                    <td className="whitespace-nowrap">
                      <Link href={`/app/wallet?b=${p.businessSlug}`} className="hover:underline">{p.businessName}</Link>
                    </td>
                    <td className="hidden max-w-[220px] text-ink-soft lg:table-cell">{p.items || "—"}</td>
                    <td className="hidden text-muted sm:table-cell">
                      {p.reference || "—"}
                      {p.status === "reversed" ? <span className="ml-2"><Pill kind="bad">reversed</Pill></span> : null}
                    </td>
                    <td className="hidden whitespace-nowrap text-right sm:table-cell">{money(p.amountPaise)}</td>
                    <td className={`text-right font-semibold ${p.status === "reversed" ? "text-muted line-through" : "text-brand"}`}>
                      +{points(p.pointsAwarded)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 ? (
          <nav className="flex items-center justify-between border-t border-line px-5 py-3 text-[0.8rem]" aria-label="Purchase pages">
            {page > 1 ? (
              <Link href={`/app/activity?${new URLSearchParams({ ...(selected ? { b: selected.slug } : {}), page: String(page - 1) })}`} className="btn btn-ghost btn-sm">Previous</Link>
            ) : <span />}
            <span className="text-muted">Page {page} of {pages}</span>
            {page < pages ? (
              <Link href={`/app/activity?${new URLSearchParams({ ...(selected ? { b: selected.slug } : {}), page: String(page + 1) })}`} className="btn btn-ghost btn-sm">Next</Link>
            ) : <span />}
          </nav>
        ) : null}
      </section>

      <section className="card">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <Ticket size={15} className="text-copper" aria-hidden />
          <h2 className="text-[0.95rem] font-semibold">Reward redemptions</h2>
          <Link href="/app/vouchers" className="ml-auto text-[0.78rem] text-brand hover:underline">Vouchers</Link>
        </div>
        {redemptions.length === 0 ? (
          <Empty title="Nothing redeemed yet">When you spend points, the voucher and its status appear here.</Empty>
        ) : (
          <ul className="divide-y divide-[#f0e9de]">
            {redemptions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div>
                  <p className="text-[0.9rem] font-semibold">{r.rewardName}</p>
                  <p className="text-[0.76rem] text-muted">{r.businessName} · {dateTime(r.issuedAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="mono text-[0.72rem]">−{points(r.pointsSpent)} pts</span>
                  <Pill kind={r.status === "issued" ? "warn" : r.status === "redeemed" ? "ok" : "muted"}>{r.status}</Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
