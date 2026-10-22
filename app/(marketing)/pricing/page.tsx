import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { SectionTitle } from "@/components/ui";

export const metadata = {
  title: "Pricing",
  description: "Repeato's early-access pricing approach. Illustrative plans while the pilot is being shaped.",
};

const plans = [
  {
    name: "Counter",
    price: "Free",
    cadence: "during pilot",
    blurb: "One café, the full loyalty loop, no time limit we enforce by feature-gating.",
    features: ["1 business", "Unlimited members", "Owner + 2 staff", "QR code & join page", "Points, rewards, redemptions", "Dashboard & analytics"],
    missing: ["Multiple locations", "CSV exports"],
    cta: "Start free",
    kind: "ghost" as const,
  },
  {
    name: "Growth",
    price: "Illustrative",
    cadence: "per month, once finalised",
    blurb: "For a busy café that wants more staff accounts and reporting depth.",
    features: ["Everything in Counter", "Unlimited staff", "Priority onboarding", "More analytics periods", "Export-ready reports"],
    missing: ["Multiple locations"],
    cta: "Talk to us",
    kind: "primary" as const,
    featured: true,
  },
  {
    name: "Group",
    price: "Contact",
    cadence: "custom",
    blurb: "For operators with more than one venue. Requirements are gathered individually.",
    features: ["Multiple businesses", "Shared owner account", "Consolidated reporting (planned)", "Onboarding support"],
    missing: [],
    cta: "Discuss requirements",
    kind: "ghost" as const,
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="border-b border-line">
        <div className="wrap py-14 md:py-20">
          <p className="eyebrow mb-4">Pricing</p>
          <h1 className="display max-w-[18ch] text-[2.4rem] leading-[1.05] md:text-[3.2rem]">
            Early access pricing, stated honestly.
          </h1>
          <p className="mt-5 max-w-2xl text-[1rem] leading-relaxed text-ink-soft">
            Repeato is in its pilot phase. The plans below are illustrative so you can see the shape of the offer — they
            are not a commercial commitment, and nothing is charged until a plan is agreed in writing.
          </p>
        </div>
      </section>

      <section className="wrap py-14">
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className={`card card-pad flex flex-col ${plan.featured ? "border-brand ring-1 ring-brand/20" : ""}`}>
              <div className="flex items-center justify-between">
                <h2 className="display text-[1.4rem]">{plan.name}</h2>
                {plan.featured ? <span className="pill pill-brand">Suggested</span> : null}
              </div>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="display text-[2rem]">{plan.price}</span>
                <span className="text-[0.78rem] text-muted">{plan.cadence}</span>
              </p>
              <p className="mt-2 text-[0.86rem] leading-relaxed text-muted">{plan.blurb}</p>
              <ul className="mt-5 space-y-2 text-[0.88rem]">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-brand" aria-hidden />{f}</li>
                ))}
                {plan.missing.map((f) => (
                  <li key={f} className="flex gap-2 text-muted"><Minus size={15} className="mt-0.5 shrink-0" aria-hidden />{f}</li>
                ))}
              </ul>
              <Link href={plan.name === "Group" ? "/contact" : "/signup"} className={`btn btn-${plan.kind} mt-6 w-full`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-6 rounded-xl border border-line bg-white p-4 text-[0.82rem] leading-relaxed text-muted">
          <strong className="text-ink">Illustrative only.</strong> These plans are a product design artefact, not a
          published price list. No payment processing is connected to Repeato, so no plan can be purchased or renewed
          online today. Pilot terms are agreed directly.
        </p>
      </section>

      <section className="border-y border-line bg-white">
        <div className="wrap py-14 md:py-18">
          <SectionTitle eyebrow="What is included either way" title="The core loop is never paywalled during the pilot." />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Verified points", "The full purchase → ledger flow, including reversals."],
              ["Rewards & vouchers", "One-time codes and staff verification."],
              ["Customer wallets", "Per-business balances and history."],
              ["Analytics", "Members, returning customers, and redemption counts."],
            ].map(([t, d]) => (
              <div key={t} className="card-quiet p-5">
                <h3 className="text-[0.95rem] font-semibold">{t}</h3>
                <p className="mt-1 text-[0.84rem] leading-relaxed text-muted">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap py-14">
        <div className="card card-pad flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
          <div>
            <h2 className="display text-[1.6rem]">Not sure which plan fits?</h2>
            <p className="mt-1.5 text-[0.9rem] text-muted">Tell us how many venues and staff you have. We will answer with specifics, not a deck.</p>
          </div>
          <Link href="/contact" className="btn btn-primary">Contact the team <ArrowRight size={16} aria-hidden /></Link>
        </div>
      </section>
    </>
  );
}
