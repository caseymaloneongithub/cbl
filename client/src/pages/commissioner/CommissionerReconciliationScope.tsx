import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck } from "lucide-react";
import type { User, LeagueMember } from "@shared/schema";
import RosterManagement from "@/components/RosterManagement";

function CommissionerReconciliationScope({ scope }: { scope: "mlb" | "milb" }) {
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

  if (!selectedLeagueId || !currentLeague) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <p className="text-muted-foreground">No league selected</p>
      </div>
    );
  }

  const scopeLabel = scope.toUpperCase();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid={`text-reconciliation-title-${scope}`}>
          <ClipboardCheck className="h-6 w-6" />
          {scopeLabel} Reconciliation
        </h1>
        <p className="text-muted-foreground">
          This page is locked to {scopeLabel} onboarding scope.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Navigation</CardTitle>
          <CardDescription>
            Use separate pages for MLB and MiLB to avoid cross-scope reconciliation state.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 flex-wrap">
          <Link href="/commissioner/reconciliation">
            <Button variant="outline" data-testid={`button-back-reconciliation-home-${scope}`}>Back to Reconciliation Home</Button>
          </Link>
          <Link href={scope === "mlb" ? "/commissioner/reconciliation/milb" : "/commissioner/reconciliation/mlb"}>
            <Button variant="outline" data-testid={`button-switch-reconciliation-scope-${scope}`}>
              Open {scope === "mlb" ? "MiLB" : "MLB"} Reconciliation
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
              rosterLevel={scope}
              showOnboardingTools
              onboardingScope={scope}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function CommissionerMlbReconciliation() {
  return <CommissionerReconciliationScope scope="mlb" />;
}

export function CommissionerMilbReconciliation() {
  return <CommissionerReconciliationScope scope="milb" />;
}

