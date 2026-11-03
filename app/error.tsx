"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to structured logging service when available
    console.error("[repeato:error-boundary]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <div className="min-h-dvh bg-paper">
      <div className="wrap flex min-h-[60dvh] flex-col items-center justify-center text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#fdf0ee]">
          <AlertTriangle size={24} className="text-danger" aria-hidden />
        </div>
        <h1 className="display mt-5 text-[1.6rem]">Something went wrong</h1>
        <p className="mt-2 max-w-md text-[0.9rem] text-muted">
          An unexpected error occurred. Your data is safe — try again, or reload the page.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[0.72rem] text-muted">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex gap-3">
          <button onClick={reset} className="btn btn-primary">
            <RotateCcw size={15} aria-hidden /> Try again
          </button>
          <a href="/" className="btn btn-ghost">
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}

