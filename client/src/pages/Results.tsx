import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { FreeAgentWithBids } from "@shared/schema";
import { Trophy } from "lucide-react";

export default function Results() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: results, isLoading } = useQuery<FreeAgentWithBids[]>({
    queryKey: ["/api/results"],
    enabled: isAuthenticated,
  });

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Auction Results</h1>
        <p className="text-muted-foreground">Completed auctions and winning bids</p>
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
                    <TableHead className="font-semibold">Position</TableHead>
                    <TableHead className="font-semibold">Winner</TableHead>
                    <TableHead className="font-semibold text-right">Winning Bid</TableHead>
                    <TableHead className="font-semibold text-center">Years</TableHead>
                    <TableHead className="font-semibold text-right">Total Value</TableHead>
                    <TableHead className="font-semibold text-center">Auction Ended</TableHead>
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
                          {agent.position}
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
