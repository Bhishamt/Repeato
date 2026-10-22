import Link from "next/link";
import { ArrowRight, BarChart3, Check, Clock, Megaphone, QrCode, ShieldCheck, Store, Users } from "lucide-react";
import { SectionTitle } from "@/components/ui";

export const metadata = {
  title: "For businesses",
  description: "Run a verified points programme in your café without a POS project. Owner console, staff tools, QR code, analytics.",
};

export default function ForBusinessesPage() {
  return (
    <>
      <section className="border-b border-line">
        <div className="wrap grid gap-10 py-14 md:grid-cols-[1.1fr_0.9fr] md:py-20">
          <div>
            <p className="eyebrow mb-4">For café & restaurant owners</p>
            <h1 className="display max-w-[16ch] text-[2.4rem] leading-[1.05] md:text-[3.2rem]">
              Loyalty that fits on the counter.
            </h1>
            <p className="mt-5 max-w-xl text-[1rem] leading-relaxed text-ink-soft">
              No terminal to install, no POS migration, no twelve-month contract. Print a QR code, teach your staff one
              flow, and start collecting members today.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary">Create your business <ArrowRight size={16} aria-hidden /></Link>
              <Link href="/pricing" className="btn btn-ghost">See pricing approach</Link>
            </div>
            <dl className="mt-9 grid gap-4 sm:grid-cols-3">
              {[
                [Clock, "Setup", "About 5 minutes"],
                [QrCode, "Hardware", "A printer and paper"],
                [ShieldCheck, "Fraud model", "Staff-verified sales"],
              ].map(([Icon, label, value]) => (
                <div key={label as string}>
                  <Icon size={16} className="text-copper" aria-hidden />
                  <dt className="mono mt-2">{label as string}</dt>
                  <dd className="mt-0.5 text-[0.9rem] font-semibold">{value as string}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="card overflow-hidden">
            <div className="border-b border-line bg-[#f8f3ea] px-5 py-3">
              <p className="mono">Console preview · illustrative</p>
            </div>
            <div className="space-y-0 p-5">
              {[
                ["Members", "128", "14 joined this month"],
                ["Returning customers", "46", "36% of members"],
                ["Points issued", "3,240", "₹2.1L in verified sales"],
                ["Redeemed", "18", "1 waiting at the counter"],
              ].map(([label, value, sub]) => (
                <div key={label} className="flex items-center justify-between border-b border-[#f0e9de] py-3 last:border-0">
                  <div>
                    <p className="text-[0.86rem] font-medium">{label}</p>
                    <p className="text-[0.72rem] text-muted">{sub}</p>
                  </div>
                  <p className="display text-[1.3rem]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="wrap py-14 md:py-18">
        <SectionTitle eyebrow="Day one" title="What you actually get." />
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {[
            [Store, "Your business page", "Name, category, city, contact, and your points rule — the page customers land on after scanning."],
            [QrCode, "A printable QR code", "Generated from your real join URL. Download as PNG, print, and place it where customers pay."],
            [Users, "Owner and staff accounts", "One owner runs the business. Staff can record sales and verify vouchers, not change your rules."],
            [BarChart3, "A real activity dashboard", "Every metric is computed from purchases and ledger entries — not a demo array."],
            [Megaphone, "Reward catalogue", "Free coffee today, a discount next month. Activate and deactivate as often as you like."],
            [ShieldCheck, "An audit trail", "Rule changes, reversals, and adjustments are recorded with the actor and timestamp."],
          ].map(([Icon, title, body]) => (
            <div key={title as string} className="card card-pad">
              <Icon size={18} className="text-brand" aria-hidden />
              <h3 className="mt-3 text-[1rem] font-semibold">{title as string}</h3>
              <p className="mt-1.5 text-[0.86rem] leading-relaxed text-muted">{body as string}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="wrap grid gap-10 py-14 md:grid-cols-2 md:py-18">
          <div>
            <SectionTitle eyebrow="Roles" title="Staff, without the risk." />
            <p className="mt-4 text-[0.92rem] leading-relaxed text-ink-soft">
              Loyalty goes wrong when everyone can do everything. Repeato separates the daily flow from the decisions
              that affect money and trust.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="table">
              <caption className="sr-only">Role permissions</caption>
              <thead><tr><th>Action</th><th>Owner</th><th>Staff</th></tr></thead>
              <tbody>
                {[
                  ["Record a purchase", true, true],
                  ["Verify a reward voucher", true, true],
                  ["Reverse a purchase", true, false],
                  ["Adjust points", true, false],
                  ["Change loyalty rules", true, false],
                  ["Manage team", true, false],
                ].map(([action, owner, staff]) => (
                  <tr key={action as string}>
                    <td>{action as string}</td>
                    <td>{owner ? <Check size={15} className="text-brand" aria-label="Allowed" /> : <span className="text-muted">—</span>}</td>
                    <td>{staff ? <Check size={15} className="text-brand" aria-label="Allowed" /> : <span className="text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="wrap py-14">
        <SectionTitle eyebrow="Onboarding" title="Three real steps, not a sales call." />
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Create the account", "Sign up as an owner. Repeato creates the business, owner membership, and default rules in one transaction."],
            ["Add your menu and rewards", "Two products and one reward is enough to run a pilot. Prices are stored in paise, so ₹180 is exact."],
            ["Print the code", "Download the QR PNG from Stores & QR. Put it on the counter. Your first member can join immediately."],
          ].map(([t, d], i) => (
            <li key={t} className="card-quiet p-5">
              <span className="mono">0{i + 1}</span>
              <h3 className="display mt-2 text-[1.2rem]">{t}</h3>
              <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted">{d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/signup" className="btn btn-primary">Start your café <ArrowRight size={16} aria-hidden /></Link>
          <Link href="/contact" className="btn btn-ghost">Ask a question</Link>
        </div>
      </section>
    </>
  );
}
