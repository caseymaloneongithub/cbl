import { useState, useMemo, useEffect } from "react";
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
import { Clock, Search, Trophy, Users, Loader2, CheckCircle, Building2, AlertTriangle, ListOrdered, ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import type { Draft, DraftRound, DraftPlayerWithDetails, DraftPickWithDetails, DraftOrder, User, AutoDraftListWithPlayer } from "@shared/schema";

interface TimingInfo {
  hasTiming: boolean;
  now: string;
  currentSlot?: DraftPickWithDetails | null;
  eligiblePickerIds?: string[];
  openSlotCount?: number;
}

const DRAFT_POLL_INTERVAL = 3000;

export default function DraftBoard() {
  const { draftId } = useParams<{ draftId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [pickDialogOpen, setPickDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<DraftPlayerWithDetails | null>(null);
  const [rosterType, setRosterType] = useState<string>("mlb");
  const [teamDraftDialogOpen, setTeamDraftDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [teamDraftRosterType, setTeamDraftRosterType] = useState<string>("milb");
  const [countdown, setCountdown] = useState<string>("");

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

  const { data: draftRounds } = useQuery<DraftRound[]>({
    queryKey: ["/api/drafts", draftIdNum, "rounds"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftIdNum}/rounds`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch rounds");
      return res.json();
    },
    enabled: !!draftIdNum,
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

  const { data: timingInfo } = useQuery<TimingInfo>({
    queryKey: ["/api/drafts", draftIdNum, "timing"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftIdNum}/timing`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch timing");
      return res.json();
    },
    enabled: !!draftIdNum && draft?.status === "active",
    refetchInterval: DRAFT_POLL_INTERVAL,
  });

  const nowMs = useMemo(() => {
    return timingInfo?.now ? new Date(timingInfo.now).getTime() : Date.now();
  }, [timingInfo]);

  const currentSlot = useMemo(() => {
    return timingInfo?.currentSlot || null;
  }, [timingInfo]);

  const currentRoundConfig = useMemo(() => {
    if (!currentSlot || !draftRounds) return null;
    return draftRounds.find(r => r.roundNumber === currentSlot.round) || null;
  }, [currentSlot, draftRounds]);

  const isTeamDraftRound = currentRoundConfig?.isTeamDraft === true;

  const currentTeam = useMemo(() => {
    if (!currentSlot || !picks) return null;
    return picks.find((p) => p.id === currentSlot.id) || null;
  }, [currentSlot, picks]);

  const isMyTurn = useMemo(() => {
    if (!currentTeam || !user) return false;
    return currentTeam.userId === user.id;
  }, [currentTeam, user]);

  const isEligibleByTiming = useMemo(() => {
    if (!timingInfo?.hasTiming || !user) return false;
    return timingInfo.eligiblePickerIds?.includes(user.id) || false;
  }, [timingInfo, user]);

  const canPick = useMemo(() => {
    if (!draft || draft.status !== "active") return false;
    if (isMyTurn) return true;
    if (user?.isCommissioner || user?.isSuperAdmin) return true;
    if (isEligibleByTiming) return true;
    return false;
  }, [draft, isMyTurn, user, isEligibleByTiming]);

  useEffect(() => {
    if (!currentSlot) {
      setCountdown("");
      return;
    }
    const deadline = new Date(currentSlot.deadlineAt).getTime();
    const updateCountdown = () => {
      const now = Date.now();
      const diff = deadline - now;
      if (diff <= 0) {
        setCountdown("Expired");
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${seconds}s`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [currentSlot]);

  const filledPicks = useMemo(() => {
    return (picks || []).filter((slot) => !!slot.madeAt);
  }, [picks]);

  const myOpenSlots = useMemo(() => {
    if (!user || !picks) return [];
    return picks
      .filter((slot) =>
        slot.userId === user.id &&
        !slot.madeAt &&
        new Date(slot.scheduledAt).getTime() <= nowMs)
      .sort((a, b) => a.overallPickNumber - b.overallPickNumber);
  }, [user, picks, nowMs]);

  const availableOrgs = useMemo(() => {
    if (!availablePlayers) return [];
    const claimed = new Set((picks || []).map((s) => s.selectedOrgName).filter(Boolean));
    const orgs: string[] = [];
    const seen: Record<string, boolean> = {};
    availablePlayers.forEach(dp => {
      if (dp.player.parentOrgName && !claimed.has(dp.player.parentOrgName) && !seen[dp.player.parentOrgName]) {
        seen[dp.player.parentOrgName] = true;
        orgs.push(dp.player.parentOrgName);
      }
    });
    return orgs.sort();
  }, [availablePlayers, picks]);

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

  const makeTeamDraftPick = useMutation({
    mutationFn: async ({ parentOrgName, rosterType }: { parentOrgName: string; rosterType: string }) => {
      const res = await apiRequest("POST", `/api/drafts/${draftIdNum}/pick`, { parentOrgName, rosterType });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Team Draft Pick", description: `Drafted ${data.playersDrafted} players from ${data.orgName}` });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "picks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "order"] });
      setTeamDraftDialogOpen(false);
      setSelectedOrg("");
      setTeamDraftRosterType("milb");
    },
    onError: (error: Error) => {
      toast({ title: "Team Draft Pick failed", description: error.message, variant: "destructive" });
    },
  });

  const { data: autoDraftList } = useQuery<AutoDraftListWithPlayer[]>({
    queryKey: ["/api/drafts", draftIdNum, "auto-draft-list"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftIdNum}/auto-draft-list`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch auto-draft list");
      return res.json();
    },
    enabled: !!draftIdNum,
    refetchInterval: DRAFT_POLL_INTERVAL,
  });

  const autoDraftListIds = useMemo(() => {
    if (!autoDraftList) return new Set<number>();
    return new Set(autoDraftList.map(item => item.mlbPlayerId));
  }, [autoDraftList]);

  const addToAutoDraft = useMutation({
    mutationFn: async ({ mlbPlayerId, rosterType }: { mlbPlayerId: number; rosterType: string }) => {
      await apiRequest("POST", `/api/drafts/${draftIdNum}/auto-draft-list`, { mlbPlayerId, rosterType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "auto-draft-list"] });
      toast({ title: "Added to auto-draft list" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add", description: error.message, variant: "destructive" });
    },
  });

  const removeFromAutoDraft = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("DELETE", `/api/drafts/${draftIdNum}/auto-draft-list/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "auto-draft-list"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
    },
  });

  const reorderAutoDraft = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      await apiRequest("PUT", `/api/drafts/${draftIdNum}/auto-draft-list/reorder`, { orderedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "auto-draft-list"] });
    },
  });

  const moveAutoDraftItem = (index: number, direction: "up" | "down") => {
    if (!autoDraftList) return;
    const newList = [...autoDraftList];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newList.length) return;
    [newList[index], newList[swapIndex]] = [newList[swapIndex], newList[index]];
    reorderAutoDraft.mutate(newList.map(item => item.id));
  };

  const handlePickClick = (player: DraftPlayerWithDetails) => {
    setSelectedPlayer(player);
    setRosterType("mlb");
    setPickDialogOpen(true);
  };

  const handleConfirmPick = () => {
    if (!selectedPlayer) return;
    makePick.mutate({ mlbPlayerId: selectedPlayer.mlbPlayerId, rosterType });
  };

  const handleTeamDraftClick = () => {
    setSelectedOrg("");
    setTeamDraftRosterType("milb");
    setTeamDraftDialogOpen(true);
  };

  const handleConfirmTeamDraft = () => {
    if (!selectedOrg) return;
    makeTeamDraftPick.mutate({ parentOrgName: selectedOrg, rosterType: teamDraftRosterType });
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
                  {filledPicks.map((pick) => (
                    <TableRow key={pick.id} data-testid={`row-pick-${pick.id}`}>
                      <TableCell className="font-mono">{pick.overallPickNumber}</TableCell>
                      <TableCell className="font-mono">{pick.round}</TableCell>
                      <TableCell className="font-medium">{pick.user.teamName || `${pick.user.firstName} ${pick.user.lastName}`}</TableCell>
                      <TableCell className="font-medium">{pick.player?.fullName || pick.selectedOrgName || "-"}</TableCell>
                      <TableCell>{pick.player?.primaryPosition || (pick.selectedOrgName ? "Org Claim" : "-")}</TableCell>
                      <TableCell className="text-muted-foreground">{pick.player?.currentTeamName || pick.player?.parentOrgName || pick.selectedOrgName || "-"}</TableCell>
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

  const roundName = currentRoundConfig?.name || (currentSlot ? `Round ${currentSlot.round}` : "Draft");
  const picksMade = filledPicks.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold" data-testid="text-draft-name">{draft.name}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant={draft.status === "active" ? "default" : "secondary"} data-testid="badge-draft-status">
            {draft.status === "active" ? "Live" : draft.status}
          </Badge>
          <span className="text-muted-foreground text-sm" data-testid="text-round-info">
            {currentSlot ? `${roundName} (Round ${currentSlot.round} of ${draft.rounds})` : "Waiting for first slot to open"}
          </span>
          <span className="text-muted-foreground text-sm">
            {currentSlot ? `Overall Pick ${currentSlot.overallPickNumber}` : "No active slot"}
          </span>
          {isTeamDraftRound && (
            <Badge variant="secondary" data-testid="badge-team-draft-round">
              <Building2 className="h-3 w-3 mr-1" />
              Team Draft Round
            </Badge>
          )}
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
              {countdown && (
                <Badge
                  variant={countdown === "Expired" ? "destructive" : "outline"}
                  className="ml-auto text-sm font-mono"
                  data-testid="badge-countdown"
                >
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  {countdown === "Expired" ? (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Time Expired
                    </span>
                  ) : countdown}
                </Badge>
              )}
            </div>
            {isTeamDraftRound && (
              <p className="text-sm text-muted-foreground mt-2">
                This is a team draft round. Pick an MLB organization to draft all remaining affiliated players.
              </p>
            )}
            {!canPick && (
              <p className="text-muted-foreground mt-2" data-testid="text-waiting">
                Waiting for {currentTeam.user.teamName || `${currentTeam.user.firstName} ${currentTeam.user.lastName}`} to pick...
              </p>
            )}
            {canPick && !isMyTurn && isEligibleByTiming && (
              <p className="text-sm text-primary mt-2" data-testid="text-your-turn-eligible">
                Your pick window is open - you can make your selection now.
              </p>
            )}
            {canPick && isTeamDraftRound && (
              <Button className="mt-3" onClick={handleTeamDraftClick} data-testid="button-team-draft-pick">
                <Building2 className="h-4 w-4 mr-2" />
                Select Organization
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {draft.status === "active" && !currentTeam && (!picks || picks.length === 0) && (
        <Card className="mb-6">
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Draft Slots Not Generated</h3>
            <p className="text-muted-foreground">The commissioner must start the draft after configuring rounds and order.</p>
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
              <CardTitle className="text-lg">
                {isTeamDraftRound ? "Available Organizations" : "Available Players"}
              </CardTitle>
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
              {isTeamDraftRound && draft.status === "active" ? (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  {availableOrgs.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No available organizations remaining.</div>
                  ) : (
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Organization</TableHead>
                          <TableHead className="font-semibold text-center">Available Players</TableHead>
                          {canPick && <TableHead className="font-semibold text-right">Action</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableOrgs.map(org => {
                          const orgPlayerCount = availablePlayers?.filter(p => p.player.parentOrgName === org).length || 0;
                          return (
                            <TableRow key={org} data-testid={`row-org-${org.replace(/\s/g, '-')}`}>
                              <TableCell className="font-medium">{org}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">{orgPlayerCount}</Badge>
                              </TableCell>
                              {canPick && (
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedOrg(org);
                                      setTeamDraftRosterType("milb");
                                      setTeamDraftDialogOpen(true);
                                    }}
                                    data-testid={`button-draft-org-${org.replace(/\s/g, '-')}`}
                                  >
                                    Draft
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ) : loadingPlayers ? (
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
                        {!isTeamDraftRound && <TableHead className="font-semibold text-right">Action</TableHead>}
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
                          {!isTeamDraftRound && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {canPick && (
                                  <Button
                                    size="sm"
                                    onClick={() => handlePickClick(dp)}
                                    data-testid={`button-pick-${dp.id}`}
                                  >
                                    Pick
                                  </Button>
                                )}
                                {draft?.status !== "completed" && !autoDraftListIds.has(dp.mlbPlayerId) && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => addToAutoDraft.mutate({ mlbPlayerId: dp.mlbPlayerId, rosterType: "mlb" })}
                                    disabled={addToAutoDraft.isPending}
                                    data-testid={`button-auto-draft-add-${dp.id}`}
                                    title="Add to auto-draft list"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                                {autoDraftListIds.has(dp.mlbPlayerId) && (
                                  <Badge variant="secondary" className="text-xs">
                                    <ListOrdered className="h-3 w-3 mr-1" />
                                    Queued
                                  </Badge>
                                )}
                              </div>
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
              {!filledPicks.length ? (
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
                      {[...filledPicks].reverse().map((pick) => (
                        <TableRow key={pick.id} data-testid={`row-pick-${pick.id}`}>
                          <TableCell className="font-mono text-xs">
                            {pick.round}.{pick.roundPickIndex + 1}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {pick.user.teamName || `${pick.user.firstName}`}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{pick.player?.fullName || pick.selectedOrgName || "-"}</div>
                            <div className="text-xs text-muted-foreground">
                              {pick.player
                                ? `${pick.player.primaryPosition} - ${pick.player.currentTeamName || pick.player.parentOrgName}`
                                : pick.selectedOrgName
                                  ? `Organization claim (${pick.selectedOrgPlayerIds?.length || 0} players)`
                                  : "-"}
                            </div>
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

          {draft.status !== "completed" && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Your Open Picks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold">{myOpenSlots.length}</div>
                <p className="text-sm text-muted-foreground">Eligible open slots (scheduled and unfilled).</p>
                {myOpenSlots.slice(0, 3).map((slot) => (
                  <div key={slot.id} className="text-sm text-muted-foreground">
                    Pick {slot.overallPickNumber} due {new Date(slot.deadlineAt).toLocaleString()}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {!!picks?.length && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Slot Board</CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[360px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow className="bg-muted/50">
                      <TableHead>#</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {picks.map((slot) => (
                      <TableRow key={slot.id} className={currentSlot?.id === slot.id ? "bg-primary/10" : ""}>
                        <TableCell className="font-mono text-xs">{slot.overallPickNumber}</TableCell>
                        <TableCell className="text-sm">{slot.user.teamName || slot.user.firstName || slot.user.lastName || slot.user.id}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(slot.scheduledAt).toLocaleString()}</TableCell>
                        <TableCell>
                          {slot.madeAt
                            ? <Badge variant="secondary" className="text-xs">Filled</Badge>
                            : (new Date(slot.scheduledAt).getTime() <= nowMs
                              ? <Badge variant="default" className="text-xs">Open</Badge>
                              : <Badge variant="outline" className="text-xs">Upcoming</Badge>)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {draft.status !== "completed" && (
            <Card className="mt-4">
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListOrdered className="h-5 w-5" />
                  Auto-Draft List
                </CardTitle>
                {autoDraftList && autoDraftList.length > 0 && (
                  <Badge variant="secondary" data-testid="badge-auto-draft-count">{autoDraftList.length}</Badge>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {!autoDraftList?.length ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No players in your auto-draft list. Use the + button on available players to add them.
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold w-8">#</TableHead>
                          <TableHead className="font-semibold">Player</TableHead>
                          <TableHead className="font-semibold">Roster</TableHead>
                          <TableHead className="font-semibold text-right w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {autoDraftList.map((item, idx) => (
                          <TableRow key={item.id} data-testid={`row-auto-draft-${item.id}`}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{item.player.fullName}</div>
                              <div className="text-xs text-muted-foreground">{item.player.primaryPosition} - {item.player.currentTeamName || item.player.parentOrgName}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.rosterType === "mlb" ? "default" : "outline"} className="text-xs">
                                {item.rosterType === "mlb" ? "MLB" : "MiLB"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-0">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => moveAutoDraftItem(idx, "up")}
                                  disabled={idx === 0 || reorderAutoDraft.isPending}
                                  data-testid={`button-auto-draft-up-${item.id}`}
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => moveAutoDraftItem(idx, "down")}
                                  disabled={idx === autoDraftList.length - 1 || reorderAutoDraft.isPending}
                                  data-testid={`button-auto-draft-down-${item.id}`}
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeFromAutoDraft.mutate(item.id)}
                                  disabled={removeFromAutoDraft.isPending}
                                  data-testid={`button-auto-draft-remove-${item.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
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

      <Dialog open={teamDraftDialogOpen} onOpenChange={setTeamDraftDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Team Draft Pick</DialogTitle>
            <DialogDescription>
              Select an MLB organization to draft all their remaining affiliated players for {currentTeam?.user.teamName || "your team"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">MLB Organization</label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger data-testid="select-org">
                  <SelectValue placeholder="Select an organization..." />
                </SelectTrigger>
                <SelectContent>
                  {availableOrgs.map(org => {
                    const count = availablePlayers?.filter(p => p.player.parentOrgName === org).length || 0;
                    return (
                      <SelectItem key={org} value={org}>
                        {org} ({count} players)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Roster Assignment</label>
              <Select value={teamDraftRosterType} onValueChange={setTeamDraftRosterType}>
                <SelectTrigger data-testid="select-team-draft-roster-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mlb">MLB Roster</SelectItem>
                  <SelectItem value="milb">MiLB System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedOrg && (
              <div className="bg-muted/50 rounded-md p-3">
                <p className="text-sm font-medium mb-1">Players to be drafted:</p>
                <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto">
                  {availablePlayers
                    ?.filter(p => p.player.parentOrgName === selectedOrg)
                    .map(p => (
                      <div key={p.id}>{p.player.fullName} - {p.player.primaryPosition}</div>
                    ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTeamDraftDialogOpen(false)} data-testid="button-cancel-team-draft">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmTeamDraft}
              disabled={makeTeamDraftPick.isPending || !selectedOrg}
              data-testid="button-confirm-team-draft"
            >
              {makeTeamDraftPick.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Draft Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
