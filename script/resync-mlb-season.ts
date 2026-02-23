import { fetchAllAffiliatedPlayers } from "../server/mlb-api";
import { storage } from "../server/storage";

async function main() {
  const seasonArg = process.argv[2];
  const season = seasonArg ? Number.parseInt(seasonArg, 10) : 2025;
  if (!Number.isFinite(season)) {
    throw new Error("Season must be a number");
  }

  console.log(`[MLB Resync] Starting season ${season}`);
  const players = await fetchAllAffiliatedPlayers(season, (p) => {
    console.log(`[MLB Resync] ${p.level}: ${p.playerCount}`);
  });

  const upserted = await storage.upsertMlbPlayers(
    players.map((p) => ({
      mlbId: p.mlbId,
      fullName: p.fullName,
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
      season: p.season,
    })),
  );

  const twoWayTotal = players.filter((p) => p.isTwoWayQualified).length;
  console.log(`[MLB Resync] Upserted ${upserted} players`);
  console.log(`[MLB Resync] Two-way qualified: ${twoWayTotal}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
