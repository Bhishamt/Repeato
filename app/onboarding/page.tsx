import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import { Alert, Field, Wordmark } from "@/components/ui";
import { requireBusinessUser } from "@/lib/auth";
import { createOwnBusiness } from "@/app/actions/business";

export const metadata = { title: "Set up your business" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireBusinessUser("/onboarding");
  const query = await searchParams;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-white">
        <div className="wrap flex h-16 items-center justify-between">
          <Wordmark />
          <Link href="/app" className="text-[0.82rem] text-ink-soft hover:text-ink">My wallet</Link>
        </div>
      </header>
      <main id="main" className="wrap max-w-xl py-10">
        <p className="eyebrow mb-2">One more step</p>
        <h1 className="display text-[2rem]">Tell us about your café.</h1>
        <p className="mt-2 text-[0.92rem] leading-relaxed text-muted">
          This creates your business, its loyalty programme and its join QR code. You can change every setting afterwards.
        </p>

        {query.error ? <div className="mt-4"><Alert kind="bad">{query.error}</Alert></div> : null}

        <form action={createOwnBusiness} className="card card-pad mt-5">
          <Field label="Business name" name="name" required placeholder="Bluebird Coffee" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type" name="category" placeholder="Cafe" defaultValue="Cafe" />
            <Field label="City" name="city" placeholder="Bengaluru" />
          </div>
          <button className="btn btn-primary btn-block mt-1" type="submit">
            <Store size={15} aria-hidden /> Create business <ArrowRight size={14} aria-hidden />
          </button>
          <p className="mt-3 text-center text-[0.75rem] text-muted">
            You will land on your QR code, ready to print for the counter.
          </p>
        </form>
      </main>
    </div>
  );
}
