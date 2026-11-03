import Link from "next/link";
import { Alert, Field } from "@/components/ui";
import { resetPassword } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";

  // Check for Supabase recovery session in cookies
  let hasSupabaseSession = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      hasSupabaseSession = true;
    }
  } catch {
    // No Supabase session active
  }

  const isAuthorized = Boolean(token || hasSupabaseSession);

  return (
    <div className="wrap flex min-h-[calc(100dvh-68px)] items-center justify-center py-12">
      <div className="card card-pad w-full max-w-md">
        <h1 className="display text-[1.6rem]">Choose a new password</h1>
        <p className="mt-1 text-[0.86rem] text-muted">
          Every other signed-in device is signed out as soon as you save.
        </p>

        {params.error ? (
          <div className="mt-4">
            <Alert kind="bad">{params.error}</Alert>
          </div>
        ) : null}

        {isAuthorized ? (
          <form action={resetPassword} className="mt-5">
            {token ? <input type="hidden" name="token" value={token} /> : null}
            <Field
              label="New password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            <Field
              label="Confirm new password"
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Repeat the password"
            />
            <button className="btn btn-primary btn-block" type="submit">
              Save password
            </button>
          </form>
        ) : (
          <div className="mt-4">
            <Alert kind="bad">This reset link is invalid, missing, or has expired. Request a new one.</Alert>
          </div>
        )}

        <p className="mt-4 text-center text-[0.8rem] text-muted">
          <Link href="/forgot" className="link">
            Request a new link
          </Link>
        </p>
      </div>
    </div>
  );
}
