import Link from "next/link";
import { Search } from "lucide-react";
import { Alert, Empty, Pill } from "@/components/ui";
import { SaleForm } from "@/components/sale-form";
import { consoleContext } from "@/lib/console";
import { getDb } from "@/lib/db";
import { reverseSale } from "@/app/actions/business";
import { dateTime, money, points } from "@/lib/format";

export const metadata = { title: "Transactions" };

const PAGE_SIZE = 20;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; q?: string; page?: string }>;
}) {
  const { business, role, user } = await consoleContext();
  const query = await searchParams;
  const db = getDb();
  const page = Math.max(1, Math.min(999, Number(query.page) || 1));
  const term = (query.q || "").trim();

  const customers = await db
    .prepare(
      `SELECT u.id, u.name, u.email FROM business_customers bc JOIN users u ON u.id = bc.user_id
        WHERE bc.business_id = ? ORDER BY u.name`,
    )
    .all<{ id: number; name: string; email: string }>(business.id);

  const where = `p.business_id = ?${term ? " AND (LOWER(u.name) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?) OR LOWER(p.reference) LIKE LOWER(?))" : ""}`;
  const args = term ? [business.id, `%${term}%`, `%${term}%`, `%${term}%`] : [business.id];

  const total =
    (await db
      .prepare(`SELECT COUNT(*) AS n FROM purchases p JOIN users u ON u.id = p.customer_id WHERE ${where}`)
      .get<{ n: number }>(...args))?.n ?? 0;

  const rows = await db
    .prepare(
      `SELECT p.id, p.amount_paise AS "amountPaise", p.points_awarded AS "pointsAwarded", p.status, p.reference,
              p.created_at AS "createdAt", u.id AS "customerId", u.name AS "customerName", s.name AS "staffName"
         FROM purchases p JOIN users u ON u.id = p.customer_id JOIN users s ON s.id = p.staff_id
        WHERE ${where} ORDER BY p.id DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    )
    .all<{
      id: number; amountPaise: number; pointsAwarded: number; status: string; reference: string | null; createdAt: string;
      customerId: number; customerName: string; staffName: string;
    }>(...args);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const back = `/biz/transactions${term ? `?q=${encodeURIComponent(term)}` : ""}`;

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Counter</p>
        <h1 className="display text-[1.8rem] md:text-[2.2rem]">Transactions</h1>
        <p className="mt-1 text-[0.9rem] text-muted">
          Every point in a wallet traces back to one of these rows. Reversals are recorded, not deleted.
        </p>
      </div>

      {query.ok ? <Alert kind="ok">{query.ok}</Alert> : null}
      {query.error ? <Alert kind="bad">{query.error}</Alert> : null}

      <SaleForm businessId={business.id} customers={customers} back={back} />

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
          <h2 className="text-[0.95rem] font-semibold">Purchase log</h2>
          <form action="/biz/transactions" className="flex gap-2">
            <label htmlFor="q" className="sr-only">Search transactions</label>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input id="q" name="q" defaultValue={term} className="input h-9 w-48 py-1 pl-8 text-[0.82rem]" placeholder="Name, email or receipt" />
            </div>
            <button className="btn btn-ghost btn-sm" type="submit">Search</button>
          </form>
        </div>

        {rows.length === 0 ? (
          <Empty title={term ? "No purchases match that search" : "No purchases yet"}>
            {term ? "Try a different customer or clear the search." : "Record the first sale above — the customer must have joined your programme."}
          </Empty>
        ) : (
          <div className="table-wrap border-0">
            <table className="table">
              <caption className="sr-only">Purchases recorded at {business.name}</caption>
              <thead>
                <tr><th>When</th><th>Customer</th><th>Staff</th><th className="text-right">Amount</th><th className="text-right">Points</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap text-muted">{dateTime(p.createdAt)}</td>
                    <td>
                      <Link href={`/biz/customers/${p.customerId}`} className="font-medium hover:underline">{p.customerName}</Link>
                      {p.reference ? <span className="block text-[0.72rem] text-muted">#{p.reference}</span> : null}
                    </td>
                    <td className="whitespace-nowrap text-muted">{p.staffName}</td>
                    <td className="whitespace-nowrap text-right">{money(p.amountPaise)}</td>
                    <td className={`text-right font-semibold ${p.status === "reversed" ? "text-muted line-through" : "text-brand"}`}>+{points(p.pointsAwarded)}</td>
                    <td><Pill kind={p.status === "verified" ? "ok" : "bad"}>{p.status}</Pill></td>
                    <td className="text-right">
                      {role === "owner" && p.status === "verified" ? (
                        <details className="relative">
                          <summary className="cursor-pointer list-none text-[0.75rem] text-muted hover:text-danger">Reverse</summary>
                          <form action={reverseSale} className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-line bg-white p-3 shadow-lg">
                            <input type="hidden" name="businessId" value={business.id} />
                            <input type="hidden" name="purchaseId" value={p.id} />
                            <input type="hidden" name="back" value={back} />
                            <label className="label text-[0.72rem]" htmlFor={`reason-${p.id}`}>Reason</label>
                            <input id={`reason-${p.id}`} name="reason" className="input text-[0.8rem]" placeholder="Refund, duplicate…" defaultValue="Refund" required />
                            <button className="btn btn-ghost btn-sm mt-2 w-full text-danger" type="submit">Remove {p.pointsAwarded} points</button>
                          </form>
                        </details>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 ? (
          <nav className="flex items-center justify-between border-t border-line px-5 py-3 text-[0.8rem]" aria-label="Transaction pages">
            {page > 1 ? <Link className="btn btn-ghost btn-sm" href={`/biz/transactions?${new URLSearchParams({ ...(term ? { q: term } : {}), page: String(page - 1) })}`}>Previous</Link> : <span />}
            <span className="text-muted">Page {page} of {pages} · {total} purchases</span>
            {page < pages ? <Link className="btn btn-ghost btn-sm" href={`/biz/transactions?${new URLSearchParams({ ...(term ? { q: term } : {}), page: String(page + 1) })}`}>Next</Link> : <span />}
          </nav>
        ) : (
          <p className="border-t border-line px-5 py-2.5 text-[0.72rem] text-muted">
            Recorded by {user.name}. {customers.length} members can earn points here.
          </p>
        )}
      </section>
    </div>
  );
}
