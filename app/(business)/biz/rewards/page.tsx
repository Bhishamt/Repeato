import { Gift, Plus } from "lucide-react";
import { Alert, Empty, Field, Pill } from "@/components/ui";
import { consoleContext } from "@/lib/console";
import { getDb } from "@/lib/db";
import { createReward, toggleReward, updateReward } from "@/app/actions/business";
import { dateShort, points } from "@/lib/format";

export const metadata = { title: "Rewards" };

type Reward = {
  id: number;
  name: string;
  description: string | null;
  pointsCost: number;
  stock: number | null;
  perCustomerLimit: number | null;
  validUntil: string | null;
  active: number;
  redeemed: number;
  open: number;
};

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { business, role } = await consoleContext();
  const query = await searchParams;
  const db = getDb();
  const back = "/biz/rewards";

  const rewards = await db
    .prepare(
      `SELECT r.id, r.name, r.description, r.points_cost AS pointsCost, r.stock, r.per_customer_limit AS perCustomerLimit,
              r.valid_until AS validUntil, r.active,
              (SELECT COUNT(*) FROM redemptions rd WHERE rd.reward_id = r.id AND rd.status = 'redeemed') AS redeemed,
              (SELECT COUNT(*) FROM redemptions rd WHERE rd.reward_id = r.id AND rd.status = 'issued') AS open
         FROM rewards r WHERE r.business_id = ? ORDER BY r.active DESC, r.points_cost`,
    )
    .all<Reward>(business.id);

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Catalogue</p>
        <h1 className="display text-[1.8rem] md:text-[2.2rem]">Rewards</h1>
        <p className="mt-1 max-w-2xl text-[0.9rem] leading-relaxed text-muted">
          What members can spend points on. Costs are compared against each customer&apos;s real balance at redemption time.
        </p>
      </div>

      {query.ok ? <Alert kind="ok">{query.ok}</Alert> : null}
      {query.error ? <Alert kind="bad">{query.error}</Alert> : null}
      {role !== "owner" ? <Alert kind="info">Only the owner can edit rewards. You can still accept vouchers.</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="card">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-[0.95rem] font-semibold">Your catalogue</h2>
            <span className="text-[0.76rem] text-muted">{rewards.filter((r) => r.active).length} active</span>
          </div>
          {rewards.length === 0 ? (
            <Empty title="No rewards yet">Start with something simple: a free filter coffee at a reachable points cost.</Empty>
          ) : (
            <ul className="divide-y divide-[#f0e9de]">
              {rewards.map((r) => (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[0.95rem] font-semibold">{r.name}</h3>
                        {r.active ? <Pill kind="ok">active</Pill> : <Pill kind="muted">paused</Pill>}
                        {r.stock !== null ? <Pill kind={r.stock > 0 ? "brand" : "bad"}>{r.stock > 0 ? `${r.stock} left` : "out of stock"}</Pill> : null}
                      </div>
                      <p className="mt-0.5 text-[0.8rem] text-muted">
                        {points(r.pointsCost)} pts
                        {r.perCustomerLimit !== null ? ` · max ${r.perCustomerLimit} per customer` : ""}
                        {r.validUntil ? ` · until ${dateShort(r.validUntil)}` : ""}
                        {` · ${r.redeemed} redeemed`}
                        {r.open ? ` · ${r.open} open` : ""}
                      </p>
                      {r.description ? <p className="mt-1 text-[0.82rem] text-ink-soft">{r.description}</p> : null}
                    </div>
                    {role === "owner" ? (
                      <form action={toggleReward}>
                        <input type="hidden" name="businessId" value={business.id} />
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="back" value={back} />
                        <button className="btn btn-ghost btn-sm" type="submit">{r.active ? "Pause" : "Activate"}</button>
                      </form>
                    ) : null}
                  </div>

                  {role === "owner" ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer list-none text-[0.76rem] font-medium text-brand">Edit</summary>
                      <form action={updateReward} className="mt-3 grid gap-2 rounded-lg border border-line bg-paper p-3 sm:grid-cols-3">
                        <input type="hidden" name="businessId" value={business.id} />
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="back" value={back} />
                        <div><label className="label text-[0.72rem]" htmlFor={`rn-${r.id}`}>Name</label><input id={`rn-${r.id}`} name="name" className="input text-[0.84rem]" defaultValue={r.name} required /></div>
                        <div><label className="label text-[0.72rem]" htmlFor={`rc-${r.id}`}>Points</label><input id={`rc-${r.id}`} name="pointsCost" className="input text-[0.84rem]" defaultValue={r.pointsCost} inputMode="numeric" required /></div>
                        <div><label className="label text-[0.72rem]" htmlFor={`rd-${r.id}`}>Description</label><input id={`rd-${r.id}`} name="description" className="input text-[0.84rem]" defaultValue={r.description ?? ""} /></div>
                        <div className="sm:col-span-3"><button className="btn btn-primary btn-sm" type="submit">Save changes</button></div>
                      </form>
                      <p className="mt-1 text-[0.7rem] text-muted">Stock, limits and dates are set when a reward is created; existing vouchers keep the cost they were bought at.</p>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {role === "owner" ? (
          <form action={createReward} className="card card-pad h-fit">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold"><Gift size={15} className="text-copper" aria-hidden /> New reward</h2>
            <input type="hidden" name="businessId" value={business.id} />
            <input type="hidden" name="back" value={back} />
            <div className="mt-3">
              <Field label="Name" name="name" required placeholder="Free filter coffee" />
              <Field label="Points cost" name="pointsCost" required placeholder="500" inputMode="numeric" />
              <Field label="Description (optional)" name="description" placeholder="Any size, one per visit" />
              <Field label="Stock (optional)" name="stock" placeholder="Blank = unlimited" inputMode="numeric" />
              <Field label="Per-customer limit (optional)" name="perCustomerLimit" placeholder="Blank = no limit" inputMode="numeric" />
              <Field label="Valid until (optional)" name="validUntil" type="date" />
            </div>
            <button className="btn btn-primary btn-block btn-sm" type="submit"><Plus size={13} aria-hidden /> Create reward</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
