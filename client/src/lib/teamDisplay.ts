type TeamAlias = {
  abbr: string;
  aliases: string[];
};

const MLB_TEAM_ALIASES: TeamAlias[] = [
  { abbr: "ARI", aliases: ["arizona diamondbacks", "diamondbacks", "d-backs", "dbacks"] },
  { abbr: "ATL", aliases: ["atlanta braves", "braves"] },
  { abbr: "BAL", aliases: ["baltimore orioles", "orioles"] },
  { abbr: "BOS", aliases: ["boston red sox", "red sox"] },
  { abbr: "CHC", aliases: ["chicago cubs", "cubs"] },
  { abbr: "CWS", aliases: ["chicago white sox", "white sox"] },
  { abbr: "CIN", aliases: ["cincinnati reds", "reds"] },
  { abbr: "CLE", aliases: ["cleveland guardians", "guardians", "cleveland indians", "indians"] },
  { abbr: "COL", aliases: ["colorado rockies", "rockies"] },
  { abbr: "DET", aliases: ["detroit tigers", "tigers"] },
  { abbr: "HOU", aliases: ["houston astros", "astros"] },
  { abbr: "KC", aliases: ["kansas city royals", "royals"] },
  { abbr: "LAA", aliases: ["los angeles angels", "la angels", "angels"] },
  { abbr: "LAD", aliases: ["los angeles dodgers", "la dodgers", "dodgers"] },
  { abbr: "MIA", aliases: ["miami marlins", "marlins", "florida marlins"] },
  { abbr: "MIL", aliases: ["milwaukee brewers", "brewers"] },
  { abbr: "MIN", aliases: ["minnesota twins", "twins"] },
  { abbr: "NYM", aliases: ["new york mets", "mets"] },
  { abbr: "NYY", aliases: ["new york yankees", "yankees"] },
  { abbr: "ATH", aliases: ["athletics", "oakland athletics", "oakland a's", "as"] },
  { abbr: "PHI", aliases: ["philadelphia phillies", "phillies"] },
  { abbr: "PIT", aliases: ["pittsburgh pirates", "pirates"] },
  { abbr: "SD", aliases: ["san diego padres", "padres"] },
  { abbr: "SF", aliases: ["san francisco giants", "giants"] },
  { abbr: "SEA", aliases: ["seattle mariners", "mariners"] },
  { abbr: "STL", aliases: ["st. louis cardinals", "saint louis cardinals", "cardinals"] },
  { abbr: "TB", aliases: ["tampa bay rays", "rays"] },
  { abbr: "TEX", aliases: ["texas rangers", "rangers"] },
  { abbr: "TOR", aliases: ["toronto blue jays", "blue jays"] },
  { abbr: "WSH", aliases: ["washington nationals", "nationals", "montreal expos", "expos"] },
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function getMlbAffiliationAbbreviation(teamOrOrgName?: string | null): string | null {
  if (!teamOrOrgName) return null;
  const normalized = normalize(teamOrOrgName);
  if (!normalized) return null;
  for (const team of MLB_TEAM_ALIASES) {
    if (team.aliases.some((alias) => normalized.includes(alias))) {
      return team.abbr;
    }
  }
  return null;
}

export function formatAffiliatedTeamLabel(params: {
  currentTeamName?: string | null;
  parentOrgName?: string | null;
  sportLevel?: string | null;
  fallback?: string;
}): string {
  const {
    currentTeamName,
    parentOrgName,
    sportLevel,
    fallback = "-",
  } = params;
  const base = currentTeamName || parentOrgName;
  if (!base) return fallback;

  if ((sportLevel || "").toUpperCase() === "MLB") {
    return currentTeamName || parentOrgName || fallback;
  }

  const abbr = getMlbAffiliationAbbreviation(parentOrgName || currentTeamName);
  if (!abbr) return base;
  if (base.endsWith(`(${abbr})`)) return base;
  return `${base} (${abbr})`;
}
