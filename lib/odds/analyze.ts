import { SportsbookLine, americanToImpliedProbability } from "./normalize";

// ── Types ──────────────────────────────────────────────────────────────────

export type Pick = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  sport: string;
  marketKey: string;
  side: string;
  point: number | null;
  recommendation: "take" | "lean" | "pass";
  confidence: number; // 0-100
  bestBook: string;
  bestBookKey: string;
  bestPrice: number;
  bestLink: string | null;
  otherBook: string | null;
  otherPrice: number | null;
  fairProb: number | null; // no-vig probability (the "true" chance)
  impliedProb: number; // what the best line implies
  expectedValue: number; // EV per $100 wagered
  kellySuggestion: number; // Kelly fraction (0-1)
  edge: number; // % edge over fair value
  priceDiff: number; // cents between books
  vig: number | null;
  headline: string; // "Take Lakers ML at DraftKings +150"
  reasoning: string[]; // stat-backed bullets
};

export type GamePicks = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  sport: string;
  picks: Pick[];
  hasTake: boolean;
  bestPick: Pick | null;
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
  // Average the no-vig across all books for each side
  const bookKeys = [...new Set(lines.filter(l => l.gameId === gameId && l.marketKey === marketKey).map(l => l.bookmakerKey))];
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

  // Average across books = consensus fair probability
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

// ── Core Analysis ──────────────────────────────────────────────────────────

export function generatePicks(lines: SportsbookLine[]): GamePicks[] {
  const gameIds = [...new Set(lines.map((l) => l.gameId))];
  const allGames: GamePicks[] = [];

  for (const gameId of gameIds) {
    const gameLines = lines.filter((l) => l.gameId === gameId);
    if (gameLines.length === 0) continue;

    const first = gameLines[0];
    const marketKeys = [...new Set(gameLines.map((l) => l.marketKey))];
    const picks: Pick[] = [];

    for (const marketKey of marketKeys) {
      const marketLines = gameLines.filter((l) => l.marketKey === marketKey);

      // Get consensus fair probabilities across both books
      const fairProbs = computeNoVigBothSides(lines, gameId, marketKey);

      // Group by side
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

        // Sort by best price (highest American odds)
        const sorted = [...sidelines].sort((a, b) => b.price - a.price);
        const best = sorted[0];
        const other = sorted.length > 1 ? sorted[1] : null;

        const impliedProb = americanToImpliedProbability(best.price);
        const fairProb = fairProbs.get(sideKey) ?? null;
        const decimalOdds = americanToDecimal(best.price);

        // Edge = how much the fair probability exceeds the implied probability
        // Positive edge = the true chance of winning is higher than what the line implies
        const edge = fairProb !== null ? (fairProb - impliedProb) * 100 : 0;

        // Expected Value per $100 bet
        // EV = (fairProb × payout) - (1-fairProb) × stake
        const ev = fairProb !== null
          ? (fairProb * (decimalOdds - 1) - (1 - fairProb)) * 100
          : 0;

        // Kelly Criterion: f* = (bp - q) / b
        // b = decimal odds - 1, p = fair prob, q = 1 - p
        let kelly = 0;
        if (fairProb !== null && fairProb > 0 && fairProb < 1) {
          const b = decimalOdds - 1;
          const p = fairProb;
          const q = 1 - p;
          kelly = Math.max(0, (b * p - q) / b);
        }

        const priceDiff = other ? best.price - other.price : 0;
        const vig = computeVig(lines, gameId, marketKey, best.bookmakerKey);

        // ── Determine recommendation ──
        let recommendation: "take" | "lean" | "pass" = "pass";
        let confidence = 0;

        // Strong take: positive EV with meaningful edge
        if (ev > 2 && edge > 1.5) {
          recommendation = "take";
          confidence = Math.min(95, 50 + edge * 8 + ev * 2);
        } else if (ev > 0.5 || edge > 1) {
          recommendation = "lean";
          confidence = Math.min(75, 35 + edge * 6 + ev * 3);
        } else if (Math.abs(priceDiff) >= 10 && edge > 0) {
          recommendation = "lean";
          confidence = Math.min(65, 30 + Math.abs(priceDiff) * 0.5);
        } else {
          recommendation = "pass";
          confidence = Math.max(10, 25 - Math.abs(ev) * 2);
        }

        confidence = Math.round(Math.max(0, Math.min(100, confidence)));

        // ── Build headline ──
        const marketLabel = marketKey === "h2h" ? "ML" : marketKey === "spreads" ? `${point != null && point > 0 ? "+" : ""}${point}` : marketKey === "totals" ? `${side} ${point}` : marketKey;
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
            `Market consensus gives ${side} a ${(fairProb * 100).toFixed(1)}% true probability`
          );
          reasoning.push(
            `${best.book} is pricing it at ${(impliedProb * 100).toFixed(1)}% implied — ${
              edge > 0
                ? `${edge.toFixed(1)}% underpriced (value)`
                : `${Math.abs(edge).toFixed(1)}% overpriced`
            }`
          );
        }

        if (ev > 0) {
          reasoning.push(
            `+$${ev.toFixed(2)} expected value per $100 wagered`
          );
        } else if (ev < -2) {
          reasoning.push(
            `Negative EV: -$${Math.abs(ev).toFixed(2)} per $100 — the juice is eating your edge`
          );
        }

        if (other && priceDiff !== 0) {
          reasoning.push(
            `${Math.abs(priceDiff)} cents better than ${other.book} (${formatOdds(other.price)}) — this is the sharper number`
          );
        }

        if (kelly > 0.02) {
          reasoning.push(
            `Kelly suggests ${(kelly * 100).toFixed(1)}% of bankroll — ${
              kelly > 0.05
                ? "strong sizing signal"
                : "small but positive edge"
            }`
          );
        }

        if (vig !== null) {
          const vigPct = vig * 100;
          if (vigPct < 3) {
            reasoning.push(`Low juice market (${vigPct.toFixed(1)}% vig) — more of your bet goes to potential payout`);
          } else if (vigPct >= 5) {
            reasoning.push(`Heavy juice (${vigPct.toFixed(1)}% vig) — the book is taking a big cut here`);
          }
        }

        if (recommendation === "take" && fairProb !== null) {
          const breakeven = impliedProb * 100;
          reasoning.push(
            `You only need ${side} to win ${breakeven.toFixed(1)}% of the time to break even — consensus says they win ${(fairProb * 100).toFixed(1)}%`
          );
        }

        if (recommendation === "pass") {
          if (ev < 0) {
            reasoning.push("No edge detected — the line is priced efficiently or against you");
          }
          if (other && priceDiff === 0) {
            reasoning.push("Both books agree on this number — no line shopping advantage");
          }
        }

        picks.push({
          gameId,
          homeTeam: first.homeTeam,
          awayTeam: first.awayTeam,
          commenceTime: first.commenceTime,
          sport: first.sport,
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
        });
      }
    }

    // Sort: takes first, then leans, then passes. Within each tier, by confidence desc.
    const recOrder = { take: 0, lean: 1, pass: 2 };
    picks.sort((a, b) => {
      const o = recOrder[a.recommendation] - recOrder[b.recommendation];
      if (o !== 0) return o;
      return b.confidence - a.confidence;
    });

    const hasTake = picks.some((p) => p.recommendation === "take");
    const bestPick = picks.length > 0 ? picks[0] : null;

    allGames.push({
      gameId,
      homeTeam: first.homeTeam,
      awayTeam: first.awayTeam,
      commenceTime: first.commenceTime,
      sport: first.sport,
      picks,
      hasTake,
      bestPick,
    });
  }

  // Sort games: games with "take" picks first, then by start time
  allGames.sort((a, b) => {
    if (a.hasTake && !b.hasTake) return -1;
    if (!a.hasTake && b.hasTake) return 1;
    return new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime();
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

  return {
    takes,
    leans,
    totalGames: games.length,
    totalMarkets: allPicks.length,
    totalEV: Math.round(totalEV * 100) / 100,
    avgConfidence: Math.round(avgConfidence),
  };
}
