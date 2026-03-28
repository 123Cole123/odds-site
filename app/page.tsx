import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">Odds Compare</h1>
        <p className="mt-3 text-lg text-slate-400">
          Live lines from DraftKings, FanDuel, and Kalshi in one place.
        </p>
        <Link
          href="/live"
          className="mt-8 inline-block rounded-xl bg-blue-600 px-8 py-3 text-lg font-semibold text-white transition hover:bg-blue-500"
        >
          View Live Odds
        </Link>
      </div>
    </main>
  );
}
