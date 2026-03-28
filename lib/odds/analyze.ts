import { SportsbookLine, americanToImpliedProbability } from "./normalize";

export type BestLineAnalysis = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  sport: string;
  marketKey: string;
  side: string;
  point: number | null;
  lines: {
    book: string;
    bookmakerKey: string;
    price: number;
    impliedProb: number;
    link: string | null;
    updatedAt: string | null;
  }[];
  best: {
    book: string;
    bookmakerKey: string;
    price: number;
    impliedProb: number;
    link: string | null;
  };
  worst: {
    book: string;
    price: number;
    impliedProb: number;
  };
  edge: number; // percentage points of implied probability saved vs worst line
  noVigProb: number | null; // fair probability after removing vig
  vigAtBest: number | null; // vig baked into the best line (lower = better)
  rating: "strong" | "moderate" | "neutral";
  reasons: string[];
};

export type GameAnalysis = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  sport: string;
  markets: BestLineAnalysis[];
  totalVigDK: number | null;
  totalVigFD: number | null;
};

/**
 * For a given game + market (e.g. moneyline), compute the no-vig probability
 * by summing implied probs of all outcomes for a book, then dividing each
 * outcome's implied prob by that sum.
 */
function computeNoVig(
  lines: SportsbookLine[],
  gameId: string,
  marketKey: string,
  bookmakerKey: string,
  side: string
): number | null {
  const bookLines = lines.filter(
    (l) =>
      l.gameId === gameId &&
      l.marketKey === marketKey &&
      l.bookmakerKey === bookmakerKey
  );
  if (bookLines.length < 2) return null;

  const totalImplied = bookLines.reduce(
    (sum, l) => sum + americanToImpliedProbability(l.price),
    0
  );
  const thisLine = bookLines.find((l) => l.outcomeName === side);
  if (!thisLine) return null;

  return americanToImpliedProbability(thisLine.price) / totalImplied;
}

/**
 * Compute the total vig (overround) for a book on a specific game+market.
 * Vig = sum of implied probs - 1. E.g. 0.04 = 4% vig.
 */
function computeVig(
  lines: SportsbookLine[],
  gameId: string,
  marketKey: string,
  bookmakerKey: string
): number | null {
  const bookLines = lines.filter(
    (l) =>
      l.gameId === gameId &&
      l.marketKey === marketKey &&
      l.bookmakerKey === bookmakerKey
  );
  if (bookLines.length < 2) return null;

  const totalImplied = bookLines.reduce(
    (sum, l) => sum + americanToImpliedProbability(l.price),
    0
  );
  return totalImplied - 1;
}

/**
 * Core analysis: for every game × market × side, find the best line across books
 * and produce analytics explaining why it's better.
 */
export function analyzeBestLines(lines: SportsbookLine[]): GameAnalysis[] {
  // Group by game
  const gameIds = [...new Set(lines.map((l) => l.gameId))];

  const games: GameAnalysis[] = [];

  for (const gameId of gameIds) {
    const gameLines = lines.filter((l) => l.gameId === gameId);
    if (gameLines.length === 0) continue;

    const first = gameLines[0];
    const marketKeys = [...new Set(gameLines.map((l) => l.marketKey))];
    const markets: BestLineAnalysis[] = [];

    // Compute total vig per book for the moneyline market
    const totalVigDK = computeVig(gameLines, gameId, "h2h", "draftkings");
    const totalVigFD = computeVig(gameLines, gameId, "h2h", "fanduel");

    for (const marketKey of marketKeys) {
      const marketLines = gameLines.filter((l) => l.marketKey === marketKey);
      // Group by side+point to handle spreads/totals correctly
      const sideKeys = [
        ...new Set(
          marketLines.map((l) => `${l.outcomeName}||${l.point ?? "null"}`)
        ),
      ];

      for (const sideKey of sideKeys) {
        const [side, pointStr] = sideKey.split("||");
        const point = pointStr === "null" ? null : parseFloat(pointStr);

        const sidelines = marketLines.filter(
          (l) =>
            l.outcomeName === side &&
            ((l.point === null && point === null) || l.point === point)
        );

        if (sidelines.length === 0) continue;

        const analyzed = sidelines.map((l) => ({
          book: l.book,
          bookmakerKey: l.bookmakerKey,
          price: l.price,
          impliedProb: americanToImpliedProbability(l.price),
          link: l.link,
          updatedAt: l.updatedAt,
        }));

        // Best line = highest American odds (most positive or least negative)
        // which corresponds to lowest implied probability (best payout for bettor)
        analyzed.sort((a, b) => b.price - a.price);

        const best = analyzed[0];
        const worst = analyzed[analyzed.length - 1];

        const edge =
          analyzed.length > 1
            ? (worst.impliedProb - best.impliedProb) * 100
            : 0;

        // No-vig fair probability from the best book
        const noVigProb = computeNoVig(
          lines,
          gameId,
          marketKey,
          best.bookmakerKey,
          side
        );

        // Vig at the best book for this market
        const vigAtBest = computeVig(lines, gameId, marketKey, best.bookmakerKey);

        // Build reasons
        const reasons: string[] = [];
        let rating: "strong" | "moderate" | "neutral" = "neutral";

        if (analyzed.length > 1 && best.price !== worst.price) {
          reasons.push(
            `Best price at ${best.book} (${formatOdds(best.price)}) vs ${worst.book} (${formatOdds(worst.price)})`
          );
        }

        if (edge >= 3) {
          reasons.push(
            `${edge.toFixed(1)}% implied probability edge — significant value`
          );
          rating = "strong";
        } else if (edge >= 1) {
          reasons.push(
            `${edge.toFixed(1)}% implied probability edge`
          );
          rating = "moderate";
        }

        if (noVigProb !== null) {
          const vigOverpay = best.impliedProb - noVigProb;
          if (vigOverpay > 0) {
            reasons.push(
              `Fair prob ${(noVigProb * 100).toFixed(1)}% → you're paying ${(vigOverpay * 100).toFixed(1)}% vig at ${best.book}`
            );
          }
        }

        if (vigAtBest !== null) {
          const vigPct = vigAtBest * 100;
          if (vigPct < 3) {
            reasons.push(`Low juice: ${vigPct.toFixed(1)}% total vig on this market`);
            if (rating === "neutral") rating = "moderate";
          } else if (vigPct >= 5) {
            reasons.push(`High juice: ${vigPct.toFixed(1)}% total vig — consider waiting for better price`);
          }
        }

        if (analyzed.length > 1) {
          const priceDiff = best.price - worst.price;
          if (Math.abs(priceDiff) >= 15) {
            reasons.push(
              `${Math.abs(priceDiff)} cent spread between books — shop this line`
            );
            if (rating === "neutral") rating = "moderate";
          }
        }

        if (reasons.length === 0) {
          reasons.push("Lines are identical across books");
        }

        markets.push({
          gameId,
          homeTeam: first.homeTeam,
          awayTeam: first.awayTeam,
          commenceTime: first.commenceTime,
          sport: first.sport,
          marketKey,
          side,
          point,
          lines: analyzed,
          best: {
            book: best.book,
            bookmakerKey: best.bookmakerKey,
            price: best.price,
            impliedProb: best.impliedProb,
            link: best.link,
          },
          worst: {
            book: worst.book,
            price: worst.price,
            impliedProb: worst.impliedProb,
          },
          edge,
          noVigProb,
          vigAtBest,
          rating,
          reasons,
        });
      }
    }

    // Sort markets: strong first, then moderate, then neutral
    const ratingOrder = { strong: 0, moderate: 1, neutral: 2 };
    markets.sort((a, b) => ratingOrder[a.rating] - ratingOrder[b.rating]);

    games.push({
      gameId,
      homeTeam: first.homeTeam,
      awayTeam: first.awayTeam,
      commenceTime: first.commenceTime,
      sport: first.sport,
      markets,
      totalVigDK,
      totalVigFD,
    });
  }

  // Sort games by commence time
  games.sort(
    (a, b) =>
      new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime()
  );

  return games;
}

function formatOdds(price: number) {
  return price > 0 ? `+${price}` : `${price}`;
}

export function overallEdgeSummary(games: GameAnalysis[]) {
  const allMarkets = games.flatMap((g) => g.markets);
  const strongPicks = allMarkets.filter((m) => m.rating === "strong");
  const moderatePicks = allMarkets.filter((m) => m.rating === "moderate");
  const avgEdge =
    allMarkets.length > 0
      ? allMarkets.reduce((sum, m) => sum + m.edge, 0) / allMarkets.length
      : 0;

  return { strongPicks, moderatePicks, avgEdge, totalMarkets: allMarkets.length };
}
