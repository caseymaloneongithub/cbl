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
