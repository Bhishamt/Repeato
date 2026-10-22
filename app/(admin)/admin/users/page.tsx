import { Search } from "lucide-react";
import { Empty, Pill } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dateShort } from "@/lib/format";

export const metadata = { title: "Users" };

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin("/admin/users");
  const query = await searchParams;
  const db = getDb();
  const term = (query.q || "").trim();

  const rows = await db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.created_at AS createdAt,
              (SELECT COUNT(*) FROM business_customers bc WHERE bc.user_id = u.id) AS wallets,
              (SELECT COUNT(*) FROM business_members bm WHERE bm.user_id = u.id) AS teams
         FROM users u
        ${term ? "WHERE u.name LIKE ? OR u.email LIKE ?" : ""}
        ORDER BY u.id DESC LIMIT 200`,
    )
    .all(...(term ? [`%${term}%`, `%${term}%`] : [])) as Array<{
    id: number; name: string; email: string; role: string; status: string; createdAt: string; wallets: number; teams: number;
  }>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Accounts</p>
          <h1 className="display text-[1.8rem] md:text-[2.2rem]">Users</h1>
          <p className="mt-1 text-[0.9rem] text-muted">
            One account can hold wallets and team memberships across several businesses. Roles shown here are account defaults.
          </p>
        </div>
        <form action="/admin/users" className="flex gap-2">
          <label htmlFor="q" className="sr-only">Search users</label>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input id="q" name="q" defaultValue={term} className="input h-9 w-52 py-1 pl-8 text-[0.82rem]" placeholder="Name or email" />
          </div>
          <button className="btn btn-ghost btn-sm" type="submit">Search</button>
        </form>
      </div>

      <section className="card">
        {rows.length === 0 ? (
          <Empty title="No accounts found">Try a different search.</Empty>
        ) : (
          <div className="table-wrap border-0">
            <table className="table">
              <caption className="sr-only">All user accounts</caption>
              <thead><tr><th>Person</th><th>Role</th><th className="text-right">Wallets</th><th className="text-right">Teams</th><th>Joined</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-[0.72rem] text-muted">{u.email}</p>
                    </td>
                    <td><Pill kind={u.role === "admin" ? "warn" : u.role === "customer" ? "muted" : "brand"}>{u.role}</Pill></td>
                    <td className="text-right">{u.wallets}</td>
                    <td className="text-right">{u.teams}</td>
                    <td className="whitespace-nowrap text-muted">{dateShort(u.createdAt)}</td>
                    <td><Pill kind={u.status === "active" ? "ok" : "bad"}>{u.status}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[0.74rem] text-muted">
        Personal data shown here is limited to account identity. Customer balances and purchase history are not exposed in this console.
      </p>
    </div>
  );
}
