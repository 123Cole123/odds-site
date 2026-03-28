export const SPORT_MAP: Record<string, string> = {
  nba: "basketball_nba",
  mlb: "baseball_mlb",
  nhl: "icehockey_nhl",
  nfl: "americanfootball_nfl",
  ncaab: "basketball_ncaab",
  soccer_epl: "soccer_epl",
  soccer_uefa_champs_league: "soccer_uefa_champs_league",
};

export const DISPLAY_SPORTS = [
  { label: "All Sports", value: "all" },
  { label: "NBA", value: "nba" },
  { label: "MLB", value: "mlb" },
  { label: "NHL", value: "nhl" },
  { label: "NFL", value: "nfl" },
  { label: "NCAAB", value: "ncaab" },
  { label: "EPL", value: "soccer_epl" },
  { label: "UCL", value: "soccer_uefa_champs_league" },
];

// Reverse lookup: API sport_key -> short label
export const SPORT_LABEL: Record<string, string> = {
  basketball_nba: "NBA",
  baseball_mlb: "MLB",
  icehockey_nhl: "NHL",
  americanfootball_nfl: "NFL",
  basketball_ncaab: "NCAAB",
  soccer_epl: "EPL",
  soccer_uefa_champs_league: "UCL",
};
