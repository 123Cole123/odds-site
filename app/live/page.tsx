"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Home,
  Plane,
  Info,
  Users,
  TrendingUp,
  Trophy,
  Zap,
  Target,
  ArrowRight,
  Check,
  Clock,
  BarChart3,
} from "lucide-react";
import { DISPLAY_SPORTS } from "@/lib/odds/sports";
import {
  formatAmericanOdds,
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
  kalshiLines: any[];
  error?: string;
};

const REFRESH_INTERVAL = 30 * 60 * 1000;

// Affiliate links — replace with real tracking URLs
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

/* ═══════════════════════════════════════════════════════════════════════════ */
/* HELPER: Determine the "Our Pick" for a game                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

type PickRecommendation = {
  side: string;
  type: "moneyline" | "spread";
  label: string;
  probability: number;
  edge: number; // biggest edge found for this side
  bestBook: string;
  bestBookKey: string;
  bestPrice: number;
  confidence: "strong" | "lean" | "toss-up";
  reasoning: string;
};

function getPickRecommendation(game: GameProjection): PickRecommendation | null {
  if (game.homeWinProb === null || game.awayWinProb === null) return null;

  const favSide = game.homeWinProb >= game.awayWinProb ? game.homeTeam : game.awayTeam;
  const favProb = Math.max(game.homeWinProb, game.awayWinProb);
  const dogSide = favSide === game.homeTeam ? game.awayTeam : game.homeTeam;

  // Find the biggest edge for either side
  const homeEdges = game.edges.filter((e) => e.side === game.homeTeam);
  const awayEdges = game.edges.filter((e) => e.side === game.awayTeam);

  const bestHomeEdge = homeEdges.length > 0
    ? homeEdges.reduce((best, e) => (e.edge > best.edge ? e : best))
    : null;
  const bestAwayEdge = awayEdges.length > 0
    ? awayEdges.reduce((best, e) => (e.edge > best.edge ? e : best))
    : null;

  // Determine which side has the best edge
  let pickSide: string;
  let pickProb: number;
  let bestEdge: BookEdge | null;

  // Prefer the side with the biggest edge, but only if it's positive
  if (bestHomeEdge && bestAwayEdge) {
    if (bestHomeEdge.edge > bestAwayEdge.edge) {
      pickSide = game.homeTeam;
      pickProb = game.homeWinProb;
      bestEdge = bestHomeEdge;
    } else {
      pickSide = game.awayTeam;
      pickProb = game.awayWinProb;
      bestEdge = bestAwayEdge;
    }
  } else if (bestHomeEdge) {
    pickSide = game.homeTeam;
    pickProb = game.homeWinProb;
    bestEdge = bestHomeEdge;
  } else if (bestAwayEdge) {
    pickSide = game.awayTeam;
    pickProb = game.awayWinProb;
    bestEdge = bestAwayEdge;
  } else {
    // No edges — just pick the favorite
    pickSide = favSide;
    pickProb = favProb;
    bestEdge = null;
  }

  const edge = bestEdge?.edge ?? 0;

  // Confidence
  let confidence: "strong" | "lean" | "toss-up";
  if (pickProb >= 0.6 && edge >= 0.03) confidence = "strong";
  else if (pickProb >= 0.53 || edge >= 0.02) confidence = "lean";
  else confidence = "toss-up";

  // Determine if spread is better than ML
  let type: "moneyline" | "spread" = "moneyline";
  let label = `${pickSide} ML`;

  if (game.spreadHome !== null) {
    const isHome = pickSide === game.homeTeam;
    const spread = isHome ? game.spreadHome : -(game.spreadHome);
    // If spread is large (> 5 pts NBA, > 1.5 MLB), suggest spread
    const bigSpread = game.sportLabel === "NBA" ? 5 : 1.5;
    if (Math.abs(spread) >= bigSpread && pickProb >= 0.6) {
      type = "spread";
      label = `${pickSide} ${spread > 0 ? "+" : ""}${spread}`;
    }
  }

  // Build reasoning
  let reasoning = "";
  if (confidence === "strong") {
    reasoning = `Our model gives ${pickSide} a ${(pickProb * 100).toFixed(0)}% win probability`;
    if (edge > 0 && bestEdge) {
      reasoning += ` with a ${(edge * 100).toFixed(1)}% edge at ${bestEdge.book}`;
    }
    reasoning += ". Strong pick.";
  } else if (confidence === "lean") {
    reasoning = `Model leans ${pickSide} at ${(pickProb * 100).toFixed(0)}%`;
    if (edge > 0 && bestEdge) {
      reasoning += `. ${(edge * 100).toFixed(1)}% edge available at ${bestEdge.book}`;
    }
    reasoning += ".";
  } else {
    reasoning = `Close game — model has it ${(pickProb * 100).toFixed(0)}-${(100 - pickProb * 100).toFixed(0)}. Proceed with caution.`;
  }

  return {
    side: pickSide,
    type,
    label,
    probability: pickProb,
    edge,
    bestBook: bestEdge?.book ?? (pickSide === game.homeTeam ? (game.bestHomeBook?.book ?? "") : (game.bestAwayBook?.book ?? "")),
    bestBookKey: bestEdge?.bookKey ?? "",
    bestPrice: bestEdge?.price ?? 0,
    confidence,
    reasoning,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* SMALL UI COMPONENTS                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

const SPORT_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  NBA: { bg: "bg-orange-500/15", text: "text-orange-400", ring: "ring-orange-500/25" },
  MLB: { bg: "bg-red-500/15", text: "text-red-400", ring: "ring-red-500/25" },
};

function SportBadge({ label }: { label: string }) {
  const c = SPORT_COLORS[label] ?? { bg: "bg-slate-500/15", text: "text-slate-400", ring: "ring-slate-500/25" };
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${c.bg} ${c.text} ${c.ring}`}>
      {label}
    </span>
  );
}

function ConfidencePill({ level }: { level: "strong" | "lean" | "toss-up" }) {
  if (level === "strong")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 ring-1 ring-emerald-500/25">
        <Check className="h-3 w-3" /> STRONG PICK
      </span>
    );
  if (level === "lean")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-400 ring-1 ring-blue-500/25">
        <TrendingUp className="h-3 w-3" /> LEAN
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2.5 py-0.5 text-[11px] font-bold text-slate-400 ring-1 ring-slate-500/25">
      TOSS-UP
    </span>
  );
}

function WinProbRing({
  value,
  size = 72,
  strokeWidth = 5,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
}) {
  const pct = Math.round(value * 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value * circumference);
  const color =
    pct >= 65 ? "stroke-emerald-500" : pct >= 55 ? "stroke-blue-500" : pct >= 45 ? "stroke-amber-500" : "stroke-slate-500";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-base font-bold tabular-nums text-white">{pct}%</span>
    </div>
  );
}

function ProbBar({ value, label, isWinner }: { value: number; label: string; isWinner: boolean }) {
  const pct = Math.round(value * 100);
  const color = isWinner ? "bg-emerald-500" : "bg-slate-600";

  return (
    <div className="flex-1">
      <div className="mb-1 flex items-baseline justify-between">
        <span className={`text-sm ${isWinner ? "font-semibold text-white" : "text-slate-400"}`}>{label}</span>
        <span className={`text-xl font-bold tabular-nums ${isWinner ? "text-white" : "text-slate-500"}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function edgeColor(edge: number): string {
  if (edge >= 0.05) return "text-emerald-400";
  if (edge >= 0.03) return "text-green-400";
  if (edge >= 0.01) return "text-lime-400";
  if (edge > -0.01) return "text-slate-500";
  return "text-red-400";
}

function FactorRow({ factor }: { factor: Factor }) {
  const dot =
    factor.impact === "supports" ? "bg-emerald-500" :
    factor.impact === "against" ? "bg-red-500" : "bg-slate-600";

  return (
    <div className="flex items-start gap-2 text-[13px] leading-relaxed">
      <span className={`mt-[7px] block h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot}`} />
      <div>
        <span className="font-medium text-slate-300">{factor.name}: </span>
        <span className="text-slate-500">{factor.detail}</span>
        {factor.citation && (
          <span className="ml-1 text-[10px] italic text-slate-700">[{factor.citation}]</span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* EDGE TABLE                                                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

function EdgeTable({ edges, homeTeam, awayTeam }: { edges: BookEdge[]; homeTeam: string; awayTeam: string }) {
  const [side, setSide] = useState<string>(homeTeam);
  const sideEdges = edges.filter((e) => e.side === side).sort((a, b) => b.edge - a.edge);
  if (sideEdges.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Edge Finder</span>
        </div>
        <div className="flex rounded-lg bg-white/[0.04] p-0.5">
          {[homeTeam, awayTeam].map((team) => (
            <button
              key={team}
              onClick={() => setSide(team)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                side === team ? "bg-white/10 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {team}
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div className="mb-1 grid grid-cols-[1fr_80px_80px_70px_60px_56px] gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
        <span>Book</span>
        <span className="text-right">Book Prob</span>
        <span className="text-right">Our Prob</span>
        <span className="text-right">Edge</span>
        <span className="text-right">Odds</span>
        <span />
      </div>

      <div className="space-y-1">
        {sideEdges.map((e) => (
          <div
            key={e.bookKey}
            className={`grid grid-cols-[1fr_80px_80px_70px_60px_56px] items-center gap-2 rounded-lg px-3 py-2 transition ${
              e.edge >= 0.03 ? "bg-emerald-500/[0.06] border border-emerald-500/15" : "bg-white/[0.02] border border-transparent"
            }`}
          >
            <span className="text-sm font-medium text-slate-300 truncate">{e.book}</span>
            <span className="text-right text-xs tabular-nums text-slate-500">
              {(e.impliedProb * 100).toFixed(1)}%
            </span>
            <span className="text-right text-xs tabular-nums text-slate-400">
              {(e.modelProb * 100).toFixed(1)}%
            </span>
            <span className={`text-right text-xs font-bold tabular-nums ${edgeColor(e.edge)}`}>
              {e.edge > 0 ? "+" : ""}{(e.edge * 100).toFixed(1)}%
            </span>
            <span className="text-right text-xs font-semibold tabular-nums text-slate-300">
              {formatAmericanOdds(e.price)}
            </span>
            <a
              href={BOOK_LINKS[e.bookKey] ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className={`rounded-md px-2 py-1 text-center text-[11px] font-semibold transition ${
                e.edge >= 0.02
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-white/[0.06] text-slate-400 hover:bg-white/10"
              }`}
            >
              {e.edge >= 0.02 ? "Bet" : "View"}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* PROJECTION CARD (spreads, totals, props)                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

function ProjectionCard({ proj }: { proj: Projection }) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.round(proj.probability * 100);

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] transition hover:bg-white/[0.025]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {proj.isProp && (
            <span className="flex-shrink-0 rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold text-purple-400 ring-1 ring-purple-500/25">
              PROP
            </span>
          )}
          <span className="text-sm font-medium text-white truncate">{proj.label}</span>
          <span className="flex-shrink-0 text-[10px] text-slate-600">{proj.booksUsed} books</span>
        </div>
        <div className="ml-3 flex items-center gap-2">
          <span className={`text-base font-bold tabular-nums ${pct >= 55 ? "text-emerald-400" : pct >= 45 ? "text-white" : "text-slate-500"}`}>
            {pct}%
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-600" /> : <ChevronDown className="h-4 w-4 text-slate-600" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.04] px-4 pb-4 pt-3 space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600">Best line</div>
              <div className="text-lg font-bold text-white">{formatAmericanOdds(proj.bestPrice)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-600">at {proj.bestBook}</div>
              {proj.bestLink && (
                <a href={proj.bestLink} target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Analysis</div>
            {proj.factors.map((f, i) => <FactorRow key={i} factor={f} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* GAME CARD — The main event                                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

function GameCard({ game, rank }: { game: GameProjection; rank: number }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showEdges, setShowEdges] = useState(false);
  const [showProps, setShowProps] = useState(false);

  const pick = getPickRecommendation(game);
  const gameLines = game.projections.filter((p) => !p.isProp);
  const propLines = game.projections.filter((p) => p.isProp);
  const isTopPick = rank === 0 && pick?.confidence === "strong";

  return (
    <div className={`rounded-2xl border bg-[#111827]/80 overflow-hidden ${
      isTopPick
        ? "border-emerald-500/25 top-pick-glow"
        : "border-white/[0.06]"
    }`}>

      {/* ── Top Pick Banner ── */}
      {isTopPick && (
        <div className="flex items-center gap-2 bg-emerald-500/10 px-5 py-2 text-emerald-400">
          <Trophy className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Top Pick of the Day</span>
        </div>
      )}

      <div className="p-5">
        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SportBadge label={game.sportLabel} />
              <span className="text-xs text-slate-600">
                <Clock className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                {new Date(game.commenceTime).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white">
              {game.awayTeam} <span className="text-slate-600 font-normal">@</span> {game.homeTeam}
            </h3>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-600">
              <span>{game.booksTotal} books</span>
              <span>Agreement: {game.marketAgreement}/100</span>
            </div>
          </div>
        </div>

        {/* ═══ OUR PICK — The hero section ═══ */}
        {pick && (
          <div className={`rounded-xl p-4 mb-4 ${
            pick.confidence === "strong"
              ? "bg-emerald-500/[0.08] border border-emerald-500/20"
              : pick.confidence === "lean"
              ? "bg-blue-500/[0.06] border border-blue-500/15"
              : "bg-white/[0.03] border border-white/[0.06]"
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <WinProbRing value={pick.probability} />
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Our Pick</span>
                    <ConfidencePill level={pick.confidence} />
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {pick.label}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-400 max-w-md">
                    {pick.reasoning}
                  </p>
                </div>
              </div>

              {pick.bestBook && pick.bestPrice !== 0 && (
                <a
                  href={BOOK_LINKS[pick.bestBookKey] ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${
                    pick.confidence === "strong"
                      ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
                      : "bg-blue-600 text-white hover:bg-blue-500"
                  }`}
                >
                  Bet at {pick.bestBook}
                  <span className="font-mono">{formatAmericanOdds(pick.bestPrice)}</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              )}
            </div>

            {/* Best odds per side */}
            <div className="mt-3 flex flex-wrap gap-2">
              {game.bestAwayBook && (
                <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                  <Trophy className="h-3 w-3 text-amber-400" />
                  <span className="text-xs text-slate-400">{game.awayTeam} best:</span>
                  <span className="text-xs font-bold text-white">{formatAmericanOdds(game.bestAwayBook.price)}</span>
                  <span className="text-[10px] text-slate-600">at {game.bestAwayBook.book}</span>
                </div>
              )}
              {game.bestHomeBook && (
                <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                  <Trophy className="h-3 w-3 text-amber-400" />
                  <span className="text-xs text-slate-400">{game.homeTeam} best:</span>
                  <span className="text-xs font-bold text-white">{formatAmericanOdds(game.bestHomeBook.price)}</span>
                  <span className="text-[10px] text-slate-600">at {game.bestHomeBook.book}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Win Probability Bars ── */}
        {game.homeWinProb !== null && game.awayWinProb !== null && (
          <div className="mb-4">
            <div className="flex gap-6">
              <ProbBar value={game.awayWinProb} label={game.awayTeam} isWinner={game.awayWinProb > game.homeWinProb} />
              <ProbBar value={game.homeWinProb} label={game.homeTeam} isWinner={game.homeWinProb >= game.awayWinProb} />
            </div>

            {/* Key stats row */}
            <div className="mt-3 flex flex-wrap gap-3">
              {game.spreadHome !== null && (
                <div className="rounded-lg bg-white/[0.03] px-3 py-1.5 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-slate-600">Spread</div>
                  <div className="text-sm font-bold text-white">
                    {game.homeTeam.split(" ").pop()} {game.spreadHome > 0 ? "+" : ""}{game.spreadHome}
                  </div>
                </div>
              )}
              {game.projectedTotal !== null && (
                <div className="rounded-lg bg-white/[0.03] px-3 py-1.5 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-slate-600">O/U</div>
                  <div className="text-sm font-bold text-white">{game.projectedTotal}</div>
                </div>
              )}
              {game.homeExpectedPts !== null && game.awayExpectedPts !== null && (
                <div className="rounded-lg bg-white/[0.03] px-3 py-1.5 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-slate-600">Proj Score</div>
                  <div className="text-sm font-bold text-white">
                    {game.awayExpectedPts} – {game.homeExpectedPts}
                  </div>
                </div>
              )}
              {game.marginOfVictory !== null && game.marginOfVictory > 0 && (
                <div className="rounded-lg bg-white/[0.03] px-3 py-1.5 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-slate-600">MOV</div>
                  <div className="text-sm font-bold text-white">{game.marginOfVictory}</div>
                </div>
              )}

              {/* Model breakdown mini-pills */}
              {game.consensusHomeProb !== null && (
                <div className="rounded-lg bg-blue-500/[0.06] px-3 py-1.5 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-blue-500/60">Consensus</div>
                  <div className="text-sm font-bold text-blue-400">{Math.round(game.consensusHomeProb * 100)}%</div>
                </div>
              )}
              {game.pythagHomeProb !== null && (
                <div className="rounded-lg bg-amber-500/[0.06] px-3 py-1.5 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-amber-500/60">Pythag</div>
                  <div className="text-sm font-bold text-amber-400">{Math.round(game.pythagHomeProb * 100)}%</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Action buttons row ── */}
        <div className="flex flex-wrap gap-2 mb-3">
          {game.edges.length > 0 && (
            <button
              onClick={() => setShowEdges(!showEdges)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                showEdges ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.06]"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              Edge Finder
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">
                {game.edges.filter((e) => e.edge >= 0.02).length}
              </span>
            </button>
          )}

          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              showDetails ? "bg-blue-500/15 text-blue-400" : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.06]"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            All Markets
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">
              {gameLines.length}
            </span>
          </button>

          {propLines.length > 0 && (
            <button
              onClick={() => setShowProps(!showProps)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                showProps ? "bg-purple-500/15 text-purple-400" : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.06]"
              }`}
            >
              Player Props
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">
                {propLines.length}
              </span>
            </button>
          )}

          {game.modelNotes.length > 0 && (
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white/[0.06]">
                <Info className="h-3.5 w-3.5" />
                Model Details
              </summary>
              <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
                <ul className="space-y-1 text-[11px] text-slate-600">
                  {game.modelNotes.map((note, i) => <li key={i}>{note}</li>)}
                </ul>
              </div>
            </details>
          )}
        </div>

        {/* ── Edge finder panel ── */}
        {showEdges && (
          <div className="mb-3">
            <EdgeTable edges={game.edges} homeTeam={game.homeTeam} awayTeam={game.awayTeam} />
          </div>
        )}

        {/* ── All markets panel ── */}
        {showDetails && (
          <div className="mb-3 space-y-1.5">
            {gameLines.map((p) => (
              <ProjectionCard key={`${p.marketKey}__${p.side}__${p.point}__${p.playerName ?? ""}`} proj={p} />
            ))}
          </div>
        )}

        {/* ── Player props panel ── */}
        {showProps && (
          <div className="mb-3 space-y-1.5">
            {propLines.map((p) => (
              <ProjectionCard key={`${p.marketKey}__${p.side}__${p.point}__${p.playerName ?? ""}`} proj={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* LOADING SKELETON                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-white/[0.06] bg-[#111827]/80 p-5 animate-pulse">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-5 w-10 rounded-md bg-white/[0.06]" />
            <div className="h-6 w-56 rounded-md bg-white/[0.06]" />
          </div>
          <div className="rounded-xl bg-white/[0.03] p-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="h-[72px] w-[72px] rounded-full bg-white/[0.06]" />
              <div className="space-y-2">
                <div className="h-3 w-20 rounded bg-white/[0.06]" />
                <div className="h-7 w-40 rounded bg-white/[0.06]" />
                <div className="h-3 w-64 rounded bg-white/[0.06]" />
              </div>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded bg-white/[0.06]" />
              <div className="h-2.5 w-full rounded-full bg-white/[0.06]" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded bg-white/[0.06]" />
              <div className="h-2.5 w-full rounded-full bg-white/[0.06]" />
            </div>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
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
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
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
  const bigEdges = games.reduce((sum, g) => sum + g.edges.filter((e) => e.edge >= 0.03).length, 0);
  const strongPicks = games.filter((g) => {
    const pick = getPickRecommendation(g);
    return pick?.confidence === "strong";
  }).length;

  // Sort by strongest pick first
  const sortedGames = [...games].sort((a, b) => {
    const pa = getPickRecommendation(a);
    const pb = getPickRecommendation(b);
    const scoreA = (pa?.confidence === "strong" ? 3 : pa?.confidence === "lean" ? 2 : 1) + (pa?.edge ?? 0) * 10;
    const scoreB = (pb?.confidence === "strong" ? 3 : pb?.confidence === "lean" ? 2 : 1) + (pb?.edge ?? 0) * 10;
    return scoreB - scoreA;
  });

  let filteredGames = sortedGames;
  if (sportFilter !== "all") {
    filteredGames = filteredGames.filter((g) => g.sportLabel === sportFilter);
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a]">
      <div className="mx-auto max-w-5xl px-4 py-6">

        {/* ── Page header ── */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Today&apos;s Picks
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Projections refresh every 30 min. Sorted by confidence.
          </p>
        </div>

        {/* ── Controls ── */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg bg-white/[0.04] p-0.5">
            {DISPLAY_SPORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => { setSport(s.value); setSportFilter(s.value === "all" ? "all" : s.label); hasFetched.current = false; }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  sport === s.value ? "bg-white/10 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchOdds}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading && !data ? "Loading..." : "Refresh"}
          </button>

          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-white/20 bg-slate-800 h-3.5 w-3.5"
            />
            Auto-refresh
          </label>

          {countdown && <span className="text-[11px] text-slate-600 tabular-nums">Next: {countdown}</span>}
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Summary stats ── */}
        {data && games.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { value: summary.totalGames, label: "Games", color: "text-white" },
              { value: strongPicks, label: "Strong Picks", color: "text-emerald-400" },
              { value: bigEdges, label: "Edges 3%+", color: "text-green-400" },
              { value: summary.propCount, label: "Player Props", color: "text-purple-400" },
              { value: summary.avgAgreement, label: "Avg Agreement", color: "text-blue-400", suffix: "/100" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <div className={`text-xl font-bold ${stat.color}`}>
                  {stat.value}{stat.suffix ?? ""}
                </div>
                <div className="text-[10px] text-slate-600 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {data && games.length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            {/* Sport filter pills */}
            {summary.sportsWithGames.length > 1 && (
              <div className="flex gap-1">
                <button
                  onClick={() => setSportFilter("all")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${sportFilter === "all" ? "bg-white/10 text-white" : "text-slate-600 hover:text-slate-400"}`}
                >
                  All
                </button>
                {summary.sportsWithGames.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSportFilter(s)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${sportFilter === s ? "bg-white/10 text-white" : "text-slate-600 hover:text-slate-400"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <span className="text-[11px] text-slate-700">
              Built {data ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}
            </span>
          </div>
        )}

        {/* ── Game cards ── */}
        <section className="space-y-4">
          {loading && !data && <LoadingSkeleton />}

          {!loading && data && filteredGames.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#111827]/50 p-16 text-center">
              <Target className="mx-auto h-12 w-12 text-slate-700" />
              <h3 className="mt-4 text-lg font-semibold text-slate-400">No games scheduled</h3>
              <p className="mt-1 text-sm text-slate-600 max-w-sm mx-auto">
                There are no NBA or MLB games with available odds right now. Games typically appear 12-24 hours before tip-off.
              </p>
            </div>
          )}

          {filteredGames.map((game, i) => (
            <GameCard key={game.gameId} game={game} rank={i} />
          ))}
        </section>

        {/* ── Methodology footer ── */}
        {data && games.length > 0 && (
          <div className="mt-8 rounded-xl border border-white/[0.04] bg-white/[0.015] p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Methodology</h4>
            <p className="text-[12px] text-slate-600 leading-relaxed">
              Win probabilities are computed by blending three models: <strong className="text-slate-500">Market Consensus</strong> (50%) strips the vig from
              all available sportsbook lines and averages the true implied probabilities. <strong className="text-slate-500">Pythagorean Expectation</strong> (25%)
              uses Bill James&apos; (1980) power formula with sport-specific exponents (NBA: 14, MLB: 1.83) and the Log5 method for head-to-head matchups.
              <strong className="text-slate-500"> Spread-Implied Probability</strong> (25%) converts point spreads to win probability via Stern&apos;s (1991) normal
              distribution model. Edges show where individual books deviate from our blended model.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
