import Link from "next/link";
import { ArrowRight, BadgeCheck, BarChart3, Gift, Lock, QrCode, Receipt, ShieldCheck, Smartphone, Store, Users, Wallet } from "lucide-react";
import { SectionTitle } from "@/components/ui";

export const metadata = {
  title: "Features",
  description: "QR joining, verified purchases, a points ledger, rewards, staff tools, and analytics — what Repeato actually does.",
};

const groups = [
  {
    title: "Joining & identity",
    icon: QrCode,
    items: [
      ["Business QR code", "One code per business, generated from your real join URL. Download a PNG for print."],
      ["One account, many cafés", "Customers sign in once and join as many businesses as they like."],
      ["Duplicate-safe join", "Joining twice is a no-op. The welcome bonus is paid exactly once."],
      ["Inactive business handling", "Suspended businesses stop accepting joins without breaking existing wallets."],
    ],
  },
  {
    title: "Earning points",
    icon: Receipt,
    items: [
      ["Staff-recorded purchases", "Your team enters the bill (optionally itemised) in the console."],
      ["Server-side calculation", "The browser never submits a points number. Rules live on the business record."],
      ["Per-product points", "A product can override the spend formula; overridden lines are excluded from it."],
      ["Idempotent sales", "Every sale carries a one-time key so a refresh or retry cannot double-award."],
    ],
  },
  {
    title: "Spending points",
    icon: Gift,
    items: [
      ["Business-owned rewards", "Each reward belongs to one business and cannot be redeemed elsewhere."],
      ["Atomically deducted", "Balance is re-checked inside the transaction that writes the debit."],
      ["One-time voucher codes", "8-character codes from a cryptographic RNG, valid for 14 days."],
      ["Staff verification", "Only a member of the issuing business can mark a voucher redeemed, once."],
    ],
  },
  {
    title: "Running the business",
    icon: BarChart3,
    items: [
      ["Menu & categories", "Products with prices in paise, availability, and optional points overrides."],
      ["Loyalty rules", "Points per ₹100, minimum purchase, welcome bonus, redemption floor, per-sale cap."],
      ["Team & permissions", "Owners manage settings and reversals; staff can record sales and check vouchers."],
      ["Analytics", "Members, new members, returning customers, issued/redeemed points, completed rewards."],
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="border-b border-line">
        <div className="wrap py-14 md:py-20">
          <p className="eyebrow mb-4">Features</p>
          <h1 className="display max-w-[18ch] text-[2.4rem] leading-[1.05] md:text-[3.4rem]">
            Everything the counter needs. Nothing it doesn&apos;t.
          </h1>
          <p className="mt-5 max-w-2xl text-[1rem] leading-relaxed text-ink-soft">
            Repeato is a focused loyalty platform: joining, earning, spending, and the evidence that it worked. Each
            feature below is implemented in this product — not a roadmap slide.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/signup" className="btn btn-primary">Create your café <ArrowRight size={16} aria-hidden /></Link>
            <Link href="/how-it-works" className="btn btn-ghost">Walk through the flow</Link>
          </div>
        </div>
      </section>

      <section className="wrap py-14 md:py-18">
        <div className="grid gap-5 md:grid-cols-2">
          {groups.map(({ title, icon: Icon, items }) => (
            <div key={title} className="card card-pad">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand-deep"><Icon size={17} aria-hidden /></span>
                <h2 className="display text-[1.35rem]">{title}</h2>
              </div>
              <dl className="mt-5 space-y-4">
                {items.map(([term, detail]) => (
                  <div key={term}>
                    <dt className="text-[0.9rem] font-semibold">{term}</dt>
                    <dd className="mt-0.5 text-[0.85rem] leading-relaxed text-muted">{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-[#f5efe5]">
        <div className="wrap py-14 md:py-18">
          <SectionTitle eyebrow="Boundaries" title="What Repeato deliberately does not do." intro="Honest scope makes a product trustworthy. These are conscious exclusions, not missing pieces." />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              [ShieldCheck, "No POS integration", "Staff record the bill in Repeato. A POS adapter would be a separate, provider-specific project."],
              [Lock, "No card or payment processing", "Your existing till takes payment. Repeato never stores card data."],
              [Smartphone, "No native app", "The customer flow is a mobile web page opened by the QR code, built to feel native."],
              [Users, "No marketing automation", "Notifications are in-app. Email and SMS delivery require a provider you configure."],
              [Wallet, "No cross-business points", "Points are issued and spent per business. Shared programmes would be an explicit future feature."],
              [Store, "No multi-location rollups yet", "One business = one counter for now. Branch rollups are a planned extension."],
            ].map(([Icon, title, body]) => (
              <div key={title as string} className="card-quiet p-5">
                <Icon size={17} className="text-ink-soft" aria-hidden />
                <h3 className="mt-3 text-[0.95rem] font-semibold">{title as string}</h3>
                <p className="mt-1.5 text-[0.84rem] leading-relaxed text-muted">{body as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap py-14">
        <div className="card card-pad flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="eyebrow mb-2">Next step</p>
            <h2 className="display text-[1.7rem]">See it with your own menu.</h2>
            <p className="mt-1.5 text-[0.9rem] text-muted">Create a business, add two products, and print the QR code in about five minutes.</p>
          </div>
          <Link href="/signup" className="btn btn-primary">Get started <ArrowRight size={16} aria-hidden /></Link>
        </div>
      </section>
    </>
  );
}
