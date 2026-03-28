import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 text-white">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Odds Compare
        </h1>
        <p className="mt-4 text-xl leading-relaxed text-slate-300">
          See what every game is actually worth &mdash; before the sportsbooks take their cut.
        </p>
        <p className="mt-3 text-base text-slate-500 max-w-lg mx-auto">
          We strip the vig from 19 sportsbooks, blend with Pythagorean and spread models,
          and show you the true win probabilities. Then we highlight where books are mispricing.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/live"
            className="inline-block rounded-xl bg-blue-600 px-8 py-3 text-lg font-semibold text-white transition hover:bg-blue-500"
          >
            View Projections
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3 text-left">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="text-2xl font-bold text-emerald-400">19+</div>
            <div className="text-sm text-slate-400 mt-1">Sportsbooks aggregated &amp; stripped of vig</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="text-2xl font-bold text-blue-400">3 Models</div>
            <div className="text-sm text-slate-400 mt-1">Consensus, Pythagorean, &amp; spread-implied blended</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="text-2xl font-bold text-amber-400">Edge Finder</div>
            <div className="text-sm text-slate-400 mt-1">See where each book is mispricing every game</div>
          </div>
        </div>
      </div>
    </main>
  );
}
