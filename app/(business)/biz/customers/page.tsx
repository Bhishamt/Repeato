import Link from "next/link";
import { Search } from "lucide-react";
import { Empty } from "@/components/ui";
import { consoleContext } from "@/lib/console";
import { getDb } from "@/lib/db";
import { dateShort, points } from "@/lib/format";

export const metadata = { title: "Customers" };

const PAGE_SIZE = 25;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { business } = await consoleContext();
  const query = await searchParams;
  const db = getDb();
  const page = Math.max(1, Math.min(999, Number(query.page) || 1));
  const term = (query.q || "").trim();

  const where = `bc.business_id = ?${term ? " AND (u.name LIKE ? OR u.email LIKE ?)" : ""}`;
  const args = term ? [business.id, `%${term}%`, `%${term}%`] : [business.id];

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM business_customers bc JOIN users u ON u.id = bc.user_id WHERE ${where}`).get(...args) as { n: number }
  ).n;

  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.email, bc.joined_at AS joinedAt,
              COALESCE((SELECT SUM(delta) FROM ledger l WHERE l.business_id = bc.business_id AND l.customer_id = u.id), 0) AS balance,
              (SELECT COUNT(*) FROM purchases p WHERE p.business_id = bc.business_id AND p.customer_id = u.id AND p.status = 'verified') AS visits,
              (SELECT MAX(p.created_at) FROM purchases p WHERE p.business_id = bc.business_id AND p.customer_id = u.id AND p.status = 'verified') AS lastVisit
         FROM business_customers bc JOIN users u ON u.id = bc.user_id
        WHERE ${where}
        ORDER BY bc.joined_at DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    )
    .all(...args) as Array<{
    id: number; name: string; email: string; joinedAt: string; balance: number; visits: number; lastVisit: string | null;
  }>;

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Members</p>
          <h1 className="display text-[1.8rem] md:text-[2.2rem]">Customers</h1>
          <p className="mt-1 text-[0.9rem] text-muted">{total} people have joined {business.name}.</p>
        </div>
        <form action="/biz/customers" className="flex gap-2">
          <label htmlFor="q" className="sr-only">Search customers</label>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input id="q" name="q" defaultValue={term} className="input h-9 w-52 py-1 pl-8 text-[0.82rem]" placeholder="Name or email" />
          </div>
          <button className="btn btn-ghost btn-sm" type="submit">Search</button>
        </form>
      </div>

      <section className="card">
        {rows.length === 0 ? (
          <Empty title={term ? "No members match that search" : "No members yet"}>
            {term
              ? "Try a different name or clear the search."
              : "Members appear here after they scan your QR code and join. Welcome points are added automatically."}
          </Empty>
        ) : (
          <div className="table-wrap border-0">
            <table className="table">
              <caption className="sr-only">Customers of {business.name}</caption>
              <thead>
                <tr><th>Customer</th><th>Joined</th><th className="text-right">Visits</th><th>Last visit</th><th className="text-right">Balance</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/biz/customers/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                      <span className="block text-[0.72rem] text-muted">{c.email}</span>
                    </td>
                    <td className="whitespace-nowrap text-muted">{dateShort(c.joinedAt)}</td>
                    <td className="text-right">{c.visits}</td>
                    <td className="whitespace-nowrap text-muted">{c.lastVisit ? dateShort(c.lastVisit) : "—"}</td>
                    <td className="text-right font-semibold">{points(c.balance)}</td>
                    <td className="text-right"><Link href={`/biz/customers/${c.id}`} className="text-[0.78rem] text-brand hover:underline">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 ? (
          <nav className="flex items-center justify-between border-t border-line px-5 py-3 text-[0.8rem]" aria-label="Customer pages">
            {page > 1 ? <Link className="btn btn-ghost btn-sm" href={`/biz/customers?${new URLSearchParams({ ...(term ? { q: term } : {}), page: String(page - 1) })}`}>Previous</Link> : <span />}
            <span className="text-muted">Page {page} of {pages}</span>
            {page < pages ? <Link className="btn btn-ghost btn-sm" href={`/biz/customers?${new URLSearchParams({ ...(term ? { q: term } : {}), page: String(page + 1) })}`}>Next</Link> : <span />}
          </nav>
        ) : null}
      </section>

      <p className="text-[0.76rem] text-muted">
        Only people who joined this business appear. Personal data from other businesses is never loaded here.
      </p>
    </div>
  );
}
