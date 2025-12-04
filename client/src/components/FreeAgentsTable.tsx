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

type SortField = "name" | "position" | "currentBid" | "totalValue" | "endTime" | 
  "avg" | "hr" | "rbi" | "runs" | "sb" | "ops" | "pa" |
  "wins" | "losses" | "era" | "whip" | "strikeouts" | "ip";
type SortDirection = "asc" | "desc";
type PlayerTypeFilter = "all" | "hitter" | "pitcher";

export function FreeAgentsTable({ freeAgents }: FreeAgentsTableProps) {
  const { user } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<FreeAgentWithBids | null>(null);
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [autoBidDialogOpen, setAutoBidDialogOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [playerTypeFilter, setPlayerTypeFilter] = useState<PlayerTypeFilter>("all");
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

    if (playerTypeFilter !== "all") {
      result = result.filter(a => a.playerType === playerTypeFilter);
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
  }, [freeAgents, searchTerm, positionFilter, teamFilter, playerTypeFilter, sortField, sortDirection]);

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
    setPlayerTypeFilter("all");
  };

  const hasActiveFilters = searchTerm || positionFilter !== "all" || teamFilter !== "all" || playerTypeFilter !== "all";

  const formatStat = (value: number | null | undefined, decimals: number = 0): string => {
    if (value === null || value === undefined) return "-";
    return decimals > 0 ? value.toFixed(decimals) : String(value);
  };

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
                  {playerTypeFilter === "hitter" && (
                    <>
                      <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("avg")}>
                        <div className="flex items-center justify-end">AVG{getSortIcon("avg")}</div>
                      </TableHead>
                      <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("hr")}>
                        <div className="flex items-center justify-end">HR{getSortIcon("hr")}</div>
                      </TableHead>
                      <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("rbi")}>
                        <div className="flex items-center justify-end">RBI{getSortIcon("rbi")}</div>
                      </TableHead>
                      <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("runs")}>
                        <div className="flex items-center justify-end">R{getSortIcon("runs")}</div>
                      </TableHead>
                      <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("sb")}>
                        <div className="flex items-center justify-end">SB{getSortIcon("sb")}</div>
                      </TableHead>
                      <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("ops")}>
                        <div className="flex items-center justify-end">OPS{getSortIcon("ops")}</div>
                      </TableHead>
                      <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("pa")}>
                        <div className="flex items-center justify-end">PA{getSortIcon("pa")}</div>
                      </TableHead>
                    </>
                  )}
                  {playerTypeFilter === "pitcher" && (
                    <>
                      <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("wins")}>
                        <div className="flex items-center justify-end">W{getSortIcon("wins")}</div>
                      </TableHead>
                      <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("losses")}>
                        <div className="flex items-center justify-end">L{getSortIcon("losses")}</div>
                      </TableHead>
                      <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("era")}>
                        <div className="flex items-center justify-end">ERA{getSortIcon("era")}</div>
                      </TableHead>
                      <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("whip")}>
                        <div className="flex items-center justify-end">WHIP{getSortIcon("whip")}</div>
                      </TableHead>
                      <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("strikeouts")}>
                        <div className="flex items-center justify-end">K{getSortIcon("strikeouts")}</div>
                      </TableHead>
                      <TableHead className="font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("ip")}>
                        <div className="flex items-center justify-end">IP{getSortIcon("ip")}</div>
                      </TableHead>
                    </>
                  )}
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedAgents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={playerTypeFilter === "hitter" ? 16 : playerTypeFilter === "pitcher" ? 15 : 9} className="text-center py-8 text-muted-foreground">
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
                        {playerTypeFilter === "hitter" && (
                          <>
                            <TableCell className="text-right font-mono text-sm">{formatStat(agent.avg, 3)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatStat(agent.hr)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatStat(agent.rbi)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatStat(agent.runs)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatStat(agent.sb)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatStat(agent.ops, 3)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatStat(agent.pa)}</TableCell>
                          </>
                        )}
                        {playerTypeFilter === "pitcher" && (
                          <>
                            <TableCell className="text-right font-mono text-sm">{formatStat(agent.wins)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatStat(agent.losses)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatStat(agent.era, 2)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatStat(agent.whip, 2)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatStat(agent.strikeouts)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatStat(agent.ip, 1)}</TableCell>
                          </>
                        )}
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
