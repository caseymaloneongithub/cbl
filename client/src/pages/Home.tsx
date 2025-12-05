import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, Gavel, Trophy, Clock, DollarSign } from "lucide-react";
import type { FreeAgentWithBids, UserWithStats, Auction } from "@shared/schema";
import { FreeAgentsTable } from "@/components/FreeAgentsTable";

export default function Home() {
  const { user } = useAuth();

  // Fetch the active auction
  const { data: activeAuction } = useQuery<Auction | null>({
    queryKey: ["/api/auctions/active"],
  });

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
  });

  const { data: stats, isLoading: loadingStats } = useQuery<{
    totalActive: number;
    myActiveBids: number;
    myWins: number;
    endingSoon: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const { data: budget, isLoading: loadingBudget } = useQuery<{
    budget: number;
    spent: number;
    committed: number;
    available: number;
  }>({
    queryKey: ["/api/budget", activeAuction?.id],
    queryFn: async () => {
      const url = activeAuction?.id 
        ? `/api/budget?auctionId=${activeAuction.id}` 
        : "/api/budget";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch budget");
      return res.json();
    },
  });

  const activeAgents = freeAgents?.filter(a => a.isActive) || [];

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
          {user?.teamName ? `Managing ${user.teamName}` : "Ready to build your championship team"}
        </p>
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
              Ending Soon
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold font-mono text-destructive" data-testid="text-ending-soon">
                {stats?.endingSoon || 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget Summary */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Budget
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingBudget ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : budget ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Spent</div>
                  <div className="text-lg font-bold font-mono" data-testid="text-budget-spent">
                    ${Math.floor(budget.spent)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Committed</div>
                  <div className="text-lg font-bold font-mono" data-testid="text-budget-committed">
                    ${Math.floor(budget.committed)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Available</div>
                  <div 
                    className={`text-lg font-bold font-mono ${budget.available < 20 ? 'text-destructive' : ''}`}
                    data-testid="text-budget-available"
                  >
                    ${Math.floor(budget.available)}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Budget Usage</span>
                  <span>${Math.floor(budget.spent + budget.committed)} / ${budget.budget}</span>
                </div>
                <Progress 
                  value={((budget.spent + budget.committed) / budget.budget) * 100} 
                  className="h-2"
                />
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Budget information unavailable</p>
          )}
        </CardContent>
      </Card>

      {/* Free Agents Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Active Free Agents</h2>
        </div>
        {loadingAgents ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
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
          <FreeAgentsTable freeAgents={activeAgents} />
        )}
      </div>
    </div>
  );
}
