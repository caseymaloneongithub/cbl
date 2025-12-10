import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, formatNumberWithCommas } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { FreeAgentWithBids, Auction } from "@shared/schema";
import { Trophy, RefreshCcw, Loader2, Archive } from "lucide-react";

export default function Results() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [relistDialogOpen, setRelistDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<FreeAgentWithBids | null>(null);
  const [relistMinBid, setRelistMinBid] = useState(1);
  const [relistMinYears, setRelistMinYears] = useState(1);
  const [relistEndDate, setRelistEndDate] = useState("");
  const [selectedAuctionId, setSelectedAuctionId] = useState<string>("all");

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

  // Fetch all auctions for the dropdown
  const { data: auctions } = useQuery<Auction[]>({
    queryKey: ["/api/auctions"],
    enabled: isAuthenticated,
  });

  // Build query key with optional auction filter
  const resultsQueryKey = selectedAuctionId === "all" 
    ? ["/api/results"] 
    : ["/api/results", { auctionId: selectedAuctionId }];

  const { data: results, isLoading } = useQuery<FreeAgentWithBids[]>({
    queryKey: resultsQueryKey,
    queryFn: async () => {
      const url = selectedAuctionId === "all" 
        ? "/api/results" 
        : `/api/results?auctionId=${selectedAuctionId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch results");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const relistMutation = useMutation({
    mutationFn: async ({ agentId, minimumBid, minimumYears, auctionEndTime }: { agentId: number; minimumBid: number; minimumYears: number; auctionEndTime: string }) => {
      await apiRequest("POST", `/api/free-agents/${agentId}/relist`, {
        minimumBid,
        minimumYears,
        auctionEndTime,
      });
    },
    onSuccess: () => {
      toast({
        title: "Player Relisted",
        description: `${selectedAgent?.name} has been relisted for auction.`,
      });
      // Invalidate all results queries (both base and filtered)
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/free-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setRelistDialogOpen(false);
      setSelectedAgent(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Relist Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRelistClick = (agent: FreeAgentWithBids) => {
    setSelectedAgent(agent);
    setRelistMinBid(agent.minimumBid || 1);
    setRelistMinYears(agent.minimumYears || 1);
    const defaultEndDate = new Date();
    defaultEndDate.setDate(defaultEndDate.getDate() + 7);
    setRelistEndDate(defaultEndDate.toISOString().slice(0, 16));
    setRelistDialogOpen(true);
  };

  const handleRelistSubmit = () => {
    if (!selectedAgent) return;
    
    // Validate minimum bid
    if (!relistMinBid || relistMinBid < 1) {
      toast({
        title: "Invalid Minimum Bid",
        description: "Minimum bid must be at least $1",
        variant: "destructive",
      });
      return;
    }
    
    // Validate end date
    if (!relistEndDate) {
      toast({
        title: "End Date Required",
        description: "Please select an auction end date",
        variant: "destructive",
      });
      return;
    }
    
    const endTime = new Date(relistEndDate);
    if (endTime <= new Date()) {
      toast({
        title: "Invalid End Date",
        description: "Auction end date must be in the future",
        variant: "destructive",
      });
      return;
    }
    
    relistMutation.mutate({
      agentId: selectedAgent.id,
      minimumBid: relistMinBid,
      minimumYears: relistMinYears,
      auctionEndTime: endTime.toISOString(),
    });
  };

  const isCommissioner = user?.isCommissioner;

  if (authLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auction Results</h1>
          <p className="text-muted-foreground">Completed auctions and winning bids</p>
        </div>
        
        {auctions && auctions.length > 0 && (
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedAuctionId}
              onValueChange={setSelectedAuctionId}
            >
              <SelectTrigger className="w-[200px]" data-testid="select-auction-filter">
                <SelectValue placeholder="Select auction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Auctions</SelectItem>
                {auctions.map((auction) => (
                  <SelectItem key={auction.id} value={String(auction.id)}>
                    {auction.name}
                    {auction.status === "active" && (
                      <Badge variant="default" className="ml-2 text-xs">Active</Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !results || results.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Completed Auctions</h3>
            <p className="text-muted-foreground">
              Results will appear here once auctions close.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Player</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Winner</TableHead>
                    <TableHead className="font-semibold text-right">Winning Bid</TableHead>
                    <TableHead className="font-semibold text-center">Years</TableHead>
                    <TableHead className="font-semibold text-right">Total Value</TableHead>
                    <TableHead className="font-semibold text-center">Auction Ended</TableHead>
                    {isCommissioner && <TableHead className="font-semibold text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((agent) => (
                    <TableRow key={agent.id} data-testid={`row-result-${agent.id}`}>
                      <TableCell>
                        <span className="font-medium">{agent.name}</span>
                        {agent.team && (
                          <span className="text-muted-foreground text-sm ml-2">
                            ({agent.team})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {agent.playerType === "pitcher" ? "Pitcher" : "Hitter"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {agent.highBidder ? (
                          <div className="flex items-center gap-2">
                            <span>
                              {agent.highBidder.firstName} {agent.highBidder.lastName}
                            </span>
                            <Badge variant="default" className="text-xs">
                              <Trophy className="h-3 w-3 mr-1" />
                              Winner
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No bids</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {agent.currentBid ? formatCurrency(agent.currentBid.amount) : "-"}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {agent.currentBid ? `${agent.currentBid.years}yr` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {agent.currentBid ? formatCurrency(agent.currentBid.totalValue) : "-"}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground text-sm">
                        {formatDate(agent.auctionEndTime)}
                      </TableCell>
                      {isCommissioner && (
                        <TableCell className="text-right">
                          {!agent.currentBid && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRelistClick(agent)}
                              data-testid={`button-relist-${agent.id}`}
                            >
                              <RefreshCcw className="h-4 w-4 mr-1" />
                              Relist
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Relist Dialog */}
      <Dialog open={relistDialogOpen} onOpenChange={setRelistDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw className="h-5 w-5" />
              Relist Player
            </DialogTitle>
            <DialogDescription>
              Re-enter {selectedAgent?.name} with a new minimum bid and auction end date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="relist-min-bid">Minimum Bid ($)</Label>
              <Input
                id="relist-min-bid"
                type="text"
                inputMode="numeric"
                value={formatNumberWithCommas(relistMinBid)}
                onChange={(e) => {
                  const numericOnly = e.target.value.replace(/[^\d]/g, '');
                  setRelistMinBid(numericOnly === "" ? 0 : parseInt(numericOnly, 10));
                }}
                data-testid="input-relist-min-bid"
              />
            </div>

            <div className="space-y-2">
              <Label>Minimum Contract Years</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((year) => (
                  <Button
                    key={year}
                    type="button"
                    variant={relistMinYears === year ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setRelistMinYears(year)}
                    data-testid={`button-relist-year-${year}`}
                  >
                    {year}yr
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="relist-end-date">Auction End Date</Label>
              <Input
                id="relist-end-date"
                type="datetime-local"
                value={relistEndDate}
                onChange={(e) => setRelistEndDate(e.target.value)}
                data-testid="input-relist-end-date"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setRelistDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleRelistSubmit}
                disabled={relistMutation.isPending}
                data-testid="button-confirm-relist"
              >
                {relistMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Relisting...
                  </>
                ) : (
                  "Relist Player"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
