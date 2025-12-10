import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CountdownTimer } from "@/components/CountdownTimer";
import { AutoBidDialog } from "@/components/AutoBidDialog";
import { BundleDialog } from "@/components/BundleDialog";
import { formatCurrency, isAuctionClosed } from "@/lib/utils";
import { REFRESH_INTERVAL, queryClient, apiRequest } from "@/lib/queryClient";
import type { FreeAgentWithBids, AutoBid, FreeAgent, Auction, BidBundleWithItems } from "@shared/schema";
import { Gavel, Zap, Trophy, Package, Plus, Trash2, Pencil } from "lucide-react";

type AutoBidWithAgent = AutoBid & { freeAgent: FreeAgent };

export default function MyBids() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [editingAutoBid, setEditingAutoBid] = useState<FreeAgentWithBids | null>(null);
  const [autoBidDialogOpen, setAutoBidDialogOpen] = useState(false);
  const [bundleDialogOpen, setBundleDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const handleEditAutoBid = (autoBid: AutoBidWithAgent) => {
    const freeAgentWithBids: FreeAgentWithBids = {
      ...autoBid.freeAgent,
      currentBid: null,
      highBidder: null,
      bidCount: 0,
    };
    setEditingAutoBid(freeAgentWithBids);
    setAutoBidDialogOpen(true);
  };

  const { data: activeAuction } = useQuery<Auction | null>({
    queryKey: ["/api/auctions/active"],
    refetchInterval: REFRESH_INTERVAL,
  });

  const { data: myBids, isLoading: loadingBids } = useQuery<FreeAgentWithBids[]>({
    queryKey: ["/api/my-bids"],
    enabled: isAuthenticated,
    refetchInterval: REFRESH_INTERVAL,
  });

  const { data: myAutoBids, isLoading: loadingAutoBids } = useQuery<AutoBidWithAgent[]>({
    queryKey: ["/api/my-auto-bids"],
    enabled: isAuthenticated,
    refetchInterval: REFRESH_INTERVAL,
  });

  const { data: myBundles, isLoading: loadingBundles } = useQuery<BidBundleWithItems[]>({
    queryKey: ["/api/my-bundles", activeAuction?.id],
    enabled: isAuthenticated && !!activeAuction?.id,
    refetchInterval: REFRESH_INTERVAL,
  });

  const deleteBundleMutation = useMutation({
    mutationFn: async (bundleId: number) => {
      await apiRequest("DELETE", `/api/bundles/${bundleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-bundles"] });
      toast({ title: "Bundle deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete bundle", variant: "destructive" });
    },
  });

  const activeBids = myBids?.filter(b => !isAuctionClosed(b.auctionEndTime)) || [];
  const wonBids = myBids?.filter(b => isAuctionClosed(b.auctionEndTime) && b.winnerId) || [];
  const activeAutoBids = myAutoBids?.filter(ab => ab.isActive) || [];
  const activeBundles = myBundles?.filter(b => b.status === 'active') || [];

  const handleAuctionClose = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/free-agents"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/my-bids"] });
    queryClient.invalidateQueries({ queryKey: ["/api/my-auto-bids"] });
    queryClient.invalidateQueries({ queryKey: ["/api/my-bundles"] });
    queryClient.invalidateQueries({ queryKey: ["/api/results"] });
    queryClient.invalidateQueries({ queryKey: ["/api/budget"] });
    queryClient.invalidateQueries({ queryKey: ["/api/limits"] });
  }, []);

  const getBundleItemStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'deployed':
        return <Badge variant="default">Active</Badge>;
      case 'winning':
        return <Badge variant="default">Winning</Badge>;
      case 'outbid':
        return <Badge variant="destructive">Outbid</Badge>;
      case 'skipped':
        return <Badge variant="secondary">Skipped</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">My Bids</h1>
        <p className="text-muted-foreground">Track your active bids and auto-bid settings</p>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active">
            <Gavel className="h-4 w-4 mr-2" />
            Active ({activeBids.length})
          </TabsTrigger>
          <TabsTrigger value="auto-bids" data-testid="tab-auto-bids">
            <Zap className="h-4 w-4 mr-2" />
            Auto-Bids ({activeAutoBids.length})
          </TabsTrigger>
          <TabsTrigger value="bundles" data-testid="tab-bundles">
            <Package className="h-4 w-4 mr-2" />
            Bundles ({activeBundles.length})
          </TabsTrigger>
          <TabsTrigger value="won" data-testid="tab-won">
            <Trophy className="h-4 w-4 mr-2" />
            Won ({wonBids.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {loadingBids ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : activeBids.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Gavel className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Active Bids</h3>
                <p className="text-muted-foreground">
                  Head to the Free Agents page to start bidding!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeBids.map((agent) => {
                const isWinning = agent.currentBid !== null;
                return (
                  <Card key={agent.id} data-testid={`card-bid-${agent.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <Badge variant="outline">{agent.playerType === "pitcher" ? "Pitcher" : "Hitter"}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center py-4 rounded-lg bg-muted/50">
                        <div className="text-3xl font-bold font-mono text-primary">
                          {agent.currentBid ? formatCurrency(agent.currentBid.amount) : "-"}
                        </div>
                        {agent.currentBid && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {agent.currentBid.years}yr contract = {formatCurrency(agent.currentBid.totalValue)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant={isWinning ? "default" : "destructive"}>
                          {isWinning ? "WINNING" : "OUTBID"}
                        </Badge>
                        <CountdownTimer endTime={agent.auctionEndTime} onClose={handleAuctionClose} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="auto-bids" className="space-y-4">
          {loadingAutoBids ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : activeAutoBids.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Auto-Bids Active</h3>
                <p className="text-muted-foreground">
                  Set up auto-bidding on any player to compete automatically.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeAutoBids.map((autoBid) => {
                const isClosed = isAuctionClosed(autoBid.freeAgent.auctionEndTime);
                return (
                  <Card key={autoBid.id} data-testid={`card-auto-bid-${autoBid.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-lg">{autoBid.freeAgent.name}</CardTitle>
                        <Badge variant="secondary">
                          <Zap className="h-3 w-3 mr-1" />
                          Auto
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Max bid</span>
                        <span className="font-mono font-medium">
                          {formatCurrency(autoBid.maxAmount)}/yr
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Years</span>
                        <span className="font-mono">{autoBid.years}yr</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Ends</span>
                        <CountdownTimer endTime={autoBid.freeAgent.auctionEndTime} onClose={handleAuctionClose} />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        disabled={isClosed}
                        onClick={() => handleEditAutoBid(autoBid)}
                        data-testid={`button-edit-auto-bid-${autoBid.id}`}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Auto-Bid
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bundles" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setBundleDialogOpen(true)}
              disabled={!activeAuction}
              data-testid="button-create-bundle"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Bundle
            </Button>
          </div>

          {loadingBundles ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : activeBundles.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Active Bundles</h3>
                <p className="text-muted-foreground mb-4">
                  Create a bundle to set prioritized auto-bids across multiple players.
                  When outbid on one player, the system automatically moves to the next.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeBundles.map((bundle) => (
                <Card key={bundle.id} data-testid={`card-bundle-${bundle.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-lg">{bundle.name || `Bundle #${bundle.id}`}</CardTitle>
                      <Badge variant="secondary">
                        <Package className="h-3 w-3 mr-1" />
                        {bundle.items.length} players
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {bundle.items
                        .sort((a, b) => a.priority - b.priority)
                        .map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">#{idx + 1}</span>
                              <span className="font-medium">
                                {item.freeAgent?.name || `Player ${item.freeAgentId}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">
                                {formatCurrency(item.amount)} / {item.years}yr
                              </span>
                              {getBundleItemStatusBadge(item.status)}
                            </div>
                          </div>
                        ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => deleteBundleMutation.mutate(bundle.id)}
                      disabled={deleteBundleMutation.isPending}
                      data-testid={`button-delete-bundle-${bundle.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Cancel Bundle
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="won" className="space-y-4">
          {loadingBids ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : wonBids.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Players Won Yet</h3>
                <p className="text-muted-foreground">
                  Keep bidding to build your roster!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {wonBids.map((agent) => (
                <Card key={agent.id} className="border-primary/20" data-testid={`card-won-${agent.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <Badge variant="default">
                        <Trophy className="h-3 w-3 mr-1" />
                        WON
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-center py-3 rounded-lg bg-primary/10">
                      <div className="text-2xl font-bold font-mono">
                        {agent.currentBid ? formatCurrency(agent.currentBid.amount) : "-"}
                      </div>
                      {agent.currentBid && (
                        <div className="text-sm text-muted-foreground">
                          {agent.currentBid.years} year contract
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Total Value</span>
                      <span className="font-mono font-medium">
                        {agent.currentBid ? formatCurrency(agent.currentBid.totalValue) : "-"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AutoBidDialog
        freeAgent={editingAutoBid}
        open={autoBidDialogOpen}
        onOpenChange={setAutoBidDialogOpen}
        bidIncrement={activeAuction?.bidIncrement ?? 0.10}
      />

      {activeAuction && (
        <BundleDialog
          auctionId={activeAuction.id}
          open={bundleDialogOpen}
          onOpenChange={setBundleDialogOpen}
        />
      )}
    </div>
  );
}
