import { SportsbookLine, americanToImpliedProbability, isPlayerProp, formatMarketLabel } from "./normalize";
import { SPORT_LABEL } from "./sports";

// ── Types ──────────────────────────────────────────────────────────────────

export type Projection = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  sport: string;
  sportLabel: string;
  marketKey: string;
  side: string;
  point: number | null;
  playerName: string | null;
  isProp: boolean;
  probability: number; // 0-1, our weighted model probability
  confidenceLevel: "high" | "medium" | "low"; // how confident we are in the projection
  booksUsed: number; // how many books contributed to this projection
  bestPrice: number; // best available line if you want to bet it
  bestBook: string;
  bestLink: string | null;
  label: string; // e.g. "Lakers ML", "LeBron Over 25.5 Points"
  factors: Factor[];
};

export type Factor = {
  name: string;
  detail: string;
  impact: "supports" | "against" | "neutral";
};

export type GameProjection = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  sport: string;
  sportLabel: string;
  homeWinProb: number | null;
  awayWinProb: number | null;
  spreadHome: number | null;
  projectedTotal: number | null;
  marketAgreement: number; // 0-100, how much books agree
  booksTotal: number;
  projections: Projection[];
  gameFactor: string | null;
};

// ── Home advantage baselines ───────────────────────────────────────────────

const HOME_EDGE: Record<string, { prob: number; note: string }> = {
  basketball_nba: {
    prob: 0.035,
    note: "NBA home teams historically win ~57.5% — a ~3.5% edge over 50/50",
  },
  baseball_mlb: {
    prob: 0.025,
    note: "MLB home teams historically win ~53-54% — a smaller but consistent edge",
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Core probability model: compute no-vig consensus across ALL books for a side.
 * More books = more data points = higher confidence.
 * We weight each book equally — the market IS the model.
 */
function computeConsensusProb(
  lines: SportsbookLine[],
  gameId: string,
  marketKey: string,
  side: string,
  point: number | null,
  playerName: string | null
): { prob: number; booksUsed: number; spread: number } | null {
  // Get all books offering this market
  const bookKeys = [
    ...new Set(
      lines
        .filter((l) => l.gameId === gameId && l.marketKey === marketKey)
        .map((l) => l.bookmakerKey)
    ),
  ];

  const noVigProbs: number[] = [];

  for (const bookKey of bookKeys) {
    const bookLines = lines.filter(
      (l) =>
        l.gameId === gameId &&
        l.marketKey === marketKey &&
        l.bookmakerKey === bookKey
    );

    // For player props, we need to match by player too
    const relevantLines = playerName
      ? bookLines.filter((l) => l.playerName === playerName)
      : bookLines;

    if (relevantLines.length < 2) continue;

    const totalImplied = relevantLines.reduce(
      (sum, l) => sum + americanToImpliedProbability(l.price),
      0
    );

    const match = relevantLines.find(
      (l) =>
        l.outcomeName === side &&
        ((l.point === null && point === null) || l.point === point)
    );
    if (!match) continue;

    noVigProbs.push(americanToImpliedProbability(match.price) / totalImplied);
  }

  if (noVigProbs.length === 0) return null;

  const avgProb = noVigProbs.reduce((a, b) => a + b, 0) / noVigProbs.length;

  // Spread = how much books disagree (std dev proxy)
  const spread =
    noVigProbs.length > 1
      ? Math.sqrt(
          noVigProbs.reduce((sum, p) => sum + (p - avgProb) ** 2, 0) /
            noVigProbs.length
        ) * 100
      : 0;

  return { prob: avgProb, booksUsed: noVigProbs.length, spread };
}

/**
 * Market agreement: how tightly do all books cluster around the consensus?
 * 100 = perfect agreement, 0 = wildly different.
 */
function marketAgreement(
  lines: SportsbookLine[],
  gameId: string
): { score: number; booksTotal: number } {
  const mlLines = lines.filter(
    (l) => l.gameId === gameId && l.marketKey === "h2h"
  );
  const bookKeys = [...new Set(mlLines.map((l) => l.bookmakerKey))];

  if (bookKeys.length < 2) return { score: 100, booksTotal: bookKeys.length };

  // Compute implied prob per book for each side
  const homeTeam = mlLines[0]?.homeTeam;
  const homeProbs: number[] = [];

  for (const bk of bookKeys) {
    const bkLines = mlLines.filter((l) => l.bookmakerKey === bk);
    if (bkLines.length < 2) continue;
    const total = bkLines.reduce(
      (s, l) => s + americanToImpliedProbability(l.price),
      0
    );
    const home = bkLines.find((l) => l.outcomeName === homeTeam);
    if (home) homeProbs.push(americanToImpliedProbability(home.price) / total);
  }

  if (homeProbs.length < 2) return { score: 100, booksTotal: bookKeys.length };

  const avg = homeProbs.reduce((a, b) => a + b, 0) / homeProbs.length;
  const stdDev = Math.sqrt(
    homeProbs.reduce((sum, p) => sum + (p - avg) ** 2, 0) / homeProbs.length
  );

  // 0% std dev = 100 score, 5%+ std dev = 0 score
  const score = Math.max(0, Math.min(100, Math.round((1 - stdDev / 0.05) * 100)));

  return { score, booksTotal: bookKeys.length };
}

function getSpread(
  lines: SportsbookLine[],
  gameId: string,
  homeTeam: string
): number | null {
  const spreadLines = lines.filter(
    (l) => l.gameId === gameId && l.marketKey === "spreads"
  );
  const home = spreadLines.find((l) => l.outcomeName === homeTeam);
  return home?.point ?? null;
}

function getTotal(
  lines: SportsbookLine[],
  gameId: string
): number | null {
  const totalLines = lines.filter(
    (l) => l.gameId === gameId && l.marketKey === "totals"
  );
  return totalLines[0]?.point ?? null;
}

// ── Core Model ─────────────────────────────────────────────────────────────

export function buildProjections(lines: SportsbookLine[]): GameProjection[] {
  const gameIds = [...new Set(lines.map((l) => l.gameId))];
  const allGames: GameProjection[] = [];

  for (const gameId of gameIds) {
    const gameLines = lines.filter((l) => l.gameId === gameId);
    if (gameLines.length === 0) continue;

    const first = gameLines[0];
    const sportLabel = SPORT_LABEL[first.sport] ?? first.sport;
    const marketKeys = [...new Set(gameLines.map((l) => l.marketKey))];
    const projections: Projection[] = [];

    // Game-level stats
    const agreement = marketAgreement(lines, gameId);
    const spreadHome = getSpread(lines, gameId, first.homeTeam);
    const projectedTotal = getTotal(lines, gameId);
    const homeAdv = HOME_EDGE[first.sport];

    // ML consensus
    const homeMLConsensus = computeConsensusProb(
      lines, gameId, "h2h", first.homeTeam, null, null
    );
    const awayMLConsensus = computeConsensusProb(
      lines, gameId, "h2h", first.awayTeam, null, null
    );

    const homeWinProb = homeMLConsensus?.prob ?? null;
    const awayWinProb = awayMLConsensus?.prob ?? null;

    // Game-level factor
    let gameFactor: string | null = null;
    if (homeAdv && homeWinProb !== null) {
      gameFactor = homeAdv.note;
    }

    for (const marketKey of marketKeys) {
      const marketLines = gameLines.filter((l) => l.marketKey === marketKey);
      const isProp = isPlayerProp(marketKey);

      const sideKeys = [
        ...new Set(
          marketLines.map(
            (l) => `${l.outcomeName}||${l.point ?? "null"}||${l.playerName ?? ""}`
          )
        ),
      ];

      for (const sideKey of sideKeys) {
        const parts = sideKey.split("||");
        const side = parts[0];
        const pointStr = parts[1];
        const playerName = parts[2] || null;
        const point = pointStr === "null" ? null : parseFloat(pointStr);

        const sidelines = marketLines.filter(
          (l) =>
            l.outcomeName === side &&
            ((l.point === null && point === null) || l.point === point) &&
            (l.playerName ?? "") === (playerName ?? "")
        );
        if (sidelines.length === 0) continue;

        const consensus = computeConsensusProb(
          lines, gameId, marketKey, side, point, playerName
        );
        if (!consensus) continue;

        // Best available price
        const sorted = [...sidelines].sort((a, b) => b.price - a.price);
        const best = sorted[0];

        // Confidence level based on number of books and agreement
        let confidenceLevel: "high" | "medium" | "low";
        if (consensus.booksUsed >= 6 && consensus.spread < 1.5) {
          confidenceLevel = "high";
        } else if (consensus.booksUsed >= 3 && consensus.spread < 3) {
          confidenceLevel = "medium";
        } else {
          confidenceLevel = "low";
        }

        // Build label
        let label: string;
        if (isProp && playerName) {
          label = `${playerName} ${side} ${point ?? ""} ${formatMarketLabel(marketKey)}`;
        } else if (marketKey === "h2h") {
          label = `${side} Win`;
        } else if (marketKey === "spreads") {
          label = `${side} ${point != null && point > 0 ? "+" : ""}${point}`;
        } else if (marketKey === "totals") {
          label = `${side} ${point}`;
        } else {
          label = `${side} ${formatMarketLabel(marketKey)}`;
        }

        // Build factors
        const factors: Factor[] = [];

        // Factor: consensus strength
        factors.push({
          name: "Market consensus",
          detail: `${consensus.booksUsed} sportsbook${consensus.booksUsed === 1 ? "" : "s"} averaged (no-vig) to produce this probability`,
          impact: consensus.booksUsed >= 5 ? "supports" : consensus.booksUsed <= 1 ? "against" : "neutral",
        });

        if (consensus.spread > 0) {
          factors.push({
            name: "Book agreement",
            detail: consensus.spread < 1.5
              ? `Books tightly clustered (${consensus.spread.toFixed(1)}% std dev) — strong agreement on this number`
              : consensus.spread < 3
              ? `Moderate spread across books (${consensus.spread.toFixed(1)}% std dev) — some disagreement`
              : `Books diverge significantly (${consensus.spread.toFixed(1)}% std dev) — less certainty in this projection`,
            impact: consensus.spread < 1.5 ? "supports" : consensus.spread > 3 ? "against" : "neutral",
          });
        }

        // Factor: home/away for game lines
        if (marketKey === "h2h" && homeAdv) {
          const isHome = side === first.homeTeam;
          factors.push({
            name: isHome ? "Home court/field" : "Road game",
            detail: isHome
              ? `Playing at home. ${homeAdv.note}.`
              : `Playing on the road. The home team gets a ~${(homeAdv.prob * 100).toFixed(1)}% baseline edge.`,
            impact: isHome ? "supports" : "against",
          });
        }

        // Factor: spread context for ML
        if (marketKey === "h2h" && spreadHome !== null) {
          const isHome = side === first.homeTeam;
          const teamSpread = isHome ? spreadHome : -(spreadHome);
          if (teamSpread < -5) {
            factors.push({
              name: "Spread-implied favorite",
              detail: `Spread of ${teamSpread > 0 ? "+" : ""}${teamSpread} points — the market sees ${side} as significantly stronger`,
              impact: "supports",
            });
          } else if (teamSpread > 5) {
            factors.push({
              name: "Spread-implied underdog",
              detail: `Spread of +${teamSpread} points — ${side} is expected to lose by a notable margin`,
              impact: "against",
            });
          } else if (Math.abs(teamSpread) <= 2) {
            factors.push({
              name: "Coin-flip game",
              detail: `Spread of ${teamSpread > 0 ? "+" : ""}${teamSpread} — essentially a pick'em. Small factors like rest, travel, and matchups swing this.`,
              impact: "neutral",
            });
          }
        }

        // Factor: total context
        if (marketKey === "totals" && point !== null) {
          if (first.sport === "basketball_nba") {
            factors.push({
              name: "Pace context",
              detail: point > 230
                ? `Total of ${point} is above league average (~224) — market expects a fast-paced, high-scoring game`
                : point < 215
                ? `Total of ${point} is below league average (~224) — market expects a grind-it-out, defensive game`
                : `Total of ${point} is near league average (~224) — standard pace expected`,
              impact: "neutral",
            });
          } else if (first.sport === "baseball_mlb") {
            factors.push({
              name: "Run environment",
              detail: point > 9
                ? `Total of ${point} is elevated — market expects high-scoring conditions (pitching matchup, ballpark, weather)`
                : point < 7.5
                ? `Total of ${point} is low — market expects a pitcher's duel or run-suppressing environment`
                : `Total of ${point} is near the MLB average (~8.5 runs)`,
              impact: "neutral",
            });
          }
        }

        // Factor: prop depth
        if (isProp && playerName) {
          if (consensus.booksUsed >= 5) {
            factors.push({
              name: "Prop market depth",
              detail: `${consensus.booksUsed} books pricing this prop — deep market with reliable consensus`,
              impact: "supports",
            });
          } else if (consensus.booksUsed <= 2) {
            factors.push({
              name: "Thin prop market",
              detail: `Only ${consensus.booksUsed} book${consensus.booksUsed === 1 ? "" : "s"} — limited data makes this projection less reliable`,
              impact: "against",
            });
          }
        }

        projections.push({
          gameId,
          homeTeam: first.homeTeam,
          awayTeam: first.awayTeam,
          commenceTime: first.commenceTime,
          sport: first.sport,
          sportLabel,
          marketKey,
          side,
          point,
          playerName,
          isProp,
          probability: Math.round(consensus.prob * 1000) / 1000,
          confidenceLevel,
          booksUsed: consensus.booksUsed,
          bestPrice: best.price,
          bestBook: best.book,
          bestLink: best.link,
          label,
          factors,
        });
      }
    }

    // Sort: game lines first, then props. Within each, by probability desc.
    projections.sort((a, b) => {
      if (a.isProp !== b.isProp) return a.isProp ? 1 : -1;
      // For game lines, show ML first, then spread, then totals
      const marketOrder: Record<string, number> = { h2h: 0, spreads: 1, totals: 2 };
      const ao = marketOrder[a.marketKey] ?? 3;
      const bo = marketOrder[b.marketKey] ?? 3;
      if (ao !== bo) return ao - bo;
      return b.probability - a.probability;
    });

    allGames.push({
      gameId,
      homeTeam: first.homeTeam,
      awayTeam: first.awayTeam,
      commenceTime: first.commenceTime,
      sport: first.sport,
      sportLabel,
      homeWinProb,
      awayWinProb,
      spreadHome,
      projectedTotal,
      marketAgreement: agreement.score,
      booksTotal: agreement.booksTotal,
      projections,
      gameFactor: gameFactor,
    });
  }

  // Sort by game time
  allGames.sort(
    (a, b) =>
      new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime()
  );

  return allGames;
}

export function projectionsSummary(games: GameProjection[]) {
  const allProjections = games.flatMap((g) => g.projections);
  const highConf = allProjections.filter((p) => p.confidenceLevel === "high");
  const props = allProjections.filter((p) => p.isProp);
  const gameLines = allProjections.filter((p) => !p.isProp);
  const sportsWithGames = [...new Set(games.map((g) => g.sportLabel))];
  const avgAgreement =
    games.length > 0
      ? Math.round(
          games.reduce((sum, g) => sum + g.marketAgreement, 0) / games.length
        )
      : 0;

  return {
    totalGames: games.length,
    totalProjections: allProjections.length,
    highConfCount: highConf.length,
    propCount: props.length,
    gameLineCount: gameLines.length,
    avgAgreement,
    sportsWithGames,
  };
}
