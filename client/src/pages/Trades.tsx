import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
} from "@/components/ui/alert-dialog";
import { ArrowLeftRight, Check, X, Clock, Ban } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TradeWithDetails } from "@shared/schema";

export default function Trades({ highlightTradeId }: { highlightTradeId?: number } = {}) {
  const { user } = useAuth();
  const { currentLeague, selectedLeagueId } = useLeague();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [confirmAction, setConfirmAction] = useState<{ tradeId: number; action: "accept" | "reject" | "cancel" } | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  const leagueId = selectedLeagueId;

  const tradesQuery = useQuery<TradeWithDetails[]>({
    queryKey: ["/api/leagues", leagueId, "trades"],
    queryFn: () => fetch(`/api/leagues/${leagueId}/trades`).then(r => r.json()),
    enabled: !!leagueId,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ tradeId, action }: { tradeId: number; action: string }) => {
      if (action === "cancel") {
        const res = await apiRequest("POST", `/api/leagues/${leagueId}/trades/${tradeId}/cancel`);
        return res.json();
      }
      const res = await apiRequest("POST", `/api/leagues/${leagueId}/trades/${tradeId}/respond`, { action });
      return res.json();
    },
    onSuccess: (_, { action }) => {
      const msg = action === "accept" ? "Trade accepted! Rosters have been updated." : action === "reject" ? "Trade rejected." : "Trade cancelled.";
      toast({ title: "Done", description: msg });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "roster-assignments"] });
      setConfirmAction(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to respond to trade", variant: "destructive" });
      setConfirmAction(null);
    },
  });

  useEffect(() => {
    if (highlightTradeId && tradesQuery.data && !hasScrolled.current) {
      const trade = tradesQuery.data.find(t => t.id === highlightTradeId);
      if (trade && statusFilter !== "all" && statusFilter !== trade.status) {
        setStatusFilter("all");
      }
      setTimeout(() => {
        if (highlightRef.current) {
          highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
          hasScrolled.current = true;
        }
      }, 100);
    }
  }, [highlightTradeId, tradesQuery.data, statusFilter]);

  if (!currentLeague) {
    return (
      <div className="container mx-auto p-4">
        <Card><CardContent className="py-8 text-center text-muted-foreground">No active league selected.</CardContent></Card>
      </div>
    );
  }

  const filteredTrades = (tradesQuery.data || []).filter(t =>
    statusFilter === "all" || t.status === statusFilter
  );

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case "accepted": return <Badge className="bg-green-600 hover:bg-green-700 gap-1"><Check className="h-3 w-3" />Accepted</Badge>;
      case "rejected": return <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" />Rejected</Badge>;
      case "cancelled": return <Badge variant="secondary" className="gap-1"><Ban className="h-3 w-3" />Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="page-title">Trades</h1>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tradesQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : filteredTrades.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {statusFilter === "all" ? "No trades found." : `No ${statusFilter} trades.`}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTrades.map(trade => {
            const proposerName = trade.proposingUser.teamName || `${trade.proposingUser.firstName} ${trade.proposingUser.lastName}`;
            const partnerName = trade.partnerUser.teamName || `${trade.partnerUser.firstName} ${trade.partnerUser.lastName}`;
            const proposerSends = trade.items.filter(i => i.fromUserId === trade.proposingUserId);
            const partnerSends = trade.items.filter(i => i.fromUserId === trade.partnerUserId);
            const isPartner = user?.id === trade.partnerUserId;
            const isProposer = user?.id === trade.proposingUserId;
            const canRespond = isPartner && trade.status === "pending";
            const canCancel = isProposer && trade.status === "pending";

            return (
              <Card
                key={trade.id}
                ref={trade.id === highlightTradeId ? highlightRef : undefined}
                data-testid={`trade-card-${trade.id}`}
                className={trade.id === highlightTradeId ? "ring-2 ring-primary shadow-lg" : ""}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">
                        {proposerName} <ArrowLeftRight className="inline h-4 w-4 mx-1 text-muted-foreground" /> {partnerName}
                      </CardTitle>
                      {statusBadge(trade.status)}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(trade.proposedAt).toLocaleDateString()} {new Date(trade.proposedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">{proposerName} sends:</p>
                      <Table>
                        <TableBody>
                          {proposerSends.map(item => (
                            <TableRow key={item.id}>
                              <TableCell className="py-1.5 font-medium">{item.player.name}</TableCell>
                              <TableCell className="py-1.5 text-muted-foreground">{item.player.position || "-"}</TableCell>
                              <TableCell className="py-1.5">
                                <Badge variant={item.rosterType === "mlb" ? "default" : "secondary"} className="text-xs">{item.rosterType.toUpperCase()}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">{partnerName} sends:</p>
                      <Table>
                        <TableBody>
                          {partnerSends.map(item => (
                            <TableRow key={item.id}>
                              <TableCell className="py-1.5 font-medium">{item.player.name}</TableCell>
                              <TableCell className="py-1.5 text-muted-foreground">{item.player.position || "-"}</TableCell>
                              <TableCell className="py-1.5">
                                <Badge variant={item.rosterType === "mlb" ? "default" : "secondary"} className="text-xs">{item.rosterType.toUpperCase()}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {trade.notes && (
                    <div className="text-sm bg-muted/50 p-2 rounded border">
                      <span className="font-medium">Notes:</span> {trade.notes}
                    </div>
                  )}

                  {(canRespond || canCancel) && (
                    <div className="flex gap-2 pt-2 border-t">
                      {canRespond && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => setConfirmAction({ tradeId: trade.id, action: "accept" })}
                            data-testid={`button-accept-trade-${trade.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setConfirmAction({ tradeId: trade.id, action: "reject" })}
                            data-testid={`button-reject-trade-${trade.id}`}
                          >
                            <X className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmAction({ tradeId: trade.id, action: "cancel" })}
                          data-testid={`button-cancel-trade-${trade.id}`}
                        >
                          <Ban className="h-4 w-4 mr-1" /> Cancel Trade
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === "accept" ? "Accept Trade?" : confirmAction?.action === "reject" ? "Reject Trade?" : "Cancel Trade?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "accept"
                ? "Accepting this trade will immediately swap the selected players between rosters. This action cannot be undone."
                : confirmAction?.action === "reject"
                ? "This will reject the trade proposal. The proposer can submit a new one if needed."
                : "This will cancel your trade proposal."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-dialog-cancel">Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) {
                  respondMutation.mutate({ tradeId: confirmAction.tradeId, action: confirmAction.action });
                }
              }}
              className={confirmAction?.action === "accept" ? "bg-green-600 hover:bg-green-700" : ""}
              data-testid="button-dialog-confirm"
            >
              {respondMutation.isPending ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
