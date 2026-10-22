import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, Gift, QrCode, ScanLine, Wallet } from "lucide-react";
import { Alert, Pill, Wordmark } from "@/components/ui";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getBusinessBySlug, getBalance, isCustomerOf, rulesFor } from "@/lib/services";
import { money, points } from "@/lib/format";
import { nextRewardProgress } from "@/lib/points";
import { joinFromQr } from "@/app/actions/customer";

type Reward = { id: number; name: string; description: string | null; pointsCost: number; stock: number | null; validUntil: string | null };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getBusinessBySlug(getDb(), slug);
  return { title: business ? `Join ${business.name}` : "Join a business" };
}

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ joined?: string; bonus?: string; error?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const db = getDb();
  const business = await getBusinessBySlug(db, slug);
  if (!business) notFound();

  const user = await getSessionUser();
  const rules = rulesFor(business);
  const rewards = await db
    .prepare(
      `SELECT id, name, description, points_cost AS pointsCost, stock, valid_until AS validUntil
         FROM rewards WHERE business_id = ? AND active = 1 ORDER BY points_cost ASC`,
    )
    .all<Reward>(business.id);
  const joined = user ? await isCustomerOf(db, business.id, user.id) : false;
  const balance = user && joined ? await getBalance(db, business.id, user.id) : 0;
  const next = nextRewardProgress(balance, rewards.map((r) => ({ id: r.id, name: r.name, pointsCost: r.pointsCost })));
  const isTeam = user ? await db.prepare("SELECT role FROM business_members WHERE user_id = ? AND business_id = ?").get(user.id, business.id) : null;

  if (business.status === "suspended") {
    return (
      <Shell>
        <div className="card card-pad mx-auto max-w-lg text-center">
          <Pill kind="bad">Unavailable</Pill>
          <h1 className="display mt-4 text-[1.8rem]">{business.name} is not accepting members.</h1>
          <p className="mt-2 text-[0.9rem] text-muted">The loyalty programme is paused. Existing members can still sign in to view their wallet.</p>
          <Link href="/app" className="btn btn-ghost mt-5">Open my wallet</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto w-full max-w-2xl">
        <div className="card overflow-hidden">
          <div className="h-1.5" style={{ background: business.brandColor }} aria-hidden />
          <div className="p-5 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl text-[1.2rem] font-semibold text-white" style={{ background: business.brandColor }} aria-hidden>
                  {business.name.slice(0, 1)}
                </span>
                <div>
                  <p className="mono">{business.category} · {business.city || "Local"}</p>
                  <h1 className="display text-[1.6rem] leading-tight">{business.name}</h1>
                </div>
              </div>
              <span className="pill pill-brand"><ScanLine size={12} aria-hidden /> Scanned</span>
            </div>

            <p className="mt-4 text-[0.92rem] leading-relaxed text-ink-soft">
              {business.description || `${business.name} runs its loyalty programme on Repeato. Join once, then earn points every time you visit.`}
            </p>

            <div className="mt-4 grid gap-2 rounded-xl border border-line bg-paper p-4 text-[0.84rem] sm:grid-cols-3">
              <Rule icon={Wallet} label="Earning" value={`${rules.pointsPer100} pts per ${money(10000)}`} />
              <Rule icon={Gift} label="Welcome" value={rules.signupBonus ? `+${rules.signupBonus} pts` : "No bonus"} />
              <Rule icon={BadgeCheck} label="Redeem from" value={`${rules.minRedeemPoints} pts`} />
            </div>

            {query.joined === "1" ? (
              <div className="mt-4">
                <Alert kind="ok">
                  You&apos;re in. {Number(query.bonus) > 0 ? `${query.bonus} welcome points were added to your wallet.` : "Your wallet is ready."}
                </Alert>
              </div>
            ) : null}
            {query.joined === "0" ? (
              <div className="mt-4"><Alert kind="info">You were already a member — no duplicate bonus was added.</Alert></div>
            ) : null}
            {query.error ? <div className="mt-4"><Alert kind="bad">{query.error}</Alert></div> : null}

            {user && joined ? (
              <div className="mt-5 rounded-xl bg-ink p-4 text-paper">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[0.62rem] uppercase tracking-[0.16em] opacity-60">Your balance here</p>
                    <p className="display mt-1 text-[2.1rem] leading-none">{points(balance)}</p>
                  </div>
                  <Link href={`/app/rewards?b=${business.slug}`} className="btn btn-accent btn-sm">Redeem <ArrowRight size={14} aria-hidden /></Link>
                </div>
                {next ? (
                  <div className="mt-4">
                    <div className="flex justify-between text-[0.75rem] opacity-80">
                      <span>Next: {next.reward.name}</span>
                      <span>{next.ready ? "Ready" : `${points(next.remaining)} pts to go`}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                      <span className="block h-full rounded-full bg-[#e6b06a]" style={{ width: `${next.percent}%` }} />
                    </div>
                  </div>
                ) : null}
                <p className="mt-3 text-[0.7rem] opacity-60">Points are added when staff record your purchase at the counter.</p>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-line bg-white p-4">
                <h2 className="text-[0.95rem] font-semibold">
                  {user ? "Join this loyalty programme" : "Join in about a minute"}
                </h2>
                <p className="mt-1 text-[0.84rem] leading-relaxed text-muted">
                  {isTeam
                    ? "You are on this business's team. You can join as a customer too, or open the console."
                    : "One account works for every café you visit. Welcome points are added immediately — purchase points need staff verification."}
                </p>
                <form action={joinFromQr} className="mt-4">
                  <input type="hidden" name="slug" value={business.slug} />
                  <button className="btn btn-primary btn-block" type="submit">
                    {user ? `Join ${business.name}` : "Create an account and join"}
                  </button>
                </form>
                {!user ? (
                  <p className="mt-3 text-center text-[0.8rem] text-muted">
                    Already have an account?{" "}
                    <Link href={`/login?next=${encodeURIComponent(`/join/${business.slug}`)}`} className="link">Sign in</Link>
                  </p>
                ) : null}
                {isTeam ? (
                  <p className="mt-2 text-center text-[0.78rem] text-muted">
                    <Link href="/biz" className="link">Open the business console</Link>
                  </p>
                ) : null}
              </div>
            )}

            <p className="mt-4 flex items-start gap-2 text-[0.75rem] leading-relaxed text-muted">
              <QrCode size={14} className="mt-0.5 shrink-0" aria-hidden />
              A scan only identifies the business. Points require a staff-recorded, verified purchase.
            </p>
          </div>
        </div>

        {rewards.length ? (
          <div className="card card-pad mt-4">
            <div className="flex items-center justify-between">
              <h2 className="display text-[1.25rem]">Rewards here</h2>
              <p className="mono">{rewards.length} active</p>
            </div>
            <ul className="mt-3 divide-y divide-[#f0e9de]">
              {rewards.map((reward) => (
                <li key={reward.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-[0.9rem] font-semibold">{reward.name}</p>
                    <p className="text-[0.78rem] text-muted">
                      {reward.description || "Ask at the counter"}{reward.stock !== null ? ` · ${reward.stock} left` : ""}
                    </p>
                  </div>
                  <span className="pill pill-muted shrink-0">{points(reward.pointsCost)} pts</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {user && joined ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/app" className="btn btn-ghost btn-sm">My wallets</Link>
            <Link href="/app/rewards" className="btn btn-ghost btn-sm">All rewards</Link>
            <Link href={`/app/activity?b=${business.slug}`} className="btn btn-ghost btn-sm">My history here</Link>
          </div>
        ) : null}

        <p className="mt-6 text-center text-[0.72rem] text-muted">
          Powered by Repeato · Points have no cash value · <Link href="/privacy" className="underline">Privacy</Link>
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-paper/90 backdrop-blur">
        <div className="wrap flex h-16 items-center justify-between">
          <Wordmark />
          <Link href="/app" className="text-[0.82rem] font-medium text-ink-soft hover:text-ink">My wallet</Link>
        </div>
      </header>
      <main id="main" className="wrap py-6 sm:py-10">{children}</main>
    </div>
  );
}

function Rule({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={16} className="text-brand" aria-hidden />
      <div>
        <p className="mono text-[0.6rem]">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}
