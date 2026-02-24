import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
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
import { formatAffiliatedTeamLabel } from "@/lib/teamDisplay";
import { stripAccents } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Clock, Search, Trophy, Users, Loader2, CheckCircle, Building2, AlertTriangle, ListOrdered, ArrowUp, ArrowDown, Plus, Trash2, Pause, Play } from "lucide-react";
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
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { currentLeague, selectedLeagueId, isLeagueCommissioner } = useLeague();
  const { toast } = useToast();
  const [playerSearch, setPlayerSearch] = useState("");
  const [orgSearch, setOrgSearch] = useState("");
  const [pickDialogOpen, setPickDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<DraftPlayerWithDetails | null>(null);
  const [rosterType, setRosterType] = useState<string>("milb");
  const [autoDraftRosterType, setAutoDraftRosterType] = useState<string>("milb");
  const [teamDraftDialogOpen, setTeamDraftDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [teamDraftRosterType, setTeamDraftRosterType] = useState<string>("milb");
  const [countdown, setCountdown] = useState<string>("");
  const [autoDraftSearch, setAutoDraftSearch] = useState("");

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
    queryKey: ["/api/drafts", draftIdNum, "players", { status: "available", search: playerSearch }],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "available" });
      if (playerSearch) params.set("search", playerSearch);
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
  const filteredOrgs = useMemo(() => {
    const needle = stripAccents(orgSearch.trim().toLowerCase());
    if (!needle) return availableOrgs;
    return availableOrgs.filter((org) => stripAccents(org.toLowerCase()).includes(needle));
  }, [availableOrgs, orgSearch]);

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

  const autoDraftCandidatePlayers = useMemo(() => {
    const needle = stripAccents(autoDraftSearch.trim().toLowerCase());
    if (!availablePlayers?.length) return [] as DraftPlayerWithDetails[];
    return availablePlayers
      .filter((dp) => !autoDraftListIds.has(dp.mlbPlayerId))
      .filter((dp) => {
        if (!needle) return true;
        return [
          dp.player.fullName,
          dp.player.primaryPosition,
          dp.player.currentTeamName,
          dp.player.parentOrgName,
        ].some((value) => stripAccents((value || "").toLowerCase()).includes(needle));
      })
      .slice(0, 8);
  }, [availablePlayers, autoDraftListIds, autoDraftSearch]);

  const addToAutoDraft = useMutation({
    mutationFn: async ({ mlbPlayerId, rosterType }: { mlbPlayerId: number; rosterType: string }) => {
      await apiRequest("POST", `/api/drafts/${draftIdNum}/auto-draft-list`, { mlbPlayerId, rosterType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "auto-draft-list"] });
      toast({ title: "Added to auto-draft list", description: `Queued as ${autoDraftRosterType.toUpperCase()}` });
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

  const clearAutoDraft = useMutation({
    mutationFn: async () => {
      if (!autoDraftList?.length) return;
      await Promise.all(
        autoDraftList.map((item) => apiRequest("DELETE", `/api/drafts/${draftIdNum}/auto-draft-list/${item.id}`)),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "auto-draft-list"] });
      toast({ title: "Auto-draft list cleared" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to clear list", description: error.message, variant: "destructive" });
    },
  });

  const pauseDraft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/drafts/${draftIdNum}/pause`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", { leagueId: selectedLeagueId }] });
      toast({ title: "Draft Paused" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resumeDraft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/drafts/${draftIdNum}/resume`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", { leagueId: selectedLeagueId }] });
      toast({ title: "Draft Resumed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
            <p className="text-muted-foreground">This draft does not exist in your current league context, or you do not have access.</p>
            <p className="text-sm text-muted-foreground mt-2">Current league: {currentLeague?.name || "Not selected"} (ID {selectedLeagueId || "?"})</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/drafts")} data-testid="button-back-drafts">
              Back to Drafts
            </Button>
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
                      <TableCell className="text-muted-foreground">
                        {pick.player
                          ? formatAffiliatedTeamLabel({
                              currentTeamName: pick.player.currentTeamName,
                              parentOrgName: pick.player.parentOrgName,
                              sportLevel: pick.player.sportLevel,
                            })
                          : (pick.selectedOrgName || "-")}
                      </TableCell>
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
          <Badge variant={draft.status === "active" ? "default" : draft.status === "paused" ? "destructive" : "secondary"} data-testid="badge-draft-status">
            {draft.status === "active" ? "Live" : draft.status === "paused" ? "Paused" : draft.status}
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
          {isLeagueCommissioner && draft.status === "active" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-pause-draft">
                  <Pause className="h-3 w-3 mr-1" />Pause
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Pause Draft</AlertDialogTitle>
                  <AlertDialogDescription>This will pause the draft. No picks can be made while paused. You can resume at any time.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => pauseDraft.mutate()} data-testid="button-confirm-pause-draft">
                    {pauseDraft.isPending ? "Pausing..." : "Pause Draft"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isLeagueCommissioner && draft.status === "paused" && (
            <Button size="sm" onClick={() => resumeDraft.mutate()} disabled={resumeDraft.isPending} data-testid="button-resume-draft">
              {resumeDraft.isPending ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Resuming...</> : <><Play className="h-3 w-3 mr-1" />Resume</>}
            </Button>
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
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={isTeamDraftRound ? "Search organizations..." : "Search players..."}
                    value={isTeamDraftRound ? orgSearch : playerSearch}
                    onChange={(e) => isTeamDraftRound ? setOrgSearch(e.target.value) : setPlayerSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-players"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isTeamDraftRound && draft.status === "active" ? (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  {filteredOrgs.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      {orgSearch ? "No organizations match your search." : "No available organizations remaining."}
                    </div>
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
                        {filteredOrgs.map(org => {
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
                  {playerSearch ? "No players match your search." : "No available players remaining."}
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
                          <TableCell className="text-muted-foreground">
                            {formatAffiliatedTeamLabel({
                              currentTeamName: dp.player.currentTeamName,
                              parentOrgName: dp.player.parentOrgName,
                              sportLevel: dp.player.sportLevel,
                            })}
                          </TableCell>
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
                                    size="sm"
                                    variant="outline"
                                    onClick={() => addToAutoDraft.mutate({ mlbPlayerId: dp.mlbPlayerId, rosterType: autoDraftRosterType })}
                                    disabled={addToAutoDraft.isPending}
                                    data-testid={`button-auto-draft-add-${dp.id}`}
                                    title={`Add to auto-draft list as ${autoDraftRosterType.toUpperCase()}`}
                                  >
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    Queue
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
                                ? `${pick.player.primaryPosition} - ${formatAffiliatedTeamLabel({
                                    currentTeamName: pick.player.currentTeamName,
                                    parentOrgName: pick.player.parentOrgName,
                                    sportLevel: pick.player.sportLevel,
                                  })}`
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
              <CardHeader className="pb-3 space-y-3">
                <div className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ListOrdered className="h-5 w-5" />
                    Auto-Draft List
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {autoDraftList && autoDraftList.length > 0 && (
                      <Badge variant="secondary" data-testid="badge-auto-draft-count">{autoDraftList.length}</Badge>
                    )}
                    {!!autoDraftList?.length && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => clearAutoDraft.mutate()}
                        disabled={clearAutoDraft.isPending}
                        data-testid="button-auto-draft-clear"
                      >
                        {clearAutoDraft.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Set your priority order here. When you are on the clock, the system takes the highest available player in this list.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={autoDraftSearch}
                      onChange={(e) => setAutoDraftSearch(e.target.value)}
                      placeholder="Search players to queue..."
                      className="pl-9"
                      data-testid="input-auto-draft-search"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!!autoDraftSearch && (
                  <div className="border-t border-b p-2 space-y-1">
                    {autoDraftCandidatePlayers.length === 0 ? (
                      <div className="px-2 py-1 text-xs text-muted-foreground">
                        No matching available players found.
                      </div>
                    ) : (
                      autoDraftCandidatePlayers.map((dp) => (
                        <div
                          key={dp.id}
                          className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                          data-testid={`row-auto-draft-candidate-${dp.id}`}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{dp.player.fullName}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {dp.player.primaryPosition} - {formatAffiliatedTeamLabel({
                                currentTeamName: dp.player.currentTeamName,
                                parentOrgName: dp.player.parentOrgName,
                                sportLevel: dp.player.sportLevel,
                              })}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addToAutoDraft.mutate({ mlbPlayerId: dp.mlbPlayerId, rosterType: autoDraftRosterType })}
                            disabled={addToAutoDraft.isPending}
                            data-testid={`button-auto-draft-candidate-add-${dp.id}`}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Queue
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
                {!autoDraftList?.length ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No players in your auto-draft list yet. Search above or use Queue in the available players table.
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
                              <div className="text-xs text-muted-foreground">
                                {item.player.primaryPosition} - {formatAffiliatedTeamLabel({
                                  currentTeamName: item.player.currentTeamName,
                                  parentOrgName: item.player.parentOrgName,
                                  sportLevel: item.player.sportLevel,
                                })}
                              </div>
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
                  {selectedPlayer.player.primaryPosition} - {formatAffiliatedTeamLabel({
                    currentTeamName: selectedPlayer.player.currentTeamName,
                    parentOrgName: selectedPlayer.player.parentOrgName,
                    sportLevel: selectedPlayer.player.sportLevel,
                  })}
                </div>
                <div className="text-muted-foreground text-xs mt-1">
                  Level: {selectedPlayer.player.sportLevel}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Player will be added to the MiLB roster.
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
            <div className="text-xs text-muted-foreground">
              All drafted players will be added to the MiLB roster.
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
