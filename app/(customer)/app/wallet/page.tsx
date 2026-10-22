import Link from "next/link";
import { ArrowRight, Info, Wallet } from "lucide-react";
import { Empty } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getBalance } from "@/lib/services";
import { dateTime, money, points } from "@/lib/format";

export const metadata = { title: "Points wallet" };

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const user = await requireUser("/app/wallet");
  const query = await searchParams;
  const db = getDb();

  const memberships = await db
    .prepare(
      `SELECT b.id, b.name, b.slug, b.brand_color AS brandColor, b.points_per_100 AS pointsPer100,
              b.min_purchase_paise AS minPurchasePaise, b.min_redeem_points AS minRedeemPoints,
              b.max_points_per_txn AS maxPointsPerTxn
         FROM business_customers bc JOIN businesses b ON b.id = bc.business_id
        WHERE bc.user_id = ? ORDER BY b.name`,
    )
    .all<{
    id: number; name: string; slug: string; brandColor: string; pointsPer100: number;
    minPurchasePaise: number; minRedeemPoints: number; maxPointsPerTxn: number;
  }>(user.id);

  const selected = query.b ? memberships.find((m) => m.slug === query.b) : null;
  const wallets = [];
  for (const m of memberships) {
    const balance = await getBalance(db, m.id, user.id);
    const earned =
      (await db
        .prepare("SELECT COALESCE(SUM(delta), 0) AS n FROM ledger WHERE business_id = ? AND customer_id = ? AND delta > 0")
        .get<{ n: number }>(m.id, user.id))?.n ?? 0;
    const spent =
      (await db
        .prepare("SELECT COALESCE(SUM(-delta), 0) AS n FROM ledger WHERE business_id = ? AND customer_id = ? AND delta < 0")
        .get<{ n: number }>(m.id, user.id))?.n ?? 0;
    wallets.push({ ...m, balance, earned, spent });
  }

  const entries = await db
    .prepare(
      `SELECT l.id, l.delta, l.kind, l.note, l.created_at AS createdAt, b.name AS businessName, b.slug AS businessSlug
         FROM ledger l JOIN businesses b ON b.id = l.business_id
        WHERE l.customer_id = ? ${selected ? "AND l.business_id = ?" : ""}
        ORDER BY l.id DESC LIMIT 40`,
    )
    .all<{
      id: number; delta: number; kind: string; note: string | null; createdAt: string; businessName: string; businessSlug: string;
    }>(...(selected ? [user.id, selected.id] : [user.id]));

  const total = wallets.reduce((sum, w) => sum + w.balance, 0);

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Wallet</p>
        <h1 className="display text-[1.9rem] md:text-[2.3rem]">{points(total)} points, {wallets.length} wallet{wallets.length === 1 ? "" : "s"}.</h1>
        <p className="mt-2 max-w-xl text-[0.9rem] leading-relaxed text-muted">
          Balances are kept separately per business. Every change comes from a recorded purchase, a redemption or an
          authorised adjustment — never from a browser.
        </p>
      </div>

      {wallets.length === 0 ? (
        <div className="card">
          <Empty title="Your wallet is empty">
            Join a café and its welcome points, then verified purchases, will show up here.
          </Empty>
          <div className="flex justify-center pb-8"><Link href="/app/businesses" className="btn btn-primary">Find a café</Link></div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {wallets.map((w) => (
            <article key={w.id} className="card card-pad">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: w.brandColor }} aria-hidden />
                  <h2 className="text-[0.95rem] font-semibold">{w.name}</h2>
                </div>
                <span className="mono text-[0.62rem]">{w.balance} pts</span>
              </div>
              <p className="display mt-3 text-[2.3rem] leading-none">{points(w.balance)}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[0.78rem]">
                <div><dt className="text-muted">Earned</dt><dd className="font-semibold text-brand">+{points(w.earned)}</dd></div>
                <div><dt className="text-muted">Redeemed / reversed</dt><dd className="font-semibold text-copper">−{points(w.spent)}</dd></div>
              </dl>
              <p className="mt-3 flex items-start gap-1.5 text-[0.74rem] leading-relaxed text-muted">
                <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
                {w.pointsPer100} pts per {money(10000)} spent · minimum {money(w.minPurchasePaise)} · redeem from {points(w.minRedeemPoints)}
              </p>
              <div className="mt-3 flex gap-2">
                <Link href={`/app/wallet?b=${w.slug}`} className="btn btn-ghost btn-sm"><Wallet size={13} aria-hidden /> Statement</Link>
                <Link href={`/app/rewards?b=${w.slug}`} className="btn btn-soft btn-sm">Redeem <ArrowRight size={12} aria-hidden /></Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {wallets.length ? (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
            <h2 className="text-[0.95rem] font-semibold">
              {selected ? `${selected.name} statement` : "Points ledger"}
            </h2>
            {selected ? <Link href="/app/wallet" className="text-[0.78rem] text-muted hover:text-ink">Show all wallets</Link> : null}
          </div>
          {entries.length ? (
            <div className="table-wrap border-0">
              <table className="table">
                <caption className="sr-only">Points ledger</caption>
                <thead>
                  <tr><th>When</th><th>Café</th><th>Type</th><th>Note</th><th className="text-right">Points</th></tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-muted">{dateTime(e.createdAt)}</td>
                      <td className="whitespace-nowrap">{e.businessName}</td>
                      <td><span className="pill pill-muted">{e.kind}</span></td>
                      <td className="text-ink-soft">{e.note || "—"}</td>
                      <td className={`text-right font-semibold ${e.delta > 0 ? "text-brand" : "text-copper"}`}>
                        {e.delta > 0 ? "+" : ""}{points(e.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No ledger entries yet">Points appear after the café records a verified purchase.</Empty>
          )}
          <div className="border-t border-line px-5 py-2.5 text-[0.72rem] text-muted">
            Showing the latest 40 entries. <Link href="/app/activity" className="link">Full activity</Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
