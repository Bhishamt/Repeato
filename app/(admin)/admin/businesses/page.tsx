import Link from "next/link";
import { Search } from "lucide-react";
import { Alert, Empty, Pill } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { setBusinessStatus } from "@/app/actions/admin";
import { dateShort, money } from "@/lib/format";

export const metadata = { title: "Businesses" };

export default async function AdminBusinesses({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; q?: string }>;
}) {
  await requireAdmin("/admin/businesses");
  const query = await searchParams;
  const db = getDb();
  const term = (query.q || "").trim();

  const rows = await db
    .prepare(
      `SELECT b.id, b.name, b.slug, b.category, b.city, b.status, b.created_at AS createdAt,
              (SELECT COUNT(*) FROM business_customers bc WHERE bc.business_id = b.id) AS members,
              (SELECT COUNT(*) FROM purchases p WHERE p.business_id = b.id AND p.status = 'verified') AS purchases,
              (SELECT COALESCE(SUM(p.amount_paise),0) FROM purchases p WHERE p.business_id = b.id AND p.status = 'verified') AS volume,
              (SELECT u.email FROM business_members bm JOIN users u ON u.id = bm.user_id WHERE bm.business_id = b.id AND bm.role = 'owner' LIMIT 1) AS ownerEmail
         FROM businesses b
        ${term ? "WHERE b.name LIKE ? OR b.slug LIKE ? OR b.city LIKE ?" : ""}
        ORDER BY b.id DESC LIMIT 200`,
    )
    .all(...(term ? [`%${term}%`, `%${term}%`, `%${term}%`] : [])) as Array<{
    id: number; name: string; slug: string; category: string; city: string | null; status: string; createdAt: string;
    members: number; purchases: number; volume: number; ownerEmail: string | null;
  }>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Directory</p>
          <h1 className="display text-[1.8rem] md:text-[2.2rem]">Businesses</h1>
          <p className="mt-1 text-[0.9rem] text-muted">Suspending a business hides its join page and blocks new memberships.</p>
        </div>
        <form action="/admin/businesses" className="flex gap-2">
          <label htmlFor="q" className="sr-only">Search businesses</label>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input id="q" name="q" defaultValue={term} className="input h-9 w-52 py-1 pl-8 text-[0.82rem]" placeholder="Name, city or slug" />
          </div>
          <button className="btn btn-ghost btn-sm" type="submit">Search</button>
        </form>
      </div>

      {query.ok ? <Alert kind="ok">{query.ok}</Alert> : null}
      {query.error ? <Alert kind="bad">{query.error}</Alert> : null}

      <section className="card">
        {rows.length === 0 ? (
          <Empty title="No businesses found">Try a different search.</Empty>
        ) : (
          <div className="table-wrap border-0">
            <table className="table">
              <caption className="sr-only">All businesses</caption>
              <thead><tr><th>Business</th><th>Owner</th><th className="text-right">Members</th><th className="text-right">Purchases</th><th className="text-right">Volume</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-[0.72rem] text-muted">{b.category}{b.city ? ` · ${b.city}` : ""} · joined {dateShort(b.createdAt)}</p>
                      <Link href={`/join/${b.slug}`} target="_blank" rel="noreferrer" className="text-[0.72rem] text-brand hover:underline">/join/{b.slug}</Link>
                    </td>
                    <td className="max-w-[180px] truncate text-[0.8rem] text-muted">{b.ownerEmail ?? "—"}</td>
                    <td className="text-right">{b.members}</td>
                    <td className="text-right">{b.purchases}</td>
                    <td className="text-right">{money(b.volume)}</td>
                    <td><Pill kind={b.status === "active" ? "ok" : b.status === "pending" ? "warn" : "bad"}>{b.status}</Pill></td>
                    <td>
                      <form action={setBusinessStatus} className="flex items-center gap-1.5">
                        <input type="hidden" name="businessId" value={b.id} />
                        <input type="hidden" name="back" value={`/admin/businesses${term ? `?q=${encodeURIComponent(term)}` : ""}`} />
                        <input type="hidden" name="status" value={b.status === "active" ? "suspended" : "active"} />
                        <button className={`btn btn-sm ${b.status === "active" ? "btn-ghost text-danger" : "btn-soft"}`} type="submit">
                          {b.status === "active" ? "Suspend" : "Activate"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
