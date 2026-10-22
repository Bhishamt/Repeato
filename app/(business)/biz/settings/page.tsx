import Link from "next/link";
import { ExternalLink, Info } from "lucide-react";
import { Alert, Field, Pill } from "@/components/ui";
import { consoleContext } from "@/lib/console";
import { updateBusiness } from "@/app/actions/business";

export const metadata = { title: "Business settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { business, role, user } = await consoleContext();
  const query = await searchParams;
  const canEdit = role === "owner";

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Settings</p>
        <h1 className="display text-[1.8rem] md:text-[2.2rem]">Business details</h1>
        <p className="mt-1 text-[0.9rem] text-muted">These appear on your join page and at the top of the customer&apos;s wallet.</p>
      </div>

      {query.ok ? <Alert kind="ok">{query.ok}</Alert> : null}
      {query.error ? <Alert kind="bad">{query.error}</Alert> : null}
      {!canEdit ? <Alert kind="info">Only the owner can edit business details.</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <form action={updateBusiness} className="card card-pad">
          <input type="hidden" name="businessId" value={business.id} />
          <input type="hidden" name="back" value="/biz/settings" />
          <fieldset disabled={!canEdit}>
            <legend className="text-[0.98rem] font-semibold">Public profile</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Business name" name="name" defaultValue={business.name} required />
              <Field label="Type" name="category" defaultValue={business.category} required hint="e.g. Cafe, Bakery, Restaurant" />
              <Field label="City" name="city" defaultValue={business.city ?? ""} />
              <Field label="Phone" name="phone" defaultValue={business.phone ?? ""} autoComplete="tel" />
              <div className="sm:col-span-2">
                <Field label="Address" name="address" defaultValue={business.address ?? ""} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="description">Description</label>
                <textarea id="description" name="description" className="textarea" rows={3} defaultValue={business.description ?? ""} maxLength={400} />
                <p className="hint mt-1">Shown to customers before they join. Keep it short and concrete.</p>
              </div>
              <div>
                <label className="label" htmlFor="brandColor">Brand colour</label>
                <div className="flex items-center gap-2">
                  <input id="brandColor" name="brandColor" type="color" defaultValue={business.brandColor} className="h-10 w-14 cursor-pointer rounded border border-line bg-white p-1" />
                  <span className="font-mono text-[0.8rem] text-muted">{business.brandColor}</span>
                </div>
                <p className="hint mt-1">Used on the wallet card and join page.</p>
              </div>
            </div>
            <div className="mt-2">
              <button className="btn btn-primary" type="submit" disabled={!canEdit}>Save changes</button>
            </div>
          </fieldset>
        </form>

        <div className="space-y-4">
          <section className="card card-pad">
            <h2 className="text-[0.95rem] font-semibold">Programme address</h2>
            <p className="mt-2 break-all rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[0.78rem]">/join/{business.slug}</p>
            <p className="mt-2 text-[0.76rem] leading-relaxed text-muted">
              The address is permanent so printed QR codes keep working. A new address would need new codes.
            </p>
            <Link href={`/join/${business.slug}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[0.8rem] text-brand hover:underline">
              Open public page <ExternalLink size={12} aria-hidden />
            </Link>
          </section>

          <section className="card card-pad">
            <h2 className="text-[0.95rem] font-semibold">Account</h2>
            <dl className="mt-2 space-y-2 text-[0.82rem]">
              <div className="flex justify-between gap-2"><dt className="text-muted">Status</dt><dd><Pill kind={business.status === "active" ? "ok" : business.status === "pending" ? "warn" : "bad"}>{business.status}</Pill></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Your role</dt><dd className="font-medium">{role}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Signed in as</dt><dd className="truncate text-right">{user.email}</dd></div>
            </dl>
          </section>

          <section className="card card-pad">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold"><Info size={14} className="text-muted" aria-hidden /> Data &amp; privacy</h2>
            <p className="mt-1 text-[0.78rem] leading-relaxed text-muted">
              You can see contact details only for customers who joined your programme. Export and deletion requests are handled by
              platform support while the product is in its pilot phase.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
