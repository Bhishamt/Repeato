import Link from "next/link";
import { redirect } from "next/navigation";
import { Coffee, Store } from "lucide-react";
import { Alert, Field } from "@/components/ui";
import { signIn } from "@/app/actions/auth";
import { getSessionUser, homeFor } from "@/lib/auth";
import { safeNext } from "@/lib/validate";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; next?: string; error?: string; ok?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(safeNext(params.next) ?? homeFor(user.role));
  const next = safeNext(params.next);
  const asBusiness = params.as === "business";

  return (
    <div className="wrap grid min-h-[calc(100dvh-68px)] items-center gap-12 py-12 md:grid-cols-[1fr_0.9fr]">
      <div className="hidden md:block">
        <p className="eyebrow mb-3">Welcome back</p>
        <h1 className="display max-w-[14ch] text-[2.8rem] leading-[1.05]">
          {asBusiness ? "Run your counter with confidence." : "Your regulars are one scan away."}
        </h1>
        <p className="mt-5 max-w-md text-[0.98rem] leading-relaxed text-ink-soft">
          {asBusiness
            ? "Sign in to manage your menu, review transactions, verify customer vouchers, and inspect business analytics."
            : "Sign in to see your points balance, view available rewards, and show your active vouchers at the counter."}
        </p>

        <div className="mt-8 flex gap-3">
          <Link
            href="/login?as=customer"
            className={`card flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition ${
              !asBusiness ? "border-brand ring-1 ring-brand/20 bg-white" : "text-muted hover:text-ink"
            }`}
          >
            <Coffee size={16} className="text-copper" aria-hidden /> Customer wallet
          </Link>
          <Link
            href="/login?as=business"
            className={`card flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition ${
              asBusiness ? "border-brand ring-1 ring-brand/20 bg-white" : "text-muted hover:text-ink"
            }`}
          >
            <Store size={16} className="text-brand" aria-hidden /> Merchant console
          </Link>
        </div>

        <ul className="mt-8 space-y-2 text-[0.87rem] text-muted">
          <li>• Customers: balances, rewards, and one-time vouchers</li>
          <li>• Owners: multiple businesses, menu, team, rules, analytics</li>
          <li>• Staff: record customer sales and verify vouchers</li>
        </ul>
      </div>

      <div className="card card-pad mx-auto w-full max-w-md">
        <div className="flex items-center justify-between">
          <h2 className="display text-[1.6rem]">
            {asBusiness ? "Merchant sign in" : "Sign in"}
          </h2>
          <span className="pill pill-brand">
            {asBusiness ? "Merchant" : "Customer"}
          </span>
        </div>
        <p className="mt-1 text-[0.86rem] text-muted">
          New here?{" "}
          <Link href={asBusiness ? "/signup?as=business" : "/signup?as=customer"} className="link">
            {asBusiness ? "Register a business" : "Create an account"}
          </Link>
        </p>

        {/* Mobile toggle for role */}
        <div className="mt-4 flex gap-2 md:hidden">
          <Link
            href="/login?as=customer"
            className={`btn btn-sm flex-1 ${!asBusiness ? "btn-primary" : "btn-ghost"}`}
          >
            Customer
          </Link>
          <Link
            href="/login?as=business"
            className={`btn btn-sm flex-1 ${asBusiness ? "btn-primary" : "btn-ghost"}`}
          >
            Merchant
          </Link>
        </div>

        {params.error ? <div className="mt-4"><Alert kind="bad">{params.error}</Alert></div> : null}
        {params.ok ? <div className="mt-4"><Alert kind="ok">{params.ok}</Alert></div> : null}

        <div className="mt-5">
          <GoogleSignInButton role={asBusiness ? "business" : "customer"} next={next ?? undefined} />
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-line" />
          </div>
          <div className="relative flex justify-center text-[0.72rem] uppercase tracking-wider">
            <span className="bg-white px-2 text-muted">or continue with email</span>
          </div>
        </div>

        <form action={signIn} className="mt-2">
          {next ? (
            <input type="hidden" name="next" value={next} />
          ) : asBusiness ? (
            <input type="hidden" name="next" value="/biz" />
          ) : null}
          <Field label="Email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
          <div className="field">
            <div className="flex items-baseline justify-between">
              <label className="label" htmlFor="f_password">Password</label>
              <span className="hint"><Link href="/forgot" className="link">Forgot password?</Link></span>
            </div>
            <input id="f_password" name="password" type="password" required autoComplete="current-password" className="input" placeholder="••••••••" />
          </div>
          <button className="btn btn-primary btn-block" type="submit">
            {asBusiness ? "Sign in to console" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-[0.8rem] text-muted">
          {asBusiness ? (
            <>
              Looking for your personal rewards?{" "}
              <Link href="/login?as=customer" className="link">Sign in as customer</Link>
            </>
          ) : (
            <>
              Running a café or store?{" "}
              <Link href="/login?as=business" className="link">Open merchant console</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
