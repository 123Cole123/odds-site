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
  TrendingUp,
  Trophy,
  Zap,
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
  BookEdge,
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

// Affiliate / sportsbook links — replace with real tracking URLs when you have them
const BOOK_LINKS: Record<string, string> = {
  draftkings: "https://www.draftkings.com",
  fanduel: "https://www.fanduel.com",
  betmgm: "https://www.betmgm.com",
  williamhill_us: "https://www.caesars.com/sportsbook-and-casino",
  pointsbetus: "https://www.pointsbet.com",
  betrivers: "https://www.betrivers.com",
  superbook: "https://www.superbook.com",
  bovada: "https://www.bovada.lv",
  betonlineag: "https://www.betonline.ag",
  mybookieag: "https://www.mybookie.ag",
  unibet_us: "https://www.unibet.com",
  espnbet: "https://www.espnbet.com",
  fanatics: "https://sportsbook.fanatics.com",
  hardrockbet: "https://www.hardrock.bet",
  lowvig: "https://www.lowvig.ag",
  betus: "https://www.betus.com.pa",
  wynnbet: "https://www.wynnbet.com",
  betfred: "https://www.betfred.com",
  fliff: "https://www.getfliff.com",
};

/* ─── Small UI components ─── */

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

function edgeColor(edge: number): string {
  if (edge >= 0.05) return "text-emerald-400 bg-emerald-500/10";
  if (edge >= 0.02) return "text-green-400 bg-green-500/10";
  if (edge > 0) return "text-lime-400 bg-lime-500/5";
  if (edge > -0.02) return "text-slate-400 bg-white/5";
  return "text-red-400 bg-red-500/10";
}

function edgeBg(edge: number): string {
  if (edge >= 0.05) return "border-emerald-500/30";
  if (edge >= 0.02) return "border-green-500/20";
  return "border-white/5";
}

function FactorRow({ factor }: { factor: Factor }) {
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

function BestOddsBadge({ book, price }: { book: string; price: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 ring-1 ring-amber-500/20">
      <Trophy className="h-3 w-3 text-amber-400" />
      <span className="text-xs font-semibold text-amber-300">{formatAmericanOdds(price)}</span>
      <span className="text-[10px] text-amber-400/70">at {book}</span>
    </div>
  );
}

/* ─── Edge Finder Table ─── */

function EdgeTable({ edges, homeTeam, awayTeam }: { edges: BookEdge[]; homeTeam: string; awayTeam: string }) {
  const [side, setSide] = useState<string>(homeTeam);
  const sideEdges = edges
    .filter((e) => e.side === side)
    .sort((a, b) => b.edge - a.edge);

  if (sideEdges.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Edge Finder</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setSide(homeTeam)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${side === homeTeam ? "bg-white/15 text-white" : "bg-white/5 text-slate-500 hover:bg-white/10"}`}
          >
            {homeTeam}
          </button>
          <button
            onClick={() => setSide(awayTeam)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${side === awayTeam ? "bg-white/15 text-white" : "bg-white/5 text-slate-500 hover:bg-white/10"}`}
          >
            {awayTeam}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {sideEdges.map((e) => {
          const edgePct = (e.edge * 100).toFixed(1);
          const positive = e.edge > 0;
          return (
            <div
              key={e.bookKey}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 ${edgeBg(e.edge)}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-white w-28 truncate">{e.book}</span>
                <span className="text-xs text-slate-500 tabular-nums">
                  Book: {(e.impliedProb * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500">→</span>
                <span className="text-xs text-slate-500 tabular-nums">
                  Model: {(e.modelProb * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${edgeColor(e.edge)}`}>
                  {positive ? "+" : ""}{edgePct}%
                </span>
                <span className="text-xs font-semibold text-slate-300 tabular-nums w-14 text-right">
                  {formatAmericanOdds(e.price)}
                </span>
                <a
                  href={BOOK_LINKS[e.bookKey] ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    e.edge >= 0.02
                      ? "bg-emerald-600 text-white hover:bg-emerald-500"
                      : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {e.edge >= 0.02 ? "Bet" : "View"}
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] text-slate-600">
        Edge = model probability − book implied probability. Green = potential value.
      </p>
    </div>
  );
}

/* ─── Projection Card (spreads, totals, props) ─── */

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

/* ─── Game Card ─── */

function GameCard({ game }: { game: GameProjection }) {
  const [showProps, setShowProps] = useState(false);
  const [showEdges, setShowEdges] = useState(false);

  const gameLines = game.projections.filter((p) => !p.isProp);
  const propLines = game.projections.filter((p) => p.isProp);
  const topEdge = game.edges.length > 0 ? game.edges[0] : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <SportBadge label={game.sportLabel} />
          <h3 className="text-lg font-semibold text-white">
            {game.awayTeam} @ {game.homeTeam}
          </h3>
          {topEdge && topEdge.edge >= 0.03 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
              <TrendingUp className="h-3 w-3" />
              +{(topEdge.edge * 100).toFixed(1)}% edge
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
          <span>{new Date(game.commenceTime).toLocaleString()}</span>
          <span>{game.booksTotal} books</span>
          <span>Agreement: {game.marketAgreement}/100</span>
        </div>
      </div>

      {/* Win probability hero */}
      {game.homeWinProb !== null && game.awayWinProb !== null && (
        <div className="mb-4 rounded-xl bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Win probability
            </div>
          </div>
          <div className="flex gap-4">
            <ProbBar value={game.awayWinProb} label={game.awayTeam} />
            <ProbBar value={game.homeWinProb} label={game.homeTeam} />
          </div>

          {/* Best odds badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            {game.bestAwayBook && (
              <div>
                <div className="text-[9px] text-slate-600 mb-0.5">{game.awayTeam} best odds</div>
                <BestOddsBadge book={game.bestAwayBook.book} price={game.bestAwayBook.price} />
              </div>
            )}
            {game.bestHomeBook && (
              <div>
                <div className="text-[9px] text-slate-600 mb-0.5">{game.homeTeam} best odds</div>
                <BestOddsBadge book={game.bestHomeBook.book} price={game.bestHomeBook.price} />
              </div>
            )}
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
              {game.spreadHome !== null && game.homeWinProb !== null && (
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

      {/* Edge Finder */}
      {game.edges.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowEdges(!showEdges)}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300"
          >
            {showEdges ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <Zap className="h-3 w-3" />
            Edge Finder — compare model vs. each book
          </button>
          {showEdges && (
            <div className="mt-2">
              <EdgeTable edges={game.edges} homeTeam={game.homeTeam} awayTeam={game.awayTeam} />
            </div>
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

/* ─── Loading skeleton ─── */

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 animate-pulse">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-5 w-10 rounded-md bg-white/10" />
            <div className="h-5 w-48 rounded-md bg-white/10" />
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 rounded bg-white/10" />
                <div className="h-2 w-full rounded-full bg-white/10" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 rounded bg-white/10" />
                <div className="h-2 w-full rounded-full bg-white/10" />
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-10 rounded-xl bg-white/5" />
            <div className="h-10 rounded-xl bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function LiveOddsPage() {
  const [sport, setSport] = useState("all");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true); // start true for auto-load
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true); // default ON
  const [sportFilter, setSportFilter] = useState<string>("all");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");
  const hasFetched = useRef(false);

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
        setNextRefresh(new Date(Date.now() + REFRESH_INTERVAL));
      }
    } catch (err: any) {
      setError(err.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }, [sport]);

  // Auto-fetch on mount
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchOdds();
    }
  }, [fetchOdds]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchOdds, REFRESH_INTERVAL);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchOdds]);

  // Countdown timer
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

  // Count total edges ≥ 3%
  const bigEdges = games.reduce(
    (sum, g) => sum + g.edges.filter((e) => e.edge >= 0.03).length,
    0
  );

  let filteredGames = games;
  if (sportFilter !== "all") {
    filteredGames = filteredGames.filter((g) => g.sportLabel === sportFilter);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Game Projections
          </h1>
          <p className="mt-2 max-w-xl mx-auto text-lg text-slate-400">
            See what every game is actually worth — before the sportsbooks take their cut.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            True win probabilities from {summary.totalGames > 0 ? `${games[0]?.booksTotal ?? 0}+` : "19"} sportsbooks, stripped of vig, blended with Pythagorean and spread models.
          </p>
        </div>

        {/* Controls */}
        <section className="mb-6 flex flex-wrap items-end justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Sport</label>
            <select
              value={sport}
              onChange={(e) => { setSport(e.target.value); hasFetched.current = false; }}
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
            {loading && !data ? "Loading..." : "Refresh"}
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
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
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
              <div className="text-2xl font-bold text-emerald-400">{bigEdges}</div>
              <div className="mt-0.5 text-xs text-slate-400">Edges 3%+</div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">{summary.highConfCount}</div>
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
          {loading && !data && <LoadingSkeleton />}

          {!loading && data && filteredGames.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/50 p-8 text-center">
              <p className="text-sm text-slate-400">No games found for this filter. Games may not be scheduled yet.</p>
            </div>
          )}

          {filteredGames.map((game) => (
            <GameCard key={game.gameId} game={game} />
          ))}
        </section>

        {data && (
          <p className="mt-8 text-center text-[11px] text-slate-600">
            Projections blend no-vig consensus (50%), Pythagorean win expectation (25%), and spread-implied probability (25%).
            Based on James (1980), Stern (1991), and Moskowitz &amp; Wertheim (2011). Not financial advice.
          </p>
        )}
      </div>
    </main>
  );
}
