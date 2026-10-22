export const metadata = {
  title: "Privacy",
  description: "What Repeato collects, why, and what it does not do with your data.",
};

const updated = "23 October 2026";

export default function PrivacyPage() {
  return (
    <section className="wrap max-w-3xl py-14 md:py-20">
      <p className="eyebrow mb-3">Legal</p>
      <h1 className="display text-[2.3rem] md:text-[2.8rem]">Privacy notice</h1>
      <p className="mt-2 text-[0.8rem] text-muted">Last updated {updated}</p>

      <div className="mt-8 space-y-7 text-[0.93rem] leading-relaxed text-ink-soft">
        <p className="rounded-xl border border-line bg-white p-4 text-[0.85rem]">
          <strong className="text-ink">Plain-language summary.</strong> We collect the account details you give us and
          the loyalty activity generated when a business records your purchase. We do not sell data, do not run
          advertising trackers on this site, and do not store card details.
        </p>

        <div>
          <h2 className="display text-[1.35rem] text-ink">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li><strong>Account data:</strong> name, email address, optional phone number, and a salted password hash. Passwords are never stored in readable form.</li>
            <li><strong>Loyalty data:</strong> the businesses you join, verified purchase amounts, points earned and spent, rewards redeemed, and voucher status.</li>
            <li><strong>Operational data:</strong> session records (hashed tokens), audit entries for sensitive actions, and in-app notifications.</li>
            <li><strong>Contact form:</strong> the name, email, business name, and message you submit.</li>
          </ul>
        </div>

        <div>
          <h2 className="display text-[1.35rem] text-ink">Why we use it</h2>
          <p className="mt-2">
            To operate your account, maintain accurate per-business balances, let a business verify a purchase or
            voucher you present, show you your own history, and keep an audit trail for disputes. Staff of a business
            you joined can see your name, email, and your activity with that business only — never your activity at
            another business.
          </p>
        </div>

        <div>
          <h2 className="display text-[1.35rem] text-ink">What we do not do</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>We do not sell or rent personal data.</li>
            <li>We do not store payment card numbers; payments happen at the business&apos;s own till.</li>
            <li>We do not send marketing email unless a provider is configured and you opt in. Transactional in-app notifications are part of the service.</li>
            <li>We do not use third-party advertising or cross-site tracking scripts on this site.</li>
          </ul>
        </div>

        <div>
          <h2 className="display text-[1.35rem] text-ink">Retention and deletion</h2>
          <p className="mt-2">
            Account and loyalty records are kept while your account is active. Because points ledgers are financial
            records for the business, a business may retain the transaction history it is legally required to keep.
            To request deletion of your account, email{" "}
            <a className="link" href="mailto:hello@repeato.app">hello@repeato.app</a> from the address on the account.
          </p>
        </div>

        <div>
          <h2 className="display text-[1.35rem] text-ink">Security</h2>
          <p className="mt-2">
            Passwords use scrypt with a per-password salt. Sessions use random tokens stored as SHA-256 hashes in
            HTTP-only cookies. Access to business data is checked on the server for every action. No system is
            perfectly secure; if you believe your account is compromised, contact us immediately.
          </p>
        </div>

        <div>
          <h2 className="display text-[1.35rem] text-ink">Who we share with</h2>
          <p className="mt-2">
            Only the businesses you choose to join see your activity with them, and only to run their loyalty
            programme. Infrastructure providers (hosting, database) process data on our behalf. A named legal entity,
            registered address, and grievance officer will be published here before commercial launch; until then this
            pilot notice governs.
          </p>
        </div>

        <div>
          <h2 className="display text-[1.35rem] text-ink">Contact</h2>
          <p className="mt-2">
            Questions or requests: <a className="link" href="mailto:hello@repeato.app">hello@repeato.app</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
