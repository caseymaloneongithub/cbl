import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Users } from "lucide-react";
import type { User, LeagueMember } from "@shared/schema";
import RosterManagement from "@/components/RosterManagement";

export default function CommissionerRosters({ level }: { level: "mlb" | "milb" }) {
  const { user } = useAuth();
  const { selectedLeagueId, currentLeague, isLeagueCommissioner } = useLeague();

  const { data: leagueMembers, isLoading } = useQuery<(LeagueMember & { user: User })[]>({
    queryKey: ["/api/leagues", selectedLeagueId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${selectedLeagueId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch league members");
      return res.json();
    },
    enabled: !!selectedLeagueId,
  });

  const title = level === "mlb" ? "Major League Rosters" : "Minor League Rosters";
  const description = level === "mlb"
    ? `Assign MLB players to team ${currentLeague?.mlRosterLimit || 40}-man ML rosters`
    : `Assign minor league players to team ${currentLeague?.milbRosterLimit || 125}-man MiLB systems`;

  if (!selectedLeagueId || !currentLeague) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <p className="text-muted-foreground">No league selected</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-rosters-title">
          <Users className="h-6 w-6" />
          {title}
        </h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : leagueMembers ? (
        <Card>
          <CardContent className="pt-6">
            <RosterManagement
              leagueId={selectedLeagueId}
              league={currentLeague}
              members={leagueMembers}
              isCommissioner={isLeagueCommissioner || user?.isSuperAdmin || false}
              rosterLevel={level}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
