import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Clock, Search, Trophy, Users, Loader2, CheckCircle } from "lucide-react";
import type { Draft, DraftPlayerWithDetails, DraftPickWithDetails, DraftOrder, User } from "@shared/schema";

const DRAFT_POLL_INTERVAL = 3000;

export default function DraftBoard() {
  const { draftId } = useParams<{ draftId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [pickDialogOpen, setPickDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<DraftPlayerWithDetails | null>(null);
  const [rosterType, setRosterType] = useState<string>("mlb");

  const draftIdNum = draftId ? parseInt(draftId, 10) : null;

  const { data: draft, isLoading: loadingDraft } = useQuery<Draft>({
    queryKey: ["/api/drafts", draftIdNum],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftIdNum}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch draft");
      return res.json();
    },
    enabled: !!draftIdNum,
    refetchInterval: DRAFT_POLL_INTERVAL,
  });

  const { data: draftOrderData } = useQuery<(DraftOrder & { user: User })[]>({
    queryKey: ["/api/drafts", draftIdNum, "order"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftIdNum}/order`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch order");
      return res.json();
    },
    enabled: !!draftIdNum,
    refetchInterval: DRAFT_POLL_INTERVAL,
  });

  const { data: picks } = useQuery<DraftPickWithDetails[]>({
    queryKey: ["/api/drafts", draftIdNum, "picks"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftIdNum}/picks`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch picks");
      return res.json();
    },
    enabled: !!draftIdNum,
    refetchInterval: DRAFT_POLL_INTERVAL,
  });

  const { data: availablePlayers, isLoading: loadingPlayers } = useQuery<DraftPlayerWithDetails[]>({
    queryKey: ["/api/drafts", draftIdNum, "players", { status: "available", search }],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "available" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/drafts/${draftIdNum}/players?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch players");
      return res.json();
    },
    enabled: !!draftIdNum,
    refetchInterval: DRAFT_POLL_INTERVAL,
  });

  const sortedOrder = useMemo(() => {
    if (!draftOrderData) return [];
    return [...draftOrderData].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [draftOrderData]);

  const currentTeam = useMemo(() => {
    if (!draft || !sortedOrder.length || draft.status !== "active") return null;
    const round = draft.currentRound;
    const pickIndex = draft.currentPickIndex;
    const isEvenRound = round % 2 === 0;
    const order = isEvenRound ? [...sortedOrder].reverse() : sortedOrder;
    return order[pickIndex] || null;
  }, [draft, sortedOrder]);

  const isMyTurn = useMemo(() => {
    if (!currentTeam || !user) return false;
    return currentTeam.userId === user.id;
  }, [currentTeam, user]);

  const canPick = useMemo(() => {
    if (!draft || draft.status !== "active") return false;
    if (isMyTurn) return true;
    if (user?.isCommissioner || user?.isSuperAdmin) return true;
    return false;
  }, [draft, isMyTurn, user]);

  const makePick = useMutation({
    mutationFn: async ({ mlbPlayerId, rosterType }: { mlbPlayerId: number; rosterType: string }) => {
      await apiRequest("POST", `/api/drafts/${draftIdNum}/pick`, { mlbPlayerId, rosterType });
    },
    onSuccess: () => {
      toast({ title: "Pick made", description: `${selectedPlayer?.player.fullName} has been drafted.` });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "picks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "order"] });
      setPickDialogOpen(false);
      setSelectedPlayer(null);
      setRosterType("mlb");
    },
    onError: (error: Error) => {
      toast({ title: "Pick failed", description: error.message, variant: "destructive" });
    },
  });

  const handlePickClick = (player: DraftPlayerWithDetails) => {
    setSelectedPlayer(player);
    setRosterType("mlb");
    setPickDialogOpen(true);
  };

  const handleConfirmPick = () => {
    if (!selectedPlayer) return;
    makePick.mutate({ mlbPlayerId: selectedPlayer.mlbPlayerId, rosterType });
  };

  if (loadingDraft) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-24 w-full mb-6" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2"><Skeleton className="h-96 w-full" /></div>
          <div><Skeleton className="h-96 w-full" /></div>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Draft Not Found</h3>
            <p className="text-muted-foreground">This draft does not exist or you don't have access.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (draft.status === "completed") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" data-testid="text-draft-name">{draft.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="secondary" data-testid="badge-draft-status">
              <CheckCircle className="h-3 w-3 mr-1" />
              Completed
            </Badge>
            <span className="text-muted-foreground text-sm">{draft.rounds} rounds</span>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Final Results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Pick</TableHead>
                    <TableHead className="font-semibold">Rd</TableHead>
                    <TableHead className="font-semibold">Team</TableHead>
                    <TableHead className="font-semibold">Player</TableHead>
                    <TableHead className="font-semibold">Pos</TableHead>
                    <TableHead className="font-semibold">MLB Team</TableHead>
                    <TableHead className="font-semibold">Roster</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {picks?.map((pick) => (
                    <TableRow key={pick.id} data-testid={`row-pick-${pick.id}`}>
                      <TableCell className="font-mono">{pick.pickNumber}</TableCell>
                      <TableCell className="font-mono">{pick.round}</TableCell>
                      <TableCell className="font-medium">{pick.user.teamName || `${pick.user.firstName} ${pick.user.lastName}`}</TableCell>
                      <TableCell className="font-medium">{pick.player.fullName}</TableCell>
                      <TableCell>{pick.player.primaryPosition}</TableCell>
                      <TableCell className="text-muted-foreground">{pick.player.currentTeamName || pick.player.parentOrgName}</TableCell>
                      <TableCell>
                        <Badge variant={pick.rosterType === "mlb" ? "default" : "outline"}>
                          {pick.rosterType === "mlb" ? "MLB" : "MiLB"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalPicks = sortedOrder.length * draft.rounds;
  const picksMade = picks?.length || 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold" data-testid="text-draft-name">{draft.name}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant={draft.status === "active" ? "default" : "secondary"} data-testid="badge-draft-status">
            {draft.status === "active" ? "Live" : draft.status}
          </Badge>
          <span className="text-muted-foreground text-sm" data-testid="text-round-info">
            Round {draft.currentRound} of {draft.rounds}
          </span>
          <span className="text-muted-foreground text-sm">
            Pick {picksMade + 1} of {totalPicks}
          </span>
        </div>
      </div>

      {draft.status === "active" && currentTeam && (
        <Card className="mb-6 border-primary">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg" data-testid="text-on-the-clock">On the Clock:</span>
              <span className="text-lg font-bold text-primary" data-testid="text-current-team">
                {currentTeam.user.teamName || `${currentTeam.user.firstName} ${currentTeam.user.lastName}`}
              </span>
              {isMyTurn && (
                <Badge variant="default" data-testid="badge-your-pick">Your Pick</Badge>
              )}
            </div>
            {!canPick && (
              <p className="text-muted-foreground mt-2" data-testid="text-waiting">
                Waiting for {currentTeam.user.teamName || `${currentTeam.user.firstName} ${currentTeam.user.lastName}`} to pick...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {draft.status === "setup" && (
        <Card className="mb-6">
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Draft Not Started</h3>
            <p className="text-muted-foreground">The commissioner has not started this draft yet.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="text-lg">Available Players</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search players..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-players"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingPlayers ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : !availablePlayers?.length ? (
                <div className="p-8 text-center text-muted-foreground">
                  {search ? "No players match your search." : "No available players remaining."}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Player</TableHead>
                        <TableHead className="font-semibold">Pos</TableHead>
                        <TableHead className="font-semibold">Team</TableHead>
                        <TableHead className="font-semibold">Level</TableHead>
                        {canPick && <TableHead className="font-semibold text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availablePlayers.map((dp) => (
                        <TableRow key={dp.id} data-testid={`row-player-${dp.id}`}>
                          <TableCell className="font-medium">{dp.player.fullName}</TableCell>
                          <TableCell>{dp.player.primaryPosition}</TableCell>
                          <TableCell className="text-muted-foreground">{dp.player.currentTeamName || dp.player.parentOrgName || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{dp.player.sportLevel}</Badge>
                          </TableCell>
                          {canPick && (
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => handlePickClick(dp)}
                                data-testid={`button-pick-${dp.id}`}
                              >
                                Pick
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Pick History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!picks?.length ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No picks made yet.</div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">#</TableHead>
                        <TableHead className="font-semibold">Team</TableHead>
                        <TableHead className="font-semibold">Player</TableHead>
                        <TableHead className="font-semibold">Roster</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...picks].reverse().map((pick) => (
                        <TableRow key={pick.id} data-testid={`row-pick-${pick.id}`}>
                          <TableCell className="font-mono text-xs">
                            {pick.round}.{pick.pickNumber}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {pick.user.teamName || `${pick.user.firstName}`}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{pick.player.fullName}</div>
                            <div className="text-xs text-muted-foreground">{pick.player.primaryPosition} - {pick.player.currentTeamName || pick.player.parentOrgName}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={pick.rosterType === "mlb" ? "default" : "outline"} className="text-xs">
                              {pick.rosterType === "mlb" ? "MLB" : "MiLB"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {sortedOrder.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Draft Order</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {sortedOrder.map((entry, idx) => (
                      <TableRow
                        key={entry.id}
                        className={currentTeam?.userId === entry.userId ? "bg-primary/10" : ""}
                        data-testid={`row-order-${entry.id}`}
                      >
                        <TableCell className="font-mono text-sm">{idx + 1}</TableCell>
                        <TableCell className="font-medium text-sm">
                          {entry.user.teamName || `${entry.user.firstName} ${entry.user.lastName}`}
                          {currentTeam?.userId === entry.userId && (
                            <Badge variant="default" className="ml-2 text-xs">Current</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={pickDialogOpen} onOpenChange={setPickDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Pick</DialogTitle>
            <DialogDescription>
              Select this player for {currentTeam?.user.teamName || "your team"}.
            </DialogDescription>
          </DialogHeader>
          {selectedPlayer && (
            <div className="space-y-4 py-2">
              <div>
                <div className="font-semibold text-lg" data-testid="text-pick-player-name">{selectedPlayer.player.fullName}</div>
                <div className="text-muted-foreground text-sm">
                  {selectedPlayer.player.primaryPosition} - {selectedPlayer.player.currentTeamName || selectedPlayer.player.parentOrgName}
                </div>
                <div className="text-muted-foreground text-xs mt-1">
                  Level: {selectedPlayer.player.sportLevel}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Roster Assignment</label>
                <Select value={rosterType} onValueChange={setRosterType}>
                  <SelectTrigger data-testid="select-roster-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mlb">MLB Roster</SelectItem>
                    <SelectItem value="milb">MiLB System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPickDialogOpen(false)} data-testid="button-cancel-pick">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPick}
              disabled={makePick.isPending}
              data-testid="button-confirm-pick"
            >
              {makePick.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Pick
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
