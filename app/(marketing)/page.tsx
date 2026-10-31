import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Gift,
  LineChart,
  QrCode,
  Repeat2,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import { SectionTitle } from "@/components/ui";

export const metadata = {
  title: "Repeato — QR loyalty for cafes and restaurants",
  description:
    "Turn first-time visitors into regulars. Customers scan a QR code, join in seconds, and earn points on purchases your staff verify.",
};

const steps = [
  {
    n: "01",
    title: "Scan at the counter",
    body: "A single QR code on the counter opens your café's page. No app store, no plastic card, no forms at the till.",
    icon: ScanLine,
  },
  {
    n: "02",
    title: "Join in seconds",
    body: "The customer joins with an email and password, and their welcome points land immediately. They are a member, not a receipt.",
    icon: Users,
  },
  {
    n: "03",
    title: "Staff verify the bill",
    body: "Points are awarded only when your team records or confirms the purchase. A scan alone never earns anything.",
    icon: BadgeCheck,
  },
  {
    n: "04",
    title: "Rewards bring them back",
    body: "Points become a free coffee, a dessert, a discount. The customer returns with a reason, and you see it in your dashboard.",
    icon: Gift,
  },
];

const features = [
  {
    icon: QrCode,
    title: "One QR per business",
    body: "A clean, printable code that always points at the right café. Download it, print it, put it on the counter.",
  },
  {
    icon: Wallet,
    title: "Per-business wallets",
    body: "Customers can belong to several cafés. Points stay with the business that issued them — no accidental cross-spend.",
  },
  {
    icon: ShieldCheck,
    title: "Verified purchases only",
    body: "Every point is tied to a purchase your staff recorded, with an auditable ledger and one-time idempotency keys.",
  },
  {
    icon: Store,
    title: "Menu-aware earning",
    body: "Set points per ₹100, or give a specific product its own points value. The engine never counts the same rupee twice.",
  },
  {
    icon: BarChart3,
    title: "Retention you can read",
    body: "Members, returning customers, points issued and redeemed, redemptions completed — all from real activity.",
  },
  {
    icon: Smartphone,
    title: "Built for the phone",
    body: "The customer experience is mobile-first because that is where the QR code lands. The owner console works everywhere too.",
  },
];

const faqs = [
  {
    q: "Do customers need to download an app?",
    a: "No. The QR code opens a mobile web page. They sign in once and their wallet is available from any browser.",
  },
  {
    q: "Does scanning the QR code add points?",
    a: "Never. Scanning identifies the business and lets someone join. Points are issued only after your staff records a verified purchase.",
  },
  {
    q: "Do I need a POS integration?",
    a: "No. Staff enter the bill total — and optionally the items — in the Repeato console. A POS integration is a future option, not a requirement.",
  },
  {
    q: "Can two cafés share a customer?",
    a: "Yes. A customer can join several businesses with one account. Each business has its own balance, rewards, and rules.",
  },
  {
    q: "How do you stop duplicate points?",
    a: "Each sale carries a one-time key. The database rejects a second record of the same sale, and every balance change is a ledger entry.",
  },
  {
    q: "What does it cost?",
    a: "Repeato is in an early pilot. Pricing below is illustrative so you can see the shape of the plans; nothing is charged until a plan is agreed.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="aura -left-28 -top-8 h-72 w-72 bg-brand-soft/80" aria-hidden />
        <div className="aura -right-24 top-20 h-80 w-80 bg-copper-soft/80" aria-hidden />
        <div className="wrap relative grid items-center gap-14 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24">
          <div className="fade-up">
            <p className="eyebrow mb-4">Customer loyalty for cafés & restaurants</p>
            <h1 className="display max-w-[17ch] hyphens-none text-[2.4rem] leading-[1.06] sm:text-[3rem] md:text-[3.4rem]">
              Turn first-time visitors into regulars.
            </h1>
            <p className="mt-6 max-w-lg text-[1.02rem] leading-relaxed text-ink-soft">
              Repeato puts loyalty where your customers already are — on the counter. They scan your QR code, join in
              seconds, and earn points on purchases your staff verify. Then they come back for the reward.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn btn-primary">
                Start with your café <ArrowRight size={16} aria-hidden />
              </Link>
              <Link href="/how-it-works" className="btn btn-ghost">
                See how it works
              </Link>
            </div>
            <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.78rem] text-muted">
              <span className="inline-flex items-center gap-1.5"><Smartphone size={13} aria-hidden /> No app to install</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} aria-hidden /> Points only after verification</span>
              <span className="inline-flex items-center gap-1.5"><Repeat2 size={13} aria-hidden /> Multi-business by design</span>
            </p>
          </div>

          {/* Product preview */}
          <div className="fade-up fade-up-2 relative">
            <p className="mono mb-3 text-right">Illustrative product preview</p>
            <div className="relative mx-auto w-full max-w-[380px]">
              <div className="absolute -inset-3 -rotate-2 rounded-[22px] border border-line bg-paper-deep" aria-hidden />
              <div className="relative rounded-[20px] border border-line bg-white p-5 shadow-[0_24px_60px_-30px_rgba(23,19,15,0.35)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand-deep">
                      <Store size={15} aria-hidden />
                    </span>
                    <div>
                      <p className="text-[0.82rem] font-semibold leading-tight">Bluebird Coffee</p>
                      <p className="text-[0.7rem] text-muted">Indiranagar · Member since March</p>
                    </div>
                  </div>
                  <span className="pill pill-brand">Member</span>
                </div>

                <div className="mt-5 rounded-xl bg-ink p-4 text-paper">
                  <p className="text-[0.62rem] uppercase tracking-[0.16em] opacity-60">Your points</p>
                  <p className="mt-1 flex items-end gap-1.5">
                    <span className="display text-[2.4rem] leading-none">650</span>
                    <span className="pb-1 text-[0.7rem] opacity-60">pts</span>
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <span className="block h-full w-[65%] rounded-full bg-[#e6b06a]" />
                  </div>
                  <p className="mt-2 text-[0.7rem] opacity-70">350 points to a free brunch</p>
                </div>

                <ul className="mt-4 divide-y divide-[#f0e9de] text-[0.82rem]">
                  <li className="flex items-center justify-between py-2.5">
                    <span className="text-ink-soft">Filter coffee + croissant</span>
                    <span className="font-semibold">+45</span>
                  </li>
                  <li className="flex items-center justify-between py-2.5">
                    <span className="text-ink-soft">Reward redeemed</span>
                    <span className="font-semibold text-copper">−150</span>
                  </li>
                </ul>

                <div className="mt-4 rounded-lg border border-dashed border-line bg-paper p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.82rem] font-semibold">Free filter coffee</p>
                    <p className="mono">150 pts</p>
                  </div>
                  <p className="mt-1 text-[0.72rem] text-muted">Ready to redeem at the counter</p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-[0.7rem] text-muted">
              Example data. Your dashboard shows only your business&apos;s real activity.
            </p>
          </div>
        </div>
      </section>

      {/* THREE STEPS */}
      <section className="wrap py-20 md:py-28">
        <SectionTitle
          eyebrow="The loop"
          title="One scan. One verified bill. A reason to return."
          intro="Repeato is deliberately small at the counter and deliberate everywhere else. The customer does one thing; your team does one thing."
        />
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["Scan", "The QR code opens your business page with your name, rewards, and joining terms."],
            ["Verify", "Staff record the bill. The server calculates points from your rules and writes the ledger."],
            ["Return", "The customer sees the balance grow and redeems a reward the next time they visit."],
          ].map(([title, body], i) => (
            <li key={title} className="card card-pad fade-up" style={{ animationDelay: `${i * 70}ms` }}>
              <p className="mono">Step {i + 1}</p>
              <h3 className="display mt-2 text-[1.4rem]">{title}</h3>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-soft">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* TWO AUDIENCES */}
      <section className="border-y border-line bg-[#f5efe5]">
        <div className="wrap grid gap-4 py-16 md:grid-cols-2 md:py-20">
          <div className="card card-pad">
            <span className="pill pill-brand">For customers</span>
            <h2 className="display mt-4 text-[1.8rem]">A wallet that makes sense.</h2>
            <ul className="mt-5 space-y-3 text-[0.92rem] text-ink-soft">
              {[
                "One account, several cafés, a separate balance for each.",
                "See exactly how many points you have and what they unlock.",
                "Redeem with a one-time code your café verifies at the counter.",
                "History you can check: purchases, points, and redemptions.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-copper" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/join/bluebird-coffee" className="btn btn-ghost mt-6">
              See a live café page
            </Link>
          </div>
          <div className="card card-pad">
            <span className="pill pill-warn">For café owners</span>
            <h2 className="display mt-4 text-[1.8rem]">A loyalty programme you can run.</h2>
            <ul className="mt-5 space-y-3 text-[0.92rem] text-ink-soft">
              {[
                "Set points per ₹100, welcome bonus, and redemption minimum.",
                "Add your menu, give products their own points, keep prices exact.",
                "Staff record sales; owners see the numbers and can reverse mistakes.",
                "No POS migration, no hardware, no long contract to start.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <LineChart size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/for-businesses" className="btn btn-primary mt-6">
              Explore the owner console
            </Link>
          </div>
        </div>
      </section>

      {/* DASHBOARD PREVIEW */}
      <section className="wrap py-20 md:py-28">
        <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-center">
          <div>
            <SectionTitle
              eyebrow="Owner console"
              title="The numbers behind the queue."
              intro="Members, repeat visits, points issued, rewards redeemed. Calculated from the same ledger your customers see — never a separate spreadsheet."
            />
            <div className="mt-6 space-y-3 text-[0.9rem] text-ink-soft">
              {[
                ["Returning customers", "Anyone with two or more verified purchases in the period."],
                ["Points issued vs redeemed", "The health of your programme at a glance."],
                ["Redemption queue", "Codes waiting to be checked at the counter."],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-3">
                  <BadgeCheck size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                  <p><strong className="text-ink">{t}.</strong> {d}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <p className="mono">Overview · illustrative</p>
              <span className="pill pill-muted">Last 30 days</span>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
              {[
                ["Members", "128"],
                ["Returning", "46"],
                ["Points issued", "3,240"],
                ["Redeemed", "18"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="mono text-[0.6rem]">{label}</p>
                  <p className="display mt-1 text-[1.5rem]">{value}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-line px-5 py-4">
              <div className="flex h-24 items-end gap-1.5" aria-hidden>
                {[28, 34, 30, 46, 52, 44, 62, 58, 70, 66, 78, 86].map((h, i) => (
                  <span key={i} className="flex-1 rounded-t bg-brand/80" style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[0.65rem] text-muted">
                <span>Week 1</span>
                <span>Week 12</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STEPS DETAIL */}
      <section className="border-t border-line bg-white">
        <div className="wrap py-20 md:py-28">
          <SectionTitle eyebrow="How it works" title="From the counter sticker to the repeat visit." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ n, title, body, icon: Icon }) => (
              <div key={n} className="card-quiet p-5">
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand-deep">
                    <Icon size={17} aria-hidden />
                  </span>
                  <span className="mono">{n}</span>
                </div>
                <h3 className="display mt-4 text-[1.18rem]">{title}</h3>
                <p className="mt-2 text-[0.87rem] leading-relaxed text-ink-soft">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="wrap py-20 md:py-28">
        <SectionTitle eyebrow="What's inside" title="Small surface, real substance." />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card card-pad">
              <Icon size={19} className="text-brand" aria-hidden />
              <h3 className="mt-3 text-[1.02rem] font-semibold">{title}</h3>
              <p className="mt-1.5 text-[0.87rem] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PILOT / PRICING TEASER */}
      <section className="border-y border-line bg-[#f5efe5]">
        <div className="wrap grid gap-8 py-16 md:grid-cols-2 md:items-center md:py-20">
          <SectionTitle
            eyebrow="Early access"
            title="Start with one café. Grow on evidence."
            intro="We are onboarding a small number of cafés directly. You get the full product — QR code, customer wallets, staff console, analytics — without a POS project."
          />
          <div className="card card-pad">
            <div className="flex items-baseline justify-between">
              <p className="display text-[1.5rem]">Pilot</p>
              <p className="mono">Illustrative</p>
            </div>
            <p className="mt-2 text-sm text-muted">For a single-location café getting its first loyalty loop running.</p>
            <ul className="mt-4 space-y-2 text-[0.9rem] text-ink-soft">
              <li>Unlimited members and rewards</li>
              <li>Owner + staff accounts</li>
              <li>Verified purchase ledger</li>
              <li>Analytics and redemption console</li>
            </ul>
            <Link href="/pricing" className="btn btn-ghost btn-block mt-5">
              See the pricing approach
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="wrap py-20 md:py-28">
        <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
          <SectionTitle eyebrow="Questions" title="The things owners ask first." />
          <div className="divide-y divide-line border-y border-line">
            {faqs.map(({ q, a }) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[0.95rem] font-semibold">
                  {q}
                  <span className="text-muted transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-2 pr-6 text-[0.9rem] leading-relaxed text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="wrap pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-14 text-paper md:px-14">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand/40 blur-3xl" aria-hidden />
          <div className="relative max-w-2xl">
            <p className="eyebrow" style={{ color: "#e6b06a" }}>Ready when you are</p>
            <h2 className="display mt-3 text-[2.2rem] leading-tight md:text-[2.8rem]">Put loyalty on the counter this week.</h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-paper/75">
              Create your café, set your points rule, print one QR code. Your first members can join the same day.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-accent">
                Create your café <ArrowRight size={16} aria-hidden />
              </Link>
              <Link href="/contact" className="btn" style={{ borderColor: "rgba(251,247,241,0.28)", color: "#fbf7f1" }}>
                Talk to us first
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
