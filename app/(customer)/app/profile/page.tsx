import Link from "next/link";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { Alert, Field } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { changePassword, signOut } from "@/app/actions/auth";
import { updateProfile } from "@/app/actions/customer";
import { dateShort } from "@/lib/format";

export const metadata = { title: "Profile" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  const user = await requireUser("/app/profile");
  const query = await searchParams;
  const db = getDb();
  const row = db
    .prepare("SELECT phone, created_at AS createdAt FROM users WHERE id = ?")
    .get(user.id) as { phone: string | null; createdAt: string };
  const memberships = db
    .prepare(
      `SELECT b.name, b.slug, bc.joined_at AS joinedAt FROM business_customers bc
         JOIN businesses b ON b.id = bc.business_id WHERE bc.user_id = ? ORDER BY b.name`,
    )
    .all(user.id) as Array<{ name: string; slug: string; joinedAt: string }>;

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Profile</p>
        <h1 className="display text-[1.9rem] md:text-[2.3rem]">Your account.</h1>
        <p className="mt-2 text-[0.9rem] text-muted">Member since {dateShort(row.createdAt)}.</p>
      </div>

      {query.msg ? <Alert kind="ok">{query.msg}</Alert> : null}
      {query.error ? <Alert kind="bad">{query.error}</Alert> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card card-pad">
          <div className="flex items-center gap-2">
            <UserRound size={16} className="text-brand" aria-hidden />
            <h2 className="text-[0.95rem] font-semibold">Details</h2>
          </div>
          <form action={updateProfile} className="mt-4">
            <Field label="Full name" name="name" defaultValue={user.name} required autoComplete="name" />
            <Field label="Email" name="email" type="email" defaultValue={user.email} hint="Email changes are not supported yet — contact support." />
            <Field label="Phone (optional)" name="phone" defaultValue={row.phone ?? ""} autoComplete="tel" hint="Used for your account only. No SMS is sent." />
            <button className="btn btn-primary btn-sm" type="submit">Save details</button>
          </form>
        </section>

        <section className="card card-pad">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-copper" aria-hidden />
            <h2 className="text-[0.95rem] font-semibold">Password</h2>
          </div>
          <form action={changePassword} className="mt-4">
            <Field label="Current password" name="current" type="password" required autoComplete="current-password" />
            <Field label="New password" name="password" type="password" required autoComplete="new-password" hint="At least 8 characters. Other sessions are signed out." />
            <Field label="Confirm new password" name="confirm" type="password" required autoComplete="new-password" />
            <button className="btn btn-ghost btn-sm" type="submit">Update password</button>
          </form>
          <p className="mt-3 flex items-start gap-1.5 text-[0.74rem] leading-relaxed text-muted">
            <ShieldCheck size={12} className="mt-0.5 shrink-0" aria-hidden />
            Password reset by email is not configured. If you lose access, ask the café or platform support to help.
          </p>
        </section>
      </div>

      <section className="card">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-[0.95rem] font-semibold">Memberships</h2>
        </div>
        {memberships.length ? (
          <ul className="divide-y divide-[#f0e9de]">
            {memberships.map((m) => (
              <li key={m.slug} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-[0.9rem] font-semibold">{m.name}</p>
                  <p className="text-[0.74rem] text-muted">Joined {dateShort(m.joinedAt)}</p>
                </div>
                <Link href={`/app/rewards?b=${m.slug}`} className="text-[0.8rem] text-brand hover:underline">Rewards</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-[0.85rem] text-muted">
            You have not joined a café yet. <Link href="/app/businesses" className="link">Find one</Link>.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-5 py-3.5">
        <p className="text-[0.82rem] text-muted">Signed in as {user.email}</p>
        <form action={signOut}>
          <button className="btn btn-ghost btn-sm" type="submit">Sign out</button>
        </form>
      </div>
    </div>
  );
}
