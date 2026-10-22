import Link from "next/link";
import { ArrowRight, Gift, MapPin, Search } from "lucide-react";
import { Alert, Empty, Pill } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getBalance } from "@/lib/services";
import { joinFromDirectory } from "@/app/actions/customer";
import { money, points } from "@/lib/format";

export const metadata = { title: "Find a café" };

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; msg?: string; error?: string }>;
}) {
  const user = await requireUser("/app/businesses");
  const query = await searchParams;
  const db = getDb();
  const term = (query.q || "").trim();

  const rows = await db
    .prepare(
      `SELECT b.id, b.name, b.slug, b.category, b.city, b.description, b.brand_color AS brandColor,
              b.points_per_100 AS pointsPer100, b.signup_bonus AS signupBonus,
              EXISTS (SELECT 1 FROM business_customers bc WHERE bc.business_id = b.id AND bc.user_id = ?) AS isMember
         FROM businesses b
        WHERE b.status = 'active' AND (LOWER(b.name) LIKE LOWER(?) OR LOWER(b.city) LIKE LOWER(?) OR LOWER(b.category) LIKE LOWER(?))
        ORDER BY isMember DESC, b.name`,
    )
    .all<{
    id: number; name: string; slug: string; category: string; city: string | null; description: string | null;
    brandColor: string; pointsPer100: number; signupBonus: number; isMember: number;
  }>(user.id, `%${term}%`, `%${term}%`, `%${term}%`);

  const cards = [];
  for (const b of rows) {
    const balance = b.isMember ? await getBalance(db, b.id, user.id) : 0;
    const rewardCount =
      (await db
        .prepare("SELECT COUNT(*) AS n FROM rewards WHERE business_id = ? AND active = 1")
        .get<{ n: number }>(b.id))?.n ?? 0;
    cards.push({ ...b, balance, rewardCount });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Directory</p>
        <h1 className="display text-[1.9rem] md:text-[2.3rem]">Find a café to join.</h1>
        <p className="mt-2 max-w-xl text-[0.9rem] leading-relaxed text-muted">
          Each café runs its own programme with its own points. Joining takes a minute and is free.
        </p>
      </div>

      {query.msg ? <Alert kind="ok">{query.msg}</Alert> : null}
      {query.error ? <Alert kind="bad">{query.error}</Alert> : null}

      <form action="/app/businesses" className="flex gap-2">
        <label htmlFor="q" className="sr-only">Search cafés</label>
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input id="q" name="q" defaultValue={term} className="input pl-9" placeholder="Search by name, city or type" />
        </div>
        <button className="btn btn-ghost" type="submit">Search</button>
      </form>

      {cards.length === 0 ? (
        <div className="card">
          <Empty title="No cafés match that search">
            {term ? "Try a different name or clear the search." : "No businesses have opened a programme on Repeato yet. If you scanned a code, check the link with the counter."}
          </Empty>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {cards.map((b) => (
            <article key={b.id} className="card overflow-hidden">
              <div className="h-1" style={{ background: b.brandColor }} aria-hidden />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[1.05rem] font-semibold text-white"
                      style={{ background: b.brandColor }}
                      aria-hidden
                    >
                      {b.name.slice(0, 1)}
                    </span>
                    <div>
                      <h2 className="display text-[1.15rem] leading-tight">{b.name}</h2>
                      <p className="mt-0.5 flex items-center gap-1 text-[0.76rem] text-muted">
                        <MapPin size={11} aria-hidden /> {b.city || b.category}
                      </p>
                    </div>
                  </div>
                  {b.isMember ? <Pill kind="ok">Member</Pill> : null}
                </div>

                <p className="mt-3 line-clamp-2 text-[0.84rem] leading-relaxed text-ink-soft">
                  {b.description || `${b.category} running a points programme on Repeato.`}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.78rem] text-muted">
                  <span>{b.pointsPer100} pts per {money(10000)}</span>
                  <span>{b.rewardCount} reward{b.rewardCount === 1 ? "" : "s"}</span>
                  {b.signupBonus > 0 ? <span>{b.signupBonus} welcome points</span> : null}
                </div>

                {b.isMember ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2.5">
                    <div>
                      <p className="mono text-[0.6rem]">Your balance</p>
                      <p className="display text-[1.35rem] leading-none">{points(b.balance)}</p>
                    </div>
                    <Link href={`/app/rewards?b=${b.slug}`} className="btn btn-soft btn-sm">
                      <Gift size={13} aria-hidden /> Rewards <ArrowRight size={12} aria-hidden />
                    </Link>
                  </div>
                ) : (
                  <form action={joinFromDirectory} className="mt-4">
                    <input type="hidden" name="slug" value={b.slug} />
                    <button className="btn btn-primary btn-block" type="submit">
                      Join {b.name}{b.signupBonus > 0 ? ` · +${b.signupBonus} pts` : ""}
                    </button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="text-center text-[0.78rem] text-muted">
        Received a QR code from a café?{" "}
        <Link href="/how-it-works" className="link">See how joining works</Link>.
      </p>
    </div>
  );
}
