import { ShieldCheck, UserPlus } from "lucide-react";
import { Alert, Field, Pill } from "@/components/ui";
import { consoleContext } from "@/lib/console";
import { getDb } from "@/lib/db";
import { inviteStaff, removeStaff } from "@/app/actions/business";
import { dateShort } from "@/lib/format";

export const metadata = { title: "Team" };

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { business, role, user } = await consoleContext();
  const query = await searchParams;
  const db = getDb();

  const team = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role AS accountRole, bm.role, bm.created_at AS addedAt
         FROM business_members bm JOIN users u ON u.id = bm.user_id
        WHERE bm.business_id = ? ORDER BY bm.role = 'owner' DESC, u.name`,
    )
    .all(business.id) as Array<{ id: number; name: string; email: string; accountRole: string; role: string; addedAt: string }>;

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Access</p>
        <h1 className="display text-[1.8rem] md:text-[2.2rem]">Team &amp; permissions</h1>
        <p className="mt-1 max-w-2xl text-[0.9rem] leading-relaxed text-muted">
          Staff can record purchases and accept vouchers. They cannot change prices, loyalty rules, rewards or team access.
          Every check runs on the server for each request.
        </p>
      </div>

      {query.ok ? <Alert kind="ok">{query.ok}</Alert> : null}
      {query.error ? <Alert kind="bad">{query.error}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="card">
          <div className="border-b border-line px-5 py-3"><h2 className="text-[0.95rem] font-semibold">People with access</h2></div>
          <ul className="divide-y divide-[#f0e9de]">
            {team.map((person) => (
              <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <p className="text-[0.92rem] font-semibold">
                    {person.name}
                    {person.id === user.id ? <span className="ml-1.5 text-[0.72rem] font-normal text-muted">(you)</span> : null}
                  </p>
                  <p className="text-[0.76rem] text-muted">{person.email} · joined {dateShort(person.addedAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill kind={person.role === "owner" ? "brand" : "muted"}>
                    {person.role === "owner" ? <><ShieldCheck size={11} aria-hidden /> owner</> : "staff"}
                  </Pill>
                  {role === "owner" && person.role === "staff" && person.id !== user.id ? (
                    <form action={removeStaff}>
                      <input type="hidden" name="businessId" value={business.id} />
                      <input type="hidden" name="userId" value={person.id} />
                      <input type="hidden" name="back" value="/biz/team" />
                      <button className="text-[0.74rem] text-muted hover:text-danger" type="submit">Remove</button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {role === "owner" ? (
          <form action={inviteStaff} className="card card-pad h-fit">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold"><UserPlus size={15} className="text-brand" aria-hidden /> Add a staff member</h2>
            <input type="hidden" name="businessId" value={business.id} />
            <input type="hidden" name="back" value="/biz/team" />
            <div className="mt-3">
              <Field label="Their account email" name="email" type="email" required placeholder="staff@example.com" hint="They must already have a Repeato account. Email invitations are not sent yet." />
            </div>
            <button className="btn btn-primary btn-block btn-sm" type="submit">Grant counter access</button>
          </form>
        ) : (
          <div className="card card-pad h-fit">
            <h2 className="text-[0.95rem] font-semibold">Your access</h2>
            <p className="mt-1 text-[0.84rem] leading-relaxed text-muted">
              You are staff at {business.name}. You can record sales, look up members and accept vouchers. Ask the owner for changes to the menu or rules.
            </p>
          </div>
        )}
      </div>

      <section className="card card-pad">
        <h2 className="text-[0.95rem] font-semibold">What each role can do</h2>
        <div className="mt-3 table-wrap">
          <table className="table">
            <caption className="sr-only">Permissions by role</caption>
            <thead><tr><th>Capability</th><th>Owner</th><th>Staff</th></tr></thead>
            <tbody>
              {[
                ["Record a purchase", "Yes", "Yes"],
                ["Accept a voucher", "Yes", "Yes"],
                ["See this business's customers", "Yes", "Yes"],
                ["Edit menu, rewards and rules", "Yes", "No"],
                ["Reverse a purchase", "Yes", "No"],
                ["Adjust points manually", "Yes", "No"],
                ["Invite or remove staff", "Yes", "No"],
              ].map(([capability, owner, staff]) => (
                <tr key={capability}>
                  <td>{capability}</td>
                  <td className="text-brand">{owner}</td>
                  <td className={staff === "No" ? "text-muted" : "text-brand"}>{staff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
