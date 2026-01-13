import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CountdownTimer } from "./CountdownTimer";
import { formatCurrency } from "@/lib/utils";
import type { FreeAgentWithBids, BidWithUser } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { Clock, Zap } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BidHistoryModalProps {
  agent: FreeAgentWithBids | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BidHistoryModal({ agent, open, onOpenChange }: BidHistoryModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { data: bids, isLoading } = useQuery<BidWithUser[]>({
    queryKey: ['/api/free-agents', agent?.id, 'bids'],
    enabled: open && !!agent?.id,
  });

  const triggerCompetitionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/free-agents/${agent?.id}/trigger-competition`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.triggered ? "Competition Triggered" : "No Changes",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/free-agents', agent?.id, 'bids'] });
      queryClient.invalidateQueries({ queryKey: ['/api/free-agents'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!agent) return null;

  const sortedBids = bids ? [...bids].sort((a, b) => 
    new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
  ) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{agent.name}</span>
            {agent.team && (
              <span className="text-muted-foreground font-normal">({agent.team})</span>
            )}
            <Badge variant="outline" className="ml-2">
              {agent.playerType === "pitcher" ? "Pitcher" : "Hitter"}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Bid history and activity for this player
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-muted/50" data-testid="auction-ending-display">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Auction ending in:</span>
          <CountdownTimer endTime={agent.auctionEndTime} />
        </div>
        
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sortedBids.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No bids yet for this player
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Team</TableHead>
                  <TableHead className="font-semibold text-right">Amount</TableHead>
                  <TableHead className="font-semibold text-center">Years</TableHead>
                  <TableHead className="font-semibold text-right">Total Value</TableHead>
                  <TableHead className="font-semibold text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBids.map((bid, index) => {
                  const isCurrentUser = bid.userId === user?.id;
                  const isHighestBid = index === 0;
                  
                  return (
                    <TableRow 
                      key={bid.id}
                      className={isHighestBid ? "bg-muted/50" : ""}
                      data-testid={`row-bid-${bid.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={isCurrentUser ? "font-medium" : ""}>
                            {bid.user.teamAbbreviation || bid.user.teamName || `${bid.user.firstName} ${bid.user.lastName?.[0]}.`}
                          </span>
                          {isCurrentUser && (
                            <Badge variant="default" className="text-xs">You</Badge>
                          )}
                          {isHighestBid && (
                            <Badge variant="secondary" className="text-xs">High</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(bid.amount)}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {bid.years}yr
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(bid.totalValue)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(bid.createdAt!), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="border-t pt-4 mt-2">
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Total bids: {sortedBids.length}</span>
            <div className="flex items-center gap-4">
              {user?.isSuperAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerCompetitionMutation.mutate()}
                  disabled={triggerCompetitionMutation.isPending}
                  data-testid="button-trigger-competition"
                >
                  <Zap className="h-4 w-4 mr-1" />
                  {triggerCompetitionMutation.isPending ? "Running..." : "Trigger Auto-Bid Competition"}
                </Button>
              )}
              <span>
                {agent.currentBid 
                  ? `Current: ${formatCurrency(agent.currentBid.amount)} / ${agent.currentBid.years}yr`
                  : `Minimum: ${formatCurrency(agent.minimumBid)}`
                }
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
