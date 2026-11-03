"use client";

import { useEffect } from "react";

/**
 * Global error boundary — catches errors that bubble past every segment.
 * Must render its own <html> and <body> because the root layout may have
 * failed. Keeps styling minimal to avoid depending on the design system.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[repeato:global-error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#faf7f1",
          color: "#17130f",
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: "0.5rem", color: "#746a5f", maxWidth: "28rem" }}>
            Repeato hit a critical error. Your data is safe.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: "0.5rem",
                fontFamily: "monospace",
                fontSize: "0.75rem",
                color: "#746a5f",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                padding: "0.6rem 1.2rem",
                borderRadius: "0.75rem",
                border: "none",
                background: "#17553f",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: "0.6rem 1.2rem",
                borderRadius: "0.75rem",
                border: "1px solid #ded4c5",
                background: "transparent",
                color: "#17130f",
                fontWeight: 600,
                textDecoration: "none",
                fontSize: "0.9rem",
              }}
            >
              Back to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

