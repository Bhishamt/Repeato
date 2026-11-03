import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-paper">
      <div className="wrap flex min-h-[60dvh] flex-col items-center justify-center text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#fbf0dc]">
          <SearchX size={24} className="text-amber" aria-hidden />
        </div>
        <h1 className="display mt-5 text-[1.6rem]">Page not found</h1>
        <p className="mt-2 max-w-md text-[0.9rem] text-muted">
          This page doesn&apos;t exist or the link may be outdated. Check the URL or head back.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/" className="btn btn-primary">
            Back to home
          </Link>
          <Link href="/login" className="btn btn-ghost">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

