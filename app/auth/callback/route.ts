import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/db";
import { homeFor, startSession, type Role } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { audit } from "@/lib/services";
import { safeNext } from "@/lib/validate";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const roleParam = searchParams.get("role");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle provider cancellation or provider-level errors
  if (error || errorDescription) {
    let friendlyMessage = "Google sign-in was not completed.";
    if (error === "access_denied") {
      friendlyMessage = "Sign in was cancelled.";
    } else if (errorDescription) {
      friendlyMessage = errorDescription;
    }
    const backUrl = roleParam === "business" ? "/login?as=business" : "/login";
    return NextResponse.redirect(
      `${origin}${backUrl}${backUrl.includes("?") ? "&" : "?"}error=${encodeURIComponent(friendlyMessage)}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Supabase OAuth code exchange error:", exchangeError);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("Could not complete authentication. Please try again.")}`,
      );
    }

    // Handle password recovery redirect
    if (next?.startsWith("/reset")) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    if (data?.user?.email) {
      const email = data.user.email.toLowerCase();
      const name =
        (data.user.user_metadata?.full_name as string) ||
        (data.user.user_metadata?.name as string) ||
        email.split("@")[0];

      const db = getDb();
      let user = await db
        .prepare("SELECT id, email, name, role, status FROM users WHERE lower(email) = ?")
        .get<{ id: number; email: string; name: string; role: Role; status: string }>(email);

      if (!user) {
        // First-time sign-in via Google OAuth: provision user account
        const assignedRole: Role = roleParam === "business" ? "owner" : "customer";
        const dummyPassword = hashPassword(`oauth-${Math.random().toString(36)}`);

        const userId = await db.insert(
          "INSERT INTO users (email, name, password_hash, role, email_verified) VALUES (?, ?, ?, ?, 1)",
          email,
          name,
          dummyPassword,
          assignedRole,
        );

        user = {
          id: userId,
          email,
          name,
          role: assignedRole,
          status: "active",
        };

        await audit(db, user.id, "auth.oauth_signup", "user", user.id, { provider: "google" });
      } else {
        await db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(user.id);
        await audit(db, user.id, "auth.oauth_login", "user", user.id, { provider: "google" });
      }

      if (user.status !== "active") {
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent("This account is suspended. Contact support.")}`,
        );
      }

      // Establish Repeato session cookie
      await startSession(user.id);

      const destination = next ?? homeFor(user.role);
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Invalid authentication callback. Please try again.")}`,
  );
}

