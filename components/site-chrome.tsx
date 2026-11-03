import Link from "next/link";
import { ArrowUpRight, Coffee, Store } from "lucide-react";
import { Wordmark } from "./ui";
import { MarketingLink } from "./nav-link";
import { getSessionUser, homeFor } from "@/lib/auth";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/for-businesses", label: "For businesses" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export async function SiteHeader() {
  const user = await getSessionUser().catch(() => null);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
      <div className="wrap flex h-[68px] items-center justify-between gap-4">
        <Wordmark />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <MarketingLink key={item.href} href={item.href}>
              {item.label}
            </MarketingLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link href={homeFor(user.role)} className="btn btn-primary btn-sm">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login?as=customer"
                className="hidden rounded-full px-3 py-1.5 text-[0.84rem] font-medium text-ink-soft hover:text-ink sm:inline-flex sm:items-center sm:gap-1.5"
                title="Customer wallet sign in"
              >
                <Coffee size={14} className="text-copper" aria-hidden /> Customer wallet
              </Link>
              <Link
                href="/login?as=business"
                className="btn btn-ghost btn-sm hidden sm:inline-flex sm:items-center sm:gap-1.5"
                title="Merchant console sign in"
              >
                <Store size={14} className="text-brand" aria-hidden /> Merchant console
              </Link>
              <Link href="/signup" className="btn btn-primary btn-sm">
                Get started
              </Link>
            </>
          )}
          <details className="relative md:hidden">
            <summary className="btn btn-ghost btn-sm cursor-pointer list-none">Menu</summary>
            <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-line bg-white p-2 shadow-xl">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-paper-deep">
                  {item.label}
                </Link>
              ))}
              <div className="my-1 border-t border-line" />
              <Link href="/login?as=customer" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-paper-deep">
                <Coffee size={14} className="text-copper" aria-hidden /> Customer sign in
              </Link>
              <Link href="/login?as=business" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-paper-deep">
                <Store size={14} className="text-brand" aria-hidden /> Merchant sign in
              </Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-[#f5efe5]">
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            Loyalty for cafes and restaurants that runs on the counter, not in a drawer. Scan, join, earn, return.
          </p>
          <p className="eyebrow mt-5">Built for independent hospitality</p>
        </div>
        <FooterCol
          title="Product"
          links={[
            ["/features", "Features"],
            ["/how-it-works", "How it works"],
            ["/for-businesses", "For businesses"],
            ["/pricing", "Pricing"],
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            ["/about", "About"],
            ["/contact", "Contact"],
            ["/signup", "Create an account"],
            ["/login?as=customer", "Customer sign in"],
            ["/login?as=business", "Merchant console"],
          ]}
        />
        <FooterCol
          title="Legal"
          links={[
            ["/privacy", "Privacy"],
            ["/terms", "Terms"],
            ["/contact", "Support"],
          ]}
        />
      </div>
      <div className="border-t border-line">
        <div className="wrap flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Repeato. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Made for the hospitality floor <ArrowUpRight size={12} aria-hidden />
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="mono mb-3">{title}</p>
      <ul className="space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href + label}>
            <Link href={href} className="text-ink-soft hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
