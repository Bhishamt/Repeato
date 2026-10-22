import Link from "next/link";
import { ArrowRight, Compass, Eye, Handshake, Leaf, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "About",
  description: "Why Repeato exists, how it is built, and what it deliberately leaves out.",
};

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-line">
        <div className="wrap py-14 md:py-20">
          <p className="eyebrow mb-4">About Repeato</p>
          <h1 className="display max-w-[20ch] text-[2.4rem] leading-[1.05] md:text-[3.2rem]">
            Loyalty should be as easy as paying.
          </h1>
          <p className="mt-5 max-w-2xl text-[1rem] leading-relaxed text-ink-soft">
            Repeato is a customer retention platform for independent cafés and restaurants. It exists because most
            loyalty programmes ask too much of the customer and give too little to the business: an app to install, a
            card to forget, a stamp nobody checks.
          </p>
        </div>
      </section>

      <section className="wrap grid gap-10 py-14 md:grid-cols-[1.1fr_0.9fr] md:py-18">
        <div className="space-y-5 text-[0.95rem] leading-relaxed text-ink-soft">
          <h2 className="display text-[1.8rem] text-ink">The product in one paragraph.</h2>
          <p>
            A café prints a QR code. A customer scans it, joins with an account they already understand, and receives a
            separate wallet for that café. When they buy something, staff record the bill in the Repeato console. The
            server applies the café&apos;s rules, writes a ledger entry, and the customer&apos;s balance updates. When the
            balance is enough, the customer redeems a reward and shows a one-time code at the counter.
          </p>
          <p>
            That is the whole loop. Everything else — the dashboard, the menu, the audit log — exists to make that loop
            trustworthy and repeatable. There is no billing system, no inventory module, and no marketing automation
            suite hiding behind it.
          </p>

          <h2 className="display mt-10 text-[1.8rem] text-ink">Principles we build by.</h2>
          <ul className="space-y-4">
            {[
              [ShieldCheck, "Verification before value.", "A scan identifies a business. It never grants points. Only a staff-recorded, server-validated purchase moves a balance."],
              [Eye, "Show your work.", "Balances are the sum of an append-only ledger. Analytics are derived from the same rows customers see."],
              [Leaf, "Small surface.", "Fewer screens, each finished. A working five-minute setup is worth more than a feature grid."],
              [Handshake, "Honest positioning.", "No invented customers, testimonials, or revenue figures. If an integration is not configured, the product says so."],
            ].map(([Icon, title, body]) => (
              <li key={title as string} className="flex gap-3">
                <Icon size={17} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                <span><strong className="text-ink">{title as string}</strong> {body as string}</span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="space-y-4">
          <div className="card card-pad">
            <Compass size={18} className="text-copper" aria-hidden />
            <h2 className="display mt-3 text-[1.3rem]">Where it is today</h2>
            <p className="mt-2 text-[0.86rem] leading-relaxed text-muted">
              Repeato is an early product in active development. The core loop is implemented and tested. Some
              production capabilities — hosted multi-tenant deployment, email delivery, POS adapters — are documented
              as the next layer rather than pretended to exist.
            </p>
          </div>
          <div className="card card-pad">
            <h2 className="display text-[1.15rem]">Built with</h2>
            <ul className="mt-3 space-y-1.5 text-[0.85rem] text-muted">
              <li>Next.js App Router + React + TypeScript</li>
              <li>Tailwind CSS design system</li>
              <li>PostgreSQL schema with row-level security for the hosted tier</li>
              <li>Vitest for domain and integration tests</li>
            </ul>
          </div>
          <div className="card card-pad">
            <h2 className="display text-[1.15rem]">Talk to a human</h2>
            <p className="mt-2 text-[0.85rem] text-muted">Questions about a pilot, or a café that does not fit the default flow? We read every message.</p>
            <Link href="/contact" className="btn btn-ghost btn-block mt-4">Contact us <ArrowRight size={15} aria-hidden /></Link>
          </div>
        </aside>
      </section>
    </>
  );
}
