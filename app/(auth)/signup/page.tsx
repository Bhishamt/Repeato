import Link from "next/link";
import { redirect } from "next/navigation";
import { Store, User } from "lucide-react";
import { Alert, Field } from "@/components/ui";
import { signUp } from "@/app/actions/auth";
import { getSessionUser, homeFor } from "@/lib/auth";
import { safeNext } from "@/lib/validate";

export const metadata = { title: "Create an account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const next = safeNext(params.next);
  if (user) redirect(next ?? homeFor(user.role));
  const asBusiness = params.as === "business";

  return (
    <div className="wrap grid items-start gap-12 py-12 md:grid-cols-[0.9fr_1.1fr] md:py-16">
      <div className="md:pt-6">
        <p className="eyebrow mb-3">Get started</p>
        <h1 className="display max-w-[15ch] text-[2.5rem] leading-[1.05]">
          {asBusiness ? "Put your café on the counter." : "Carry every café in one wallet."}
        </h1>
        <p className="mt-4 max-w-md text-[0.96rem] leading-relaxed text-ink-soft">
          {asBusiness
            ? "Creating a business account also creates your business, your owner membership, and sensible loyalty defaults in one step. You can change everything afterwards."
            : "One account, a separate balance for each café you join. Welcome points are added the moment you join."}
        </p>
        <div className="mt-6 grid gap-3">
          <Link
            href="/signup?as=business"
            className={`card flex items-start gap-3 p-4 ${asBusiness ? "border-brand ring-1 ring-brand/20" : ""}`}
            aria-current={asBusiness ? "true" : undefined}
          >
            <Store size={18} className="mt-0.5 text-brand" aria-hidden />
            <span>
              <span className="block text-[0.92rem] font-semibold">I run a café or restaurant</span>
              <span className="block text-[0.8rem] text-muted">Owner console, QR code, menu, staff, analytics</span>
            </span>
          </Link>
          <Link
            href="/signup?as=customer"
            className={`card flex items-start gap-3 p-4 ${!asBusiness ? "border-brand ring-1 ring-brand/20" : ""}`}
            aria-current={!asBusiness ? "true" : undefined}
          >
            <User size={18} className="mt-0.5 text-copper" aria-hidden />
            <span>
              <span className="block text-[0.92rem] font-semibold">I&apos;m a customer</span>
              <span className="block text-[0.8rem] text-muted">Join with a café&apos;s QR code, earn and redeem points</span>
            </span>
          </Link>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="display text-[1.5rem]">{asBusiness ? "Create your business" : "Create your account"}</h2>
        <p className="mt-1 text-[0.86rem] text-muted">
          Already have one? <Link href="/login" className="link">Sign in</Link>
        </p>
        {params.error ? <div className="mt-4"><Alert kind="bad">{params.error}</Alert></div> : null}

        <form action={signUp} className="mt-5">
          <input type="hidden" name="intent" value={asBusiness ? "owner" : "customer"} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <Field label="Your name" name="name" required autoComplete="name" placeholder="Priya Nair" />
          {asBusiness ? (
            <>
              <Field label="Business name" name="businessName" required placeholder="Bluebird Coffee" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="field">
                  <label className="label" htmlFor="f_category">Category</label>
                  <select id="f_category" name="category" className="select" defaultValue="Cafe">
                    {["Cafe", "Restaurant", "Bakery", "Juice bar", "Dessert parlour", "Other"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <Field label="City" name="city" placeholder="Bengaluru" />
              </div>
            </>
          ) : null}
          <Field label="Email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Password" name="password" type="password" required autoComplete="new-password" hint="At least 8 characters" />
            <Field label="Confirm password" name="confirm" type="password" required autoComplete="new-password" />
          </div>
          <button className="btn btn-primary btn-block mt-1" type="submit">
            {asBusiness ? "Create business" : "Create account"}
          </button>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-muted">
            By creating an account you agree to the <Link href="/terms" className="link">terms</Link> and{" "}
            <Link href="/privacy" className="link">privacy notice</Link>.
          </p>
          <p className="sr-only" aria-live="polite">Signup errors are announced at the top of the form.</p>
        </form>
      </div>
    </div>
  );
}
