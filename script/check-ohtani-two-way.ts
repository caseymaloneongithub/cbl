import { fetchAllAffiliatedPlayers } from "../server/mlb-api";

async function main() {
  const seasonArg = process.argv[2];
  const season = seasonArg ? Number.parseInt(seasonArg, 10) : 2025;
  if (!Number.isFinite(season)) {
    throw new Error("Season must be a number");
  }

  const players = await fetchAllAffiliatedPlayers(season);
  const match = players.find((p) => p.fullName.toLowerCase().includes("shohei ohtani"));
  if (!match) {
    console.log("Shohei Ohtani not found");
    return;
  }

  const hittingUrl = `https://statsapi.mlb.com/api/v1/people/${match.mlbId}/stats?stats=season&season=${season}&group=hitting`;
  const pitchingUrl = `https://statsapi.mlb.com/api/v1/people/${match.mlbId}/stats?stats=season&season=${season}&group=pitching`;
  const [hittingResp, pitchingResp] = await Promise.all([fetch(hittingUrl), fetch(pitchingUrl)]);
  const hittingJson = await hittingResp.json();
  const pitchingJson = await pitchingResp.json();
  const hittingStat = hittingJson?.stats?.[0]?.splits?.[0]?.stat || {};
  const pitchingStat = pitchingJson?.stats?.[0]?.splits?.[0]?.stat || {};

  console.log(
    JSON.stringify(
      {
        mlbId: match.mlbId,
        fullName: match.fullName,
        sportLevel: match.sportLevel,
        hadHittingStats: match.hadHittingStats,
        hadPitchingStats: match.hadPitchingStats,
        pitchingInningsPitched: match.pitchingInningsPitched,
        hittingGamesStarted: match.hittingGamesStarted,
        hittingPlateAppearances: match.hittingPlateAppearances,
        isTwoWayQualified: match.isTwoWayQualified,
        rawHittingStatKeys: Object.keys(hittingStat).sort(),
        rawPitchingStatKeys: Object.keys(pitchingStat).sort(),
        rawHittingStat: hittingStat,
        rawPitchingStat: pitchingStat,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
