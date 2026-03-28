import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 text-white">
      <div className="max-w-xl text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Odds Compare
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-400">
          We scan DraftKings and FanDuel every 30 minutes, find mispriced lines,
          and tell you exactly what we&apos;d take &mdash; backed by expected
          value, fair probability, and Kelly Criterion math.
        </p>
        <Link
          href="/live"
          className="mt-8 inline-block rounded-xl bg-blue-600 px-8 py-3 text-lg font-semibold text-white transition hover:bg-blue-500"
        >
          See Today&apos;s Plays
        </Link>
      </div>
    </main>
  );
}
