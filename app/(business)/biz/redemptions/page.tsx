import Link from "next/link";
import { CheckCircle2, Ticket } from "lucide-react";
import { Alert, Empty, Pill } from "@/components/ui";
import { consoleContext } from "@/lib/console";
import { getDb } from "@/lib/db";
import { verifyVoucher } from "@/app/actions/business";
import { dateTime, points } from "@/lib/format";

export const metadata = { title: "Redemptions" };

export default async function RedemptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { business } = await consoleContext();
  const query = await searchParams;
  const db = getDb();

  const rows = await db
    .prepare(
      `SELECT r.id, r.token, r.status, r.points_spent AS pointsSpent, r.issued_at AS issuedAt, r.expires_at AS expiresAt,
              r.redeemed_at AS redeemedAt, rw.name AS rewardName, u.name AS customerName, u.id AS customerId,
              s.name AS redeemedByName
         FROM redemptions r
         JOIN rewards rw ON rw.id = r.reward_id
         JOIN users u ON u.id = r.customer_id
         LEFT JOIN users s ON s.id = r.redeemed_by
        WHERE r.business_id = ? ORDER BY r.id DESC LIMIT 100`,
    )
    .all<{
      id: number; token: string; status: string; pointsSpent: number; issuedAt: string; expiresAt: string; redeemedAt: string | null;
      rewardName: string; customerName: string; customerId: number; redeemedByName: string | null;
    }>(business.id);

  const open = rows.filter((r) => r.status === "issued");
  const past = rows.filter((r) => r.status !== "issued");

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Counter</p>
        <h1 className="display text-[1.8rem] md:text-[2.2rem]">Redemptions</h1>
        <p className="mt-1 text-[0.9rem] text-muted">
          Ask the customer for their voucher code. A code works once, only here, and only before it expires.
        </p>
      </div>

      {query.ok ? <Alert kind="ok"><CheckCircle2 size={14} className="mr-1 inline" aria-hidden /> {query.ok}</Alert> : null}
      {query.error ? <Alert kind="bad">{query.error}</Alert> : null}

      <form action={verifyVoucher} className="card card-pad">
        <input type="hidden" name="businessId" value={business.id} />
        <input type="hidden" name="back" value="/biz/redemptions" />
        <h2 className="text-[0.98rem] font-semibold">Accept a voucher</h2>
        <p className="mt-0.5 text-[0.8rem] text-muted">Enter the 8-character code, no spaces. Case does not matter.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label htmlFor="token" className="sr-only">Voucher code</label>
          <input
            id="token"
            name="token"
            className="input w-44 font-mono text-[1rem] uppercase tracking-[0.2em]"
            placeholder="ABCD2345"
            maxLength={20}
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button className="btn btn-primary" type="submit"><Ticket size={15} aria-hidden /> Verify &amp; redeem</button>
        </div>
        <p className="mt-2 text-[0.74rem] text-muted">
          If the code is unknown, already used or expired, the redemption is refused and nothing is deducted.
        </p>
      </form>

      <section className="card">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-[0.95rem] font-semibold">Waiting to be used</h2>
          <span className="text-[0.76rem] text-muted">{open.length}</span>
        </div>
        {open.length === 0 ? (
          <Empty title="No open vouchers">When a member redeems a reward, the voucher shows up here until staff accept it.</Empty>
        ) : (
          <ul className="divide-y divide-[#f0e9de]">
            {open.map((r) => {
              const expired = r.expiresAt < new Date().toISOString().slice(0, 19).replace("T", " ");
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-[0.9rem] font-semibold">{r.rewardName}</p>
                    <p className="text-[0.76rem] text-muted">
                      <Link href={`/biz/customers/${r.customerId}`} className="hover:underline">{r.customerName}</Link> · issued {dateTime(r.issuedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-ink px-2.5 py-1 font-mono text-[0.78rem] tracking-[0.16em] text-paper">{r.token}</span>
                    <Pill kind={expired ? "bad" : "warn"}>{expired ? "expired" : "open"}</Pill>
                    <span className="text-[0.75rem] text-muted">{points(r.pointsSpent)} pts</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-[0.95rem] font-semibold">History</h2>
        </div>
        {past.length === 0 ? (
          <Empty title="No completed redemptions yet">Accepted and cancelled vouchers are kept here for your records.</Empty>
        ) : (
          <div className="table-wrap border-0">
            <table className="table">
              <caption className="sr-only">Redemption history</caption>
              <thead><tr><th>Code</th><th>Reward</th><th>Customer</th><th>Points</th><th>Status</th><th>When</th></tr></thead>
              <tbody>
                {past.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-[0.78rem] tracking-[0.12em]">{r.token}</td>
                    <td>{r.rewardName}</td>
                    <td><Link href={`/biz/customers/${r.customerId}`} className="hover:underline">{r.customerName}</Link></td>
                    <td className="text-muted">{points(r.pointsSpent)}</td>
                    <td><Pill kind={r.status === "redeemed" ? "ok" : "muted"}>{r.status}</Pill></td>
                    <td className="whitespace-nowrap text-muted">
                      {r.status === "redeemed" ? `${dateTime(r.redeemedAt)}${r.redeemedByName ? ` · ${r.redeemedByName}` : ""}` : dateTime(r.issuedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
