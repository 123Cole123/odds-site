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
            book:
              bookmaker.key === "draftkings"
                ? "DraftKings"
                : bookmaker.key === "fanduel"
                ? "FanDuel"
                : bookmaker.title,
            bookmakerKey: bookmaker.key,
            marketKey: market.key,
            outcomeName: outcome.name,
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

export type GroupedRow = {
  key: string;
  gameId: string;
  sport: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  book: string;
  bookmakerKey: string;
  marketKey: string;
  updatedAt: string | null;
  link: string | null;
  outcomes: { name: string; price: number; point: number | null }[];
};

export function groupSportsbookRows(lines: SportsbookLine[]): GroupedRow[] {
  const map = new Map<string, GroupedRow>();

  for (const line of lines) {
    const key = `${line.gameId}__${line.bookmakerKey}__${line.marketKey}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        gameId: line.gameId,
        sport: line.sport,
        commenceTime: line.commenceTime,
        homeTeam: line.homeTeam,
        awayTeam: line.awayTeam,
        book: line.book,
        bookmakerKey: line.bookmakerKey,
        marketKey: line.marketKey,
        updatedAt: line.updatedAt,
        link: line.link,
        outcomes: [],
      });
    }

    map.get(key)!.outcomes.push({
      name: line.outcomeName,
      price: line.price,
      point: line.point,
    });
  }

  return Array.from(map.values());
}

export function americanToImpliedProbability(odds: number) {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

export function formatMarketLabel(marketKey: string) {
  if (marketKey === "h2h") return "Moneyline";
  if (marketKey === "spreads") return "Spread";
  if (marketKey === "totals") return "Total";
  return marketKey;
}

export function centsToPercentDisplay(value: number | null) {
  if (value === null) return "\u2014";
  return `${value}\u00A2`;
}

export function formatAmericanOdds(price: number) {
  return price > 0 ? `+${price}` : `${price}`;
}
