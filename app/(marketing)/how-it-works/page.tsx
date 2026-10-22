import Link from "next/link";
import { ArrowRight, BadgeCheck, Gift, QrCode, ScanLine, ShieldCheck, UserPlus, Wallet } from "lucide-react";
import { SectionTitle, Pill } from "@/components/ui";

export const metadata = {
  title: "How it works",
  description: "The exact Repeato loop: scan, join, staff-verified purchase, points ledger, reward redemption.",
};

const stages = [
  {
    icon: ScanLine,
    who: "Customer",
    title: "Scan the counter code",
    body: "The QR code is a plain link to /join/your-business. Nothing secret is encoded in it — just a stable slug.",
    detail: "If the business is suspended, the page explains that instead of showing a broken join form.",
  },
  {
    icon: UserPlus,
    who: "Customer",
    title: "Join once",
    body: "Sign in or create an account. Repeato checks whether you are already a member, then adds you and pays your welcome bonus once.",
    detail: "Existing accounts can join a second café without signing up again. One account, separate wallets.",
  },
  {
    icon: BadgeCheck,
    who: "Staff",
    title: "Record the purchase",
    body: "Staff find the customer by email, enter the bill total (or pick products), and confirm. The server calculates the points.",
    detail: "The browser sends an amount and a one-time key — never a points total. Duplicate submissions collapse to one sale.",
  },
  {
    icon: Wallet,
    who: "System",
    title: "Write the ledger",
    body: "A purchase row, optional item rows, and a points ledger entry are written in a single transaction.",
    detail: "Balances are always derived from the ledger sum. There is no editable balance column to drift.",
  },
  {
    icon: Gift,
    who: "Customer",
    title: "Redeem a reward",
    body: "Pick a reward you can afford. Repeato re-checks membership, stock, limits, and balance inside the transaction.",
    detail: "You get an 8-character voucher. It is not a database id and cannot be guessed.",
  },
  {
    icon: ShieldCheck,
    who: "Staff",
    title: "Verify the voucher",
    body: "Staff enter the code. A guarded update marks it redeemed exactly once, in the issuing business only.",
    detail: "A second attempt fails with a clear message. Expired codes are refused.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="border-b border-line">
        <div className="wrap py-14 md:py-20">
          <p className="eyebrow mb-4">How it works</p>
          <h1 className="display max-w-[20ch] text-[2.4rem] leading-[1.05] md:text-[3.2rem]">
            The scan is the beginning. The verified bill is the proof.
          </h1>
          <p className="mt-5 max-w-2xl text-[1rem] leading-relaxed text-ink-soft">
            Most loyalty fraud is simple: someone scans a code and expects points. Repeato separates identity from
            value. Scanning proves nothing; a staff-verified purchase is the only thing that moves a balance.
          </p>
        </div>
      </section>

      <section className="wrap py-14">
        <div className="grid gap-4 md:grid-cols-2">
          {stages.map(({ icon: Icon, who, title, body, detail }, i) => (
            <article key={title} className="card card-pad">
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand-deep"><Icon size={17} aria-hidden /></span>
                <div className="flex items-center gap-2">
                  <Pill kind={who === "Staff" ? "warn" : who === "System" ? "muted" : "brand"}>{who}</Pill>
                  <span className="mono">0{i + 1}</span>
                </div>
              </div>
              <h2 className="display mt-4 text-[1.32rem]">{title}</h2>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-soft">{body}</p>
              <p className="mt-3 border-l-2 border-line pl-3 text-[0.82rem] leading-relaxed text-muted">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="wrap grid gap-10 py-14 md:grid-cols-2 md:py-18">
          <div>
            <SectionTitle eyebrow="Points maths" title="A worked example." intro="Illustrative numbers using a rule of 10 points per ₹100, a ₹100 minimum, and 100 points to redeem." />
            <div className="mt-6 overflow-hidden rounded-xl border border-line">
              <table className="table">
                <caption className="sr-only">Worked points example</caption>
                <thead>
                  <tr><th>Event</th><th>Amount</th><th>Points</th><th>Balance</th></tr>
                </thead>
                <tbody>
                  <tr><td>Welcome bonus</td><td>—</td><td>+20</td><td>20</td></tr>
                  <tr><td>Filter coffee + croissant</td><td>₹450</td><td>+45</td><td>65</td></tr>
                  <tr><td>Weekend brunch</td><td>₹1,200</td><td>+120</td><td>185</td></tr>
                  <tr><td>Free coffee (100 pts)</td><td>—</td><td>−100</td><td>85</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-4">
            {[
              ["Rounding", "Points are whole numbers. The rule is floor(spend ÷ ₹100) × points-per-₹100, so ₹250 earns 25 points at the default rate."],
              ["Minimums", "A business can refuse points below a minimum purchase. Below it, the sale is still recorded for history."],
              ["Caps", "A per-sale cap protects against a mistyped amount awarding thousands of points."],
              ["Products", "If a product has its own points value, that line earns the product value and is excluded from the spend formula."],
            ].map(([t, d]) => (
              <div key={t} className="card card-pad">
                <h3 className="text-[0.95rem] font-semibold">{t}</h3>
                <p className="mt-1 text-[0.86rem] leading-relaxed text-muted">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap py-14">
        <SectionTitle eyebrow="Failure paths" title="What happens when something goes wrong." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Duplicate sale", "The one-time key hits a unique constraint and the original sale is returned instead of a second award."],
            ["Double redemption", "The status update is conditional on “issued”, so only the first request succeeds."],
            ["Cross-business voucher", "Verification is scoped by business id before the code is even considered."],
            ["Expired reward", "Expiry is evaluated against the issue time plus 14 days and shown to the customer."],
          ].map(([t, d]) => (
            <div key={t} className="card-quiet p-5">
              <h3 className="text-[0.92rem] font-semibold">{t}</h3>
              <p className="mt-1.5 text-[0.84rem] leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/signup" className="btn btn-primary">Create your café <ArrowRight size={16} aria-hidden /></Link>
          <Link href="/join/bluebird-coffee" className="btn btn-ghost"><QrCode size={16} aria-hidden /> Open a sample join page</Link>
        </div>
      </section>
    </>
  );
}
