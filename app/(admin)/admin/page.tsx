import Link from "next/link";
import { Alert, Empty, Pill, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dateShort, money, points } from "@/lib/format";

export const metadata = { title: "Platform overview" };

export default async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin("/admin");
  const query = await searchParams;
  const db = getDb();

  const stats =
    (await db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM users) AS users,
           (SELECT COUNT(*) FROM businesses) AS businesses,
           (SELECT COUNT(*) FROM businesses WHERE status = 'active') AS "activeBusinesses",
           (SELECT COUNT(*) FROM business_customers) AS members,
           (SELECT COUNT(*) FROM purchases WHERE status = 'verified') AS purchases,
           (SELECT COALESCE(SUM(amount_paise),0) FROM purchases WHERE status = 'verified') AS volume,
           (SELECT COUNT(*) FROM redemptions WHERE status = 'redeemed') AS redemptions,
           (SELECT COUNT(*) FROM redemptions WHERE status = 'issued') AS "openVouchers"`,
      )
      .get<{
        users: number; businesses: number; activeBusinesses: number; members: number;
        purchases: number; volume: number; redemptions: number; openVouchers: number;
      }>()) ?? {
      users: 0, businesses: 0, activeBusinesses: 0, members: 0, purchases: 0, volume: 0, redemptions: 0, openVouchers: 0,
    };
  const { users, businesses, activeBusinesses, members, purchases, volume, redemptions, openVouchers } = stats;

  const recent = await db
    .prepare(
      `SELECT b.id, b.name, b.slug, b.status, b.category, b.city, b.created_at AS createdAt,
              (SELECT COUNT(*) FROM business_customers bc WHERE bc.business_id = b.id) AS members,
              (SELECT u.email FROM business_members bm JOIN users u ON u.id = bm.user_id
                WHERE bm.business_id = b.id AND bm.role = 'owner' LIMIT 1) AS ownerEmail
         FROM businesses b ORDER BY b.id DESC LIMIT 6`,
    )
    .all<{ id: number; name: string; slug: string; status: string; category: string; city: string | null; createdAt: string; members: number; ownerEmail: string | null }>();

  const audit = await db
    .prepare("SELECT a.id, a.action, a.entity, a.entity_id AS entityId, a.created_at AS createdAt, u.email AS actor FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 8")
    .all<{ id: number; action: string; entity: string; entityId: number | null; createdAt: string; actor: string | null }>();

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Platform</p>
        <h1 className="display text-[1.9rem] md:text-[2.2rem]">Repeato at a glance</h1>
        <p className="mt-1 text-[0.9rem] text-muted">Every figure is read live from the platform database.</p>
      </div>

      {query.ok ? <Alert kind="ok">{query.ok}</Alert> : null}
      {query.error ? <Alert kind="bad">{query.error}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Businesses" value={businesses} sub={`${activeBusinesses} active`} />
        <Stat label="Accounts" value={points(users)} sub={`${members} memberships`} />
        <Stat label="Verified purchases" value={points(purchases)} sub={`${money(volume)} recorded`} />
        <Stat label="Rewards redeemed" value={points(redemptions)} sub={`${openVouchers} vouchers open`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="card">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-[0.95rem] font-semibold">Newest businesses</h2>
            <Link href="/admin/businesses" className="text-[0.8rem] font-semibold text-brand hover:underline">Manage</Link>
          </div>
          {recent.length === 0 ? (
            <Empty title="No businesses yet">Businesses appear when someone completes owner onboarding.</Empty>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <caption className="sr-only">Newest businesses</caption>
                <thead><tr><th>Business</th><th>Owner</th><th className="text-right">Members</th><th>Status</th></tr></thead>
                <tbody>
                  {recent.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-[0.72rem] text-muted">{b.category}{b.city ? ` · ${b.city}` : ""} · {dateShort(b.createdAt)}</p>
                      </td>
                      <td className="max-w-[180px] truncate text-[0.8rem] text-muted">{b.ownerEmail ?? "—"}</td>
                      <td className="text-right">{b.members}</td>
                      <td><Pill kind={b.status === "active" ? "ok" : b.status === "pending" ? "warn" : "bad"}>{b.status}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-[0.95rem] font-semibold">Recent administrative actions</h2>
            <Link href="/admin/audit" className="text-[0.8rem] font-semibold text-brand hover:underline">All</Link>
          </div>
          {audit.length === 0 ? (
            <Empty title="No audit entries yet">Owner changes to rules, rewards and sales are recorded here.</Empty>
          ) : (
            <ul className="divide-y divide-[#f0e9de]">
              {audit.map((a) => (
                <li key={a.id} className="px-5 py-2.5">
                  <p className="text-[0.82rem]"><span className="font-mono text-[0.72rem] text-brand">{a.action}</span> <span className="text-muted">{a.entity} #{a.entityId ?? "—"}</span></p>
                  <p className="text-[0.72rem] text-muted">{a.actor ?? "system"} · {dateShort(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-[0.74rem] text-muted">
        Platform administrators can suspend businesses but cannot read a customer&apos;s private history from this console.
        That access stays with the business that owns the relationship.
      </p>
    </div>
  );
}
