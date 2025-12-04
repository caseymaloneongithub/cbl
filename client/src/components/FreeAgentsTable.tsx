import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Gavel, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface FreeAgentsTableProps {
  freeAgents: FreeAgentWithBids[];
}

export function FreeAgentsTable({ freeAgents }: FreeAgentsTableProps) {
  const { user } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<FreeAgentWithBids | null>(null);
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [autoBidDialogOpen, setAutoBidDialogOpen] = useState(false);

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
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Player</TableHead>
                  <TableHead className="font-semibold">Position</TableHead>
                  <TableHead className="font-semibold text-right">Current Bid</TableHead>
                  <TableHead className="font-semibold text-center">Years</TableHead>
                  <TableHead className="font-semibold text-right">Total Value</TableHead>
                  <TableHead className="font-semibold">High Bidder</TableHead>
                  <TableHead className="font-semibold text-center">Time Left</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {freeAgents.map((agent) => {
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
                          <span className="text-muted-foreground">-</span>
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
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
