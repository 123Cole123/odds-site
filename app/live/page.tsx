"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Target,
  AlertCircle,
  Home,
  Plane,
  Info,
  Users,
} from "lucide-react";
import { DISPLAY_SPORTS } from "@/lib/odds/sports";
import {
  KalshiLine,
  formatAmericanOdds,
  centsToPercentDisplay,
  SportsbookLine,
} from "@/lib/odds/normalize";
import {
  buildProjections,
  projectionsSummary,
  GameProjection,
  Projection,
  Factor,
} from "@/lib/odds/analyze";

type ApiResponse = {
  ok: boolean;
  fetchedAt: string;
  sport: string;
  kalshiSeriesTicker: string | null;
  sportsbookLines: SportsbookLine[];
  kalshiLines: KalshiLine[];
  error?: string;
};

const REFRESH_INTERVAL = 30 * 60 * 1000;

const SPORT_COLORS: Record<string, string> = {
  NBA: "bg-orange-500/20 text-orange-400 ring-orange-500/30",
  MLB: "bg-red-500/20 text-red-400 ring-red-500/30",
};

function SportBadge({ label }: { label: string }) {
  const colors = SPORT_COLORS[label] ?? "bg-slate-500/20 text-slate-400 ring-slate-500/30";
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${colors}`}>
      {label}
    </span>
  );
}

function ProbBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 65 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : pct >= 35 ? "bg-amber-500" : "bg-slate-500";
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <span className={`text-lg font-bold tabular-nums ${pct >= 50 ? "text-white" : "text-slate-400"}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ConfBadge({ level }: { level: "high" | "medium" | "low" }) {
  if (level === "high")
    return <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">High confidence</span>;
  if (level === "medium")
    return <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400 ring-1 ring-blue-500/30">Medium confidence</span>;
  return <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-semibold text-slate-400 ring-1 ring-slate-500/30">Low confidence</span>;
}

function FactorRow({ factor }: { factor: Factor }) {
  const icon =
    factor.name.includes("Home") ? <Home className="h-3 w-3" /> :
    factor.name.includes("Road") ? <Plane className="h-3 w-3" /> :
    factor.name.includes("consensus") ? <Users className="h-3 w-3" /> :
    <Info className="h-3 w-3" />;

  const dot =
    factor.impact === "supports" ? "bg-emerald-500" :
    factor.impact === "against" ? "bg-red-500" : "bg-slate-500";

  return (
    <div className="flex items-start gap-2 text-sm">
      <span className={`mt-1.5 block h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />
      <div>
        <span className="font-medium text-slate-300">{factor.name}: </span>
        <span className="text-slate-400">{factor.detail}</span>
        {factor.citation && (
          <span className="ml-1 text-[10px] italic text-slate-600">[{factor.citation}]</span>
        )}
      </div>
    </div>
  );
}

function ProjectionCard({ proj }: { proj: Projection }) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.round(proj.probability * 100);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-3 flex-1">
          {proj.isProp && (
            <span className="rounded-md bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-400 ring-1 ring-purple-500/30">
              PROP
            </span>
          )}
          <span className="text-sm font-medium text-white">{proj.label}</span>
          <ConfBadge level={proj.confidenceLevel} />
          <span className="text-[10px] text-slate-500">{proj.booksUsed} books</span>
        </div>
        <div className="ml-3 flex items-center gap-3">
          <div className="text-right">
            <div className={`text-lg font-bold tabular-nums ${pct >= 55 ? "text-emerald-400" : pct >= 45 ? "text-white" : "text-slate-400"}`}>
              {pct}%
            </div>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-3 pb-3 pt-2">
          {/* Probability bar */}
          <div className="mb-3">
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${pct >= 55 ? "bg-emerald-500" : pct >= 45 ? "bg-blue-500" : "bg-slate-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-500">
              <span>0%</span>
              <span>{pct}% projected</span>
              <span>100%</span>
            </div>
          </div>

          {/* Best available line */}
          <div className="mb-3 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
            <div>
              <div className="text-[10px] uppercase text-slate-500">Best available line</div>
              <div className="text-base font-bold text-white">{formatAmericanOdds(proj.bestPrice)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500">at {proj.bestBook}</div>
              {proj.bestLink && (
                <a
                  href={proj.bestLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* Factors */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              What goes into this projection
            </div>
            {proj.factors.map((f, i) => (
              <FactorRow key={i} factor={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GameCard({ game }: { game: GameProjection }) {
  const [showProps, setShowProps] = useState(false);

  const gameLines = game.projections.filter((p) => !p.isProp);
  const propLines = game.projections.filter((p) => p.isProp);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <SportBadge label={game.sportLabel} />
          <h3 className="text-lg font-semibold text-white">
            {game.awayTeam} @ {game.homeTeam}
          </h3>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
          <span>{new Date(game.commenceTime).toLocaleString()}</span>
          <span>{game.booksTotal} books</span>
          <span>Agreement: {game.marketAgreement}/100</span>
        </div>
      </div>

      {/* Win probability hero */}
      {game.homeWinProb !== null && game.awayWinProb !== null && (
        <div className="mb-4 rounded-xl bg-white/5 p-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Win probability
          </div>
          <div className="flex gap-4">
            <ProbBar value={game.awayWinProb} label={game.awayTeam} />
            <ProbBar value={game.homeWinProb} label={game.homeTeam} />
          </div>

          {/* Expected scoring & spread/total */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            {game.spreadHome !== null && (
              <span>Spread: {game.homeTeam} {game.spreadHome > 0 ? "+" : ""}{game.spreadHome}</span>
            )}
            {game.projectedTotal !== null && (
              <span>O/U: {game.projectedTotal}</span>
            )}
            {game.homeExpectedPts !== null && game.awayExpectedPts !== null && (
              <span>Expected: {game.awayTeam} {game.awayExpectedPts} &ndash; {game.homeTeam} {game.homeExpectedPts}</span>
            )}
            {game.marginOfVictory !== null && game.marginOfVictory > 0 && (
              <span>MOV: {game.marginOfVictory}</span>
            )}
          </div>

          {/* Model breakdown */}
          {(game.consensusHomeProb !== null || game.pythagHomeProb !== null) && (
            <div className="mt-3 flex flex-wrap gap-3">
              {game.consensusHomeProb !== null && (
                <div className="rounded-lg bg-white/5 px-3 py-1.5 text-center">
                  <div className="text-[10px] text-slate-500">Consensus</div>
                  <div className="text-sm font-semibold text-blue-400">
                    {Math.round(game.consensusHomeProb * 100)}%
                  </div>
                </div>
              )}
              {game.pythagHomeProb !== null && (
                <div className="rounded-lg bg-white/5 px-3 py-1.5 text-center">
                  <div className="text-[10px] text-slate-500">Pythagorean</div>
                  <div className="text-sm font-semibold text-amber-400">
                    {Math.round(game.pythagHomeProb * 100)}%
                  </div>
                </div>
              )}
              {game.spreadHome !== null && (
                <div className="rounded-lg bg-white/5 px-3 py-1.5 text-center">
                  <div className="text-[10px] text-slate-500">Spread-implied</div>
                  <div className="text-sm font-semibold text-emerald-400">
                    {Math.round(game.homeWinProb * 100)}%
                  </div>
                </div>
              )}
              <div className="flex items-center text-[10px] text-slate-600 italic">
                {game.homeTeam} win %
              </div>
            </div>
          )}

          {/* Model notes */}
          {game.modelNotes.length > 0 && (
            <details className="mt-3 text-xs text-slate-500">
              <summary className="cursor-pointer hover:text-slate-400">Model details</summary>
              <ul className="mt-1.5 space-y-1 pl-3 text-[11px]">
                {game.modelNotes.map((note, i) => (
                  <li key={i} className="text-slate-600">{note}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Game line projections */}
      <div className="space-y-2">
        {gameLines.map((p) => (
          <ProjectionCard key={`${p.marketKey}__${p.side}__${p.point}__${p.playerName ?? ""}`} proj={p} />
        ))}
      </div>

      {/* Player props */}
      {propLines.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowProps(!showProps)}
            className="flex items-center gap-1.5 text-xs font-medium text-purple-400 hover:text-purple-300"
          >
            {showProps ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {propLines.length} player prop{propLines.length === 1 ? "" : "s"}
          </button>
          {showProps && (
            <div className="mt-2 space-y-2">
              {propLines.map((p) => (
                <ProjectionCard key={`${p.marketKey}__${p.side}__${p.point}__${p.playerName ?? ""}`} proj={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LiveOddsPage() {
  const [sport, setSport] = useState("all");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [sportFilter, setSportFilter] = useState<string>("all");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");

  const fetchOdds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sport !== "all") params.set("sport", sport);
      const res = await fetch(`/api/odds/live?${params.toString()}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Request failed");
      } else {
        setData(json);
        if (autoRefresh) setNextRefresh(new Date(Date.now() + REFRESH_INTERVAL));
      }
    } catch (err: any) {
      setError(err.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }, [sport, autoRefresh]);

  useEffect(() => {
    if (autoRefresh) {
      setNextRefresh(new Date(Date.now() + REFRESH_INTERVAL));
      intervalRef.current = setInterval(fetchOdds, REFRESH_INTERVAL);
    } else {
      setNextRefresh(null);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchOdds]);

  useEffect(() => {
    if (!nextRefresh) { setCountdown(""); return; }
    const tick = () => {
      const diff = nextRefresh.getTime() - Date.now();
      if (diff <= 0) { setCountdown("Refreshing..."); return; }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setCountdown(`${mins}m ${secs.toString().padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRefresh]);

  const games = data ? buildProjections(data.sportsbookLines) : [];
  const summary = projectionsSummary(games);

  let filteredGames = games;
  if (sportFilter !== "all") {
    filteredGames = filteredGames.filter((g) => g.sportLabel === sportFilter);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Game Projections</h1>
          <p className="mt-2 text-slate-400">
            Weighted probabilities from {summary.totalGames > 0 ? `${games[0]?.booksTotal ?? 0}+` : "19"} sportsbooks, stripped of vig, averaged into one number.
          </p>
        </div>

        {/* Controls */}
        <section className="mb-6 flex flex-wrap items-end justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Sport</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DISPLAY_SPORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchOdds}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Building projections..." : "Build Projections"}
          </button>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-white/20 bg-slate-800"
            />
            Auto (30 min)
          </label>

          {countdown && <span className="text-xs text-slate-500">Next: {countdown}</span>}
        </section>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Summary */}
        {data && (
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="text-2xl font-bold text-white">{summary.totalGames}</div>
              <div className="mt-0.5 text-xs text-slate-400">Games</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="text-2xl font-bold text-white">{summary.gameLineCount}</div>
              <div className="mt-0.5 text-xs text-slate-400">Game Lines</div>
            </div>
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.04] p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{summary.propCount}</div>
              <div className="mt-0.5 text-xs text-slate-400">Player Props</div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{summary.highConfCount}</div>
              <div className="mt-0.5 text-xs text-slate-400">High Confidence</div>
            </div>
          </section>
        )}

        {/* Sport filter */}
        {data && summary.sportsWithGames.length > 1 && (
          <div className="mb-4 flex gap-1.5">
            <button
              onClick={() => setSportFilter("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${sportFilter === "all" ? "bg-white/15 text-white" : "bg-white/5 text-slate-500 hover:bg-white/10"}`}
            >
              All
            </button>
            {summary.sportsWithGames.map((s) => (
              <button
                key={s}
                onClick={() => setSportFilter(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${sportFilter === s ? "bg-white/15 text-white" : "bg-white/5 text-slate-500 hover:bg-white/10"}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {data && (
          <p className="mb-4 text-xs text-slate-500">
            Built at {new Date(data.fetchedAt).toLocaleTimeString()} &middot;{" "}
            {summary.totalProjections} projections across {summary.totalGames} games
            &middot; Avg book agreement: {summary.avgAgreement}/100
          </p>
        )}

        {/* Games */}
        <section className="space-y-4">
          {!data && !loading && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/50 p-12 text-center">
              <Target className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-3 text-slate-400">
                Hit <strong>Build Projections</strong> to generate win probabilities for today&apos;s NBA and MLB games.
              </p>
            </div>
          )}

          {data && filteredGames.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/50 p-8 text-center">
              <p className="text-sm text-slate-400">No games found for this filter.</p>
            </div>
          )}

          {filteredGames.map((game) => (
            <GameCard key={game.gameId} game={game} />
          ))}
        </section>

        {data && (
          <p className="mt-8 text-center text-[11px] text-slate-600">
            Projections are weighted averages of no-vig implied probabilities across all available sportsbooks.
            More books = higher confidence. This is not financial advice.
          </p>
        )}
      </div>
    </main>
  );
}
