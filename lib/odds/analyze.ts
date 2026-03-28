import { SportsbookLine, americanToImpliedProbability } from "./normalize";
import { SPORT_LABEL } from "./sports";

// ── Types ──────────────────────────────────────────────────────────────────

export type Pick = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  sport: string;
  sportLabel: string;
  marketKey: string;
  side: string;
  point: number | null;
  recommendation: "take" | "lean" | "pass";
  confidence: number;
  bestBook: string;
  bestBookKey: string;
  bestPrice: number;
  bestLink: string | null;
  otherBook: string | null;
  otherPrice: number | null;
  fairProb: number | null;
  impliedProb: number;
  expectedValue: number;
  kellySuggestion: number;
  edge: number;
  priceDiff: number;
  vig: number | null;
  headline: string;
  reasoning: string[];
  insights: Insight[];
};

export type Insight = {
  label: string;
  detail: string;
  type: "bullish" | "bearish" | "neutral";
};

export type GamePicks = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  sport: string;
  sportLabel: string;
  picks: Pick[];
  hasTake: boolean;
  bestPick: Pick | null;
  homeAdvantageNote: string | null;
  crossMarketNote: string | null;
  marketEfficiency: number | null; // 0-100, how tight the market is
};

// ── Sport-specific home advantage (in points/goals) ────────────────────────

const HOME_ADVANTAGE: Record<string, { points: number; label: string }> = {
  basketball_nba: { points: 3.5, label: "NBA home court historically worth ~3.5 pts" },
  basketball_ncaab: { points: 4.0, label: "College home court historically worth ~4 pts" },
  americanfootball_nfl: { points: 2.5, label: "NFL home field historically worth ~2.5 pts" },
  baseball_mlb: { points: 0.5, label: "MLB home field advantage is minimal (~0.5 runs)" },
  icehockey_nhl: { points: 0.3, label: "NHL home ice historically worth ~0.3 goals" },
  soccer_epl: { points: 0.4, label: "EPL home pitch historically worth ~0.4 goals" },
  soccer_uefa_champs_league: { points: 0.5, label: "UCL home advantage significant in knockout rounds" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatOdds(price: number) {
  return price > 0 ? `+${price}` : `${price}`;
}

function americanToDecimal(odds: number) {
  if (odds > 0) return odds / 100 + 1;
  return 100 / Math.abs(odds) + 1;
}

function computeNoVigBothSides(
  lines: SportsbookLine[],
  gameId: string,
  marketKey: string
): Map<string, number> {
  const bookKeys = [...new Set(
    lines.filter((l) => l.gameId === gameId && l.marketKey === marketKey).map((l) => l.bookmakerKey)
  )];
  const sideProbs = new Map<string, number[]>();

  for (const bookKey of bookKeys) {
    const bookLines = lines.filter(
      (l) => l.gameId === gameId && l.marketKey === marketKey && l.bookmakerKey === bookKey
    );
    if (bookLines.length < 2) continue;
    const totalImplied = bookLines.reduce(
      (sum, l) => sum + americanToImpliedProbability(l.price), 0
    );
    for (const bl of bookLines) {
      const sideKey = `${bl.outcomeName}||${bl.point ?? "null"}`;
      const noVig = americanToImpliedProbability(bl.price) / totalImplied;
      if (!sideProbs.has(sideKey)) sideProbs.set(sideKey, []);
      sideProbs.get(sideKey)!.push(noVig);
    }
  }

  const result = new Map<string, number>();
  for (const [sideKey, probs] of sideProbs) {
    result.set(sideKey, probs.reduce((a, b) => a + b, 0) / probs.length);
  }
  return result;
}

function computeVig(
  lines: SportsbookLine[],
  gameId: string,
  marketKey: string,
  bookmakerKey: string
): number | null {
  const bookLines = lines.filter(
    (l) => l.gameId === gameId && l.marketKey === marketKey && l.bookmakerKey === bookmakerKey
  );
  if (bookLines.length < 2) return null;
  const totalImplied = bookLines.reduce(
    (sum, l) => sum + americanToImpliedProbability(l.price), 0
  );
  return totalImplied - 1;
}

/**
 * Derive implied power rating from spread.
 * e.g. home team -5.5 means market thinks home is 5.5 pts better (before home advantage).
 */
function getSpreadData(
  lines: SportsbookLine[],
  gameId: string
): { homeSpread: number | null; awaySpread: number | null; homeTeam: string; awayTeam: string } | null {
  const spreadLines = lines.filter((l) => l.gameId === gameId && l.marketKey === "spreads");
  if (spreadLines.length === 0) return null;

  const first = spreadLines[0];
  const homeLine = spreadLines.find((l) => l.outcomeName === first.homeTeam);
  const awayLine = spreadLines.find((l) => l.outcomeName === first.awayTeam);

  return {
    homeSpread: homeLine?.point ?? null,
    awaySpread: awayLine?.point ?? null,
    homeTeam: first.homeTeam,
    awayTeam: first.awayTeam,
  };
}

/**
 * Check if moneyline and spread tell a consistent story.
 * If ML favorite != spread favorite, that's a signal.
 */
function crossMarketCheck(
  lines: SportsbookLine[],
  gameId: string
): string | null {
  const mlLines = lines.filter((l) => l.gameId === gameId && l.marketKey === "h2h");
  const spreadData = getSpreadData(lines, gameId);
  if (mlLines.length < 2 || !spreadData) return null;

  // Find ML favorite (lower implied prob = underdog, so favorite has lower American odds / more negative)
  const first = mlLines[0];
  const homeML = mlLines.find((l) => l.outcomeName === first.homeTeam);
  const awayML = mlLines.find((l) => l.outcomeName === first.awayTeam);
  if (!homeML || !awayML) return null;

  const homeMLFav = homeML.price < awayML.price; // more negative = favorite
  const homeSpreadFav = spreadData.homeSpread !== null && spreadData.homeSpread < 0;

  if (homeMLFav !== homeSpreadFav && spreadData.homeSpread !== null && Math.abs(spreadData.homeSpread) >= 1.5) {
    return `Moneyline and spread disagree on the favorite — possible mispricing opportunity`;
  }

  // Check if spread implies a different probability than ML
  if (spreadData.homeSpread !== null) {
    const sport = first.sport;
    const ha = HOME_ADVANTAGE[sport]?.points ?? 0;
    const neutralSpread = spreadData.homeSpread + ha; // adjust for home advantage
    // Rough: each point of spread ≈ 2-3% win probability in NBA/NFL
    const spreadImpliedAdv = Math.abs(neutralSpread) * 2.5;
    const mlImpliedHome = americanToImpliedProbability(homeML.price) * 100;
    const mlImpliedAway = americanToImpliedProbability(awayML.price) * 100;
    const mlDiff = Math.abs(mlImpliedHome - mlImpliedAway);

    if (Math.abs(spreadImpliedAdv - mlDiff) > 8) {
      return `Spread and moneyline imply different win margins — the ${
        spreadImpliedAdv > mlDiff ? "spread" : "moneyline"
      } is more aggressive`;
    }
  }

  return null;
}

/**
 * Market efficiency: how tight is the vig across books?
 * Lower average vig = more efficient market = harder to find edges.
 */
function marketEfficiencyScore(
  lines: SportsbookLine[],
  gameId: string
): number | null {
  const bookKeys = [...new Set(
    lines.filter((l) => l.gameId === gameId).map((l) => l.bookmakerKey)
  )];
  const marketKeys = [...new Set(
    lines.filter((l) => l.gameId === gameId).map((l) => l.marketKey)
  )];

  const vigs: number[] = [];
  for (const bk of bookKeys) {
    for (const mk of marketKeys) {
      const v = computeVig(lines, gameId, mk, bk);
      if (v !== null) vigs.push(v);
    }
  }

  if (vigs.length === 0) return null;
  const avgVig = vigs.reduce((a, b) => a + b, 0) / vigs.length;
  // 0% vig = 100 efficiency, 10% vig = 0 efficiency
  return Math.max(0, Math.min(100, Math.round((1 - avgVig / 0.1) * 100)));
}

// ── Core Analysis ──────────────────────────────────────────────────────────

export function generatePicks(lines: SportsbookLine[]): GamePicks[] {
  const gameIds = [...new Set(lines.map((l) => l.gameId))];
  const allGames: GamePicks[] = [];

  for (const gameId of gameIds) {
    const gameLines = lines.filter((l) => l.gameId === gameId);
    if (gameLines.length === 0) continue;

    const first = gameLines[0];
    const sportLabel = SPORT_LABEL[first.sport] ?? first.sport;
    const marketKeys = [...new Set(gameLines.map((l) => l.marketKey))];
    const picks: Pick[] = [];

    // Game-level analysis
    const ha = HOME_ADVANTAGE[first.sport];
    const homeAdvantageNote = ha?.label ?? null;
    const crossMarketNote = crossMarketCheck(lines, gameId);
    const efficiency = marketEfficiencyScore(lines, gameId);

    // Get spread data for insights
    const spreadData = getSpreadData(lines, gameId);

    for (const marketKey of marketKeys) {
      const marketLines = gameLines.filter((l) => l.marketKey === marketKey);
      const fairProbs = computeNoVigBothSides(lines, gameId, marketKey);

      const sideKeys = [
        ...new Set(marketLines.map((l) => `${l.outcomeName}||${l.point ?? "null"}`)),
      ];

      for (const sideKey of sideKeys) {
        const [side, pointStr] = sideKey.split("||");
        const point = pointStr === "null" ? null : parseFloat(pointStr);

        const sidelines = marketLines.filter(
          (l) => l.outcomeName === side && ((l.point === null && point === null) || l.point === point)
        );
        if (sidelines.length === 0) continue;

        const sorted = [...sidelines].sort((a, b) => b.price - a.price);
        const best = sorted[0];
        const other = sorted.length > 1 ? sorted[1] : null;

        const impliedProb = americanToImpliedProbability(best.price);
        const fairProb = fairProbs.get(sideKey) ?? null;
        const decimalOdds = americanToDecimal(best.price);
        const edge = fairProb !== null ? (fairProb - impliedProb) * 100 : 0;
        const ev = fairProb !== null
          ? (fairProb * (decimalOdds - 1) - (1 - fairProb)) * 100
          : 0;

        let kelly = 0;
        if (fairProb !== null && fairProb > 0 && fairProb < 1) {
          const b = decimalOdds - 1;
          kelly = Math.max(0, (b * fairProb - (1 - fairProb)) / b);
        }

        const priceDiff = other ? best.price - other.price : 0;
        const vig = computeVig(lines, gameId, marketKey, best.bookmakerKey);

        // ── Advanced insights ──
        const insights: Insight[] = [];

        // Home/away insight
        if (marketKey === "h2h" && ha) {
          const isHome = side === first.homeTeam;
          if (isHome) {
            insights.push({
              label: "Home advantage",
              detail: `${side} plays at home. ${ha.label}.`,
              type: "bullish",
            });
          } else {
            insights.push({
              label: "Road team",
              detail: `${side} is on the road. ${ha.label} works against them.`,
              type: "bearish",
            });
          }
        }

        // Spread-implied strength
        if (marketKey === "h2h" && spreadData && spreadData.homeSpread !== null) {
          const isHome = side === first.homeTeam;
          const relevantSpread = isHome ? spreadData.homeSpread : spreadData.awaySpread;
          if (relevantSpread !== null) {
            if (relevantSpread < -3) {
              insights.push({
                label: "Spread-implied favorite",
                detail: `The spread (${relevantSpread > 0 ? "+" : ""}${relevantSpread}) prices ${side} as a clear favorite. Market sees a talent gap.`,
                type: "bullish",
              });
            } else if (relevantSpread > 3) {
              insights.push({
                label: "Spread-implied underdog",
                detail: `The spread (+${relevantSpread}) prices ${side} as a clear underdog. You're betting on an upset.`,
                type: "bearish",
              });
            } else {
              insights.push({
                label: "Toss-up game",
                detail: `Spread of ${relevantSpread > 0 ? "+" : ""}${relevantSpread} — market sees this as essentially even. Small edges can matter here.`,
                type: "neutral",
              });
            }
          }
        }

        // ML vs spread consistency for this side
        if (marketKey === "h2h" && crossMarketNote) {
          insights.push({
            label: "Cross-market signal",
            detail: crossMarketNote,
            type: "neutral",
          });
        }

        // Totals-specific insight
        if (marketKey === "totals" && point !== null) {
          if (side === "Over") {
            insights.push({
              label: "Over/Under context",
              detail: `The total is set at ${point}. Books set this where they expect balanced action. An over here means you think scoring exceeds market expectation.`,
              type: "neutral",
            });
          } else {
            insights.push({
              label: "Over/Under context",
              detail: `The total is set at ${point}. An under bet means you expect a lower-scoring game than the market consensus.`,
              type: "neutral",
            });
          }
        }

        // Market efficiency insight
        if (efficiency !== null) {
          if (efficiency < 60) {
            insights.push({
              label: "Inefficient market",
              detail: `Efficiency ${efficiency}/100 — measured by the total overround (sum of implied probabilities minus 100%). Wider overround = books disagree more = better chance of finding value.`,
              type: "bullish",
            });
          } else if (efficiency > 85) {
            insights.push({
              label: "Tight market",
              detail: `Efficiency ${efficiency}/100 — measured by total overround. Low overround means sharp, well-priced market with thin margins. Harder to find edges.`,
              type: "bearish",
            });
          }
        }

        // Underdog value insight
        if (marketKey === "h2h" && fairProb !== null && fairProb > 0.28 && fairProb < 0.45 && edge > 1) {
          insights.push({
            label: "Live dog value",
            detail: `${side} at ${(fairProb * 100).toFixed(0)}% fair probability with ${edge.toFixed(1)}% edge — underdog ML bets with positive EV have the highest long-run ROI when disciplined.`,
            type: "bullish",
          });
        }

        // Favorite value
        if (marketKey === "h2h" && fairProb !== null && fairProb > 0.6 && edge > 0.5) {
          insights.push({
            label: "Favorite at value",
            detail: `${side} is a clear favorite (${(fairProb * 100).toFixed(0)}% fair), but ${best.book} is offering better odds than the true probability warrants. Rare for heavy chalk.`,
            type: "bullish",
          });
        }

        // ── Determine recommendation ──
        let recommendation: "take" | "lean" | "pass" = "pass";
        let confidence = 0;

        // Boost confidence when advanced signals align
        let insightBoost = 0;
        const bullishInsights = insights.filter((i) => i.type === "bullish").length;
        const bearishInsights = insights.filter((i) => i.type === "bearish").length;
        insightBoost = (bullishInsights - bearishInsights) * 3;

        if (ev > 2 && edge > 1.5) {
          recommendation = "take";
          confidence = Math.min(95, 50 + edge * 8 + ev * 2 + insightBoost);
        } else if (ev > 0.5 || edge > 1) {
          recommendation = "lean";
          confidence = Math.min(75, 35 + edge * 6 + ev * 3 + insightBoost);
        } else if (Math.abs(priceDiff) >= 10 && edge > 0) {
          recommendation = "lean";
          confidence = Math.min(65, 30 + Math.abs(priceDiff) * 0.5 + insightBoost);
        } else {
          recommendation = "pass";
          confidence = Math.max(10, 25 - Math.abs(ev) * 2);
        }

        confidence = Math.round(Math.max(0, Math.min(100, confidence)));

        // ── Build headline ──
        const marketLabel =
          marketKey === "h2h"
            ? "ML"
            : marketKey === "spreads"
            ? `${point != null && point > 0 ? "+" : ""}${point}`
            : marketKey === "totals"
            ? `${side} ${point}`
            : marketKey;
        const headline =
          recommendation === "take"
            ? `Take ${side} ${marketLabel} at ${best.book} ${formatOdds(best.price)}`
            : recommendation === "lean"
            ? `Lean ${side} ${marketLabel} at ${best.book} ${formatOdds(best.price)}`
            : `Pass on ${side} ${marketLabel}`;

        // ── Build reasoning ──
        const reasoning: string[] = [];

        if (fairProb !== null) {
          reasoning.push(
            `No-vig consensus (stripping the juice from both sides of the line) gives ${side} a ${(fairProb * 100).toFixed(1)}% true win probability`
          );
          reasoning.push(
            `${best.book} prices it at ${(impliedProb * 100).toFixed(1)}% implied — ${
              edge > 0
                ? `${edge.toFixed(1)}% underpriced (value)`
                : `${Math.abs(edge).toFixed(1)}% overpriced`
            }`
          );
        }

        if (ev > 0) {
          reasoning.push(`+$${ev.toFixed(2)} EV per $100 — calculated from (fair probability × payout) minus (loss probability × stake)`);
        } else if (ev < -2) {
          reasoning.push(
            `-$${Math.abs(ev).toFixed(2)} EV per $100 — fair probability doesn't justify the price at any book`
          );
        }

        if (other && priceDiff !== 0) {
          reasoning.push(
            `${Math.abs(priceDiff)} cent price advantage at ${best.book} — this is the sharper number available`
          );
        }

        if (kelly > 0.02) {
          reasoning.push(
            `Kelly suggests ${(kelly * 100).toFixed(1)}% of bankroll — ${
              kelly > 0.05 ? "strong sizing signal" : "small but positive edge"
            }`
          );
        }

        if (vig !== null) {
          const vigPct = vig * 100;
          if (vigPct < 3) {
            reasoning.push(`Low juice market (${vigPct.toFixed(1)}% vig) — more of your bet goes to potential payout`);
          } else if (vigPct >= 5) {
            reasoning.push(`Heavy juice (${vigPct.toFixed(1)}% vig) — the book is taking a big cut`);
          }
        }

        if (recommendation === "take" && fairProb !== null) {
          reasoning.push(
            `You only need ${side} to win ${(impliedProb * 100).toFixed(1)}% of the time to break even — consensus says ${(fairProb * 100).toFixed(1)}%`
          );
        }

        if (recommendation === "pass") {
          if (ev < 0) reasoning.push("No edge detected — line is priced efficiently or against you");
          if (other && priceDiff === 0) reasoning.push("Market consensus is tight — no line shopping advantage available");
        }

        picks.push({
          gameId,
          homeTeam: first.homeTeam,
          awayTeam: first.awayTeam,
          commenceTime: first.commenceTime,
          sport: first.sport,
          sportLabel,
          marketKey,
          side,
          point,
          recommendation,
          confidence,
          bestBook: best.book,
          bestBookKey: best.bookmakerKey,
          bestPrice: best.price,
          bestLink: best.link,
          otherBook: other?.book ?? null,
          otherPrice: other?.price ?? null,
          fairProb,
          impliedProb,
          expectedValue: Math.round(ev * 100) / 100,
          kellySuggestion: Math.round(kelly * 1000) / 1000,
          edge: Math.round(edge * 100) / 100,
          priceDiff,
          vig,
          headline,
          reasoning,
          insights,
        });
      }
    }

    const recOrder = { take: 0, lean: 1, pass: 2 };
    picks.sort((a, b) => {
      const o = recOrder[a.recommendation] - recOrder[b.recommendation];
      if (o !== 0) return o;
      return b.confidence - a.confidence;
    });

    allGames.push({
      gameId,
      homeTeam: first.homeTeam,
      awayTeam: first.awayTeam,
      commenceTime: first.commenceTime,
      sport: first.sport,
      sportLabel,
      picks,
      hasTake: picks.some((p) => p.recommendation === "take"),
      bestPick: picks[0] ?? null,
      homeAdvantageNote,
      crossMarketNote,
      marketEfficiency: efficiency,
    });
  }

  // Sort: games with takes first, then leans, then by confidence of best pick
  allGames.sort((a, b) => {
    if (a.hasTake && !b.hasTake) return -1;
    if (!a.hasTake && b.hasTake) return 1;
    const aHasLean = a.picks.some((p) => p.recommendation === "lean");
    const bHasLean = b.picks.some((p) => p.recommendation === "lean");
    if (aHasLean && !bHasLean) return -1;
    if (!aHasLean && bHasLean) return 1;
    const aConf = a.bestPick?.confidence ?? 0;
    const bConf = b.bestPick?.confidence ?? 0;
    return bConf - aConf;
  });

  return allGames;
}

export function picksSummary(games: GamePicks[]) {
  const allPicks = games.flatMap((g) => g.picks);
  const takes = allPicks.filter((p) => p.recommendation === "take");
  const leans = allPicks.filter((p) => p.recommendation === "lean");
  const totalEV = takes.reduce((sum, p) => sum + p.expectedValue, 0);
  const avgConfidence =
    takes.length > 0
      ? takes.reduce((sum, p) => sum + p.confidence, 0) / takes.length
      : 0;
  const sportsWithGames = [...new Set(games.map((g) => g.sportLabel))];

  return {
    takes,
    leans,
    totalGames: games.length,
    totalMarkets: allPicks.length,
    totalEV: Math.round(totalEV * 100) / 100,
    avgConfidence: Math.round(avgConfidence),
    sportsWithGames,
  };
}
