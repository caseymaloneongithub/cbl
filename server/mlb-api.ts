const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

interface MLBPlayer {
  id: number;
  fullName: string;
  fullFMLName?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  primaryPosition?: {
    code: string;
    name: string;
    type: string;
    abbreviation: string;
  };
  currentTeam?: {
    id: number;
    name: string;
  };
}

interface MLBSearchResult {
  people?: MLBPlayer[];
}

interface MLBHittingStats {
  plateAppearances?: number;
  gamesStarted?: number;
  atBats?: number;
  hits?: number;
  homeRuns?: number;
  rbi?: number;
  runs?: number;
  stolenBases?: number;
  avg?: string;
  ops?: string;
}

interface MLBPitchingStats {
  inningsPitched?: string;
  wins?: number;
  losses?: number;
  era?: string;
  whip?: string;
  strikeOuts?: number;
}

interface MLBStatsResponse {
  stats?: Array<{
    splits?: Array<{
      stat: MLBHittingStats | MLBPitchingStats;
    }>;
  }>;
}

export interface PlayerStats {
  mlbId: number;
  name: string;
  team?: string;
  position?: string;
  playerType: "hitter" | "pitcher";
  pa?: number;
  hr?: number;
  rbi?: number;
  runs?: number;
  sb?: number;
  avg?: number;
  ops?: number;
  ip?: number;
  wins?: number;
  losses?: number;
  era?: number;
  whip?: number;
  strikeouts?: number;
}

export interface SyncResult {
  playerName: string;
  found: boolean;
  mlbName?: string;
  stats?: PlayerStats;
  reason?: string;
}

async function searchPlayerByName(name: string): Promise<MLBPlayer | null> {
  try {
    const encodedName = encodeURIComponent(name);
    const url = `${MLB_API_BASE}/people/search?names=${encodedName}&sportIds=1&active=true`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`MLB API search failed for ${name}: ${response.status}`);
      return null;
    }
    
    const data: MLBSearchResult = await response.json();
    
    if (!data.people || data.people.length === 0) {
      const inactiveUrl = `${MLB_API_BASE}/people/search?names=${encodedName}&sportIds=1`;
      const inactiveResponse = await fetch(inactiveUrl);
      if (inactiveResponse.ok) {
        const inactiveData: MLBSearchResult = await inactiveResponse.json();
        if (inactiveData.people && inactiveData.people.length > 0) {
          return findBestMatch(name, inactiveData.people);
        }
      }
      return null;
    }
    
    return findBestMatch(name, data.people);
  } catch (error) {
    console.error(`Error searching for player ${name}:`, error);
    return null;
  }
}

function findBestMatch(searchName: string, players: MLBPlayer[]): MLBPlayer | null {
  if (players.length === 0) return null;
  if (players.length === 1) return players[0];
  
  const normalizedSearch = normalizeName(searchName);
  
  for (const player of players) {
    if (normalizeName(player.fullName) === normalizedSearch) {
      return player;
    }
  }
  
  for (const player of players) {
    const normalizedFull = normalizeName(player.fullName);
    if (normalizedFull.includes(normalizedSearch) || normalizedSearch.includes(normalizedFull)) {
      return player;
    }
  }
  
  return players[0];
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function getPlayerStats(playerId: number, season: number): Promise<PlayerStats | null> {
  try {
    const hittingUrl = `${MLB_API_BASE}/people/${playerId}/stats?stats=season&season=${season}&group=hitting`;
    const pitchingUrl = `${MLB_API_BASE}/people/${playerId}/stats?stats=season&season=${season}&group=pitching`;
    
    const playerUrl = `${MLB_API_BASE}/people/${playerId}`;
    const playerResponse = await fetch(playerUrl);
    let playerInfo: MLBPlayer | null = null;
    
    if (playerResponse.ok) {
      const playerData = await playerResponse.json();
      playerInfo = playerData.people?.[0] || null;
    }
    
    const [hittingResponse, pitchingResponse] = await Promise.all([
      fetch(hittingUrl),
      fetch(pitchingUrl),
    ]);
    
    let hittingStats: MLBHittingStats | null = null;
    let pitchingStats: MLBPitchingStats | null = null;
    
    if (hittingResponse.ok) {
      const hittingData: MLBStatsResponse = await hittingResponse.json();
      hittingStats = hittingData.stats?.[0]?.splits?.[0]?.stat as MLBHittingStats || null;
    }
    
    if (pitchingResponse.ok) {
      const pitchingData: MLBStatsResponse = await pitchingResponse.json();
      pitchingStats = pitchingData.stats?.[0]?.splits?.[0]?.stat as MLBPitchingStats || null;
    }
    
    const isPitcher = playerInfo?.primaryPosition?.type === "Pitcher" || 
                      (pitchingStats && parseFloat(pitchingStats.inningsPitched || "0") > 0 && 
                       (!hittingStats || (hittingStats.plateAppearances || 0) < 50));
    
    if (isPitcher && pitchingStats) {
      return {
        mlbId: playerId,
        name: playerInfo?.fullName || "",
        team: playerInfo?.currentTeam?.name,
        position: playerInfo?.primaryPosition?.abbreviation,
        playerType: "pitcher",
        ip: parseFloat(pitchingStats.inningsPitched || "0"),
        wins: pitchingStats.wins,
        losses: pitchingStats.losses,
        era: parseFloat(pitchingStats.era || "0"),
        whip: parseFloat(pitchingStats.whip || "0"),
        strikeouts: pitchingStats.strikeOuts,
      };
    } else if (hittingStats) {
      return {
        mlbId: playerId,
        name: playerInfo?.fullName || "",
        team: playerInfo?.currentTeam?.name,
        position: playerInfo?.primaryPosition?.abbreviation,
        playerType: "hitter",
        pa: hittingStats.plateAppearances,
        hr: hittingStats.homeRuns,
        rbi: hittingStats.rbi,
        runs: hittingStats.runs,
        sb: hittingStats.stolenBases,
        avg: parseFloat(hittingStats.avg || "0"),
        ops: parseFloat(hittingStats.ops || "0"),
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching stats for player ${playerId}:`, error);
    return null;
  }
}

export async function syncPlayerStatsFromMLB(
  playerNames: string[],
  season: number
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  
  const BATCH_SIZE = 5;
  const DELAY_MS = 100;
  
  for (let i = 0; i < playerNames.length; i += BATCH_SIZE) {
    const batch = playerNames.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.all(
      batch.map(async (name): Promise<SyncResult> => {
        const player = await searchPlayerByName(name);
        
        if (!player) {
          return {
            playerName: name,
            found: false,
            reason: "Player not found in MLB database",
          };
        }
        
        const stats = await getPlayerStats(player.id, season);
        
        if (!stats) {
          return {
            playerName: name,
            found: false,
            mlbName: player.fullName,
            reason: `No ${season} stats found for ${player.fullName}`,
          };
        }
        
        return {
          playerName: name,
          found: true,
          mlbName: player.fullName,
          stats,
        };
      })
    );
    
    results.push(...batchResults);
    
    if (i + BATCH_SIZE < playerNames.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  return results;
}

export async function testMLBConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${MLB_API_BASE}/teams?sportId=1`);
    return response.ok;
  } catch {
    return false;
  }
}

// ---- Affiliated Players Sync (Stats-based: players who appeared in games) ----

interface MLBTeamInfo {
  id: number;
  name: string;
  abbreviation: string;
  parentOrgId?: number;
  parentOrgName?: string;
  sport?: { id: number; name: string };
}

interface StatsSplit {
  player: {
    id: number;
    fullName: string;
    fullFMLName?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    birthDate?: string;
    currentAge?: number;
    active?: boolean;
    primaryPosition?: {
      code: string;
      name: string;
      type: string;
      abbreviation: string;
    };
    batSide?: { code: string };
    pitchHand?: { code: string };
  };
  team: {
    id: number;
    name: string;
  };
  sport: {
    id: number;
    abbreviation: string;
  };
  position: {
    code: string;
    name: string;
    type: string;
    abbreviation: string;
  };
  stat?: {
    inningsPitched?: string;
    gamesPlayed?: number | string;
    gamesStarted?: number | string;
    plateAppearances?: number | string;
    atBats?: number | string;
    hits?: number | string;
    doubles?: number | string;
    triples?: number | string;
    homeRuns?: number | string;
    baseOnBalls?: number | string;
    hitByPitch?: number | string;
    sacFlies?: number | string;
    strikeOuts?: number | string;
    earnedRuns?: number | string;
  };
}

const SPORT_LEVELS: Record<number, string> = {
  1: "MLB",
  11: "AAA",
  12: "AA",
  13: "High-A",
  14: "Single-A",
  16: "Rookie",
};

export interface AffiliatedPlayerRecord {
  mlbId: number;
  fullName: string;
  fullFmlName: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  primaryPosition: string | null;
  positionName: string | null;
  positionType: string | null;
  batSide: string | null;
  throwHand: string | null;
  currentTeamId: number | null;
  currentTeamName: string | null;
  parentOrgId: number | null;
  parentOrgName: string | null;
  sportId: number;
  sportLevel: string;
  birthDate: string | null;
  age: number | null;
  isActive: boolean;
  hadHittingStats: boolean;
  hadPitchingStats: boolean;
  hittingAtBats: number;
  hittingWalks: number;
  hittingSingles: number;
  hittingDoubles: number;
  hittingTriples: number;
  hittingHomeRuns: number;
  hittingAvg: number | null;
  hittingObp: number | null;
  hittingSlg: number | null;
  hittingOps: number | null;
  pitchingGames: number;
  pitchingGamesStarted: number;
  pitchingStrikeouts: number;
  pitchingWalks: number;
  pitchingHits: number;
  pitchingHomeRuns: number;
  pitchingEra: number | null;
  pitchingInningsPitched: number;
  hittingGamesStarted: number;
  hittingPlateAppearances: number;
  isTwoWayQualified: boolean;
  statsSeason: number;
  season: number;
}

export interface SyncProgress {
  level: string;
  playerCount: number;
}

async function fetchTeamsLookup(sportIds: number[], season: number): Promise<Map<number, MLBTeamInfo>> {
  const url = `${MLB_API_BASE}/teams?sportIds=${sportIds.join(",")}&season=${season}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch teams: ${response.status}`);
  }
  const data = await response.json();
  const teamMap = new Map<number, MLBTeamInfo>();
  for (const team of (data.teams || [])) {
    teamMap.set(team.id, {
      id: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
      parentOrgId: team.parentOrgId,
      parentOrgName: team.parentOrgName,
      sport: team.sport,
    });
  }
  return teamMap;
}

async function fetchStatsForLevel(
  sportId: number,
  group: "hitting" | "pitching",
  season: number,
): Promise<{ splits: StatsSplit[]; totalSplits: number; pages: number }> {
  const PAGE_LIMIT = 1000;
  let offset = 0;
  let totalSplits = 0;
  let pages = 0;
  const allSplits: StatsSplit[] = [];

  while (true) {
    const url = `${MLB_API_BASE}/stats?stats=season&group=${group}&season=${season}&playerPool=ALL&sportIds=${sportId}&limit=${PAGE_LIMIT}&offset=${offset}&hydrate=person`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${group} stats for sportId ${sportId}: ${response.status}`);
    }
    const data = await response.json();
    const statsBlock = data?.stats?.[0] || {};
    const splits = Array.isArray(statsBlock?.splits) ? (statsBlock.splits as StatsSplit[]) : [];
    const reportedTotal = Number(statsBlock?.totalSplits);
    if (Number.isInteger(reportedTotal) && reportedTotal > 0) {
      totalSplits = reportedTotal;
    }

    allSplits.push(...splits);
    pages += 1;

    if (splits.length < PAGE_LIMIT) {
      break;
    }
    offset += PAGE_LIMIT;
    if (totalSplits > 0 && offset >= totalSplits) {
      break;
    }
  }

  if (totalSplits === 0) {
    totalSplits = allSplits.length;
  }
  return { splits: allSplits, totalSplits, pages };
}

interface TeamRosterEntry {
  person?: {
    id: number;
    fullName?: string;
    fullFMLName?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    birthDate?: string;
    currentAge?: number;
    active?: boolean;
    batSide?: { code?: string };
    pitchHand?: { code?: string };
    primaryPosition?: {
      code?: string;
      name?: string;
      type?: string;
      abbreviation?: string;
    };
  };
  position?: {
    code?: string;
    name?: string;
    type?: string;
    abbreviation?: string;
  };
}

function parseInningsPitched(ip: string | undefined): number {
  if (!ip) return 0;
  const [wholePart, fractionalPart] = ip.split(".");
  const whole = Number.parseInt(wholePart || "0", 10);
  if (!Number.isFinite(whole)) return 0;
  if (!fractionalPart) return whole;
  if (fractionalPart === "1") return whole + (1 / 3);
  if (fractionalPart === "2") return whole + (2 / 3);
  const fractional = Number.parseFloat(`0.${fractionalPart}`);
  return whole + (Number.isFinite(fractional) ? fractional : 0);
}

function parseNumericStat(value: number | string | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function composeFullFmlName(fullName: string | null | undefined, firstName: string | null | undefined, middleName: string | null | undefined, lastName: string | null | undefined): string | null {
  const joined = [firstName, middleName, lastName]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  if (joined) return joined;
  const fallback = String(fullName || "").trim();
  return fallback || null;
}

function qualifiesTwoWay(pitchingInningsPitched: number, hittingPlateAppearances: number): boolean {
  return pitchingInningsPitched >= 20 && hittingPlateAppearances >= 100;
}

function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

async function fetchTeamRoster(teamId: number, season: number): Promise<TeamRosterEntry[]> {
  const date = `${season}-09-30`;
  const urls = [
    `${MLB_API_BASE}/teams/${teamId}/roster?rosterType=fullSeason&date=${date}&hydrate=person`,
    `${MLB_API_BASE}/teams/${teamId}/roster?rosterType=active&date=${date}&hydrate=person`,
  ];

  for (const url of urls) {
    const response = await fetch(url);
    if (!response.ok) continue;
    const data = await response.json();
    const roster = Array.isArray(data?.roster) ? (data.roster as TeamRosterEntry[]) : [];
    if (roster.length > 0) return roster;
  }

  return [];
}

export async function fetchAllAffiliatedPlayers(
  season: number,
  onProgress?: (progress: SyncProgress) => void
): Promise<AffiliatedPlayerRecord[]> {
  const sportIds = [16, 14, 13, 12, 11, 1];

  const teamMap = await fetchTeamsLookup(sportIds, season);

  const dslTeamIds = new Set<number>();
  for (const [, team] of teamMap) {
    if (team.name.toUpperCase().includes("DSL") || team.abbreviation?.toUpperCase().includes("DSL")) {
      dslTeamIds.add(team.id);
    }
  }
  console.log(`[MLB Sync] Found ${dslTeamIds.size} DSL teams to exclude`);

  const playerMap = new Map<number, AffiliatedPlayerRecord>();

  // 1) Primary source: season stats — determines who played and at what level.
  //    Stats for completed seasons are final and deterministic.
  for (const sportId of sportIds) {
    const levelName = SPORT_LEVELS[sportId] || `Sport${sportId}`;
    const [hittingResult, pitchingResult] = await Promise.all([
      fetchStatsForLevel(sportId, "hitting", season),
      fetchStatsForLevel(sportId, "pitching", season),
    ]);
    const hittingSplits = hittingResult.splits;
    const pitchingSplits = pitchingResult.splits;
    console.log(
      `[MLB Sync] ${levelName} stats pages: hitting=${hittingResult.pages} (${hittingSplits.length}/${hittingResult.totalSplits}), pitching=${pitchingResult.pages} (${pitchingSplits.length}/${pitchingResult.totalSplits})`,
    );
    const hitterIds = new Set(hittingSplits.map((s) => s.player.id));
    const pitcherIds = new Set(pitchingSplits.map((s) => s.player.id));
    const hittingGamesStartedByPlayer = new Map<number, number>();
    const hittingPlateAppearancesByPlayer = new Map<number, number>();
    const hittingAtBatsByPlayer = new Map<number, number>();
    const hittingHitsByPlayer = new Map<number, number>();
    const hittingDoublesByPlayer = new Map<number, number>();
    const hittingTriplesByPlayer = new Map<number, number>();
    const hittingHomeRunsByPlayer = new Map<number, number>();
    const hittingWalksByPlayer = new Map<number, number>();
    const hittingHbpByPlayer = new Map<number, number>();
    const hittingSacFliesByPlayer = new Map<number, number>();
    for (const split of hittingSplits) {
      const gsRaw = split.stat?.gamesStarted;
      const gs = parseNumericStat(gsRaw);
      const pa = parseNumericStat(split.stat?.plateAppearances);
      const ab = parseNumericStat(split.stat?.atBats);
      const hits = parseNumericStat(split.stat?.hits);
      const doubles = parseNumericStat(split.stat?.doubles);
      const triples = parseNumericStat(split.stat?.triples);
      const homeRuns = parseNumericStat(split.stat?.homeRuns);
      const walks = parseNumericStat(split.stat?.baseOnBalls);
      const hbp = parseNumericStat(split.stat?.hitByPitch);
      const sacFlies = parseNumericStat(split.stat?.sacFlies);
      if (Number.isFinite(pa) && pa > 0) {
        hittingPlateAppearancesByPlayer.set(
          split.player.id,
          (hittingPlateAppearancesByPlayer.get(split.player.id) || 0) + pa,
        );
      }
      if (ab > 0) hittingAtBatsByPlayer.set(split.player.id, (hittingAtBatsByPlayer.get(split.player.id) || 0) + ab);
      if (hits > 0) hittingHitsByPlayer.set(split.player.id, (hittingHitsByPlayer.get(split.player.id) || 0) + hits);
      if (doubles > 0) hittingDoublesByPlayer.set(split.player.id, (hittingDoublesByPlayer.get(split.player.id) || 0) + doubles);
      if (triples > 0) hittingTriplesByPlayer.set(split.player.id, (hittingTriplesByPlayer.get(split.player.id) || 0) + triples);
      if (homeRuns > 0) hittingHomeRunsByPlayer.set(split.player.id, (hittingHomeRunsByPlayer.get(split.player.id) || 0) + homeRuns);
      if (walks > 0) hittingWalksByPlayer.set(split.player.id, (hittingWalksByPlayer.get(split.player.id) || 0) + walks);
      if (hbp > 0) hittingHbpByPlayer.set(split.player.id, (hittingHbpByPlayer.get(split.player.id) || 0) + hbp);
      if (sacFlies > 0) hittingSacFliesByPlayer.set(split.player.id, (hittingSacFliesByPlayer.get(split.player.id) || 0) + sacFlies);
      if (!Number.isFinite(gs) || gs <= 0) continue;
      hittingGamesStartedByPlayer.set(
        split.player.id,
        (hittingGamesStartedByPlayer.get(split.player.id) || 0) + gs,
      );
    }
    const pitchingInningsByPlayer = new Map<number, number>();
    const pitchingGamesByPlayer = new Map<number, number>();
    const pitchingGamesStartedByPlayer = new Map<number, number>();
    const pitchingStrikeoutsByPlayer = new Map<number, number>();
    const pitchingWalksByPlayer = new Map<number, number>();
    const pitchingHitsByPlayer = new Map<number, number>();
    const pitchingHomeRunsByPlayer = new Map<number, number>();
    const pitchingEarnedRunsByPlayer = new Map<number, number>();
    for (const split of pitchingSplits) {
      const ip = parseInningsPitched(split.stat?.inningsPitched);
      const g = parseNumericStat(split.stat?.gamesPlayed);
      const gs = parseNumericStat(split.stat?.gamesStarted);
      const so = parseNumericStat(split.stat?.strikeOuts);
      const bb = parseNumericStat(split.stat?.baseOnBalls);
      const hits = parseNumericStat(split.stat?.hits);
      const hr = parseNumericStat(split.stat?.homeRuns);
      const er = parseNumericStat(split.stat?.earnedRuns);
      if (ip <= 0) continue;
      pitchingInningsByPlayer.set(
        split.player.id,
        (pitchingInningsByPlayer.get(split.player.id) || 0) + ip,
      );
      if (g > 0) pitchingGamesByPlayer.set(split.player.id, (pitchingGamesByPlayer.get(split.player.id) || 0) + g);
      if (gs > 0) pitchingGamesStartedByPlayer.set(split.player.id, (pitchingGamesStartedByPlayer.get(split.player.id) || 0) + gs);
      if (so > 0) pitchingStrikeoutsByPlayer.set(split.player.id, (pitchingStrikeoutsByPlayer.get(split.player.id) || 0) + so);
      if (bb > 0) pitchingWalksByPlayer.set(split.player.id, (pitchingWalksByPlayer.get(split.player.id) || 0) + bb);
      if (hits > 0) pitchingHitsByPlayer.set(split.player.id, (pitchingHitsByPlayer.get(split.player.id) || 0) + hits);
      if (hr > 0) pitchingHomeRunsByPlayer.set(split.player.id, (pitchingHomeRunsByPlayer.get(split.player.id) || 0) + hr);
      if (er > 0) pitchingEarnedRunsByPlayer.set(split.player.id, (pitchingEarnedRunsByPlayer.get(split.player.id) || 0) + er);
    }
    const allSplits = [...hittingSplits, ...pitchingSplits];
    const seen = new Set<number>();
    let levelCount = 0;

    for (const split of allSplits) {
      const playerId = split.player.id;
      if (seen.has(playerId)) continue;
      seen.add(playerId);
      if (sportId === 16 && split.team?.id && dslTeamIds.has(split.team.id)) continue;

      const isHitter = hitterIds.has(playerId);
      const isPitcher = pitcherIds.has(playerId);
      const playerPitchingInnings = pitchingInningsByPlayer.get(playerId) || 0;
      const playerHittingGamesStarted = hittingGamesStartedByPlayer.get(playerId) || 0;
      const playerHittingPlateAppearances = hittingPlateAppearancesByPlayer.get(playerId) || 0;
      const playerHittingAtBats = hittingAtBatsByPlayer.get(playerId) || 0;
      const playerHittingHits = hittingHitsByPlayer.get(playerId) || 0;
      const playerHittingDoubles = hittingDoublesByPlayer.get(playerId) || 0;
      const playerHittingTriples = hittingTriplesByPlayer.get(playerId) || 0;
      const playerHittingHomeRuns = hittingHomeRunsByPlayer.get(playerId) || 0;
      const playerHittingWalks = hittingWalksByPlayer.get(playerId) || 0;
      const playerHittingHbp = hittingHbpByPlayer.get(playerId) || 0;
      const playerHittingSacFlies = hittingSacFliesByPlayer.get(playerId) || 0;
      const playerPitchingGames = pitchingGamesByPlayer.get(playerId) || 0;
      const playerPitchingGamesStarted = pitchingGamesStartedByPlayer.get(playerId) || 0;
      const playerPitchingStrikeouts = pitchingStrikeoutsByPlayer.get(playerId) || 0;
      const playerPitchingWalks = pitchingWalksByPlayer.get(playerId) || 0;
      const playerPitchingHits = pitchingHitsByPlayer.get(playerId) || 0;
      const playerPitchingHomeRuns = pitchingHomeRunsByPlayer.get(playerId) || 0;
      const playerPitchingEarnedRuns = pitchingEarnedRunsByPlayer.get(playerId) || 0;
      const playerHittingSingles = Math.max(0, playerHittingHits - playerHittingDoubles - playerHittingTriples - playerHittingHomeRuns);
      const hittingAvg = safeDivide(playerHittingHits, playerHittingAtBats);
      const hittingObp = safeDivide(playerHittingHits + playerHittingWalks + playerHittingHbp, playerHittingAtBats + playerHittingWalks + playerHittingHbp + playerHittingSacFlies);
      const totalBases = playerHittingSingles + (2 * playerHittingDoubles) + (3 * playerHittingTriples) + (4 * playerHittingHomeRuns);
      const hittingSlg = safeDivide(totalBases, playerHittingAtBats);
      const hittingOps = hittingObp != null && hittingSlg != null ? hittingObp + hittingSlg : null;
      const pitchingEra = playerPitchingInnings > 0 ? (playerPitchingEarnedRuns * 9) / playerPitchingInnings : null;
      const teamInfo = split.team?.id ? teamMap.get(split.team.id) : undefined;
      const existing = playerMap.get(playerId);
      if (existing) {
        const existingPriority = sportIds.indexOf(existing.sportId);
        const incomingPriority = sportIds.indexOf(sportId);
        if (incomingPriority < existingPriority) {
          continue;
        }
        if (incomingPriority > existingPriority) {
          existing.sportId = sportId;
          existing.sportLevel = levelName;
          existing.currentTeamId = split.team?.id || null;
          existing.currentTeamName = teamInfo?.name || split.team?.name || null;
          existing.parentOrgId = teamInfo?.parentOrgId || teamInfo?.id || null;
          existing.parentOrgName = teamInfo?.parentOrgName || teamInfo?.name || null;
          existing.hadHittingStats = false;
          existing.hadPitchingStats = false;
          existing.hittingAtBats = 0;
          existing.hittingWalks = 0;
          existing.hittingSingles = 0;
          existing.hittingDoubles = 0;
          existing.hittingTriples = 0;
          existing.hittingHomeRuns = 0;
          existing.hittingAvg = null;
          existing.hittingObp = null;
          existing.hittingSlg = null;
          existing.hittingOps = null;
          existing.pitchingGames = 0;
          existing.pitchingGamesStarted = 0;
          existing.pitchingStrikeouts = 0;
          existing.pitchingWalks = 0;
          existing.pitchingHits = 0;
          existing.pitchingHomeRuns = 0;
          existing.pitchingEra = null;
          existing.pitchingInningsPitched = 0;
          existing.hittingGamesStarted = 0;
          existing.hittingPlateAppearances = 0;
          existing.isTwoWayQualified = false;
        }

        const prevPitchingInnings = existing.pitchingInningsPitched || 0;
        const prevPitchingEra = existing.pitchingEra;
        const prevPitchingEarnedRuns =
          prevPitchingEra != null && prevPitchingInnings > 0
            ? (prevPitchingEra * prevPitchingInnings) / 9
            : 0;

        existing.hadHittingStats = existing.hadHittingStats || (isHitter && (existing.hittingPlateAppearances || 0) + playerHittingPlateAppearances > 0);
        existing.hadPitchingStats = existing.hadPitchingStats || (isPitcher && existing.pitchingInningsPitched + playerPitchingInnings > 0);
        existing.statsSeason = season;
        existing.pitchingInningsPitched = prevPitchingInnings + playerPitchingInnings;
        existing.hittingGamesStarted = (existing.hittingGamesStarted || 0) + playerHittingGamesStarted;
        existing.hittingPlateAppearances = (existing.hittingPlateAppearances || 0) + playerHittingPlateAppearances;
        existing.hittingAtBats = (existing.hittingAtBats || 0) + playerHittingAtBats;
        existing.hittingWalks = (existing.hittingWalks || 0) + playerHittingWalks;
        existing.hittingDoubles = (existing.hittingDoubles || 0) + playerHittingDoubles;
        existing.hittingTriples = (existing.hittingTriples || 0) + playerHittingTriples;
        existing.hittingHomeRuns = (existing.hittingHomeRuns || 0) + playerHittingHomeRuns;
        existing.hittingSingles = Math.max(0, (existing.hittingSingles || 0) + playerHittingSingles);
        existing.pitchingGames = (existing.pitchingGames || 0) + playerPitchingGames;
        existing.pitchingGamesStarted = (existing.pitchingGamesStarted || 0) + playerPitchingGamesStarted;
        existing.pitchingStrikeouts = (existing.pitchingStrikeouts || 0) + playerPitchingStrikeouts;
        existing.pitchingWalks = (existing.pitchingWalks || 0) + playerPitchingWalks;
        existing.pitchingHits = (existing.pitchingHits || 0) + playerPitchingHits;
        existing.pitchingHomeRuns = (existing.pitchingHomeRuns || 0) + playerPitchingHomeRuns;
        const existingHits = (existing.hittingSingles || 0) + (existing.hittingDoubles || 0) + (existing.hittingTriples || 0) + (existing.hittingHomeRuns || 0);
        const recalcAvg = safeDivide(existingHits, existing.hittingAtBats || 0);
        const existingTotalBases = (existing.hittingSingles || 0) + (2 * (existing.hittingDoubles || 0)) + (3 * (existing.hittingTriples || 0)) + (4 * (existing.hittingHomeRuns || 0));
        const recalcSlg = safeDivide(existingTotalBases, existing.hittingAtBats || 0);
        const recalcObp = safeDivide(existingHits + (existing.hittingWalks || 0), (existing.hittingAtBats || 0) + (existing.hittingWalks || 0));
        existing.hittingAvg = recalcAvg;
        existing.hittingObp = recalcObp;
        existing.hittingSlg = recalcSlg;
        existing.hittingOps = recalcObp != null && recalcSlg != null ? recalcObp + recalcSlg : null;
        existing.pitchingEra = existing.pitchingInningsPitched > 0
          ? (((prevPitchingEarnedRuns + playerPitchingEarnedRuns) * 9) / existing.pitchingInningsPitched)
          : null;
        existing.isTwoWayQualified = qualifiesTwoWay(existing.pitchingInningsPitched, existing.hittingPlateAppearances);
        continue;
      }

      playerMap.set(playerId, {
        mlbId: playerId,
        fullName: split.player.fullName,
        fullFmlName: split.player.fullFMLName || composeFullFmlName(split.player.fullName, split.player.firstName || null, split.player.middleName || null, split.player.lastName || null),
        firstName: split.player.firstName || null,
        middleName: split.player.middleName || null,
        lastName: split.player.lastName || null,
        primaryPosition: split.player.primaryPosition?.abbreviation || split.position?.abbreviation || null,
        positionName: split.player.primaryPosition?.name || split.position?.name || null,
        positionType: split.player.primaryPosition?.type || split.position?.type || null,
        batSide: split.player.batSide?.code || null,
        throwHand: split.player.pitchHand?.code || null,
        currentTeamId: split.team?.id || null,
        currentTeamName: teamInfo?.name || split.team?.name || null,
        parentOrgId: teamInfo?.parentOrgId || teamInfo?.id || null,
        parentOrgName: teamInfo?.parentOrgName || teamInfo?.name || null,
        sportId,
        sportLevel: levelName,
        birthDate: split.player.birthDate || null,
        age: split.player.currentAge || null,
        isActive: split.player.active !== false,
        hadHittingStats: isHitter && playerHittingPlateAppearances > 0,
        hadPitchingStats: isPitcher && playerPitchingInnings > 0,
        hittingAtBats: playerHittingAtBats,
        hittingWalks: playerHittingWalks,
        hittingSingles: playerHittingSingles,
        hittingDoubles: playerHittingDoubles,
        hittingTriples: playerHittingTriples,
        hittingHomeRuns: playerHittingHomeRuns,
        hittingAvg,
        hittingObp,
        hittingSlg,
        hittingOps,
        pitchingGames: playerPitchingGames,
        pitchingGamesStarted: playerPitchingGamesStarted,
        pitchingStrikeouts: playerPitchingStrikeouts,
        pitchingWalks: playerPitchingWalks,
        pitchingHits: playerPitchingHits,
        pitchingHomeRuns: playerPitchingHomeRuns,
        pitchingEra,
        pitchingInningsPitched: playerPitchingInnings,
        hittingGamesStarted: playerHittingGamesStarted,
        hittingPlateAppearances: playerHittingPlateAppearances,
        isTwoWayQualified: qualifiesTwoWay(playerPitchingInnings, playerHittingPlateAppearances),
        statsSeason: season,
        season,
      });
      levelCount++;
    }

    console.log(`[MLB Sync] ${levelName}: ${levelCount} new players from stats`);
    onProgress?.({ level: levelName, playerCount: playerMap.size });
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  const statsPlayerCount = playerMap.size;
  console.log(`[MLB Sync] Total players from stats: ${statsPlayerCount}`);

  // 2) Supplemental source: team rosters — updates team affiliation info for players
  //    already found via stats. Does NOT add new players (only stats determine inclusion).
  let rosterUpdated = 0;
  for (const sportId of sportIds) {
    const levelName = SPORT_LEVELS[sportId] || `Sport${sportId}`;
    const levelTeams = Array.from(teamMap.values()).filter(
      (team) => team.sport?.id === sportId && !dslTeamIds.has(team.id),
    );

    for (const team of levelTeams) {
      const roster = await fetchTeamRoster(team.id, season);
      for (const entry of roster) {
        const person = entry.person;
        const playerId = person?.id;
        if (!playerId) continue;

        const existing = playerMap.get(playerId);
        if (!existing) continue;

        existing.currentTeamId = team.id;
        existing.currentTeamName = team.name;
        existing.parentOrgId = team.parentOrgId || team.id || null;
        existing.parentOrgName = team.parentOrgName || team.name || null;

        if (person.primaryPosition?.abbreviation) {
          existing.primaryPosition = person.primaryPosition.abbreviation;
        }
        if (person.primaryPosition?.name) {
          existing.positionName = person.primaryPosition.name;
        }
        if (person.primaryPosition?.type) {
          existing.positionType = person.primaryPosition.type;
        }
        if (person.batSide?.code) {
          existing.batSide = person.batSide.code;
        }
        if (person.pitchHand?.code) {
          existing.throwHand = person.pitchHand.code;
        }
        if (person.birthDate) {
          existing.birthDate = person.birthDate;
        }
        if (person.currentAge != null) {
          existing.age = person.currentAge;
        }
        if (person.fullName) {
          existing.fullName = person.fullName;
        }
        if (person.firstName) {
          existing.firstName = person.firstName;
        }
        if (person.middleName) {
          existing.middleName = person.middleName;
        }
        if (person.lastName) {
          existing.lastName = person.lastName;
        }
        const fullFml = (person as any).fullFMLName || composeFullFmlName(person.fullName || null, person.firstName || null, person.middleName || null, person.lastName || null);
        if (fullFml) {
          existing.fullFmlName = fullFml;
        }
        rosterUpdated++;
      }
    }

    console.log(`[MLB Sync] ${levelName}: roster enrichment pass complete`);
  }

  console.log(`[MLB Sync] Roster enrichment updated ${rosterUpdated} player records`);

  return Array.from(playerMap.values());
}
