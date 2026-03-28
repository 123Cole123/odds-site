import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Odds Compare — True Win Probabilities & Edge Finder",
  description:
    "Strip the vig from 19 sportsbooks. See true win probabilities, find edges, and know exactly which pick to make for every NBA and MLB game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0b0f1a]">
        {/* ── Navbar ── */}
        <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0b0f1a]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white">
                OC
              </div>
              <span className="text-base font-bold tracking-tight text-white">
                Odds Compare
              </span>
            </Link>

            <div className="flex items-center gap-1">
              <Link
                href="/live"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                Projections
              </Link>
              <Link
                href="/live"
                className="ml-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Today&apos;s Picks
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Content ── */}
        <main className="flex-1">{children}</main>

        {/* ── Footer ── */}
        <footer className="border-t border-white/[0.06] bg-[#080c16]">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600/80 text-[10px] font-black text-white">
                  OC
                </div>
                <span className="text-sm font-semibold text-slate-500">
                  Odds Compare
                </span>
              </div>
              <div className="text-center text-xs text-slate-600">
                Probabilities are model estimates, not guarantees. Gamble responsibly.
                Data from The Odds API.
              </div>
              <div className="text-xs text-slate-600">
                &copy; {new Date().getFullYear()} Odds Compare
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
