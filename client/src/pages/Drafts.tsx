import { useQuery } from "@tanstack/react-query";
import { useLeague } from "@/hooks/useLeague";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { DraftWithDetails } from "@shared/schema";
import { ListOrdered, CheckCircle, Play, Settings } from "lucide-react";

export default function Drafts() {
  const { selectedLeagueId, currentLeague } = useLeague();
  const [, navigate] = useLocation();

  const { data: drafts, isLoading, error } = useQuery<DraftWithDetails[]>({
    queryKey: ["/api/drafts", selectedLeagueId],
    queryFn: async () => {
      const res = await fetch(`/api/drafts?leagueId=${selectedLeagueId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch drafts");
      return res.json();
    },
    enabled: !!selectedLeagueId,
    staleTime: 5_000,
  });

  const statusIcon = (status: string) => {
    if (status === "active") return <Play className="h-3 w-3" />;
    if (status === "completed") return <CheckCircle className="h-3 w-3" />;
    return <Settings className="h-3 w-3" />;
  };

  const statusVariant = (status: string): "default" | "secondary" | "outline" => {
    if (status === "active") return "default";
    if (status === "completed") return "secondary";
    return "outline";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-drafts-title">
          <ListOrdered className="h-6 w-6" />
          Drafts
        </h1>
        <p className="text-muted-foreground">View and participate in your league's drafts.</p>
        <p className="text-sm text-muted-foreground mt-1">League: {currentLeague?.name || "Not selected"} (ID {selectedLeagueId || "?"})</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive mb-2">Failed to load drafts</p>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </CardContent>
        </Card>
      ) : drafts && drafts.length > 0 ? (
        <div className="space-y-3">
          {drafts.map(draft => (
            <Card
              key={draft.id}
              className="hover-elevate"
              data-testid={`card-draft-${draft.id}`}
            >
              <CardContent className="flex items-center justify-between gap-4 flex-wrap py-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-medium text-lg" data-testid={`text-draft-name-${draft.id}`}>{draft.name}</span>
                  <Badge variant={statusVariant(draft.status)} data-testid={`badge-draft-status-${draft.id}`}>
                    {statusIcon(draft.status)}
                    <span className="ml-1">{draft.status.charAt(0).toUpperCase() + draft.status.slice(1)}</span>
                  </Badge>
                  <span className="text-sm text-muted-foreground">Season {draft.season}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                  <span data-testid={`text-player-count-${draft.id}`}>{draft.playerCount} players</span>
                  <span data-testid={`text-pick-count-${draft.id}`}>{draft.pickCount} picks</span>
                  <span data-testid={`text-team-count-${draft.id}`}>{draft.teamCount} teams</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/draft/${draft.id}`)}
                    data-testid={`button-open-draft-${draft.id}`}
                  >
                    Open Draft
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <ListOrdered className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Drafts</h3>
            <p className="text-muted-foreground">There are no drafts set up for your league yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
