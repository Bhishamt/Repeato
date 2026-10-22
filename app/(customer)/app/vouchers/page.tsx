import Link from "next/link";
import { CalendarClock, CheckCircle2, Ticket } from "lucide-react";
import { Alert, Empty, Pill } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dateTime, points } from "@/lib/format";

export const metadata = { title: "My vouchers" };

type Voucher = {
  id: number;
  token: string;
  status: "issued" | "redeemed" | "cancelled";
  pointsSpent: number;
  issuedAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  rewardName: string;
  rewardDescription: string | null;
  businessName: string;
  businessSlug: string;
};

export default async function VouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ issued?: string; msg?: string }>;
}) {
  const user = await requireUser("/app/vouchers");
  const query = await searchParams;
  const db = getDb();

  const vouchers = await db
    .prepare(
      `SELECT r.id, r.token, r.status, r.points_spent AS pointsSpent, r.issued_at AS issuedAt, r.expires_at AS expiresAt,
              r.redeemed_at AS redeemedAt, rw.name AS rewardName, rw.description AS rewardDescription,
              b.name AS businessName, b.slug AS businessSlug
         FROM redemptions r JOIN rewards rw ON rw.id = r.reward_id JOIN businesses b ON b.id = r.business_id
        WHERE r.customer_id = ? ORDER BY r.id DESC`,
    )
    .all<Voucher>(user.id);

  const active = vouchers.filter((v) => v.status === "issued");
  const past = vouchers.filter((v) => v.status !== "issued");

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Vouchers</p>
        <h1 className="display text-[1.9rem] md:text-[2.3rem]">Show this at the counter.</h1>
        <p className="mt-2 max-w-xl text-[0.9rem] leading-relaxed text-muted">
          Each voucher is a one-time code. Staff will check it on their side; after it is used the code stops working.
        </p>
      </div>

      {query.msg ? <Alert kind="ok">{query.msg}</Alert> : null}

      {active.length === 0 ? (
        <div className="card">
          <Empty title="No active vouchers">
            Redeem a reward and its code will appear here, ready to show at the counter.
          </Empty>
          <div className="flex justify-center pb-8"><Link href="/app/rewards" className="btn btn-primary">Browse rewards</Link></div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {active.map((v) => {
            const isNew = query.issued === v.token;
            const expired = v.expiresAt < new Date().toISOString().slice(0, 19).replace("T", " ");
            return (
              <article key={v.id} className={`card overflow-hidden ${isNew ? "ring-2 ring-brand/40" : ""}`}>
                <div className="flex items-center justify-between border-b border-dashed border-line bg-[#fffaf4] px-5 py-3">
                  <div>
                    <p className="mono text-[0.6rem]">{v.businessName}</p>
                    <h2 className="display text-[1.15rem] leading-tight">{v.rewardName}</h2>
                  </div>
                  <Pill kind={expired ? "bad" : isNew ? "ok" : "warn"}>{expired ? "expired" : isNew ? "just issued" : "ready"}</Pill>
                </div>
                <div className="px-5 py-5 text-center">
                  <p className="mono text-[0.6rem]">One-time code</p>
                  <p className="mt-2 font-mono text-[2rem] font-bold leading-none tracking-[0.28em] text-ink" aria-label={`Code ${v.token.split("").join(" ")}`}>
                    {v.token}
                  </p>
                  <p className="mt-3 text-[0.78rem] text-muted">{v.rewardDescription || "Show the code to a staff member."}</p>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-[0.74rem] text-muted">
                    <CalendarClock size={12} aria-hidden /> Expires {dateTime(v.expiresAt)}
                  </p>
                  <p className="mt-1 text-[0.72rem] text-muted">Paid {points(v.pointsSpent)} points</p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {past.length ? (
        <section className="card">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Ticket size={15} className="text-muted" aria-hidden />
            <h2 className="text-[0.95rem] font-semibold">Past vouchers</h2>
          </div>
          <ul className="divide-y divide-[#f0e9de]">
            {past.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div>
                  <p className="text-[0.88rem] font-semibold">{v.rewardName}</p>
                  <p className="text-[0.75rem] text-muted">
                    {v.businessName} · {v.status === "redeemed" ? `used ${dateTime(v.redeemedAt)}` : `issued ${dateTime(v.issuedAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.78rem] tracking-[0.14em] text-muted">{v.token}</span>
                  <Pill kind={v.status === "redeemed" ? "ok" : "muted"}>
                    {v.status === "redeemed" ? <><CheckCircle2 size={11} aria-hidden /> used</> : v.status}
                  </Pill>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
