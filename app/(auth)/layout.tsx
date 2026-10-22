import Link from "next/link";
import { Wordmark } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line">
        <div className="wrap flex h-[68px] items-center justify-between">
          <Wordmark />
          <Link href="/" className="text-[0.84rem] font-medium text-ink-soft hover:text-ink">← Back to site</Link>
        </div>
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
