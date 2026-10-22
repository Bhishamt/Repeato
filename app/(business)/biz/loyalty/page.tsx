import { Calculator, ShieldCheck } from "lucide-react";
import { Alert, Field } from "@/components/ui";
import { PointsPreview } from "@/components/points-preview";
import { consoleContext } from "@/lib/console";
import { updateLoyalty } from "@/app/actions/business";
import { calculatePoints } from "@/lib/points";
import { money, points } from "@/lib/format";

export const metadata = { title: "Loyalty rules" };

export default async function LoyaltyPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { business, role } = await consoleContext();
  const query = await searchParams;
  const rules = {
    pointsPer100: business.pointsPer100,
    minPurchasePaise: business.minPurchasePaise,
    signupBonus: business.signupBonus,
    minRedeemPoints: business.minRedeemPoints,
    maxPointsPerTxn: business.maxPointsPerTxn,
  };
  const examples = [10000, 25000, 50000, 100000].map((paise) => ({
    paise,
    result: calculatePoints({ amountPaise: paise, rules }),
  }));

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Programme</p>
        <h1 className="display text-[1.8rem] md:text-[2.2rem]">Loyalty rules</h1>
        <p className="mt-1 max-w-2xl text-[0.9rem] leading-relaxed text-muted">
          These rules govern every purchase recorded from now on. Past transactions keep the points they were given.
        </p>
      </div>

      {query.ok ? <Alert kind="ok">{query.ok}</Alert> : null}
      {query.error ? <Alert kind="bad">{query.error}</Alert> : null}
      {role !== "owner" ? <Alert kind="info">Only the owner can change loyalty rules.</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <form action={updateLoyalty} className="card card-pad">
          <input type="hidden" name="businessId" value={business.id} />
          <input type="hidden" name="back" value="/biz/loyalty" />
          <fieldset disabled={role !== "owner"} className="space-y-1">
            <legend className="text-[0.98rem] font-semibold">Earning and spending</legend>
            <p className="mb-3 text-[0.8rem] text-muted">Whole numbers only. Points are never fractional.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Points per ₹100 spent" name="pointsPer100" type="number" min={0} max={1000} step={1} defaultValue={rules.pointsPer100} required hint="Rounded down on each purchase." />
              <Field label="Minimum purchase (₹)" name="minPurchase" defaultValue={(rules.minPurchasePaise / 100).toFixed(2)} required hint="Bills below this earn nothing." />
              <Field label="Welcome points" name="signupBonus" type="number" min={0} max={10000} step={1} defaultValue={rules.signupBonus} required hint="Added once when a customer joins." />
              <Field label="Minimum redemption" name="minRedeemPoints" type="number" min={0} max={100000} step={1} defaultValue={rules.minRedeemPoints} required hint="Balance required before any reward can be redeemed." />
              <Field label="Points cap per purchase" name="maxPointsPerTxn" type="number" min={1} max={100000} step={1} defaultValue={rules.maxPointsPerTxn} required hint="Protects against very large bills." />
            </div>
            <div className="mt-3">
              <button className="btn btn-primary" type="submit">Save rules</button>
            </div>
          </fieldset>
        </form>

        <div className="space-y-4">
          <div className="card card-pad">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold"><Calculator size={15} className="text-brand" aria-hidden /> What a bill earns</h2>
            <table className="table mt-2">
              <caption className="sr-only">Points earned at sample bill amounts with current rules</caption>
              <thead><tr><th>Bill</th><th className="text-right">Points</th></tr></thead>
              <tbody>
                {examples.map(({ paise, result }) => (
                  <tr key={paise}>
                    <td>{money(paise)}</td>
                    <td className="text-right font-semibold">{result.eligible ? points(result.points) : "0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3">
              <PointsPreview {...rules} />
            </div>
          </div>

          <div className="card card-pad">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold"><ShieldCheck size={15} className="text-copper" aria-hidden /> How it is enforced</h2>
            <ul className="mt-2 space-y-1.5 text-[0.8rem] leading-relaxed text-ink-soft">
              <li>Staff cannot type a points figure — the server calculates it from the bill.</li>
              <li>Each sale carries a unique reference, so a retry cannot award twice.</li>
              <li>Product-level points override the spend formula for that line only.</li>
              <li>Balances are the sum of ledger entries, never an editable field.</li>
              <li>Reversing a sale writes a negative entry; nothing is deleted.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
