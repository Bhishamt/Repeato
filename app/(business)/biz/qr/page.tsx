import Link from "next/link";
import { headers } from "next/headers";
import { ExternalLink, QrCode, ScanLine } from "lucide-react";
import { QrActions } from "@/components/qr-actions";
import { consoleContext } from "@/lib/console";

export const metadata = { title: "QR code" };

export default async function QrPage() {
  const { business } = await consoleContext();
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const base = (process.env.APP_URL || `${proto}://${host}`).replace(/\/$/, "");
  const joinUrl = `${base}/join/${business.slug}`;
  const image = `/api/qr/${business.slug}`;

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Counter</p>
        <h1 className="display text-[1.8rem] md:text-[2.2rem]">Your join QR code</h1>
        <p className="mt-1 max-w-2xl text-[0.9rem] leading-relaxed text-muted">
          This code opens your public page. Scanning only identifies {business.name} — points still require a staff-recorded purchase.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="card card-pad">
          <div className="mx-auto w-full max-w-[300px] rounded-xl border border-line bg-white p-4 text-center">
            <p className="mono text-[0.58rem]">Repeato · {business.category}</p>
            <h2 className="display mt-1 text-[1.3rem] leading-tight">{business.name}</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={`QR code to join ${business.name} on Repeato`}
              width={720}
              height={720}
              className="mx-auto mt-3 aspect-square w-full rounded-lg"
            />
            <p className="mt-2 text-[0.8rem] font-semibold">Scan to join &amp; earn points</p>
            <p className="mt-0.5 text-[0.7rem] text-muted">Ask the counter to record your purchase after you join.</p>
          </div>
          <div className="mt-4">
            <QrActions url={joinUrl} download={image} />
          </div>
        </section>

        <div className="space-y-4">
          <section className="card card-pad">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold"><ScanLine size={15} className="text-brand" aria-hidden /> Put it where people pay</h2>
            <ol className="mt-3 space-y-2 text-[0.85rem] leading-relaxed text-ink-soft">
              <li><span className="mr-1.5 font-semibold text-ink">1.</span> Print the code and place it at the till or on each table.</li>
              <li><span className="mr-1.5 font-semibold text-ink">2.</span> A customer scans with their phone camera and joins in about a minute.</li>
              <li><span className="mr-1.5 font-semibold text-ink">3.</span> At payment, staff record the bill under Transactions. Points appear instantly.</li>
            </ol>
            <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-[0.78rem] text-muted">
              The code contains only your public join address. It never contains customer data or tokens.
            </p>
          </section>

          <section className="card card-pad">
            <h2 className="text-[0.95rem] font-semibold">The link behind it</h2>
            <p className="mt-1 break-all rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[0.78rem]">{joinUrl}</p>
            <p className="mt-2 text-[0.76rem] text-muted">
              Repeato uses this address for every QR image, so changing it later would invalidate printed codes.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/join/${business.slug}`} className="btn btn-soft btn-sm" target="_blank" rel="noreferrer">
                <ExternalLink size={13} aria-hidden /> Preview join page
              </Link>
              <Link href="/biz/settings" className="btn btn-ghost btn-sm"><QrCode size={13} aria-hidden /> Business details</Link>
            </div>
          </section>

          <section className="card card-pad">
            <h2 className="text-[0.95rem] font-semibold">Test the code</h2>
            <p className="mt-1 text-[0.82rem] leading-relaxed text-muted">
              Open the preview on your phone, join with a test account, then record a small sale for it. If anything
              looks wrong, check the loyalty rules before printing more copies.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
