import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CountdownTimer } from "./CountdownTimer";
import { BidDialog } from "./BidDialog";
import { AutoBidDialog } from "./AutoBidDialog";
import { BidHistoryModal } from "./BidHistoryModal";
import { formatCurrency, isAuctionClosed } from "@/lib/utils";
import type { FreeAgentWithBids } from "@shared/schema";
import { Gavel, Zap, Search, ArrowUpDown, ArrowUp, ArrowDown, X, Trash2, History } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCallback } from "react";

interface FreeAgentsTableProps {
  freeAgents: FreeAgentWithBids[];
  bidIncrement?: number;
  allowAutoBidding?: boolean;
}

type SortField = "name" | "playerType" | "currentBid" | "totalValue" | "endTime" | 
  "avg" | "hr" | "rbi" | "runs" | "sb" | "ops" | "pa" |
  "wins" | "losses" | "era" | "whip" | "strikeouts" | "ip";
type SortDirection = "asc" | "desc";
type PlayerTypeFilter = "all" | "hitter" | "pitcher";

export function FreeAgentsTable({ freeAgents, bidIncrement = 0.10, allowAutoBidding = true }: FreeAgentsTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAgent, setSelectedAgent] = useState<FreeAgentWithBids | null>(null);
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [autoBidDialogOpen, setAutoBidDialogOpen] = useState(false);
  const [bidHistoryAgent, setBidHistoryAgent] = useState<FreeAgentWithBids | null>(null);
  const [bidHistoryOpen, setBidHistoryOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [playerTypeFilter, setPlayerTypeFilter] = useState<PlayerTypeFilter>("all");
  const [sortField, setSortField] = useState<SortField>("endTime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const isAdmin = user?.isCommissioner || user?.isSuperAdmin;

  const handleAuctionClose = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/free-agents"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/my-bids"] });
    queryClient.invalidateQueries({ queryKey: ["/api/results"] });
    queryClient.invalidateQueries({ queryKey: ["/api/budget"] });
    queryClient.invalidateQueries({ queryKey: ["/api/limits"] });
  }, []);

  const deleteAgent = useMutation({
    mutationFn: async (agentId: number) => {
      await apiRequest("DELETE", `/api/free-agents/${agentId}`);
    },
    onSuccess: () => {
      toast({ title: "Player Removed", description: "Free agent has been deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/free-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    },
  });

  const uniqueTeams = useMemo(() => {
    const teams = new Set(freeAgents.filter(a => a.team).map(a => a.team!));
    return Array.from(teams).sort();
  }, [freeAgents]);

  const filteredAndSortedAgents = useMemo(() => {
    let result = [...freeAgents];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        a => a.name.toLowerCase().includes(term) || 
             a.team?.toLowerCase().includes(term)
      );
    }

    if (teamFilter !== "all") {
      result = result.filter(a => a.team === teamFilter);
    }

    if (playerTypeFilter !== "all") {
      result = result.filter(a => a.playerType === playerTypeFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "playerType":
          comparison = a.playerType.localeCompare(b.playerType);
          break;
        case "currentBid":
          const aBid = a.currentBid?.amount || 0;
          const bBid = b.currentBid?.amount || 0;
          comparison = aBid - bBid;
          break;
        case "totalValue":
          const aValue = a.currentBid?.totalValue || 0;
          const bValue = b.currentBid?.totalValue || 0;
          comparison = aValue - bValue;
          break;
        case "endTime":
          comparison = new Date(a.auctionEndTime).getTime() - new Date(b.auctionEndTime).getTime();
          break;
        // Hitter stats
        case "avg":
          comparison = (a.avg ?? 0) - (b.avg ?? 0);
          break;
        case "hr":
          comparison = (a.hr ?? 0) - (b.hr ?? 0);
          break;
        case "rbi":
          comparison = (a.rbi ?? 0) - (b.rbi ?? 0);
          break;
        case "runs":
          comparison = (a.runs ?? 0) - (b.runs ?? 0);
          break;
        case "sb":
          comparison = (a.sb ?? 0) - (b.sb ?? 0);
          break;
        case "ops":
          comparison = (a.ops ?? 0) - (b.ops ?? 0);
          break;
        case "pa":
          comparison = (a.pa ?? 0) - (b.pa ?? 0);
          break;
        // Pitcher stats
        case "wins":
          comparison = (a.wins ?? 0) - (b.wins ?? 0);
          break;
        case "losses":
          comparison = (a.losses ?? 0) - (b.losses ?? 0);
          break;
        case "era":
          comparison = (a.era ?? 0) - (b.era ?? 0);
          break;
        case "whip":
          comparison = (a.whip ?? 0) - (b.whip ?? 0);
          break;
        case "strikeouts":
          comparison = (a.strikeouts ?? 0) - (b.strikeouts ?? 0);
          break;
        case "ip":
          comparison = (a.ip ?? 0) - (b.ip ?? 0);
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [freeAgents, searchTerm, teamFilter, playerTypeFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTeamFilter("all");
    setPlayerTypeFilter("all");
  };

  const hasActiveFilters = searchTerm || teamFilter !== "all" || playerTypeFilter !== "all";

  const handleBidClick = (agent: FreeAgentWithBids) => {
    setSelectedAgent(agent);
    setBidDialogOpen(true);
  };

  const handleAutoBidClick = (agent: FreeAgentWithBids) => {
    setSelectedAgent(agent);
    setAutoBidDialogOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players or teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-team">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {uniqueTeams.map(team => (
              <SelectItem key={team} value={team}>{team}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={playerTypeFilter} onValueChange={(v) => setPlayerTypeFilter(v as PlayerTypeFilter)}>
          <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-player-type">
            <SelectValue placeholder="Player Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Players</SelectItem>
            <SelectItem value="hitter">Hitters</SelectItem>
            <SelectItem value="pitcher">Pitchers</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters} data-testid="button-clear-filters">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table data-testid="table-free-agents">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead 
                    className="font-semibold cursor-pointer select-none"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      Player
                      {getSortIcon("name")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold cursor-pointer select-none"
                    onClick={() => handleSort("playerType")}
                  >
                    <div className="flex items-center">
                      Type
                      {getSortIcon("playerType")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-right cursor-pointer select-none"
                    onClick={() => handleSort("currentBid")}
                  >
                    <div className="flex items-center justify-end">
                      Current Bid
                      {getSortIcon("currentBid")}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-center">Years</TableHead>
                  <TableHead 
                    className="font-semibold text-right cursor-pointer select-none"
                    onClick={() => handleSort("totalValue")}
                  >
                    <div className="flex items-center justify-end">
                      Total Value
                      {getSortIcon("totalValue")}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold">High Bidder</TableHead>
                  <TableHead 
                    className="font-semibold text-center cursor-pointer select-none"
                    onClick={() => handleSort("endTime")}
                  >
                    <div className="flex items-center justify-center">
                      Time Left
                      {getSortIcon("endTime")}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedAgents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {hasActiveFilters 
                        ? "No players match your filters" 
                        : "No active auctions"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedAgents.map((agent) => {
                    const isClosed = isAuctionClosed(agent.auctionEndTime);
                    const isHighBidder = agent.currentBid?.userId === user?.id;
                    
                    return (
                      <TableRow
                        key={agent.id}
                        className="hover-elevate"
                        data-testid={`row-player-${agent.id}`}
                      >
                        <TableCell>
                          <button
                            className="font-medium hover:underline cursor-pointer text-left flex items-center gap-1"
                            onClick={() => {
                              setBidHistoryAgent(agent);
                              setBidHistoryOpen(true);
                            }}
                            data-testid={`text-player-name-${agent.id}`}
                          >
                            {agent.name}
                            {agent.bidCount > 0 && (
                              <Badge variant="secondary" className="text-xs ml-1">
                                {agent.bidCount}
                              </Badge>
                            )}
                          </button>
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
                        <TableCell className="text-right font-mono">
                          {agent.currentBid ? (
                            <span data-testid={`text-current-bid-${agent.id}`}>
                              {formatCurrency(agent.currentBid.amount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground" title={`Min: ${formatCurrency(agent.minimumBid)}`}>
                              {formatCurrency(agent.minimumBid)} min
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {agent.currentBid ? (
                            <span>{agent.currentBid.years}yr</span>
                          ) : (
                            <span className="text-muted-foreground" title={agent.minimumYears > 1 ? `Min ${agent.minimumYears}yr contract required` : ""}>
                              {agent.minimumYears > 1 ? `${agent.minimumYears}yr+` : "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {agent.currentBid ? (
                            <span data-testid={`text-total-value-${agent.id}`}>
                              {formatCurrency(agent.currentBid.totalValue)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {agent.highBidder ? (
                            <div className="flex items-center gap-2">
                              <span className={isHighBidder ? "text-primary font-medium" : ""}>
                                {agent.highBidder.teamAbbreviation || agent.highBidder.teamName || `${agent.highBidder.firstName} ${agent.highBidder.lastName?.[0]}.`}
                              </span>
                              {isHighBidder && (
                                <Badge variant="default" className="text-xs">You</Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No bids</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <CountdownTimer endTime={agent.auctionEndTime} onClose={handleAuctionClose} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="default"
                              size="sm"
                              disabled={isClosed}
                              onClick={() => handleBidClick(agent)}
                              data-testid={`button-bid-${agent.id}`}
                            >
                              <Gavel className="h-4 w-4 mr-1" />
                              Bid
                            </Button>
                            {allowAutoBidding && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isClosed}
                                onClick={() => handleAutoBidClick(agent)}
                                data-testid={`button-auto-bid-${agent.id}`}
                              >
                                <Zap className="h-4 w-4 mr-1" />
                                Auto
                              </Button>
                            )}
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive"
                                    data-testid={`button-delete-${agent.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Free Agent</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove {agent.name} from the auction? 
                                      This will delete all bids and auto-bids for this player.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteAgent.mutate(agent.id)}
                                      className="bg-destructive text-destructive-foreground"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {filteredAndSortedAgents.length > 0 && (
        <div className="mt-2 text-sm text-muted-foreground">
          Showing {filteredAndSortedAgents.length} of {freeAgents.length} players
        </div>
      )}

      <BidDialog
        freeAgent={selectedAgent}
        open={bidDialogOpen}
        onOpenChange={setBidDialogOpen}
        bidIncrement={bidIncrement}
      />
      
      {allowAutoBidding && (
        <AutoBidDialog
          freeAgent={selectedAgent}
          open={autoBidDialogOpen}
          onOpenChange={setAutoBidDialogOpen}
          bidIncrement={bidIncrement}
        />
      )}

      <BidHistoryModal
        agent={bidHistoryAgent}
        open={bidHistoryOpen}
        onOpenChange={setBidHistoryOpen}
      />
    </>
  );
}
