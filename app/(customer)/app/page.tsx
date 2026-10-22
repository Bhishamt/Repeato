import Link from "next/link";
import { ArrowRight, Gift, MapPin, QrCode, Sparkles } from "lucide-react";
import { Empty, Pill, Progress, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getBalance } from "@/lib/services";
import { dateTime, points } from "@/lib/format";
import { nextRewardProgress } from "@/lib/points";

export const metadata = { title: "My wallets" };

export default async function CustomerHome({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  const user = await requireUser("/app");
  const query = await searchParams;
  const db = getDb();

  const memberships = db
    .prepare(
      `SELECT b.id, b.name, b.slug, b.category, b.city, b.brand_color AS brandColor, b.points_per_100 AS pointsPer100,
              b.min_purchase_paise AS minPurchasePaise, b.signup_bonus AS signupBonus, b.min_redeem_points AS minRedeemPoints,
              b.max_points_per_txn AS maxPointsPerTxn, b.status, bc.joined_at AS joinedAt
         FROM business_customers bc JOIN businesses b ON b.id = bc.business_id
        WHERE bc.user_id = ? ORDER BY b.name`,
    )
    .all(user.id) as Array<{
    id: number; name: string; slug: string; category: string; city: string | null; brandColor: string;
    pointsPer100: number; minPurchasePaise: number; signupBonus: number; minRedeemPoints: number; maxPointsPerTxn: number;
    status: string; joinedAt: string;
  }>;

  const wallets = memberships.map((b) => {
    const balance = getBalance(db, b.id, user.id);
    const rewards = db
      .prepare("SELECT id, name, points_cost AS pointsCost FROM rewards WHERE business_id = ? AND active = 1 ORDER BY points_cost")
      .all(b.id) as Array<{ id: number; name: string; pointsCost: number }>;
    const issued = db
      .prepare("SELECT COUNT(*) AS n FROM redemptions WHERE business_id = ? AND customer_id = ? AND status = 'issued'")
      .get(b.id, user.id) as { n: number };
    return { ...b, balance, next: nextRewardProgress(balance, rewards), rewards, issued: issued.n };
  });

  const recent = db
    .prepare(
      `SELECT l.id, l.delta, l.kind, l.note, l.created_at AS createdAt, b.name AS businessName, b.slug AS businessSlug
         FROM ledger l JOIN businesses b ON b.id = l.business_id
        WHERE l.customer_id = ? ORDER BY l.id DESC LIMIT 8`,
    )
    .all(user.id) as Array<{ id: number; delta: number; kind: string; note: string | null; createdAt: string; businessName: string; businessSlug: string }>;

  const vouchers = db
    .prepare(
      `SELECT r.token, r.expires_at AS expiresAt, rw.name AS rewardName, b.name AS businessName
         FROM redemptions r JOIN rewards rw ON rw.id = r.reward_id JOIN businesses b ON b.id = r.business_id
        WHERE r.customer_id = ? AND r.status = 'issued' ORDER BY r.id DESC LIMIT 3`,
    )
    .all(user.id) as Array<{ token: string; expiresAt: string; rewardName: string; businessName: string }>;

  const totalPoints = wallets.reduce((sum, w) => sum + w.balance, 0);
  const totalRedeemed = db
    .prepare("SELECT COALESCE(SUM(-delta), 0) AS n FROM ledger WHERE customer_id = ? AND kind = 'redeem'")
    .get(user.id) as { n: number };
  const visits = db
    .prepare("SELECT COUNT(*) AS n FROM purchases WHERE customer_id = ? AND status = 'verified'")
    .get(user.id) as { n: number };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Your wallet</p>
          <h1 className="display text-[1.9rem] md:text-[2.3rem]">Hello, {user.name.split(" ")[0]}.</h1>
          <p className="mt-1 text-[0.88rem] text-muted">
            {wallets.length ? `${wallets.length} café${wallets.length > 1 ? "s" : ""} · points stay with the café that issued them.` : "Join a café to start earning."}
          </p>
        </div>
        <Link href="/app/businesses" className="btn btn-ghost btn-sm"><QrCode size={15} aria-hidden /> Find a café</Link>
      </div>

      {query.msg ? <div className="rounded-lg border border-[#cbe3d4] bg-[#edf6f0] px-3 py-2 text-[0.84rem] text-[#1d5c3f]">{query.msg}</div> : null}
      {query.error ? <div className="rounded-lg border border-[#f0d1cb] bg-[#fdf0ee] px-3 py-2 text-[0.84rem] text-[#8f2f24]">{query.error}</div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Points in wallet" value={points(totalPoints)} sub="across all cafés" />
        <Stat label="Cafés joined" value={wallets.length} sub="separate balances" />
        <Stat label="Verified visits" value={visits.n} sub="all time" />
        <Stat label="Points redeemed" value={points(totalRedeemed.n)} sub="turned into rewards" />
      </div>

      {vouchers.length ? (
        <section className="card card-pad border-copper/30 bg-[#fffaf4]">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-copper" aria-hidden />
            <h2 className="text-[0.95rem] font-semibold">Ready to use</h2>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {vouchers.map((v) => (
              <li key={v.token} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5">
                <div>
                  <p className="text-[0.86rem] font-semibold">{v.rewardName}</p>
                  <p className="text-[0.74rem] text-muted">{v.businessName} · expires {dateTime(v.expiresAt)}</p>
                </div>
                <span className="rounded-md bg-ink px-2.5 py-1 font-mono text-[0.8rem] tracking-[0.14em] text-paper">{v.token}</span>
              </li>
            ))}
          </ul>
          <Link href="/app/vouchers" className="link mt-3 inline-block text-[0.82rem]">All vouchers <ArrowRight size={12} className="inline" aria-hidden /></Link>
        </section>
      ) : null}

      {wallets.length === 0 ? (
        <div className="card">
          <Empty title="No loyalty wallets yet">
            Scan the QR code at a participating café, or browse the directory and join one here. Your first wallet takes
            about a minute.
          </Empty>
          <div className="flex justify-center pb-8">
            <Link href="/app/businesses" className="btn btn-primary">Browse cafés</Link>
          </div>
        </div>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="display text-[1.35rem]">Your cafés</h2>
            <Link href="/app/rewards" className="text-[0.82rem] font-semibold text-brand hover:underline">All rewards</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {wallets.map((w) => (
              <article key={w.id} className="card overflow-hidden">
                <div className="h-1" style={{ background: w.brandColor }} aria-hidden />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="display text-[1.2rem] leading-tight">{w.name}</h3>
                      <p className="mt-0.5 flex items-center gap-1 text-[0.76rem] text-muted">
                        <MapPin size={11} aria-hidden /> {w.city || w.category}
                        {w.status !== "active" ? <Pill kind="bad">paused</Pill> : null}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="display text-[1.8rem] leading-none">{points(w.balance)}</p>
                      <p className="mono text-[0.6rem]">points</p>
                    </div>
                  </div>

                  {w.next ? (
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between text-[0.78rem]">
                        <span className="text-ink-soft">{w.next.ready ? `${w.next.reward.name} unlocked` : `Next: ${w.next.reward.name}`}</span>
                        <span className="text-muted">{w.next.ready ? "Ready" : `${points(w.next.remaining)} to go`}</span>
                      </div>
                      <div className="mt-1.5"><Progress percent={w.next.percent} label={`Progress to ${w.next.reward.name}`} /></div>
                    </div>
                  ) : (
                    <p className="mt-4 text-[0.8rem] text-muted">No rewards published yet. Points keep accumulating.</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Link href={`/app/rewards?b=${w.slug}`} className="btn btn-soft btn-sm"><Gift size={13} aria-hidden /> Redeem</Link>
                    <Link href={`/app/wallet?b=${w.slug}`} className="btn btn-ghost btn-sm">Balance</Link>
                    <Link href={`/app/activity?b=${w.slug}`} className="btn btn-ghost btn-sm">History</Link>
                    {w.issued > 0 ? <span className="pill pill-warn self-center">{w.issued} voucher{w.issued > 1 ? "s" : ""} to use</span> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-[0.95rem] font-semibold">Recent points activity</h2>
          <Link href="/app/activity" className="text-[0.8rem] font-semibold text-brand hover:underline">View all</Link>
        </div>
        {recent.length ? (
          <div className="table-wrap border-0">
            <table className="table">
              <caption className="sr-only">Recent points activity</caption>
              <thead><tr><th>When</th><th>Café</th><th>Activity</th><th className="text-right">Points</th></tr></thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap text-muted">{dateTime(row.createdAt)}</td>
                    <td>{row.businessName}</td>
                    <td className="text-ink-soft">{row.note || row.kind}<span className="ml-2 pill pill-muted">{row.kind}</span></td>
                    <td className={`text-right font-semibold ${row.delta > 0 ? "text-brand" : "text-copper"}`}>
                      {row.delta > 0 ? "+" : ""}{points(row.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No activity yet">Ask the counter to record your first purchase — points appear here immediately.</Empty>
        )}
      </section>
    </div>
  );
}
