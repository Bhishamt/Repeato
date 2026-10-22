import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Field } from "@/components/ui";
import { signIn } from "@/app/actions/auth";
import { getSessionUser, homeFor } from "@/lib/auth";
import { safeNext } from "@/lib/validate";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; ok?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(safeNext(params.next) ?? homeFor(user.role));
  const next = safeNext(params.next);

  return (
    <div className="wrap grid min-h-[calc(100dvh-68px)] items-center gap-12 py-12 md:grid-cols-[1fr_0.9fr]">
      <div className="hidden md:block">
        <p className="eyebrow mb-3">Welcome back</p>
        <h1 className="display max-w-[14ch] text-[2.8rem] leading-[1.05]">Your regulars are one scan away.</h1>
        <p className="mt-5 max-w-md text-[0.98rem] leading-relaxed text-ink-soft">
          Sign in to see your wallet, verify a purchase, or check today&apos;s redemptions. One account works across
          every business you belong to.
        </p>
        <ul className="mt-8 space-y-2 text-[0.87rem] text-muted">
          <li>• Customers: balances, rewards, and history</li>
          <li>• Owners: menu, rules, team, analytics</li>
          <li>• Staff: record sales and check vouchers</li>
        </ul>
      </div>

      <div className="card card-pad mx-auto w-full max-w-md">
        <h2 className="display text-[1.6rem]">Sign in</h2>
        <p className="mt-1 text-[0.86rem] text-muted">
          New here? <Link href="/signup" className="link">Create an account</Link>
        </p>
        {params.error ? <div className="mt-4"><Alert kind="bad">{params.error}</Alert></div> : null}
        {params.ok ? <div className="mt-4"><Alert kind="ok">{params.ok}</Alert></div> : null}

        <form action={signIn} className="mt-5">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <Field label="Email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
          <div className="field">
            <div className="flex items-baseline justify-between">
              <label className="label" htmlFor="f_password">Password</label>
              <span className="hint"><Link href="/forgot" className="link">Forgot password?</Link></span>
            </div>
            <input id="f_password" name="password" type="password" required autoComplete="current-password" className="input" placeholder="••••••••" />
          </div>
          <button className="btn btn-primary btn-block" type="submit">Sign in</button>
        </form>

        <p className="mt-4 text-center text-[0.8rem] text-muted">
          Running a café? <Link href="/signup?as=business" className="link">Create a business account</Link>
        </p>
      </div>
    </div>
  );
}
