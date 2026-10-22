"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, Home, Ticket, User, Wallet } from "lucide-react";

const TABS = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/rewards", label: "Rewards", icon: Gift },
  { href: "/app/wallet", label: "Wallet", icon: Wallet },
  { href: "/app/vouchers", label: "Vouchers", icon: Ticket },
  { href: "/app/profile", label: "Profile", icon: User },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));
}

export function CustomerTabs() {
  const isActive = useIsActive();

  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Customer">
      {TABS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 text-[0.85rem] font-medium ${
            isActive(href) ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

// Rendered outside the sticky header: its backdrop-blur would anchor this fixed bar to the header.
export function CustomerBottomBar() {
  const isActive = useIsActive();

  return (
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur md:hidden"
        aria-label="Customer sections"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.66rem] font-medium ${
                    active ? "text-brand" : "text-muted"
                  }`}
                >
                  <Icon size={19} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
  );
}
