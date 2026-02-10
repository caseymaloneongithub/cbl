const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

interface MLBPlayer {
  id: number;
  fullName: string;
  firstName: string;
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
    firstName?: string;
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
  firstName: string | null;
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

async function fetchStatsForLevel(sportId: number, group: "hitting" | "pitching", season: number): Promise<StatsSplit[]> {
  const url = `${MLB_API_BASE}/stats?stats=season&group=${group}&season=${season}&playerPool=ALL&sportIds=${sportId}&limit=10000&hydrate=person`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${group} stats for sportId ${sportId}: ${response.status}`);
  }
  const data = await response.json();
  return data.stats?.[0]?.splits || [];
}

export async function fetchAllAffiliatedPlayers(
  season: number,
  onProgress?: (progress: SyncProgress) => void
): Promise<AffiliatedPlayerRecord[]> {
  const sportIds = [16, 14, 13, 12, 11, 1];
  
  const teamMap = await fetchTeamsLookup(sportIds, season);
  
  const dslTeamIds = new Set<number>();
  for (const [, team] of teamMap) {
    if (team.name.includes("DSL")) {
      dslTeamIds.add(team.id);
    }
  }
  console.log(`[MLB Sync] Found ${dslTeamIds.size} DSL teams to exclude`);
  
  const playerMap = new Map<number, AffiliatedPlayerRecord>();
  
  for (const sportId of sportIds) {
    const levelName = SPORT_LEVELS[sportId] || `Sport${sportId}`;
    console.log(`[MLB Sync] Fetching ${levelName} stats (hitting + pitching)...`);
    
    const [hittingSplits, pitchingSplits] = await Promise.all([
      fetchStatsForLevel(sportId, "hitting", season),
      fetchStatsForLevel(sportId, "pitching", season),
    ]);
    
    const hitterIds = new Set(hittingSplits.map(s => s.player.id));
    const pitcherIds = new Set(pitchingSplits.map(s => s.player.id));
    
    const allSplits = [...hittingSplits, ...pitchingSplits];
    const seen = new Set<number>();
    let levelCount = 0;
    
    for (const split of allSplits) {
      const playerId = split.player.id;
      if (seen.has(playerId)) continue;
      seen.add(playerId);
      
      const teamId = split.team?.id;
      
      if (sportId === 16 && teamId && dslTeamIds.has(teamId)) {
        continue;
      }
      
      const isHitter = hitterIds.has(playerId);
      const isPitcher = pitcherIds.has(playerId);
      
      if (playerMap.has(playerId)) {
        const existing = playerMap.get(playerId)!;
        existing.hadHittingStats = existing.hadHittingStats || isHitter;
        existing.hadPitchingStats = existing.hadPitchingStats || isPitcher;
        const existingSportPriority = sportIds.indexOf(existing.sportId);
        const newSportPriority = sportIds.indexOf(sportId);
        if (newSportPriority <= existingSportPriority) {
          continue;
        }
      }
      
      const teamInfo = teamId ? teamMap.get(teamId) : undefined;
      const player = split.player;
      
      playerMap.set(playerId, {
        mlbId: playerId,
        fullName: player.fullName,
        firstName: player.firstName || null,
        lastName: player.lastName || null,
        primaryPosition: player.primaryPosition?.abbreviation || split.position?.abbreviation || null,
        positionName: player.primaryPosition?.name || split.position?.name || null,
        positionType: player.primaryPosition?.type || split.position?.type || null,
        batSide: player.batSide?.code || null,
        throwHand: player.pitchHand?.code || null,
        currentTeamId: teamId || null,
        currentTeamName: teamInfo?.name || split.team?.name || null,
        parentOrgId: teamInfo?.parentOrgId || null,
        parentOrgName: teamInfo?.parentOrgName || null,
        sportId,
        sportLevel: levelName,
        birthDate: player.birthDate || null,
        age: player.currentAge || null,
        isActive: player.active !== false,
        hadHittingStats: isHitter,
        hadPitchingStats: isPitcher,
        season,
      });
      levelCount++;
    }
    
    console.log(`[MLB Sync] ${levelName}: ${hittingSplits.length} hitters + ${pitchingSplits.length} pitchers, ${levelCount} unique new players`);
    onProgress?.({ level: levelName, playerCount: levelCount });
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  return Array.from(playerMap.values());
}
