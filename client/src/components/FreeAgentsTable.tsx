import { useState, useMemo } from "react";
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
import { CountdownTimer } from "./CountdownTimer";
import { BidDialog } from "./BidDialog";
import { AutoBidDialog } from "./AutoBidDialog";
import { formatCurrency, isAuctionClosed } from "@/lib/utils";
import type { FreeAgentWithBids } from "@shared/schema";
import { Gavel, Zap, Search, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface FreeAgentsTableProps {
  freeAgents: FreeAgentWithBids[];
}

type SortField = "name" | "position" | "currentBid" | "totalValue" | "endTime";
type SortDirection = "asc" | "desc";

export function FreeAgentsTable({ freeAgents }: FreeAgentsTableProps) {
  const { user } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<FreeAgentWithBids | null>(null);
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [autoBidDialogOpen, setAutoBidDialogOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("endTime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const uniquePositions = useMemo(() => {
    const positions = new Set(freeAgents.map(a => a.position));
    return Array.from(positions).sort();
  }, [freeAgents]);

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

    if (positionFilter !== "all") {
      result = result.filter(a => a.position === positionFilter);
    }

    if (teamFilter !== "all") {
      result = result.filter(a => a.team === teamFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "position":
          comparison = a.position.localeCompare(b.position);
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
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [freeAgents, searchTerm, positionFilter, teamFilter, sortField, sortDirection]);

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
    setPositionFilter("all");
    setTeamFilter("all");
  };

  const hasActiveFilters = searchTerm || positionFilter !== "all" || teamFilter !== "all";

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
        
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-position">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            {uniquePositions.map(pos => (
              <SelectItem key={pos} value={pos}>{pos}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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
                    onClick={() => handleSort("position")}
                  >
                    <div className="flex items-center">
                      Position
                      {getSortIcon("position")}
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
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                          <span className="font-medium" data-testid={`text-player-name-${agent.id}`}>
                            {agent.name}
                          </span>
                          {agent.team && (
                            <span className="text-muted-foreground text-sm ml-2">
                              ({agent.team})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {agent.position}
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
                            <span className="text-muted-foreground">-</span>
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
                                {agent.highBidder.firstName} {agent.highBidder.lastName?.[0]}.
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
                          <CountdownTimer endTime={agent.auctionEndTime} />
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
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isClosed}
                              onClick={() => handleAutoBidClick(agent)}
                              data-testid={`button-auto-bid-${agent.id}`}
                            >
                              <Zap className="h-4 w-4" />
                            </Button>
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
      />
      
      <AutoBidDialog
        freeAgent={selectedAgent}
        open={autoBidDialogOpen}
        onOpenChange={setAutoBidDialogOpen}
      />
    </>
  );
}
