import { fetchAllAffiliatedPlayers } from "./mlb-api";
import { storage } from "./storage";

export function mapPlayerDataForSync(players: any[]) {
  return players.map((p) => ({
    mlbId: p.mlbId,
    fullName: p.fullName,
    fullFmlName: p.fullFmlName,
    firstName: p.firstName,
    middleName: p.middleName,
    lastName: p.lastName,
    primaryPosition: p.primaryPosition,
    positionName: p.positionName,
    positionType: p.positionType,
    batSide: p.batSide,
    throwHand: p.throwHand,
    currentTeamId: p.currentTeamId,
    currentTeamName: p.currentTeamName,
    parentOrgId: p.parentOrgId,
    parentOrgName: p.parentOrgName,
    sportId: p.sportId,
    sportLevel: p.sportLevel,
    birthDate: p.birthDate,
    age: p.age,
    isActive: p.isActive,
    hadHittingStats: p.hadHittingStats,
    hadPitchingStats: p.hadPitchingStats,
    hittingAtBats: p.hittingAtBats,
    hittingWalks: p.hittingWalks,
    hittingSingles: p.hittingSingles,
    hittingDoubles: p.hittingDoubles,
    hittingTriples: p.hittingTriples,
    hittingHomeRuns: p.hittingHomeRuns,
    hittingAvg: p.hittingAvg,
    hittingObp: p.hittingObp,
    hittingSlg: p.hittingSlg,
    hittingOps: p.hittingOps,
    hittingWrcPlus: p.hittingWrcPlus,
    pitchingGames: p.pitchingGames,
    pitchingGamesStarted: p.pitchingGamesStarted,
    pitchingStrikeouts: p.pitchingStrikeouts,
    pitchingWalks: p.pitchingWalks,
    pitchingHits: p.pitchingHits,
    pitchingHomeRuns: p.pitchingHomeRuns,
    pitchingEra: p.pitchingEra,
    pitchingInningsPitched: p.pitchingInningsPitched,
    hittingGamesStarted: p.hittingGamesStarted,
    hittingPlateAppearances: p.hittingPlateAppearances,
    isTwoWayQualified: p.isTwoWayQualified,
    positions: p.positions,
    season: p.season,
  }));
}

// Module-level lock shared by admin sync and nightly refresh.
// Prevents concurrent MLB API hammering and duplicate metadata churn.
let syncInFlight = false;
export function isMlbSyncInFlight(): boolean {
  return syncInFlight;
}

export async function syncMlbSeasonData(
  season: number,
  onProgress?: (phase: string) => void,
): Promise<{ playerCount: number; statRows: number }> {
  if (syncInFlight) {
    throw new Error("Another MLB sync is already in progress");
  }
  syncInFlight = true;
  try {
    onProgress?.("Fetching from MLB API...");
    const players = await fetchAllAffiliatedPlayers(season);
    const playerData = mapPlayerDataForSync(players);
    onProgress?.(`Upserting ${playerData.length.toLocaleString()} players...`);
    const playerCount = await storage.upsertMlbPlayers(playerData);
    onProgress?.("Writing stat rows...");
    const statRows = await storage.upsertMlbPlayerStatsFromSync(playerData);
    return { playerCount, statRows };
  } finally {
    syncInFlight = false;
  }
}
