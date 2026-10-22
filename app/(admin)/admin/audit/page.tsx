import { Empty } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  await requireAdmin("/admin/audit");
  const rows = await getDb()
    .prepare(
      `SELECT a.id, a.action, a.entity, a.entity_id AS entityId, a.meta, a.created_at AS createdAt,
              u.email AS actor, b.name AS businessName
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.actor_id
         LEFT JOIN businesses b ON b.id = a.business_id
        ORDER BY a.id DESC LIMIT 200`,
    )
    .all<{
    id: number; action: string; entity: string; entityId: number | null; meta: string | null; createdAt: string;
    actor: string | null; businessName: string | null;
  }>();

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Accountability</p>
        <h1 className="display text-[1.8rem] md:text-[2.2rem]">Audit log</h1>
        <p className="mt-1 max-w-2xl text-[0.9rem] leading-relaxed text-muted">
          Owner changes to rules, prices, rewards, staff and sales, plus platform suspensions. Entries are append-only
          and show the latest 200.
        </p>
      </div>

      <section className="card">
        {rows.length === 0 ? (
          <Empty title="Nothing recorded yet">Actions appear here as owners and administrators make changes.</Empty>
        ) : (
          <ol className="divide-y divide-[#f0e9de]">
            {rows.map((row) => (
              <li key={row.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[0.86rem]">
                    <span className="font-mono text-[0.76rem] font-semibold text-brand">{row.action}</span>{" "}
                    <span className="text-muted">{row.entity}{row.entityId ? ` #${row.entityId}` : ""}</span>
                    {row.businessName ? <span className="text-ink-soft"> · {row.businessName}</span> : null}
                  </p>
                  <time className="text-[0.72rem] text-muted" dateTime={row.createdAt}>{dateTime(row.createdAt)}</time>
                </div>
                <p className="mt-0.5 text-[0.72rem] text-muted">{row.actor ?? "system"}</p>
                {row.meta ? <pre className="mt-1 overflow-x-auto text-[0.68rem] text-muted">{row.meta}</pre> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
