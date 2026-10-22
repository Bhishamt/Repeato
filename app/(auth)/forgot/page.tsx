import Link from "next/link";
import { Alert, Field } from "@/components/ui";
import { requestPasswordReset } from "@/app/actions/auth";

export const metadata = { title: "Reset your password" };

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="wrap flex min-h-[calc(100dvh-68px)] items-center justify-center py-12">
      <div className="card card-pad w-full max-w-md">
        <h1 className="display text-[1.6rem]">Reset your password</h1>
        <p className="mt-1 text-[0.86rem] text-muted">
          Enter the email on your account and we will send a single-use link. It expires in 60 minutes.
        </p>

        {params.error ? <div className="mt-4"><Alert kind="bad">{params.error}</Alert></div> : null}
        {params.ok ? <div className="mt-4"><Alert kind="ok">{params.ok}</Alert></div> : null}

        <form action={requestPasswordReset} className="mt-5">
          <Field label="Email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
          <button className="btn btn-primary btn-block" type="submit">Send reset link</button>
        </form>

        <p className="mt-4 text-center text-[0.8rem] text-muted">
          Remembered it? <Link href="/login" className="link">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
