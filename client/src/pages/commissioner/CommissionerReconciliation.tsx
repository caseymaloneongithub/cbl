import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Users } from "lucide-react";

export default function CommissionerReconciliation() {
  const { user } = useAuth();
  const { selectedLeagueId, isLeagueCommissioner } = useLeague();
  const hasRosterAdminAccess = Boolean(
    isLeagueCommissioner ||
    user?.isSuperAdmin ||
    user?.originalUser?.isSuperAdmin,
  );

  if (!selectedLeagueId) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <p className="text-muted-foreground">No league selected</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-reconciliation-title">
          <ClipboardCheck className="h-6 w-6" />
          Reconciliation
        </h1>
        <p className="text-muted-foreground">
          One-time onboarding to resolve all roster rows to MLB API IDs. Choose a dedicated scope below.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Choose Reconciliation Scope</CardTitle>
          <CardDescription>
            MLB and MiLB reconciliation are isolated on separate pages to avoid cross-scope confusion.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 flex-wrap">
          <Link href="/commissioner/reconciliation/mlb">
            <Button data-testid="button-open-mlb-reconciliation">Open MLB Reconciliation</Button>
          </Link>
          <Link href="/commissioner/reconciliation/milb">
            <Button variant="outline" data-testid="button-open-milb-reconciliation">Open MiLB Reconciliation</Button>
          </Link>
          <Link href="/commissioner/teams">
            <Button variant="outline" data-testid="button-open-team-management">
              <Users className="mr-2 h-4 w-4" />
              Open Team Management
            </Button>
          </Link>
          <Link href="/commissioner/rosters/mlb">
            <Button variant="outline" data-testid="button-open-mlb-rosters">
              Open MLB Rosters
            </Button>
          </Link>
          <Link href="/commissioner/rosters/milb">
            <Button variant="outline" data-testid="button-open-milb-rosters">
              Open MiLB Rosters
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow</CardTitle>
          <CardDescription>
            1) Open MLB reconciliation and complete MLB rows. 2) Open MiLB reconciliation and complete MiLB rows. 3) Manage ongoing moves in MLB/MiLB Rosters pages.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
