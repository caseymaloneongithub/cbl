import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Gavel, Trophy, Clock } from "lucide-react";
import type { FreeAgentWithBids, UserWithStats } from "@shared/schema";
import { FreeAgentsTable } from "@/components/FreeAgentsTable";

export default function Home() {
  const { user } = useAuth();

  const { data: freeAgents, isLoading: loadingAgents } = useQuery<FreeAgentWithBids[]>({
    queryKey: ["/api/free-agents"],
  });

  const { data: stats, isLoading: loadingStats } = useQuery<{
    totalActive: number;
    myActiveBids: number;
    myWins: number;
    endingSoon: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const activeAgents = freeAgents?.filter(a => a.isActive) || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" data-testid="text-welcome">
          Welcome back, {user?.firstName || "Owner"}
        </h1>
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
