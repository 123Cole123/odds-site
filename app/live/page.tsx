"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  ExternalLink,
  TrendingUp,
  Zap,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Target,
  AlertCircle,
  DollarSign,
  Percent,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Home,
  Plane,
  Scale,
  Info,
} from "lucide-react";
import { DISPLAY_SPORTS } from "@/lib/odds/sports";
import {
  SportsbookLine,
  KalshiLine,
  formatAmericanOdds,
  centsToPercentDisplay,
} from "@/lib/odds/normalize";
import {
  generatePicks,
  picksSummary,
  GamePicks,
  Pick,
  Insight,
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
  NHL: "bg-cyan-500/20 text-cyan-400 ring-cyan-500/30",
  NFL: "bg-green-500/20 text-green-400 ring-green-500/30",
  NCAAB: "bg-purple-500/20 text-purple-400 ring-purple-500/30",
  EPL: "bg-violet-500/20 text-violet-400 ring-violet-500/30",
  UCL: "bg-blue-500/20 text-blue-400 ring-blue-500/30",
};

function SportBadge({ label }: { label: string }) {
  const colors = SPORT_COLORS[label] ?? "bg-slate-500/20 text-slate-400 ring-slate-500/30";
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${colors}`}>
      {label}
    </span>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const color = value >= 70 ? "bg-emerald-500" : value >= 45 ? "bg-amber-500" : "bg-slate-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-400">{value}%</span>
    </div>
  );
}

function RecBadge({ rec }: { rec: "take" | "lean" | "pass" }) {
  if (rec === "take")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-bold text-emerald-400 ring-1 ring-emerald-500/40">
        <ThumbsUp className="h-3.5 w-3.5" /> TAKE IT
      </span>
    );
  if (rec === "lean")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-sm font-bold text-amber-400 ring-1 ring-amber-500/40">
        <TrendingUp className="h-3.5 w-3.5" /> LEAN
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/20 px-3 py-1 text-sm font-medium text-slate-400 ring-1 ring-slate-500/30">
      <Minus className="h-3.5 w-3.5" /> PASS
    </span>
  );
}

function InsightBadge({ insight }: { insight: Insight }) {
  const icon =
    insight.label === "Home advantage" ? <Home className="h-3 w-3" /> :
    insight.label === "Road team" ? <Plane className="h-3 w-3" /> :
    insight.label === "Toss-up game" ? <Scale className="h-3 w-3" /> :
    <Info className="h-3 w-3" />;

  const colors =
    insight.type === "bullish"
      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
      : insight.type === "bearish"
      ? "border-red-500/20 bg-red-500/5 text-red-400"
      : "border-slate-500/20 bg-slate-500/5 text-slate-400";

  return (
    <div className={`rounded-lg border p-2.5 ${colors}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        {icon} {insight.label}
      </div>
      <p className="mt-1 text-xs leading-relaxed opacity-80">{insight.detail}</p>
    </div>
  );
}

function PickCard({ pick }: { pick: Pick }) {
  const [expanded, setExpanded] = useState(pick.recommendation === "take");

  return (
    <div
      className={`rounded-xl border transition-colors ${
        pick.recommendation === "take"
          ? "border-emerald-500/30 bg-emerald-500/[0.06]"
          : pick.recommendation === "lean"
          ? "border-amber-500/20 bg-amber-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <RecBadge rec={pick.recommendation} />
            <span className="text-base font-semibold text-white">{pick.headline}</span>
          </div>
          <div className="mt-1.5">
            <ConfidenceMeter value={pick.confidence} />
          </div>
        </div>
        <div className="ml-4 flex items-center gap-3">
          {pick.recommendation !== "pass" && pick.bestLink && (
            <a
              href={pick.bestLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
            >
              Bet at {pick.bestBook} <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {expanded ? <ChevronUp className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3">
          {/* Stats */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                <DollarSign className="h-3 w-3" /> EV / $100
              </div>
              <div className={`mt-1 text-lg font-bold tabular-nums ${pick.expectedValue > 0 ? "text-emerald-400" : pick.expectedValue < -1 ? "text-red-400" : "text-slate-300"}`}>
                {pick.expectedValue > 0 ? "+" : ""}${pick.expectedValue.toFixed(2)}
              </div>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                <Percent className="h-3 w-3" /> Edge
              </div>
              <div className={`mt-1 text-lg font-bold tabular-nums ${pick.edge > 1.5 ? "text-emerald-400" : pick.edge > 0 ? "text-amber-400" : "text-slate-300"}`}>
                {pick.edge > 0 ? "+" : ""}{pick.edge.toFixed(1)}%
              </div>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                <Target className="h-3 w-3" /> Fair Prob
              </div>
              <div className="mt-1 text-lg font-bold tabular-nums text-white">
                {pick.fairProb !== null ? `${(pick.fairProb * 100).toFixed(1)}%` : "\u2014"}
              </div>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                <BarChart3 className="h-3 w-3" /> Kelly
              </div>
              <div className={`mt-1 text-lg font-bold tabular-nums ${pick.kellySuggestion > 0.02 ? "text-emerald-400" : "text-slate-400"}`}>
                {pick.kellySuggestion > 0 ? `${(pick.kellySuggestion * 100).toFixed(1)}%` : "\u2014"}
              </div>
            </div>
          </div>

          {/* Recommended line */}
          <div className="mb-4 rounded-lg bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Best available line</div>
                <div className="mt-1 text-2xl font-bold text-emerald-400">{formatAmericanOdds(pick.bestPrice)}</div>
                <div className="mt-0.5 text-xs text-slate-500">at {pick.bestBook}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Fair value derived from</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-500">
                  No-vig consensus probability<br />
                  (overround stripped from both sides)
                </div>
              </div>
            </div>
          </div>

          {/* Insights */}
          {pick.insights.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pick.insights.map((ins, i) => (
                <InsightBadge key={i} insight={ins} />
              ))}
            </div>
          )}

          {/* Reasoning */}
          <div className="rounded-lg bg-slate-900/60 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <Zap className="h-3.5 w-3.5" />
              Why {pick.recommendation === "take" ? "we'd take this" : pick.recommendation === "lean" ? "we're leaning this way" : "we're passing"}
            </div>
            <ul className="space-y-1.5">
              {pick.reasoning.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                  <span className={`mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full ${pick.recommendation === "take" ? "bg-emerald-500" : pick.recommendation === "lean" ? "bg-amber-500" : "bg-slate-500"}`} />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function GameSection({ game }: { game: GamePicks }) {
  const takes = game.picks.filter((p) => p.recommendation === "take");
  const leans = game.picks.filter((p) => p.recommendation === "lean");
  const [showPasses, setShowPasses] = useState(false);

  const activePicks = game.picks.filter((p) => p.recommendation !== "pass");
  const passes = game.picks.filter((p) => p.recommendation === "pass");

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SportBadge label={game.sportLabel} />
            <h3 className="text-lg font-semibold text-white">
              {game.awayTeam} @ {game.homeTeam}
            </h3>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>{new Date(game.commenceTime).toLocaleString()}</span>
            {game.marketEfficiency !== null && (
              <span>Market efficiency: {game.marketEfficiency}/100</span>
            )}
          </div>
          {game.homeAdvantageNote && (
            <div className="mt-1 text-xs text-slate-500">{game.homeAdvantageNote}</div>
          )}
        </div>
        <div className="flex gap-2">
          {takes.length > 0 && (
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">
              {takes.length} {takes.length === 1 ? "play" : "plays"}
            </span>
          )}
          {leans.length > 0 && (
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-400">
              {leans.length} {leans.length === 1 ? "lean" : "leans"}
            </span>
          )}
        </div>
      </div>

      {game.crossMarketNote && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-400">
          <Scale className="h-3.5 w-3.5 flex-shrink-0" />
          {game.crossMarketNote}
        </div>
      )}

      <div className="space-y-2">
        {activePicks.map((p) => (
          <PickCard key={`${p.marketKey}__${p.side}__${p.point}`} pick={p} />
        ))}
      </div>

      {passes.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowPasses(!showPasses)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-400"
          >
            {showPasses ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {passes.length} market{passes.length === 1 ? "" : "s"} we&apos;d pass on
          </button>
          {showPasses && (
            <div className="mt-2 space-y-2">
              {passes.map((p) => (
                <PickCard key={`${p.marketKey}__${p.side}__${p.point}`} pick={p} />
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
  const [kalshiTicker, setKalshiTicker] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filter, setFilter] = useState<"all" | "takes" | "leans">("all");
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
      if (kalshiTicker.trim()) params.set("kalshiSeriesTicker", kalshiTicker.trim());
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
  }, [sport, kalshiTicker, autoRefresh]);

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

  const games: GamePicks[] = data ? generatePicks(data.sportsbookLines) : [];
  const summary = picksSummary(games);

  // Apply both filters
  let filteredGames = games;
  if (sportFilter !== "all") {
    filteredGames = filteredGames.filter((g) => g.sportLabel === sportFilter);
  }
  if (filter === "takes") {
    filteredGames = filteredGames.filter((g) => g.picks.some((p) => p.recommendation === "take"));
  } else if (filter === "leans") {
    filteredGames = filteredGames.filter((g) => g.picks.some((p) => p.recommendation === "take" || p.recommendation === "lean"));
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Today&apos;s Plays</h1>
          <p className="mt-2 text-slate-400">
            Every sport. Every line on DraftKings &amp; FanDuel. We find the mispriced ones.
          </p>
        </div>

        {/* Controls */}
        <section className="mb-6 flex flex-wrap items-end justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Scope</label>
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

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Kalshi Ticker</label>
            <input
              type="text"
              value={kalshiTicker}
              onChange={(e) => setKalshiTicker(e.target.value)}
              placeholder="optional"
              className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={fetchOdds}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Scanning..." : "Scan All Lines"}
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
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{summary.takes.length}</div>
              <div className="mt-0.5 text-xs text-slate-400">Plays</div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">{summary.leans.length}</div>
              <div className="mt-0.5 text-xs text-slate-400">Leans</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <div className={`text-2xl font-bold tabular-nums ${summary.totalEV > 0 ? "text-emerald-400" : "text-slate-300"}`}>
                {summary.totalEV > 0 ? "+" : ""}${summary.totalEV.toFixed(0)}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">Total EV</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="text-2xl font-bold text-white">{summary.avgConfidence}%</div>
              <div className="mt-0.5 text-xs text-slate-400">Avg Conf</div>
            </div>
          </section>
        )}

        {/* Filters */}
        {data && (
          <div className="mb-4 flex flex-wrap items-center gap-4">
            {/* Recommendation filter */}
            <div className="flex gap-2">
              {([
                { key: "all", label: "All" },
                { key: "takes", label: "Plays Only" },
                { key: "leans", label: "Plays + Leans" },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === f.key ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sport filter chips */}
            {summary.sportsWithGames.length > 1 && (
              <div className="flex gap-1.5">
                <button
                  onClick={() => setSportFilter("all")}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${sportFilter === "all" ? "bg-white/15 text-white" : "bg-white/5 text-slate-500 hover:bg-white/10"}`}
                >
                  All Sports
                </button>
                {summary.sportsWithGames.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSportFilter(s)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${sportFilter === s ? "bg-white/15 text-white" : "bg-white/5 text-slate-500 hover:bg-white/10"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {data && (
          <p className="mb-4 text-xs text-slate-500">
            Scanned at {new Date(data.fetchedAt).toLocaleTimeString()} &middot;{" "}
            {summary.totalMarkets} markets across {summary.totalGames} games
            {summary.sportsWithGames.length > 0 && ` &middot; ${summary.sportsWithGames.join(", ")}`}
          </p>
        )}

        {/* Games */}
        <section className="space-y-4">
          {!data && !loading && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/50 p-12 text-center">
              <Target className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-3 text-slate-400">
                Hit <strong>Scan All Lines</strong> to find today&apos;s best plays across every sport.
              </p>
            </div>
          )}

          {data && filteredGames.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/50 p-8 text-center">
              <ThumbsDown className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-2 text-sm text-slate-400">No games match this filter. Try &ldquo;All&rdquo;.</p>
            </div>
          )}

          {filteredGames.map((game) => (
            <GameSection key={game.gameId} game={game} />
          ))}
        </section>

        {/* Kalshi */}
        {data && (data.kalshiLines ?? []).length > 0 && (
          <section className="mt-8">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <h2 className="mb-4 text-xl font-semibold">Kalshi Markets</h2>
              <div className="space-y-3">
                {data.kalshiLines.map((market) => (
                  <div key={market.marketTicker} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="font-medium text-white">{market.title}</div>
                    {market.subtitle && <div className="mt-1 text-xs text-slate-400">{market.subtitle}</div>}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl bg-white/5 p-3">
                        <div className="text-slate-400">Yes ask</div>
                        <div className="mt-1 font-semibold text-white">{centsToPercentDisplay(market.yesAsk)}</div>
                      </div>
                      <div className="rounded-xl bg-white/5 p-3">
                        <div className="text-slate-400">No ask</div>
                        <div className="mt-1 font-semibold text-white">{centsToPercentDisplay(market.noAsk)}</div>
                      </div>
                      <div className="rounded-xl bg-white/5 p-3">
                        <div className="text-slate-400">Yes bid</div>
                        <div className="mt-1 font-semibold text-white">{centsToPercentDisplay(market.yesBid)}</div>
                      </div>
                      <div className="rounded-xl bg-white/5 p-3">
                        <div className="text-slate-400">No bid</div>
                        <div className="mt-1 font-semibold text-white">{centsToPercentDisplay(market.noBid)}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>{market.marketTicker}</span>
                      <span>Volume: {market.volume ?? "\u2014"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {data && (
          <p className="mt-8 text-center text-[11px] text-slate-600">
            Analysis uses cross-book no-vig consensus, expected value, Kelly Criterion,
            home/away advantage factors, and cross-market consistency checks.
            This is not financial advice. Gamble responsibly.
          </p>
        )}
      </div>
    </main>
  );
}
