import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-blue-600/[0.07] blur-[120px]" />
        </div>

        <div className="mx-auto max-w-4xl px-4 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400 ring-1 ring-emerald-500/20 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live — updating every 30 minutes
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.1]">
            Know the <span className="text-blue-400">real odds</span> before{" "}
            you bet.
          </h1>

          <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            We pull lines from 19 sportsbooks, strip the vig, blend with
            statistical models, and tell you exactly which pick to make &mdash;
            and where to bet it.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/live"
              className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-lg font-semibold text-white transition hover:bg-blue-500 shadow-lg shadow-blue-600/25"
            >
              See Today&apos;s Picks
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-white/[0.04] bg-[#080c16]">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <h2 className="text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-600 mb-12">
            How it works
          </h2>

          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Aggregate",
                desc: "We pull moneylines, spreads, and totals from 19 US sportsbooks in real time.",
                color: "text-blue-400",
                border: "border-blue-500/15",
              },
              {
                step: "02",
                title: "Model",
                desc: "Strip the vig. Blend market consensus with Pythagorean expectation and spread models.",
                color: "text-emerald-400",
                border: "border-emerald-500/15",
              },
              {
                step: "03",
                title: "Pick",
                desc: "See the true win probability, find mispriced lines, and know exactly where to bet.",
                color: "text-amber-400",
                border: "border-amber-500/15",
              },
            ].map((item) => (
              <div
                key={item.step}
                className={`rounded-2xl border ${item.border} bg-white/[0.02] p-6`}
              >
                <div className={`text-xs font-bold ${item.color} mb-3`}>
                  STEP {item.step}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-t border-white/[0.04]">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { value: "19+", label: "Sportsbooks", color: "text-blue-400" },
              { value: "3", label: "Blended Models", color: "text-emerald-400" },
              { value: "NBA & MLB", label: "Sports Covered", color: "text-amber-400" },
              { value: "30min", label: "Refresh Rate", color: "text-purple-400" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="mt-1 text-xs text-slate-600 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Research ── */}
      <section className="border-t border-white/[0.04] bg-[#080c16]">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 mb-6">
            Built on research
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Our projections cite peer-reviewed models: Pythagorean Win Expectation
            (James, 1980), Log5 head-to-head method, Stern&apos;s (1991) spread-probability
            conversion, and Moskowitz &amp; Wertheim&apos;s (2011) home advantage research.
            Not vibes &mdash; math.
          </p>
          <Link
            href="/live"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 transition"
          >
            See it in action <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
