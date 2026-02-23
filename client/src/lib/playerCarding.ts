import type { MlbPlayer } from "@shared/schema";

export function isUncardedOnMlbRoster(player: MlbPlayer, rosterType: string): boolean {
  if (rosterType !== "mlb") return false;
  const isMlbLevel = (player.sportLevel || "").toUpperCase() === "MLB";
  const hasAnyStats = !!player.hadHittingStats || !!player.hadPitchingStats;
  return !isMlbLevel || !hasAnyStats;
}

