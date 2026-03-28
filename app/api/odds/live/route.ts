import { NextRequest, NextResponse } from "next/server";
import { SPORT_MAP } from "@/lib/odds/sports";
import {
  normalizeSportsbookOdds,
  normalizeKalshiMarkets,
  SportsbookLine,
  KalshiLine,
} from "@/lib/odds/normalize";

// All US-region bookmakers supported by The Odds API
const ALL_BOOKMAKERS = [
  "draftkings",
  "fanduel",
  "betmgm",
  "williamhill_us",
  "pointsbetus",
  "betrivers",
  "superbook",
  "bovada",
  "betonlineag",
  "mybookieag",
  "unibet_us",
  "espnbet",
  "fanatics",
  "hardrockbet",
  "lowvig",
  "betus",
  "wynnbet",
  "betfred",
  "fliff",
].join(",");

// Standard game markets
const GAME_MARKETS = "h2h,spreads,totals";

// Player prop markets by sport
const PROP_MARKETS: Record<string, string> = {
  basketball_nba:
    "player_points,player_rebounds,player_assists,player_threes,player_points_rebounds_assists,player_points_rebounds,player_points_assists,player_rebounds_assists,player_blocks,player_steals,player_turnovers",
  basketball_ncaab:
    "player_points,player_rebounds,player_assists,player_threes",
  americanfootball_nfl:
    "player_pass_tds,player_pass_yds,player_pass_completions,player_pass_interceptions,player_rush_yds,player_reception_yds,player_receptions,player_anytime_td,player_kicking_points",
  baseball_mlb:
    "player_hits,player_home_runs,player_total_bases,player_rbis,player_stolen_bases,player_strikeouts,player_pitcher_strikeouts,player_hits_allowed,player_walks,player_earned_runs",
  icehockey_nhl:
    "player_goals,player_assists,player_shots_on_goal,player_total_saves,player_blocked_shots,player_power_play_points",
};

async function fetchGameOdds(sport: string): Promise<SportsbookLine[]> {
  const sportKey = SPORT_MAP[sport];
  if (!sportKey) return [];

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error("Missing ODDS_API_KEY env var");

  const url = new URL(
    `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`
  );
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", GAME_MARKETS);
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("bookmakers", ALL_BOOKMAKERS);

  const res = await fetch(url.toString(), { cache: "no-store" });

  if (!res.ok) {
    if (res.status === 422 || res.status === 404) return [];
    const text = await res.text();
    throw new Error(`Odds API error ${res.status} for ${sport}: ${text}`);
  }

  return normalizeSportsbookOdds(await res.json());
}

async function fetchPlayerProps(sport: string): Promise<SportsbookLine[]> {
  const sportKey = SPORT_MAP[sport];
  if (!sportKey) return [];

  const propMarkets = PROP_MARKETS[sportKey];
  if (!propMarkets) return []; // no props defined for this sport

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error("Missing ODDS_API_KEY env var");

  // First get events list to get event IDs
  const eventsUrl = new URL(
    `https://api.the-odds-api.com/v4/sports/${sportKey}/events`
  );
  eventsUrl.searchParams.set("apiKey", apiKey);

  const eventsRes = await fetch(eventsUrl.toString(), { cache: "no-store" });
  if (!eventsRes.ok) return [];

  const events: any[] = await eventsRes.json();
  if (events.length === 0) return [];

  // Fetch props for each event (limit to first 5 to conserve API quota)
  const eventSlice = events.slice(0, 5);

  const results = await Promise.allSettled(
    eventSlice.map(async (event) => {
      const url = new URL(
        `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${event.id}/odds`
      );
      url.searchParams.set("apiKey", apiKey!);
      url.searchParams.set("regions", "us");
      url.searchParams.set("markets", propMarkets);
      url.searchParams.set("oddsFormat", "american");
      url.searchParams.set("bookmakers", ALL_BOOKMAKERS);

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) return [];

      const data = await res.json();
      // The event-level endpoint returns a single event object, not an array
      return normalizeSportsbookOdds([data]);
    })
  );

  const allLines: SportsbookLine[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allLines.push(...result.value);
    }
  }
  return allLines;
}

async function fetchSportFull(sport: string): Promise<SportsbookLine[]> {
  const [gameLines, propLines] = await Promise.all([
    fetchGameOdds(sport),
    fetchPlayerProps(sport),
  ]);
  return [...gameLines, ...propLines];
}

async function fetchAllSports(): Promise<SportsbookLine[]> {
  const sportKeys = Object.keys(SPORT_MAP);

  const results = await Promise.allSettled(
    sportKeys.map((sport) => fetchSportFull(sport))
  );

  const allLines: SportsbookLine[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allLines.push(...result.value);
    }
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
      sport ? fetchSportFull(sport) : fetchAllSports(),
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
