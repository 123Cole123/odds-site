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
  Trophy,
  AlertCircle,
} from "lucide-react";
import { DISPLAY_SPORTS } from "@/lib/odds/sports";
import {
  SportsbookLine,
  KalshiLine,
  formatMarketLabel,
  formatAmericanOdds,
  centsToPercentDisplay,
} from "@/lib/odds/normalize";
import {
  analyzeBestLines,
  overallEdgeSummary,
  GameAnalysis,
  BestLineAnalysis,
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

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

function RatingBadge({ rating }: { rating: "strong" | "moderate" | "neutral" }) {
  if (rating === "strong")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
        <Zap className="h-3 w-3" /> Strong Edge
      </span>
    );
  if (rating === "moderate")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/30">
        <TrendingUp className="h-3 w-3" /> Moderate Edge
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/20 px-2.5 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-slate-500/30">
      Neutral
    </span>
  );
}

function MarketCard({ analysis }: { analysis: BestLineAnalysis }) {
  const [expanded, setExpanded] = useState(analysis.rating !== "neutral");

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        analysis.rating === "strong"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : analysis.rating === "moderate"
          ? "border-amber-500/20 bg-amber-500/5"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div>
            <span className="text-sm font-medium text-white">
              {formatMarketLabel(analysis.marketKey)}
            </span>
            <span className="ml-2 text-sm text-slate-400">
              {analysis.side}
              {analysis.point !== null && (
                <span className="ml-1 text-slate-500">
                  {analysis.point > 0
                    ? `+${analysis.point}`
                    : analysis.point}
                </span>
              )}
            </span>
          </div>
          <RatingBadge rating={analysis.rating} />
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-lg font-bold ${
              analysis.rating === "strong"
                ? "text-emerald-400"
                : analysis.rating === "moderate"
                ? "text-amber-400"
                : "text-white"
            }`}
          >
            {formatAmericanOdds(analysis.best.price)}
          </span>
          <span className="text-xs text-slate-500">{analysis.best.book}</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Book comparison */}
          <div className="flex gap-2">
            {analysis.lines.map((line) => {
              const isBest =
                line.bookmakerKey === analysis.best.bookmakerKey;
              return (
                <div
                  key={line.bookmakerKey}
                  className={`flex-1 rounded-lg p-2.5 ${
                    isBest
                      ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                      : "bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {line.book}
                    </span>
                    {isBest && (
                      <Trophy className="h-3 w-3 text-emerald-400" />
                    )}
                  </div>
                  <div
                    className={`mt-1 text-lg font-bold ${
                      isBest ? "text-emerald-400" : "text-white"
                    }`}
                  >
                    {formatAmericanOdds(line.price)}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {(line.impliedProb * 100).toFixed(1)}% implied
                  </div>
                  {line.link && (
                    <a
                      href={line.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      Bet <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {/* Analytics / Reasons */}
          <div className="rounded-lg bg-slate-900/60 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <BarChart3 className="h-3.5 w-3.5" />
              Analysis
            </div>
            <ul className="space-y-1">
              {analysis.reasons.map((reason, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-slate-400"
                >
                  <span className="mt-0.5 block h-1 w-1 flex-shrink-0 rounded-full bg-slate-500" />
                  {reason}
                </li>
              ))}
            </ul>

            {/* Numeric breakdown */}
            <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-white/5 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  Edge
                </div>
                <div
                  className={`text-sm font-semibold ${
                    analysis.edge >= 3
                      ? "text-emerald-400"
                      : analysis.edge >= 1
                      ? "text-amber-400"
                      : "text-slate-300"
                  }`}
                >
                  {analysis.edge.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-md bg-white/5 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  Fair Prob
                </div>
                <div className="text-sm font-semibold text-slate-300">
                  {analysis.noVigProb !== null
                    ? `${(analysis.noVigProb * 100).toFixed(1)}%`
                    : "\u2014"}
                </div>
              </div>
              <div className="rounded-md bg-white/5 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  Vig
                </div>
                <div
                  className={`text-sm font-semibold ${
                    analysis.vigAtBest !== null && analysis.vigAtBest * 100 < 3
                      ? "text-emerald-400"
                      : analysis.vigAtBest !== null &&
                        analysis.vigAtBest * 100 >= 5
                      ? "text-red-400"
                      : "text-slate-300"
                  }`}
                >
                  {analysis.vigAtBest !== null
                    ? `${(analysis.vigAtBest * 100).toFixed(1)}%`
                    : "\u2014"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GameCard({ game }: { game: GameAnalysis }) {
  const strongCount = game.markets.filter(
    (m) => m.rating === "strong"
  ).length;
  const modCount = game.markets.filter(
    (m) => m.rating === "moderate"
  ).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      {/* Game header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {game.awayTeam} @ {game.homeTeam}
          </h3>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400">
            <span>{new Date(game.commenceTime).toLocaleString()}</span>
            {game.totalVigDK !== null && (
              <span>
                DK vig: {(game.totalVigDK * 100).toFixed(1)}%
              </span>
            )}
            {game.totalVigFD !== null && (
              <span>
                FD vig: {(game.totalVigFD * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {strongCount > 0 && (
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400">
              {strongCount} strong
            </span>
          )}
          {modCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-400">
              {modCount} moderate
            </span>
          )}
        </div>
      </div>

      {/* Markets */}
      <div className="space-y-2">
        {game.markets.map((m) => (
          <MarketCard
            key={`${m.marketKey}__${m.side}__${m.point}`}
            analysis={m}
          />
        ))}
      </div>
    </div>
  );
}

export default function LiveOddsPage() {
  const [sport, setSport] = useState("nba");
  const [kalshiTicker, setKalshiTicker] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filter, setFilter] = useState<"all" | "strong" | "moderate">("all");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");

  const fetchOdds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sport });
      if (kalshiTicker.trim()) {
        params.set("kalshiSeriesTicker", kalshiTicker.trim());
      }
      const res = await fetch(`/api/odds/live?${params.toString()}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Request failed");
      } else {
        setData(json);
        if (autoRefresh) {
          setNextRefresh(new Date(Date.now() + REFRESH_INTERVAL));
        }
      }
    } catch (err: any) {
      setError(err.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }, [sport, kalshiTicker, autoRefresh]);

  // Auto-refresh every 30 minutes
  useEffect(() => {
    if (autoRefresh) {
      setNextRefresh(new Date(Date.now() + REFRESH_INTERVAL));
      intervalRef.current = setInterval(fetchOdds, REFRESH_INTERVAL);
    } else {
      setNextRefresh(null);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchOdds]);

  // Countdown timer
  useEffect(() => {
    if (!nextRefresh) {
      setCountdown("");
      return;
    }
    const tick = () => {
      const diff = nextRefresh.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("Refreshing...");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setCountdown(`${mins}m ${secs.toString().padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRefresh]);

  // Run analysis
  const games: GameAnalysis[] = data
    ? analyzeBestLines(data.sportsbookLines)
    : [];

  const summary = overallEdgeSummary(games);

  // Filter games based on selected filter
  const filteredGames =
    filter === "all"
      ? games
      : games.filter((g) =>
          g.markets.some((m) =>
            filter === "strong"
              ? m.rating === "strong"
              : m.rating === "moderate" || m.rating === "strong"
          )
        );

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Live Odds</h1>
          <p className="mt-1 text-slate-400">
            DraftKings &middot; FanDuel &middot; Kalshi &mdash; best line
            detection with analytics
          </p>
        </div>

        {/* Controls */}
        <section className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Sport
            </label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DISPLAY_SPORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Kalshi Series Ticker (optional)
            </label>
            <input
              type="text"
              value={kalshiTicker}
              onChange={(e) => setKalshiTicker(e.target.value)}
              placeholder="e.g. KXNBA"
              className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={fetchOdds}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            {loading ? "Loading..." : "Refresh Odds"}
          </button>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-white/20 bg-slate-800"
            />
            Auto-refresh (30 min)
          </label>

          {countdown && (
            <span className="text-xs text-slate-500">
              Next refresh: {countdown}
            </span>
          )}
        </section>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Summary dashboard */}
        {data && (
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {summary.totalMarkets}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                Markets Analyzed
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">
                {summary.strongPicks.length}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                Strong Edges
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">
                {summary.moderatePicks.length}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                Moderate Edges
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {summary.avgEdge.toFixed(1)}%
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                Avg Edge
              </div>
            </div>
          </section>
        )}

        {/* Filter tabs */}
        {data && (
          <div className="mb-4 flex gap-2">
            {(
              [
                { key: "all", label: "All Markets" },
                { key: "strong", label: "Strong Edges Only" },
                { key: "moderate", label: "Moderate+" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filter === f.key
                    ? "bg-blue-600 text-white"
                    : "bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        {data && (
          <p className="mb-4 text-xs text-slate-500">
            Last fetched:{" "}
            {new Date(data.fetchedAt).toLocaleTimeString()}
          </p>
        )}

        {/* Games with best-line analysis */}
        <section className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <h2 className="mb-4 text-xl font-semibold">
              Sportsbook Lines &mdash; Best Line Analysis
            </h2>

            {filteredGames.length === 0 && !loading && !data && (
              <p className="text-sm text-slate-400">
                No odds loaded yet. Pick a sport and hit Refresh Odds.
              </p>
            )}

            {filteredGames.length === 0 && data && (
              <p className="text-sm text-slate-400">
                No markets match this filter. Try &ldquo;All Markets&rdquo;.
              </p>
            )}

            <div className="space-y-4">
              {filteredGames.map((game) => (
                <GameCard key={game.gameId} game={game} />
              ))}
            </div>
          </div>

          {/* Kalshi Markets */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Kalshi Markets</h2>
              <p className="text-sm text-slate-400">
                Loaded from the series ticker you enter
              </p>
            </div>

            <div className="space-y-3">
              {(data?.kalshiLines ?? []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/70 p-4 text-sm text-slate-400">
                  Enter a Kalshi series ticker above, then hit Refresh Odds.
                </div>
              )}

              {(data?.kalshiLines ?? []).map((market) => (
                <div
                  key={market.marketTicker}
                  className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                >
                  <div className="font-medium text-white">
                    {market.title}
                  </div>
                  {market.subtitle && (
                    <div className="mt-1 text-xs text-slate-400">
                      {market.subtitle}
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-white/5 p-3">
                      <div className="text-slate-400">Yes ask</div>
                      <div className="mt-1 font-semibold text-white">
                        {centsToPercentDisplay(market.yesAsk)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <div className="text-slate-400">No ask</div>
                      <div className="mt-1 font-semibold text-white">
                        {centsToPercentDisplay(market.noAsk)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <div className="text-slate-400">Yes bid</div>
                      <div className="mt-1 font-semibold text-white">
                        {centsToPercentDisplay(market.yesBid)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <div className="text-slate-400">No bid</div>
                      <div className="mt-1 font-semibold text-white">
                        {centsToPercentDisplay(market.noBid)}
                      </div>
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
      </div>
    </main>
  );
}
