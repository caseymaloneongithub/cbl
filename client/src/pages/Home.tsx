import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DualProgress } from "@/components/ui/dual-progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Users, Gavel, Trophy, Clock, DollarSign, AlertCircle, Globe, Mail } from "lucide-react";
import type { FreeAgentWithBids, UserWithStats, Auction } from "@shared/schema";
import { FreeAgentsTable } from "@/components/FreeAgentsTable";
import { formatCurrency } from "@/lib/utils";
import { REFRESH_INTERVAL, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { user } = useAuth();
  const { leagues, currentLeague, selectedLeagueId, isLoadingLeagues } = useLeague();

  // Fetch the active auction for the current league
  const { data: activeAuction } = useQuery<Auction | null>({
    queryKey: ["/api/auctions/active", selectedLeagueId],
    queryFn: async () => {
      const url = selectedLeagueId 
        ? `/api/auctions/active?leagueId=${selectedLeagueId}` 
        : "/api/auctions/active";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch active auction");
      return res.json();
    },
    enabled: !!selectedLeagueId,
    refetchInterval: REFRESH_INTERVAL,
  });

  // Check if user is enrolled in the active auction
  const { data: enrollmentStatus, isLoading: loadingEnrollment } = useQuery<{ enrolled: boolean }>({
    queryKey: ["/api/auctions", activeAuction?.id, "enrolled"],
    queryFn: async () => {
      if (!activeAuction?.id) return { enrolled: false };
      const res = await fetch(`/api/auctions/${activeAuction.id}/enrolled`, { credentials: "include" });
      if (!res.ok) return { enrolled: false };
      return res.json();
    },
    enabled: !!activeAuction?.id,
    refetchInterval: REFRESH_INTERVAL,
  });

  const isEnrolled = enrollmentStatus?.enrolled ?? false;
  const isCommissionerOrAdmin = user?.isCommissioner || user?.isSuperAdmin;

  const { data: freeAgents, isLoading: loadingAgents } = useQuery<FreeAgentWithBids[]>({
    queryKey: ["/api/free-agents", activeAuction?.id],
    queryFn: async () => {
      const url = activeAuction?.id 
        ? `/api/free-agents?auctionId=${activeAuction.id}` 
        : "/api/free-agents";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch free agents");
      return res.json();
    },
    refetchInterval: REFRESH_INTERVAL,
  });

  const { data: stats, isLoading: loadingStats } = useQuery<{
    totalActive: number;
    myActiveBids: number;
    myWins: number;
    endingToday: number;
  }>({
    queryKey: ["/api/stats", activeAuction?.id],
    queryFn: async () => {
      const url = activeAuction?.id 
        ? `/api/stats?auctionId=${activeAuction.id}` 
        : "/api/stats";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: REFRESH_INTERVAL,
  });

  const { data: budget, isLoading: loadingBudget } = useQuery<{
    budget: number;
    spent: number;
    committed: number;
    available: number;
  }>({
    queryKey: ["/api/budget", activeAuction?.id, user?.id],
    queryFn: async () => {
      if (!activeAuction?.id) return { budget: 0, spent: 0, committed: 0, available: 0 };
      const res = await fetch(`/api/budget?auctionId=${activeAuction.id}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) {
          return { budget: 0, spent: 0, committed: 0, available: 0 };
        }
        throw new Error("Failed to fetch budget");
      }
      return res.json();
    },
    enabled: !!activeAuction?.id,
    refetchInterval: REFRESH_INTERVAL,
  });

  const { data: limits, isLoading: loadingLimits } = useQuery<{
    rosterLimit: number | null;
    rosterUsed: number;
    rosterCommitted: number;
    rosterAvailable: number | null;
    ipLimit: number | null;
    ipUsed: number;
    ipCommitted: number;
    ipAvailable: number | null;
    paLimit: number | null;
    paUsed: number;
    paCommitted: number;
    paAvailable: number | null;
  }>({
    queryKey: ["/api/limits", activeAuction?.id, user?.id],
    queryFn: async () => {
      if (!activeAuction?.id) return null;
      const res = await fetch(`/api/limits?auctionId=${activeAuction.id}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) {
          return null;
        }
        throw new Error("Failed to fetch limits");
      }
      return res.json();
    },
    enabled: !!activeAuction?.id,
    refetchInterval: REFRESH_INTERVAL,
  });

  const activeAgents = freeAgents?.filter(a => a.isActive) || [];
  
  const { toast } = useToast();

  // Email opt-out query - only show for league-wide notifications
  const { data: emailOptOut, isLoading: loadingEmailOptOut } = useQuery<{ optedOut: boolean }>({
    queryKey: ["/api/auctions", activeAuction?.id, "email-opt-out"],
    queryFn: async () => {
      if (!activeAuction?.id) return { optedOut: false };
      const res = await fetch(`/api/auctions/${activeAuction.id}/email-opt-out`, { credentials: "include" });
      if (!res.ok) return { optedOut: false };
      return res.json();
    },
    enabled: !!activeAuction?.id && activeAuction?.emailNotifications === "league",
  });

  const emailOptOutMutation = useMutation({
    mutationFn: async (optedOut: boolean) => {
      if (!activeAuction?.id) throw new Error("No active auction");
      await apiRequest("POST", `/api/auctions/${activeAuction.id}/email-opt-out`, { optedOut });
      return optedOut;
    },
    onSuccess: (optedOut) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions", activeAuction?.id, "email-opt-out"] });
      toast({
        title: "Email preferences updated",
        description: optedOut 
          ? "You will no longer receive auction result emails." 
          : "You will now receive auction result emails.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update email preferences",
        variant: "destructive",
      });
    },
  });

  // Show message if user is not part of any league
  if (!isLoadingLeagues && leagues.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="max-w-lg mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Globe className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>No League Membership</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            {user?.isSuperAdmin ? (
              <>
                <p className="text-muted-foreground mb-4">
                  As a super admin, you can create and manage leagues from the Commissioner page.
                </p>
                <a href="/commissioner" className="text-primary hover:underline font-medium">
                  Go to Commissioner Page
                </a>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">
                  You are not currently a member of any league. Please contact your league administrator to be added to a league.
                </p>
                <p className="text-sm text-muted-foreground">
                  Once you're added to a league, you'll be able to view auctions, place bids, and manage your team.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold" data-testid="text-welcome">
            Welcome back, {user?.firstName || "Owner"}
          </h1>
          {activeAuction && (
            <Badge variant="default" className="text-sm" data-testid="badge-active-auction">
              {activeAuction.name}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          {currentLeague?.teamName ? `Managing ${currentLeague.teamName}` : "Ready to build your championship team"}
        </p>
        
        {/* Email notification opt-out - only show for league-wide notifications */}
        {activeAuction?.emailNotifications === "league" && !loadingEmailOptOut && (
          <div className="flex items-center gap-2 mt-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="email-opt-out" className="text-muted-foreground cursor-pointer">
              Receive results emails
            </Label>
            <Switch
              id="email-opt-out"
              data-testid="switch-email-notifications"
              checked={!emailOptOut?.optedOut}
              disabled={emailOptOutMutation.isPending}
              onCheckedChange={(checked) => emailOptOutMutation.mutate(!checked)}
            />
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Auctions
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold font-mono" data-testid="text-active-auctions">
                {stats?.totalActive || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Active Bids
            </CardTitle>
            <Gavel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold font-mono" data-testid="text-my-bids">
                {stats?.myActiveBids || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Players Won
            </CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold font-mono" data-testid="text-wins">
                {stats?.myWins || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ending Today
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold font-mono text-destructive" data-testid="text-ending-today">
                {stats?.endingToday || 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget & Limits Summary - only show when there's an active auction */}
      {activeAuction && (
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Budget & Limits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBudget || loadingLimits ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : budget ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Spent</div>
                    <div className="text-sm sm:text-lg font-bold font-mono" data-testid="text-budget-spent">
                      {formatCurrency(Math.floor(budget.spent))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Committed</div>
                    <div className="text-sm sm:text-lg font-bold font-mono" data-testid="text-budget-committed">
                      {formatCurrency(Math.floor(budget.committed))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Available</div>
                    <div 
                      className={`text-sm sm:text-lg font-bold font-mono ${budget.available < 20 ? 'text-destructive' : ''}`}
                      data-testid="text-budget-available"
                    >
                      {formatCurrency(Math.floor(budget.available))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground">
                    <span>Budget Usage</span>
                    <span>{formatCurrency(Math.floor(budget.spent + budget.committed))} / {formatCurrency(budget.budget)}</span>
                  </div>
                  <DualProgress
                    spent={budget.spent}
                    committed={budget.committed}
                    total={budget.budget}
                    spentLabel="Spent"
                    committedLabel="Committed"
                  />
                  <div className="flex flex-wrap gap-3 text-xs mt-1">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-sm bg-primary" />
                      <span className="text-muted-foreground">Spent</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-sm bg-amber-500 dark:bg-amber-600" />
                      <span className="text-muted-foreground">Committed</span>
                    </div>
                  </div>
                </div>
                
                {/* Roster, IP, and PA Limits */}
                {limits && (limits.rosterLimit !== null || limits.ipLimit !== null || limits.paLimit !== null) && (
                  <div className="pt-3 border-t space-y-4">
                    {limits.rosterLimit !== null && (
                      <div>
                        <div className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground mb-1">
                          <span>Roster Limit</span>
                          <span 
                            className={limits.rosterAvailable !== null && limits.rosterAvailable < 3 ? 'text-destructive' : ''}
                            data-testid="text-roster-limit"
                          >
                            {limits.rosterUsed} + {limits.rosterCommitted} / {limits.rosterLimit} ({limits.rosterAvailable ?? 0} remaining)
                          </span>
                        </div>
                        <DualProgress
                          spent={limits.rosterUsed}
                          committed={limits.rosterCommitted}
                          total={limits.rosterLimit}
                          spentLabel="Won Players"
                          committedLabel="Committed"
                        />
                      </div>
                    )}
                    {limits.ipLimit !== null && (
                      <div>
                        <div className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground mb-1">
                          <span>IP Limit</span>
                          <span 
                            className={limits.ipAvailable !== null && limits.ipAvailable < 50 ? 'text-destructive' : ''}
                            data-testid="text-ip-limit"
                          >
                            {limits.ipUsed} + {limits.ipCommitted} / {limits.ipLimit} ({limits.ipAvailable ?? 0} remaining)
                          </span>
                        </div>
                        <DualProgress
                          spent={limits.ipUsed}
                          committed={limits.ipCommitted}
                          total={limits.ipLimit}
                          spentLabel="Won IP"
                          committedLabel="Committed IP"
                        />
                      </div>
                    )}
                    {limits.paLimit !== null && (
                      <div>
                        <div className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground mb-1">
                          <span>PA Limit</span>
                          <span 
                            className={limits.paAvailable !== null && limits.paAvailable < 100 ? 'text-destructive' : ''}
                            data-testid="text-pa-limit"
                          >
                            {limits.paUsed} + {limits.paCommitted} / {limits.paLimit} ({limits.paAvailable ?? 0} remaining)
                          </span>
                        </div>
                        <DualProgress
                          spent={limits.paUsed}
                          committed={limits.paCommitted}
                          total={limits.paLimit}
                          spentLabel="Won PA"
                          committedLabel="Committed PA"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Budget information unavailable</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Free Agents Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Active Free Agents</h2>
        </div>
        {loadingAgents || loadingEnrollment ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : !activeAuction ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Active Auction</h3>
              <p className="text-muted-foreground">
                There is no active auction at the moment.
              </p>
            </CardContent>
          </Card>
        ) : !isEnrolled && !isCommissionerOrAdmin ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Not Enrolled</h3>
              <p className="text-muted-foreground">
                You are not enrolled in the current auction. Please contact the commissioner to be added.
              </p>
            </CardContent>
          </Card>
        ) : activeAgents.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Active Auctions</h3>
              <p className="text-muted-foreground">
                Check back later when the commissioner adds free agents.
              </p>
            </CardContent>
          </Card>
        ) : (
          <FreeAgentsTable 
            freeAgents={activeAgents} 
            bidIncrement={activeAuction?.bidIncrement ?? 0.10}
            allowAutoBidding={activeAuction?.allowAutoBidding ?? true}
          />
        )}
      </div>
    </div>
  );
}
