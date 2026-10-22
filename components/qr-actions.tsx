"use client";

import { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";

export function QrActions({ url, download }: { url: string; download: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button className="btn btn-ghost btn-sm" type="button" onClick={copy} aria-live="polite">
        {copied ? <><Check size={13} aria-hidden /> Copied</> : <><Copy size={13} aria-hidden /> Copy link</>}
      </button>
      <a className="btn btn-ghost btn-sm" href={download} download={`repeato-${download.split("/").pop()}.png`}>
        Download PNG
      </a>
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => window.print()}>
        <Printer size={13} aria-hidden /> Print
      </button>
    </div>
  );
}
