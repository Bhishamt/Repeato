import Link from "next/link";
import { Mail, MapPin, MessageSquare } from "lucide-react";
import { Alert, Field } from "@/components/ui";
import { sendContactMessage } from "@/app/actions/contact";

export const metadata = {
  title: "Contact",
  description: "Talk to the Repeato team about a pilot, a café, or a multi-venue requirement.",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <section className="wrap py-14 md:py-20">
      <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="eyebrow mb-4">Contact</p>
          <h1 className="display text-[2.3rem] leading-tight md:text-[2.9rem]">Tell us about your café.</h1>
          <p className="mt-4 text-[0.98rem] leading-relaxed text-ink-soft">
            Pilot questions, multi-venue requests, or something in the product that does not fit how your counter
            works. We answer with specifics.
          </p>
          <div className="mt-8 space-y-4">
            <div className="flex gap-3">
              <Mail size={18} className="mt-0.5 text-brand" aria-hidden />
              <div>
                <p className="text-[0.9rem] font-semibold">Email</p>
                <a className="link text-[0.9rem]" href="mailto:hello@repeato.app">hello@repeato.app</a>
                <p className="mt-1 text-[0.78rem] text-muted">Support address for the pilot. Response within two working days.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <MessageSquare size={18} className="mt-0.5 text-brand" aria-hidden />
              <div>
                <p className="text-[0.9rem] font-semibold">Already a member?</p>
                <p className="text-[0.85rem] text-muted">
                  Ask the counter first — they can see your purchase history. For account issues, use the same email.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <MapPin size={18} className="mt-0.5 text-brand" aria-hidden />
              <div>
                <p className="text-[0.9rem] font-semibold">Based in</p>
                <p className="text-[0.85rem] text-muted">Bengaluru, India. Pilots are onboarding locally first, with remote support.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-pad">
          <h2 className="display text-[1.4rem]">Send a message</h2>
          <p className="mt-1.5 text-[0.85rem] text-muted">This form stores your message in the Repeato inbox for a platform operator. It is not a mailing list.</p>
          {params.sent ? (
            <div className="mt-4"><Alert kind="ok">Thanks — your message is in the inbox. We reply by email.</Alert></div>
          ) : null}
          {params.error ? (
            <div className="mt-4"><Alert kind="bad">{params.error}</Alert></div>
          ) : null}
          <form action={sendContactMessage} className="mt-5">
            <Field label="Your name" name="name" required autoComplete="name" placeholder="Priya Nair" />
            <Field label="Email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
            <Field label="Business (optional)" name="business" placeholder="Bluebird Coffee" />
            <div className="field">
              <label className="label" htmlFor="f_message">Message</label>
              <textarea id="f_message" name="message" className="textarea" rows={5} required minLength={10} maxLength={2000} placeholder="How many venues do you run, and how do customers pay today?" />
            </div>
            <button className="btn btn-primary btn-block" type="submit">Send message</button>
            <p className="mt-3 text-[0.75rem] text-muted">
              By sending this you agree to our <Link href="/privacy" className="link">privacy notice</Link>. We use the
              details only to reply.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
