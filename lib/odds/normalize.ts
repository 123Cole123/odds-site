export type SportsbookLine = {
  source: "sportsbook";
  gameId: string;
  sport: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  book: string;
  bookmakerKey: string;
  marketKey: string;
  outcomeName: string;
  playerName: string | null; // for player props
  price: number;
  point: number | null;
  updatedAt: string | null;
  link: string | null;
};

export type KalshiLine = {
  source: "kalshi";
  marketTicker: string;
  title: string;
  subtitle: string | null;
  status: string;
  yesAsk: number | null;
  yesBid: number | null;
  noAsk: number | null;
  noBid: number | null;
  lastPrice: number | null;
  volume: number | null;
  closeTime: string | null;
  rulesPrimary: string | null;
};

const BOOK_DISPLAY: Record<string, string> = {
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  williamhill_us: "Caesars",
  pointsbetus: "PointsBet",
  betrivers: "BetRivers",
  superbook: "SuperBook",
  bovada: "Bovada",
  betonlineag: "BetOnline",
  mybookieag: "MyBookie",
  unibet_us: "Unibet",
  foxbet: "FOX Bet",
  barstool: "Barstool",
  wynnbet: "WynnBET",
  betfred: "Betfred",
  betus: "BetUS",
  lowvig: "LowVig",
  espnbet: "ESPN BET",
  fliff: "Fliff",
  hardrockbet: "Hard Rock",
  fanatics: "Fanatics",
};

export function normalizeSportsbookOdds(events: any[]): SportsbookLine[] {
  const lines: SportsbookLine[] = [];

  for (const event of events) {
    for (const bookmaker of event.bookmakers ?? []) {
      for (const market of bookmaker.markets ?? []) {
        for (const outcome of market.outcomes ?? []) {
          lines.push({
            source: "sportsbook",
            gameId: event.id,
            sport: event.sport_key,
            commenceTime: event.commence_time,
            homeTeam: event.home_team,
            awayTeam: event.away_team,
            book: BOOK_DISPLAY[bookmaker.key] ?? bookmaker.title,
            bookmakerKey: bookmaker.key,
            marketKey: market.key,
            outcomeName: outcome.name,
            playerName: outcome.description ?? null,
            price: outcome.price,
            point: outcome.point ?? null,
            updatedAt: bookmaker.last_update ?? null,
            link: bookmaker.link ?? null,
          });
        }
      }
    }
  }

  return lines;
}

export function normalizeKalshiMarkets(markets: any[]): KalshiLine[] {
  return (markets ?? []).map((market) => ({
    source: "kalshi",
    marketTicker: market.ticker,
    title: market.title,
    subtitle: market.subtitle ?? null,
    status: market.status,
    yesAsk: typeof market.yes_ask === "number" ? market.yes_ask : null,
    yesBid: typeof market.yes_bid === "number" ? market.yes_bid : null,
    noAsk: typeof market.no_ask === "number" ? market.no_ask : null,
    noBid: typeof market.no_bid === "number" ? market.no_bid : null,
    lastPrice: typeof market.last_price === "number" ? market.last_price : null,
    volume: typeof market.volume === "number" ? market.volume : null,
    closeTime: market.close_time ?? null,
    rulesPrimary: market.rules_primary ?? null,
  }));
}

export function americanToImpliedProbability(odds: number) {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

const PROP_LABELS: Record<string, string> = {
  player_points: "Points",
  player_rebounds: "Rebounds",
  player_assists: "Assists",
  player_threes: "3-Pointers",
  player_blocks: "Blocks",
  player_steals: "Steals",
  player_blocks_steals: "Blks+Stls",
  player_turnovers: "Turnovers",
  player_points_rebounds_assists: "Pts+Reb+Ast",
  player_points_rebounds: "Pts+Reb",
  player_points_assists: "Pts+Ast",
  player_rebounds_assists: "Reb+Ast",
  player_first_td: "First TD",
  player_last_td: "Last TD",
  player_anytime_td: "Anytime TD",
  player_pass_tds: "Pass TDs",
  player_pass_yds: "Pass Yds",
  player_pass_completions: "Completions",
  player_pass_attempts: "Pass Att",
  player_pass_interceptions: "INTs",
  player_rush_yds: "Rush Yds",
  player_rush_attempts: "Rush Att",
  player_reception_yds: "Rec Yds",
  player_receptions: "Receptions",
  player_kicking_points: "Kicking Pts",
  player_field_goals: "FGs Made",
  player_tackles_assists: "Tackles+Ast",
  player_power_play_points: "PP Points",
  player_blocked_shots: "Blocked Shots",
  player_shots_on_goal: "SOG",
  player_goals: "Goals",
  player_total_saves: "Saves",
  player_hits: "Hits",
  player_home_runs: "Home Runs",
  player_total_bases: "Total Bases",
  player_rbis: "RBIs",
  player_stolen_bases: "Stolen Bases",
  player_strikeouts: "Strikeouts",
  player_pitcher_strikeouts: "K's (Pitcher)",
  player_hits_allowed: "Hits Allowed",
  player_walks: "Walks",
  player_earned_runs: "Earned Runs",
  player_pitcher_outs: "Outs Recorded",
};

export function formatMarketLabel(marketKey: string) {
  if (marketKey === "h2h") return "Moneyline";
  if (marketKey === "spreads") return "Spread";
  if (marketKey === "totals") return "Total";
  if (PROP_LABELS[marketKey]) return PROP_LABELS[marketKey];
  // Fallback: clean up snake_case
  return marketKey.replace(/^player_/, "").replace(/_/g, " ");
}

export function isPlayerProp(marketKey: string) {
  return marketKey.startsWith("player_");
}

export function centsToPercentDisplay(value: number | null) {
  if (value === null) return "\u2014";
  return `${value}\u00A2`;
}

export function formatAmericanOdds(price: number) {
  return price > 0 ? `+${price}` : `${price}`;
}
