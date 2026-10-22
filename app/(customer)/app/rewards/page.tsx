import Link from "next/link";
import { Check, Clock, Gift, Lock, Ticket } from "lucide-react";
import { Alert, Empty, Pill, Progress } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getBalance } from "@/lib/services";
import { redeem } from "@/app/actions/customer";
import { dateShort, points } from "@/lib/format";

export const metadata = { title: "Rewards" };

type Membership = {
  id: number;
  name: string;
  slug: string;
  brandColor: string;
  minRedeemPoints: number;
};

type Reward = {
  id: number;
  businessId: number;
  name: string;
  description: string | null;
  pointsCost: number;
  stock: number | null;
  perCustomerLimit: number | null;
  validUntil: string | null;
  used: number;
};

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string; msg?: string; error?: string }>;
}) {
  const user = await requireUser("/app/rewards");
  const query = await searchParams;
  const db = getDb();

  const memberships = db
    .prepare(
      `SELECT b.id, b.name, b.slug, b.brand_color AS brandColor, b.min_redeem_points AS minRedeemPoints
         FROM business_customers bc JOIN businesses b ON b.id = bc.business_id
        WHERE bc.user_id = ? AND b.status = 'active'
        ORDER BY b.name`,
    )
    .all(user.id) as Membership[];

  const selected = query.b ? memberships.find((m) => m.slug === query.b) : null;
  const shown = selected ? [selected] : memberships;

  const groups = shown.map((m) => {
    const balance = getBalance(db, m.id, user.id);
    const rewards = db
      .prepare(
        `SELECT r.id, r.business_id AS businessId, r.name, r.description, r.points_cost AS pointsCost, r.stock,
                r.per_customer_limit AS perCustomerLimit, r.valid_until AS validUntil,
                (SELECT COUNT(*) FROM redemptions rd WHERE rd.reward_id = r.id AND rd.customer_id = ? AND rd.status <> 'cancelled') AS used
           FROM rewards r
          WHERE r.business_id = ? AND r.active = 1
          ORDER BY r.points_cost ASC`,
      )
      .all(user.id, m.id) as Reward[];
    return { membership: m, balance, rewards };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Rewards</p>
          <h1 className="display text-[1.9rem] md:text-[2.3rem]">Spend your points.</h1>
          <p className="mt-2 max-w-xl text-[0.9rem] leading-relaxed text-muted">
            Redeem a reward and you will get a one-time code to show at the counter. Codes expire after 14 days.
          </p>
        </div>
        <Link href="/app/vouchers" className="btn btn-ghost btn-sm"><Ticket size={14} aria-hidden /> My vouchers</Link>
      </div>

      {query.msg ? <Alert kind="ok">{query.msg}</Alert> : null}
      {query.error ? <Alert kind="bad">{query.error}</Alert> : null}

      {memberships.length > 1 ? (
        <div className="scroll-x flex gap-2 pb-1">
          <Link href="/app/rewards" className={`pill ${selected ? "pill-muted" : "pill-brand"}`}>All cafés</Link>
          {memberships.map((m) => (
            <Link
              key={m.id}
              href={`/app/rewards?b=${m.slug}`}
              className={`pill whitespace-nowrap ${selected?.id === m.id ? "pill-brand" : "pill-muted"}`}
            >
              {m.name}
            </Link>
          ))}
        </div>
      ) : null}

      {memberships.length === 0 ? (
        <div className="card">
          <Empty title="Join a café first">
            Rewards are tied to the café that issued your points. Browse the directory to join one.
          </Empty>
          <div className="flex justify-center pb-8">
            <Link href="/app/businesses" className="btn btn-primary">Find a café</Link>
          </div>
        </div>
      ) : null}

      {groups.map(({ membership, balance, rewards }) => (
        <section key={membership.id} className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: membership.brandColor }} aria-hidden />
              <h2 className="display text-[1.2rem]">{membership.name}</h2>
            </div>
            <p className="text-[0.82rem] text-muted">
              <strong className="text-ink">{points(balance)}</strong> points available
            </p>
          </div>

          {rewards.length === 0 ? (
            <Empty title="No rewards published yet">This café is still setting up its catalogue. Your points keep accumulating.</Empty>
          ) : (
            <ul className="divide-y divide-[#f0e9de]">
              {rewards.map((reward) => {
                const expired = reward.validUntil ? reward.validUntil < new Date().toISOString().slice(0, 10) : false;
                const limitHit = reward.perCustomerLimit !== null && reward.used >= reward.perCustomerLimit;
                const outOfStock = reward.stock !== null && reward.stock <= 0;
                const belowMin = balance < membership.minRedeemPoints;
                const short = Math.max(0, reward.pointsCost - balance);
                const canRedeem = !expired && !limitHit && !outOfStock && !belowMin && short === 0;
                const blocker = expired
                  ? "Expired"
                  : outOfStock
                    ? "Out of stock"
                    : limitHit
                      ? "Limit reached"
                      : belowMin
                        ? `Redeem from ${points(membership.minRedeemPoints)} pts`
                        : short > 0
                          ? `${points(short)} points to go`
                          : null;

                return (
                  <li key={reward.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[0.98rem] font-semibold">{reward.name}</h3>
                        {canRedeem ? <Pill kind="ok"><Check size={11} aria-hidden /> Ready</Pill> : null}
                        {blocker && !canRedeem ? <Pill kind={expired || outOfStock ? "bad" : "muted"}>{blocker}</Pill> : null}
                      </div>
                      <p className="mt-1 text-[0.84rem] leading-relaxed text-ink-soft">
                        {reward.description || "Ask the counter for details."}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.74rem] text-muted">
                        <span className="inline-flex items-center gap-1"><Gift size={11} aria-hidden /> {points(reward.pointsCost)} pts</span>
                        {reward.stock !== null ? <span>{reward.stock} left</span> : null}
                        {reward.validUntil ? (
                          <span className="inline-flex items-center gap-1"><Clock size={11} aria-hidden /> until {dateShort(reward.validUntil)}</span>
                        ) : null}
                        {reward.perCustomerLimit !== null ? <span>limit {reward.used}/{reward.perCustomerLimit}</span> : null}
                      </div>
                      {!canRedeem && short > 0 ? (
                        <div className="mt-2 max-w-xs">
                          <Progress percent={Math.floor((balance / reward.pointsCost) * 100)} label={`Progress to ${reward.name}`} />
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0">
                      {canRedeem ? (
                        <form action={redeem}>
                          <input type="hidden" name="businessId" value={membership.id} />
                          <input type="hidden" name="rewardId" value={reward.id} />
                          <input type="hidden" name="back" value={`/app/rewards${selected ? `?b=${membership.slug}` : ""}`} />
                          <button className="btn btn-primary btn-sm" type="submit">Redeem</button>
                        </form>
                      ) : (
                        <span className="btn btn-ghost btn-sm pointer-events-none opacity-60" aria-hidden>
                          <Lock size={12} aria-hidden /> Redeem
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      <p className="text-center text-[0.76rem] text-muted">
        Points have no cash value and cannot be transferred between businesses.
      </p>
    </div>
  );
}
