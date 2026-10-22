export const metadata = {
  title: "Terms",
  description: "The terms that govern use of Repeato during its pilot.",
};

const updated = "23 October 2026";

export default function TermsPage() {
  return (
    <section className="wrap max-w-3xl py-14 md:py-20">
      <p className="eyebrow mb-3">Legal</p>
      <h1 className="display text-[2.3rem] md:text-[2.8rem]">Terms of service</h1>
      <p className="mt-2 text-[0.8rem] text-muted">Last updated {updated}</p>

      <div className="mt-8 space-y-7 text-[0.93rem] leading-relaxed text-ink-soft">
        <p className="rounded-xl border border-line bg-white p-4 text-[0.85rem]">
          <strong className="text-ink">Pilot terms.</strong> Repeato is operating as an early pilot. These terms
          describe how the service works today. They are not a substitute for a signed commercial agreement, and a
          named operating entity will be added before paid use.
        </p>

        <div>
          <h2 className="display text-[1.35rem] text-ink">1. The service</h2>
          <p className="mt-2">
            Repeato provides customer loyalty software for hospitality businesses: a public join page and QR code,
            customer wallets, a points ledger, reward redemptions, and business analytics. Repeato is not a payment
            processor, a point-of-sale system, or a party to the sale between a business and its customer.
          </p>
        </div>

        <div>
          <h2 className="display text-[1.35rem] text-ink">2. Business accounts</h2>
          <p className="mt-2">
            You must provide accurate business details and keep access credentials secure. You are responsible for the
            loyalty rules you configure, the rewards you publish, and the staff you add. Points awarded by your staff
            are your liability, not Repeato&apos;s. You must honour valid rewards that your business issued through the
            service.
          </p>
        </div>

        <div>
          <h2 className="display text-[1.35rem] text-ink">3. Customer accounts</h2>
          <p className="mt-2">
            You must be at least 18 years old to create an account. Points have no cash value, are not transferable
            between businesses, and may expire only where a business clearly states an expiry. One account per person;
            creating duplicate accounts to farm welcome bonuses is a breach of these terms.
          </p>
        </div>

        <div>
          <h2 className="display text-[1.35rem] text-ink">4. Acceptable use</h2>
          <p className="mt-2">
            Do not attempt to access another business&apos;s data, submit fraudulent purchases, guess or reuse
            redemption codes, interfere with the service, scrape it, or use it to send unlawful content. We may suspend
            an account that we reasonably believe is being used to defraud a business or another customer.
          </p>
        </div>

        <div>
          <h2 className="display text-[1.35rem] text-ink">5. Availability and changes</h2>
          <p className="mt-2">
            The pilot is provided as-is. We aim for high availability but do not promise uninterrupted service, and we
            may change features as the product develops. Where a change would materially reduce a paid capability, we
            will give reasonable notice.
          </p>
        </div>

        <div>
          <h2 className="display text-[1.35rem] text-ink">6. Data and privacy</h2>
          <p className="mt-2">
            Our <a className="link" href="/privacy">privacy notice</a> explains what we collect. Businesses act as the
            controller of the loyalty data they generate; Repeato processes it to operate the service.
          </p>
        </div>

        <div>
          <h2 className="display text-[1.35rem] text-ink">7. Liability</h2>
          <p className="mt-2">
            To the extent permitted by law, Repeato is not liable for indirect or consequential loss, or for loss of
            profits, arising from use of the pilot. Nothing in these terms limits liability that cannot lawfully be
            limited.
          </p>
        </div>

        <div>
          <h2 className="display text-[1.35rem] text-ink">8. Contact</h2>
          <p className="mt-2">
            Questions about these terms: <a className="link" href="mailto:hello@repeato.app">hello@repeato.app</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
