import { NextRequest, NextResponse } from "next/server";
import { SPORT_MAP } from "@/lib/odds/sports";
import {
  normalizeSportsbookOdds,
  normalizeKalshiMarkets,
  SportsbookLine,
  KalshiLine,
} from "@/lib/odds/normalize";

async function fetchSportsbookOdds(sport: string): Promise<SportsbookLine[]> {
  const sportKey = SPORT_MAP[sport];
  if (!sportKey) return [];

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error("Missing ODDS_API_KEY env var");

  const url = new URL(
    `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`
  );
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h,spreads,totals");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("bookmakers", "draftkings,fanduel");

  const res = await fetch(url.toString(), { cache: "no-store" });

  if (!res.ok) {
    // If a sport has no games (off-season), just return empty
    if (res.status === 422 || res.status === 404) return [];
    const text = await res.text();
    throw new Error(`Odds API error ${res.status} for ${sport}: ${text}`);
  }

  const json = await res.json();
  return normalizeSportsbookOdds(json);
}

async function fetchAllSports(): Promise<SportsbookLine[]> {
  const sportKeys = Object.keys(SPORT_MAP);

  const results = await Promise.allSettled(
    sportKeys.map((sport) => fetchSportsbookOdds(sport))
  );

  const allLines: SportsbookLine[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allLines.push(...result.value);
    }
    // silently skip failed sports (off-season, etc.)
  }

  return allLines;
}

async function fetchKalshiMarkets(
  seriesTicker?: string,
  limit = 100
): Promise<KalshiLine[]> {
  if (!seriesTicker) return [];

  const url = new URL(
    "https://api.elections.kalshi.com/trade-api/v2/markets"
  );
  url.searchParams.set("series_ticker", seriesTicker);
  url.searchParams.set("status", "open");
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), { cache: "no-store" });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kalshi error ${res.status}: ${text}`);
  }

  const json = await res.json();
  return normalizeKalshiMarkets(json.markets ?? []);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport"); // null = all sports
    const kalshiSeriesTicker =
      searchParams.get("kalshiSeriesTicker") ?? undefined;

    const [sportsbookLines, kalshiLines] = await Promise.all([
      sport ? fetchSportsbookOdds(sport) : fetchAllSports(),
      fetchKalshiMarkets(kalshiSeriesTicker),
    ]);

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      sport: sport ?? "all",
      kalshiSeriesTicker: kalshiSeriesTicker ?? null,
      sportsbookLines,
      kalshiLines,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
