import type { MlbPlayer, MlbPlayerStat } from "@shared/schema";

export function isUncardedOnMlbRoster(player: MlbPlayer, rosterType: string, stats?: MlbPlayerStat | null): boolean {
  if (rosterType !== "mlb") return false;
  const isMlbLevel = (player.sportLevel || "").toUpperCase() === "MLB";
  const hasAnyStats = stats
    ? !!(stats.hadHittingStats || stats.hadPitchingStats)
    : !!(player.hadHittingStats || player.hadPitchingStats);
  return !isMlbLevel || !hasAnyStats;
}
