import Link from "next/link";
import { Alert } from "@/components/ui";
import { verifyEmailAddress } from "@/app/actions/auth";

export const metadata = { title: "Confirm your email" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";

  return (
    <div className="wrap flex min-h-[calc(100dvh-68px)] items-center justify-center py-12">
      <div className="card card-pad w-full max-w-md">
        <h1 className="display text-[1.6rem]">Confirm your email</h1>
        <p className="mt-1 text-[0.86rem] text-muted">
          Confirming your address lets us send receipts and password resets.
        </p>

        {params.error ? <div className="mt-4"><Alert kind="bad">{params.error}</Alert></div> : null}

        {token ? (
          <form action={verifyEmailAddress} className="mt-5">
            <input type="hidden" name="token" value={token} />
            <button className="btn btn-primary btn-block" type="submit">Confirm email address</button>
          </form>
        ) : (
          <div className="mt-4"><Alert kind="bad">This link is missing its token. Open the link from your email.</Alert></div>
        )}

        <p className="mt-4 text-center text-[0.8rem] text-muted">
          <Link href="/login" className="link">Go to sign in</Link>
        </p>
      </div>
    </div>
  );
}
