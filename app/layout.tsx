import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "Repeato — turn first-time visitors into regulars",
    template: "%s · Repeato",
  },
  description:
    "QR-based loyalty for cafes and restaurants. Customers scan, join in seconds, earn points on verified purchases, and come back for rewards.",
  openGraph: {
    title: "Repeato — turn first-time visitors into regulars",
    description:
      "A QR code on the counter. Verified purchases. Points that bring customers back.",
    type: "website",
    url: "/",
    siteName: "Repeato",
  },
  twitter: { card: "summary_large_image", title: "Repeato", description: "QR-based loyalty for cafes and restaurants." },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
