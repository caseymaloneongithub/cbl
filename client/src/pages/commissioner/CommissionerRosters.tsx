import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Users } from "lucide-react";
import type { User, LeagueMember } from "@shared/schema";
import RosterManagement from "@/components/RosterManagement";

export default function CommissionerRosters({ level }: { level: "mlb" | "milb" }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { selectedLeagueId, currentLeague, isLeagueCommissioner } = useLeague();
  const hasRosterAdminAccess = Boolean(
    isLeagueCommissioner ||
    user?.isSuperAdmin ||
    user?.originalUser?.isSuperAdmin,
  );

  const { data: leagueMembers, isLoading } = useQuery<(LeagueMember & { user: User })[]>({
    queryKey: ["/api/leagues", selectedLeagueId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${selectedLeagueId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch league members");
      return res.json();
    },
    enabled: !!selectedLeagueId,
  });

  const title = level === "mlb" ? "MLB Rosters" : "MiLB Rosters";
  const description = level === "mlb"
    ? `Assign MLB players to team ${currentLeague?.mlRosterLimit || 40}-man MLB rosters`
    : `Assign MiLB players to team ${currentLeague?.milbRosterLimit || 150}-man MiLB systems`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#reconciliation") {
      navigate("/commissioner/reconciliation");
    }
  }, [navigate]);

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
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Commissioner Workflow</CardTitle>
          <CardDescription>
            Reconciliation now lives in the dedicated MLB/MiLB Reconciliation page. Use this page for ongoing
            roster management after onboarding is complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 flex-wrap">
          <Link href="/commissioner/reconciliation">
            <Button variant="outline" data-testid="button-open-reconciliation-page">
              Open MLB/MiLB Reconciliation
            </Button>
          </Link>
          <Link href="/commissioner/teams">
            <Button variant="outline" data-testid="button-open-commissioner-teams">
              Open Team Management
            </Button>
          </Link>
        </CardContent>
      </Card>

      {!hasRosterAdminAccess && (
        <Card className="mb-6 border-amber-400/60 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="text-base">Commissioner Access Needed</CardTitle>
            <CardDescription>
              Reconciliation tools are only available to commissioners for the currently selected league.
              Switch to a league where your role is commissioner, or stop impersonation if you started it.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : leagueMembers ? (
        <Card>
          <CardContent className="pt-6">
            <RosterManagement
              leagueId={selectedLeagueId}
              league={currentLeague}
              members={leagueMembers}
              isCommissioner={hasRosterAdminAccess}
              rosterLevel={level}
              showOnboardingTools={false}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
