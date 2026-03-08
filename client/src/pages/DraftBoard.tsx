import { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
import { formatAffiliatedTeamLabel, getMlbAffiliationAbbreviation } from "@/lib/teamDisplay";
import { stripAccents } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Search, Users, Loader2, CheckCircle, Building2, AlertTriangle, ListOrdered, ArrowUp, ArrowDown, Plus, Trash2, Pause, Play, Bell, BellOff, Upload, Download, Pencil, Shield } from "lucide-react";
import type { Draft, DraftRound, DraftPlayerWithDetails, DraftPickWithDetails, DraftOrder, User, AutoDraftListWithPlayer, TeamAutoDraftList } from "@shared/schema";


interface TimingInfo {
  hasTiming: boolean;
  now: string;
  currentSlot?: DraftPickWithDetails | null;
  eligiblePickerIds?: string[];
  openSlotCount?: number;
  skippedTeams?: { userId: string; teamName: string }[];
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
  const [startCountdown, setStartCountdown] = useState<string>("");
  const [autoDraftSearch, setAutoDraftSearch] = useState("");
  const [teamAutoDraftSearch, setTeamAutoDraftSearch] = useState("");
  const [teamAutoDraftRosterType, setTeamAutoDraftRosterType] = useState<string>("milb");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [commPickUserId, setCommPickUserId] = useState("");
  const [commPickSearch, setCommPickSearch] = useState("");
  const [commPickSelectedPlayer, setCommPickSelectedPlayer] = useState<DraftPlayerWithDetails | null>(null);
  const [commPickOrgName, setCommPickOrgName] = useState("");

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

  const { data: allAvailablePlayers } = useQuery<DraftPlayerWithDetails[]>({
    queryKey: ["/api/drafts", draftIdNum, "players", { status: "available" }],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "available" });
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

  const getRoundLabel = useCallback((roundNumber: number, pickIndex: number) => {
    const round = draftRounds?.find(r => r.roundNumber === roundNumber);
    const name = round?.name || `Round ${roundNumber}`;
    return `${name}.${pickIndex + 1}`;
  }, [draftRounds]);

  const currentRoundConfig = useMemo(() => {
    if (!currentSlot || !draftRounds) return null;
    return draftRounds.find(r => r.roundNumber === currentSlot.round) || null;
  }, [currentSlot, draftRounds]);

  const currentTeam = useMemo(() => {
    if (!currentSlot || !picks) return null;
    return picks.find((p) => p.id === currentSlot.id) || null;
  }, [currentSlot, picks]);

  const isMyTurn = useMemo(() => {
    if (!currentTeam || !user) return false;
    return currentTeam.userId === user.id;
  }, [currentTeam, user]);

  const myEligibleSlot = useMemo(() => {
    if (!user || !picks) return null;
    return picks
      .filter(p => p.userId === user.id && !p.madeAt)
      .sort((a, b) => a.overallPickNumber - b.overallPickNumber)[0] || null;
  }, [user, picks]);

  const isCurrentRoundTeamDraft = useMemo(() => {
    return currentRoundConfig?.isTeamDraft === true;
  }, [currentRoundConfig]);

  const isMyPickTeamDraft = useMemo(() => {
    if (!myEligibleSlot || !draftRounds) return false;
    const roundConfig = draftRounds.find(r => r.roundNumber === myEligibleSlot.round);
    return roundConfig?.isTeamDraft === true;
  }, [myEligibleSlot, draftRounds]);

  const isEligibleByTiming = useMemo(() => {
    if (!timingInfo?.hasTiming || !user) return false;
    return timingInfo.eligiblePickerIds?.includes(user.id) || false;
  }, [timingInfo, user]);

  const canPick = useMemo(() => {
    if (!draft || draft.status !== "active") return false;
    if (isMyTurn) return true;
    if (isEligibleByTiming) return true;
    return false;
  }, [draft, isMyTurn, isEligibleByTiming]);

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

  const draftStartTime = useMemo(() => {
    if (!draftRounds || draftRounds.length === 0) return null;
    const sorted = [...draftRounds].sort((a, b) => a.roundNumber - b.roundNumber);
    return sorted[0]?.startTime ? new Date(sorted[0].startTime) : null;
  }, [draftRounds]);

  const showPreDraftBanner = useMemo(() => {
    if (!draft) return false;
    if (draft.status === "setup") return true;
    if (draft.status === "active" && !currentSlot && Array.isArray(picks)) {
      if (!picks.some(p => p.madeAt || p.skippedAt)) return true;
    }
    return false;
  }, [draft, currentSlot, picks]);

  useEffect(() => {
    if (!showPreDraftBanner || !draftStartTime) {
      setStartCountdown("");
      return;
    }
    const startMs = draftStartTime.getTime();
    const updateStartCountdown = () => {
      const now = Date.now();
      const diff = startMs - now;
      if (diff <= 0) {
        setStartCountdown("Starting soon...");
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      if (days > 0) {
        setStartCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setStartCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setStartCountdown(`${minutes}m ${seconds}s`);
      } else {
        setStartCountdown(`${seconds}s`);
      }
    };
    updateStartCountdown();
    const interval = setInterval(updateStartCountdown, 1000);
    return () => clearInterval(interval);
  }, [showPreDraftBanner, draftStartTime]);

  useEffect(() => {
    if (!currentSlot) return;
    requestAnimationFrame(() => {
      const container = document.getElementById("slot-board-scroll");
      const row = container?.querySelector('[data-current-slot="true"]');
      if (row && container) {
        const containerRect = container.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const scrollTarget = row.getBoundingClientRect().top - containerRect.top + container.scrollTop - containerRect.height / 2 + rowRect.height / 2;
        container.scrollTop = Math.max(0, scrollTarget);
      }
    });
  }, [currentSlot?.id]);

  const firstPickTeam = useMemo(() => {
    if (!picks || picks.length === 0) return null;
    const sorted = [...picks].sort((a, b) => a.overallPickNumber - b.overallPickNumber);
    return sorted[0] || null;
  }, [picks]);

  const filledPicks = useMemo(() => {
    return (picks || []).filter((slot) => !!slot.madeAt);
  }, [picks]);

  const upcomingPicks = useMemo(() => {
    if (!currentSlot || !picks) return [];
    return picks
      .filter((p) => !p.madeAt && p.overallPickNumber > currentSlot.overallPickNumber)
      .sort((a, b) => a.overallPickNumber - b.overallPickNumber)
      .slice(0, 4);
  }, [picks, currentSlot]);

  const myPicks = useMemo(() => {
    if (!user || !picks) return [];
    return picks
      .filter((slot) => slot.userId === user.id)
      .sort((a, b) => a.overallPickNumber - b.overallPickNumber);
  }, [user, picks]);

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
    return availableOrgs.filter((org) => {
      const orgLower = stripAccents(org.toLowerCase());
      const abbr = getMlbAffiliationAbbreviation(org)?.toLowerCase() || "";
      return orgLower.includes(needle) || abbr.includes(needle);
    });
  }, [availableOrgs, orgSearch]);

  const availablePositions = useMemo(() => {
    if (!availablePlayers?.length) return [] as string[];
    const posSet = new Set<string>();
    availablePlayers.forEach(dp => {
      if (dp.player.primaryPosition) posSet.add(dp.player.primaryPosition);
    });
    return [...posSet].sort();
  }, [availablePlayers]);

  const availableOrgOptions = useMemo(() => {
    if (!availablePlayers?.length) return [] as string[];
    const orgSet = new Set<string>();
    availablePlayers.forEach(dp => {
      if (dp.player.parentOrgName) orgSet.add(dp.player.parentOrgName);
    });
    return [...orgSet].sort();
  }, [availablePlayers]);

  const filteredAvailablePlayers = useMemo(() => {
    if (!availablePlayers) return undefined;
    return availablePlayers.filter(dp => {
      if (positionFilter !== "all" && dp.player.primaryPosition !== positionFilter) return false;
      if (orgFilter !== "all" && dp.player.parentOrgName !== orgFilter) return false;
      return true;
    });
  }, [availablePlayers, positionFilter, orgFilter]);

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
      setRosterType("milb");
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

  const commPickTeams = useMemo(() => {
    if (!picks || !timingInfo) return [];
    const now = timingInfo.now ? new Date(timingInfo.now).getTime() : Date.now();
    const currentOnClockUserId = currentSlot?.userId;
    const seen = new Set<string>();
    const teams: { userId: string; teamName: string; teamAbbreviation: string; label: string }[] = [];
    picks.forEach(slot => {
      if (slot.madeAt || seen.has(slot.userId)) return;
      const isOnClock = slot.userId === currentOnClockUserId && !slot.skippedAt;
      const deadlinePassed = slot.deadlineAt && new Date(slot.deadlineAt).getTime() <= now;
      const isSkipped = !!slot.skippedAt;
      if (isOnClock || deadlinePassed || isSkipped) {
        seen.add(slot.userId);
        const teamName = slot.user?.teamName || `${slot.user?.firstName} ${slot.user?.lastName}`;
        const teamAbbr = (slot.user as any)?.teamAbbreviation || "";
        const label = isOnClock ? "On Clock" : isSkipped ? "Skipped" : "Deadline Passed";
        teams.push({ userId: slot.userId, teamName, teamAbbreviation: teamAbbr, label });
      }
    });
    return teams;
  }, [picks, timingInfo, currentSlot]);

  const commPickTargetSlot = useMemo(() => {
    if (!commPickUserId || !picks) return null;
    return picks
      .filter(s => s.userId === commPickUserId && !s.madeAt)
      .sort((a, b) => a.overallPickNumber - b.overallPickNumber)[0] || null;
  }, [commPickUserId, picks]);

  const commPickIsTeamDraft = useMemo(() => {
    if (!commPickTargetSlot || !draftRounds) return false;
    const rc = draftRounds.find(r => r.roundNumber === commPickTargetSlot.round);
    return rc?.isTeamDraft === true;
  }, [commPickTargetSlot, draftRounds]);

  const commPickSearchResults = useMemo(() => {
    if (!commPickSearch.trim() || !availablePlayers || commPickIsTeamDraft) return [];
    const needle = stripAccents(commPickSearch.trim().toLowerCase());
    return availablePlayers
      .filter(dp => {
        const name = stripAccents(dp.player.fullName.toLowerCase());
        return name.includes(needle);
      })
      .slice(0, 8);
  }, [commPickSearch, availablePlayers, commPickIsTeamDraft]);

  const commPickOrgOptions = useMemo(() => {
    if (!commPickIsTeamDraft || !availablePlayers) return [];
    const claimed = new Set((picks || []).map(s => s.selectedOrgName).filter(Boolean));
    const orgs: string[] = [];
    const seen: Record<string, boolean> = {};
    availablePlayers.forEach(dp => {
      if (dp.player.parentOrgName && !claimed.has(dp.player.parentOrgName) && !seen[dp.player.parentOrgName]) {
        seen[dp.player.parentOrgName] = true;
        orgs.push(dp.player.parentOrgName);
      }
    });
    return orgs.sort();
  }, [commPickIsTeamDraft, availablePlayers, picks]);

  const commissionerPick = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/drafts/${draftIdNum}/commissioner-pick`, data);
      return res.json();
    },
    onSuccess: (data) => {
      const desc = data.teamDraft
        ? `Drafted ${data.playersDrafted} players from ${data.orgName}`
        : "Pick made successfully";
      toast({ title: "Commissioner Pick Made", description: desc });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "picks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "timing"] });
      setCommPickUserId("");
      setCommPickSearch("");
      setCommPickSelectedPlayer(null);
      setCommPickOrgName("");
    },
    onError: (error: Error) => {
      toast({ title: "Commissioner pick failed", description: error.message, variant: "destructive" });
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

  const { data: emailOptOut } = useQuery<{ optedOut: boolean }>({
    queryKey: ["/api/drafts", draftIdNum, "email-opt-out"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftIdNum}/email-opt-out`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch email preference");
      return res.json();
    },
    enabled: !!draftIdNum,
  });

  const toggleEmailOptOut = useMutation({
    mutationFn: async (optedOut: boolean) => {
      await apiRequest("PUT", `/api/drafts/${draftIdNum}/email-opt-out`, { optedOut });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "email-opt-out"] });
    },
  });

  const { data: autoDraftSettings } = useQuery<{ autoDraftMode: string }>({
    queryKey: ["/api/drafts", draftIdNum, "auto-draft-settings"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftIdNum}/auto-draft-settings`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch auto-draft settings");
      return res.json();
    },
    enabled: !!draftIdNum,
  });

  const toggleAutoDraftMode = useMutation({
    mutationFn: async (mode: string) => {
      await apiRequest("PUT", `/api/drafts/${draftIdNum}/auto-draft-settings`, { autoDraftMode: mode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "auto-draft-settings"] });
    },
  });

  const autoDraftListIds = useMemo(() => {
    if (!autoDraftList) return new Set<number>();
    return new Set(autoDraftList.map(item => item.mlbPlayerId));
  }, [autoDraftList]);

  const draftedPlayerLookup = useMemo(() => {
    const lookup = new Map<number, { teamName: string | null; firstName: string | null; lastName: string | null }>();
    if (!picks) return lookup;
    for (const p of picks) {
      if (p.madeAt && p.mlbPlayerId) {
        lookup.set(p.mlbPlayerId, {
          teamName: p.user?.teamName || null,
          firstName: p.user?.firstName || null,
          lastName: p.user?.lastName || null,
        });
      }
    }
    return lookup;
  }, [picks]);

  const autoDraftCandidatePlayers = useMemo(() => {
    const needle = stripAccents(autoDraftSearch.trim().toLowerCase());
    if (!needle || !allAvailablePlayers?.length) return [] as DraftPlayerWithDetails[];
    return allAvailablePlayers
      .filter((dp) => !autoDraftListIds.has(dp.mlbPlayerId))
      .filter((dp) => {
        return stripAccents((dp.player.fullName || "").toLowerCase()).includes(needle);
      })
      .slice(0, 25);
  }, [allAvailablePlayers, autoDraftListIds, autoDraftSearch]);

  const addToAutoDraft = useMutation({
    mutationFn: async ({ mlbPlayerId, rosterType }: { mlbPlayerId: number; rosterType: string }) => {
      await apiRequest("POST", `/api/drafts/${draftIdNum}/auto-draft-list`, { mlbPlayerId, rosterType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "auto-draft-list"] });
      setAutoDraftSearch("");
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
    onMutate: async (orderedIds: number[]) => {
      await queryClient.cancelQueries({ queryKey: ["/api/drafts", draftIdNum, "auto-draft-list"] });
      const previous = queryClient.getQueryData<AutoDraftListWithPlayer[]>(["/api/drafts", draftIdNum, "auto-draft-list"]);
      if (previous) {
        const idToItem = new Map(previous.map(item => [item.id, item]));
        const reordered = orderedIds.map(id => idToItem.get(id)).filter(Boolean) as AutoDraftListWithPlayer[];
        queryClient.setQueryData(["/api/drafts", draftIdNum, "auto-draft-list"], reordered);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/drafts", draftIdNum, "auto-draft-list"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "auto-draft-list"] });
    },
  });

  const clearAutoDraft = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/drafts/${draftIdNum}/auto-draft-list`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "auto-draft-list"] });
      toast({ title: "Auto-draft list cleared" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to clear list", description: error.message, variant: "destructive" });
    },
  });

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadText, setUploadText] = useState("");
  const [uploadResult, setUploadResult] = useState<any>(null);

  const uploadAutoDraft = useMutation({
    mutationFn: async (mlbIds: number[]) => {
      const res = await apiRequest("POST", `/api/drafts/${draftIdNum}/auto-draft-list/upload`, { mlbIds, rosterType: autoDraftRosterType });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "auto-draft-list"] });
      setUploadDialogOpen(false);
      setUploadText("");
      setUploadResult(data);
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
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

  const skipPick = useMutation({
    mutationFn: async (slotId: number) => {
      const res = await apiRequest("POST", `/api/drafts/${draftIdNum}/skip-pick`, { slotId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "picks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "timing"] });
      toast({ title: "Pick Skipped", description: "The team can still come back and pick at any time." });
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

  const [editingRankId, setEditingRankId] = useState<number | null>(null);
  const [editingRankValue, setEditingRankValue] = useState("");

  const jumpToPosition = (itemId: number, currentIndex: number, targetStr: string) => {
    if (!autoDraftList) return;
    const target = parseInt(targetStr);
    if (isNaN(target) || target === currentIndex + 1) {
      setEditingRankId(null);
      return;
    }
    const clamped = Math.max(1, Math.min(autoDraftList.length, target)) - 1;
    const newList = [...autoDraftList];
    const [item] = newList.splice(currentIndex, 1);
    newList.splice(clamped, 0, item);
    reorderAutoDraft.mutate(newList.map(i => i.id));
    setEditingRankId(null);
  };

  const hasTeamDraftRound = useMemo(() => {
    return draftRounds?.some(r => r.isTeamDraft) || false;
  }, [draftRounds]);

  const { data: teamAutoDraftList } = useQuery<TeamAutoDraftList[]>({
    queryKey: ["/api/drafts", draftIdNum, "team-auto-draft-list"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftIdNum}/team-auto-draft-list`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch team auto-draft list");
      return res.json();
    },
    enabled: !!draftIdNum && hasTeamDraftRound,
    refetchInterval: DRAFT_POLL_INTERVAL,
  });

  const teamAutoDraftOrgNames = useMemo(() => {
    if (!teamAutoDraftList) return new Set<string>();
    return new Set(teamAutoDraftList.map(item => item.orgName));
  }, [teamAutoDraftList]);

  const claimedOrgs = useMemo(() => {
    if (!picks) return new Set<string>();
    return new Set(picks.filter(s => !!s.selectedOrgName).map(s => s.selectedOrgName as string));
  }, [picks]);

  const teamAutoDraftCandidateOrgs = useMemo(() => {
    if (!allAvailablePlayers) return [] as string[];
    const seen: Record<string, boolean> = {};
    const orgs: string[] = [];
    allAvailablePlayers.forEach(dp => {
      if (dp.player.parentOrgName && !claimedOrgs.has(dp.player.parentOrgName) && !teamAutoDraftOrgNames.has(dp.player.parentOrgName) && !seen[dp.player.parentOrgName]) {
        seen[dp.player.parentOrgName] = true;
        orgs.push(dp.player.parentOrgName);
      }
    });
    const needle = stripAccents(teamAutoDraftSearch.trim().toLowerCase());
    if (needle) {
      return orgs.filter(org => {
        const orgLower = stripAccents(org.toLowerCase());
        const abbr = getMlbAffiliationAbbreviation(org)?.toLowerCase() || "";
        return orgLower.includes(needle) || abbr.includes(needle);
      }).sort();
    }
    return orgs.sort();
  }, [allAvailablePlayers, claimedOrgs, teamAutoDraftOrgNames, teamAutoDraftSearch]);

  const addToTeamAutoDraft = useMutation({
    mutationFn: async ({ orgName, rosterType }: { orgName: string; rosterType: string }) => {
      await apiRequest("POST", `/api/drafts/${draftIdNum}/team-auto-draft-list`, { orgName, rosterType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "team-auto-draft-list"] });
      toast({ title: "Added to team auto-draft list" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add", description: error.message, variant: "destructive" });
    },
  });

  const removeFromTeamAutoDraft = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("DELETE", `/api/drafts/${draftIdNum}/team-auto-draft-list/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "team-auto-draft-list"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
    },
  });

  const reorderTeamAutoDraft = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      await apiRequest("PUT", `/api/drafts/${draftIdNum}/team-auto-draft-list/reorder`, { orderedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "team-auto-draft-list"] });
    },
  });

  const clearTeamAutoDraft = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/drafts/${draftIdNum}/team-auto-draft-list`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftIdNum, "team-auto-draft-list"] });
      toast({ title: "Team auto-draft list cleared" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to clear list", description: error.message, variant: "destructive" });
    },
  });

  const moveTeamAutoDraftItem = (index: number, direction: "up" | "down") => {
    if (!teamAutoDraftList) return;
    const newList = [...teamAutoDraftList];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newList.length) return;
    [newList[index], newList[swapIndex]] = [newList[swapIndex], newList[index]];
    reorderTeamAutoDraft.mutate(newList.map(item => item.id));
  };

  const handlePickClick = (player: DraftPlayerWithDetails) => {
    setSelectedPlayer(player);
    setRosterType("milb");
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
            <CardTitle>
              Final Results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Pick</TableHead>
                    <TableHead className="font-semibold">Round</TableHead>
                    <TableHead className="font-semibold">Team</TableHead>
                    <TableHead className="font-semibold">Player</TableHead>
                    <TableHead className="font-semibold">Pos</TableHead>
                    <TableHead className="font-semibold">MLB Team</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filledPicks.map((pick) => (
                    <TableRow key={pick.id} data-testid={`row-pick-${pick.id}`}>
                      <TableCell className="font-mono">{pick.overallPickNumber}</TableCell>
                      <TableCell className="font-mono text-xs">{getRoundLabel(pick.round, pick.roundPickIndex)}{draftRounds?.find(r => r.roundNumber === pick.round)?.isTeamDraft ? "*" : ""}</TableCell>
                      <TableCell className="font-medium">{pick.user.teamName || `${pick.user.firstName} ${pick.user.lastName}`}</TableCell>
                      <TableCell className="font-medium">{pick.player?.fullName || pick.selectedOrgName || "-"}</TableCell>
                      <TableCell>{pick.player?.primaryPosition || (pick.selectedOrgName ? "Org Claim" : "-")}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {pick.player?.parentOrgName || pick.selectedOrgName || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {draftRounds?.some(r => r.isTeamDraft) && (
                <div className="px-4 py-2 text-xs text-muted-foreground border-t">* Team Draft round</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roundName = currentRoundConfig?.name || (currentSlot ? `Round ${currentSlot.round}` : "Draft");
  const picksMade = filledPicks.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-draft-name">{draft.name}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant={draft.status === "active" ? "default" : draft.status === "paused" ? "destructive" : "secondary"} data-testid="badge-draft-status">
            {draft.status === "active" ? "Live" : draft.status === "paused" ? "Paused" : draft.status}
          </Badge>
          <span className="text-muted-foreground text-sm" data-testid="text-round-info">
            {currentSlot ? (() => { const rn = draftRounds?.find(r => r.roundNumber === currentSlot.round)?.name; const label = rn ? (/^\d+$/.test(rn) ? `Round ${rn}` : rn) : `Round ${currentSlot.round}`; return `${label}, Pick ${currentSlot.roundPickIndex + 1}, Overall ${currentSlot.overallPickNumber}`; })() : draftStartTime ? `Starts ${draftStartTime.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Waiting to start"}
          </span>
          {isCurrentRoundTeamDraft && (
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
            {isCurrentRoundTeamDraft && (
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
            {timingInfo?.skippedTeams && timingInfo.skippedTeams.length > 0 && (
              <div className="mt-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" data-testid="skipped-teams-notice">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                  <strong>Skipped picks:</strong>{" "}
                  {timingInfo.skippedTeams.map(t => t.teamName).join(", ")}{" "}
                  {timingInfo.skippedTeams.length === 1 ? "was" : "were"} skipped and can still pick at any time.
                </p>
              </div>
            )}
            <div className="flex items-center gap-2 mt-3">
              {canPick && isMyPickTeamDraft && (
                <Button onClick={handleTeamDraftClick} data-testid="button-team-draft-pick">
                  <Building2 className="h-4 w-4 mr-2" />
                  Select Organization
                </Button>
              )}
              {(isLeagueCommissioner || user?.isSuperAdmin) && currentSlot && currentSlot.round === 1 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-skip-pick">
                      Skip Pick
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Skip this pick?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will skip {currentTeam?.user.teamName || "this team"}'s current pick and move on to the next team. The skipped team can still come back and make their pick at any time.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => skipPick.mutate(currentSlot.id)}
                        disabled={skipPick.isPending}
                        data-testid="button-confirm-skip-pick"
                      >
                        {skipPick.isPending ? "Skipping..." : "Skip Pick"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {draft.status === "active" && (isLeagueCommissioner || user?.isSuperAdmin) && commPickTeams.length > 0 && (
        <Card className="mb-6" data-testid="card-commissioner-pick">
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-base">Commissioner Pick</CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[180px]">
                <label className="text-xs text-muted-foreground mb-1 block">Team</label>
                <Select value={commPickUserId} onValueChange={(v) => { setCommPickUserId(v); setCommPickSearch(""); setCommPickSelectedPlayer(null); setCommPickOrgName(""); }} data-testid="select-comm-pick-team">
                  <SelectTrigger data-testid="trigger-comm-pick-team">
                    <SelectValue placeholder="Select team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {commPickTeams.map(t => (
                      <SelectItem key={t.userId} value={t.userId} data-testid={`option-comm-team-${t.userId}`}>
                        {t.teamAbbreviation ? `${t.teamAbbreviation} - ${t.teamName}` : t.teamName}
                        {t.label && ` (${t.label})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {commPickUserId && commPickTargetSlot && (
                <div className="text-sm text-muted-foreground">
                  Next open slot: <span className="font-medium">{getRoundLabel(commPickTargetSlot.round, commPickTargetSlot.roundPickIndex)}</span>
                </div>
              )}
              {commPickUserId && !commPickTargetSlot && (
                <div className="text-sm text-muted-foreground">No open slots for this team.</div>
              )}
            </div>

            {commPickUserId && commPickTargetSlot && !commPickIsTeamDraft && (
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    placeholder="Search players..."
                    value={commPickSearch}
                    onChange={(e) => { setCommPickSearch(e.target.value); setCommPickSelectedPlayer(null); }}
                    data-testid="input-comm-pick-search"
                  />
                </div>
                {commPickSearchResults.length > 0 && (
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    {commPickSearchResults.map(dp => (
                      <div
                        key={dp.mlbPlayerId}
                        className={`px-3 py-2 cursor-pointer hover:bg-accent text-sm flex justify-between items-center ${commPickSelectedPlayer?.mlbPlayerId === dp.mlbPlayerId ? "bg-primary/10" : ""}`}
                        onClick={() => { setCommPickSelectedPlayer(dp); setCommPickSearch(dp.player.fullName); }}
                        data-testid={`comm-pick-result-${dp.mlbPlayerId}`}
                      >
                        <span className="font-medium">{dp.player.fullName}</span>
                        <span className="text-xs text-muted-foreground">
                          {dp.player.primaryPosition} &middot; {getMlbAffiliationAbbreviation(dp.player.parentOrgName || "") || dp.player.parentOrgName}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {commPickSearch.trim() && commPickSearchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground">No matching available players.</p>
                )}
                {commPickSelectedPlayer && (
                  <Button
                    size="sm"
                    onClick={() => commissionerPick.mutate({ userId: commPickUserId, mlbPlayerId: commPickSelectedPlayer.mlbPlayerId, rosterType: "milb" })}
                    disabled={commissionerPick.isPending}
                    data-testid="button-comm-pick-submit"
                  >
                    {commissionerPick.isPending ? "Picking..." : "Make Pick"}
                  </Button>
                )}
              </div>
            )}

            {commPickUserId && commPickTargetSlot && commPickIsTeamDraft && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="min-w-[200px]">
                    <Select value={commPickOrgName} onValueChange={setCommPickOrgName}>
                      <SelectTrigger data-testid="select-comm-pick-org">
                        <SelectValue placeholder="Select organization..." />
                      </SelectTrigger>
                      <SelectContent>
                        {commPickOrgOptions.map(org => (
                          <SelectItem key={org} value={org}>{org}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const orgMeta = allAvailablePlayers?.find(dp => dp.player.parentOrgName === commPickOrgName);
                      commissionerPick.mutate({ userId: commPickUserId, selectedOrgName: commPickOrgName, selectedOrgId: orgMeta?.player.parentOrgId ?? null, rosterType: "milb" });
                    }}
                    disabled={!commPickOrgName || commissionerPick.isPending}
                    data-testid="button-comm-pick-org-submit"
                  >
                    {commissionerPick.isPending ? "Picking..." : "Make Pick"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {draft.status === "active" && upcomingPicks.length > 0 && (
        <Card className="mb-6">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-sm text-muted-foreground" data-testid="text-upcoming-label">Up Next</span>
            </div>
            <div className="flex flex-wrap gap-4">
              {upcomingPicks.map((slot, idx) => (
                <div key={slot.id} className="flex items-center gap-2" data-testid={`upcoming-pick-${idx}`}>
                  <span className="text-xs font-mono text-muted-foreground">{getRoundLabel(slot.round, slot.roundPickIndex)}</span>
                  <span className={`text-sm font-medium ${slot.userId === user?.id ? "text-primary" : ""}`}>
                    {slot.user.teamName || `${slot.user.firstName} ${slot.user.lastName}`}
                  </span>
                  {slot.userId === user?.id && (
                    <Badge variant="outline" className="text-xs">You</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showPreDraftBanner && (
        <Card className="mb-6 border-primary">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-lg" data-testid="text-draft-starts">
                {draft.status === "setup" ? "Draft Starts:" : "First Pick:"}
              </span>
              {draftStartTime ? (
                <span className="text-lg font-bold text-primary" data-testid="text-start-time">
                  {draftStartTime.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              ) : (
                <span className="text-lg text-muted-foreground">Not scheduled yet</span>
              )}
              {startCountdown && (
                <Badge
                  variant="outline"
                  className="ml-auto text-sm font-mono"
                  data-testid="badge-start-countdown"
                >
                  {startCountdown}
                </Badge>
              )}
            </div>
            {firstPickTeam ? (
              <div className="mt-2 flex items-center gap-2 text-muted-foreground">
                <span className="text-sm">
                  First pick: <span className="font-semibold text-foreground">{firstPickTeam.user.teamName || `${firstPickTeam.user.firstName} ${firstPickTeam.user.lastName}`}</span>
                  {firstPickTeam.userId === user?.id && <Badge variant="default" className="ml-2 text-xs">You</Badge>}
                </span>
              </div>
            ) : draftOrderData && draftOrderData.length > 0 ? (
              <div className="mt-2 flex items-center gap-2 text-muted-foreground">
                <span className="text-sm">
                  First pick: <span className="font-semibold text-foreground">{draftOrderData[0].user.teamName || `${draftOrderData[0].user.firstName} ${draftOrderData[0].user.lastName}`}</span>
                  {draftOrderData[0].userId === user?.id && <Badge variant="default" className="ml-2 text-xs">You</Badge>}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">Draft order has not been configured yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {!!picks?.length && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Slot Board</CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[200px] overflow-y-auto" id="slot-board-scroll">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow className="bg-muted/50">
                  <TableHead>Pick</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {picks.map((slot) => (
                  <TableRow key={slot.id} data-current-slot={currentSlot?.id === slot.id ? "true" : undefined} className={`${currentSlot?.id === slot.id ? "bg-primary/10" : slot.userId === user?.id ? "bg-accent/50" : ""}`}>
                    <TableCell className="font-mono text-xs">{getRoundLabel(slot.round, slot.roundPickIndex)}{draftRounds?.find(r => r.roundNumber === slot.round)?.isTeamDraft ? "*" : ""}</TableCell>
                    <TableCell className={`text-sm ${slot.userId === user?.id ? "font-semibold" : ""}`}>{slot.user.teamName || slot.user.firstName || slot.user.lastName || slot.user.id}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{slot.madeAt ? new Date(slot.madeAt).toLocaleString() : slot.deadlineAt ? new Date(slot.deadlineAt).toLocaleString() : new Date(slot.scheduledAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {slot.madeAt
                          ? <span className="text-xs font-medium">{slot.player ? `${slot.player.fullName} (${slot.player.primaryPosition}${slot.player.parentOrgName ? `, ${slot.player.parentOrgName}` : ""})` : slot.selectedOrgName || "Picked"}</span>
                          : slot.skippedAt
                            ? <Badge variant="destructive" className="text-xs">Skipped</Badge>
                            : currentSlot?.id === slot.id
                              ? <Badge variant="default" className="text-xs">On Clock</Badge>
                              : (new Date(slot.scheduledAt).getTime() <= nowMs
                                ? <Badge variant="default" className="text-xs">Open</Badge>
                                : <Badge variant="outline" className="text-xs">Upcoming</Badge>)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {draftRounds?.some(r => r.isTeamDraft) && (
              <div className="px-4 py-2 text-xs text-muted-foreground border-t">* Team Draft round</div>
            )}
          </CardContent>
        </Card>
      )}


      {!!picks?.length && user && (() => {
        const myPicks = picks.filter(p => p.userId === user.id);
        if (!myPicks.length) return null;
        const madePicks = myPicks.filter(p => p.madeAt);
        const futurePicks = myPicks.filter(p => !p.madeAt && !p.skippedAt);
        const skippedPicks = myPicks.filter(p => p.skippedAt && !p.madeAt);
        return (
          <Card className="mb-6" data-testid="card-my-draft">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">My Draft <span className="text-sm font-normal text-muted-foreground ml-1">({madePicks.length} of {myPicks.length})</span></CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Pick</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Selection</TableHead>
                    <TableHead>Roster</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {madePicks.map((slot) => (
                    <TableRow key={slot.id} data-testid={`row-my-pick-${slot.id}`}>
                      <TableCell className="font-mono text-xs">{getRoundLabel(slot.round, slot.roundPickIndex)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{draftRounds?.find(r => r.roundNumber === slot.round)?.name || `Round ${slot.round}`}{draftRounds?.find(r => r.roundNumber === slot.round)?.isTeamDraft ? " (Team)" : ""}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {slot.selectedOrgName
                          ? <span>{slot.selectedOrgName}</span>
                          : slot.player
                            ? <span>{slot.player.fullName} <span className="text-muted-foreground font-normal">({slot.player.primaryPosition}{slot.player.parentOrgName ? `, ${slot.player.parentOrgName}` : ""})</span></span>
                            : "Picked"}
                      </TableCell>
                      <TableCell>
                        {slot.rosterType && (
                          <Badge variant={slot.rosterType === "mlb" ? "default" : "secondary"} className="text-xs">
                            {slot.rosterType.toUpperCase()}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {skippedPicks.map((slot) => (
                    <TableRow key={slot.id} className="opacity-60" data-testid={`row-my-pick-${slot.id}`}>
                      <TableCell className="font-mono text-xs">{getRoundLabel(slot.round, slot.roundPickIndex)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{draftRounds?.find(r => r.roundNumber === slot.round)?.name || `Round ${slot.round}`}</TableCell>
                      <TableCell className="text-sm"><Badge variant="destructive" className="text-xs">Skipped</Badge></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                  {futurePicks.map((slot) => (
                    <TableRow key={slot.id} className="opacity-50" data-testid={`row-my-pick-${slot.id}`}>
                      <TableCell className="font-mono text-xs">{getRoundLabel(slot.round, slot.roundPickIndex)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{draftRounds?.find(r => r.roundNumber === slot.round)?.name || `Round ${slot.round}`}{draftRounds?.find(r => r.roundNumber === slot.round)?.isTeamDraft ? " (Team)" : ""}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {currentSlot?.id === slot.id
                          ? <Badge variant="default" className="text-xs">On Clock</Badge>
                          : slot.deadlineAt
                            ? <span className="text-xs">{new Date(slot.deadlineAt).toLocaleString()}</span>
                            : slot.scheduledAt
                              ? <span className="text-xs">{new Date(slot.scheduledAt).toLocaleString()}</span>
                              : <span className="italic">Upcoming</span>}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })()}

      <div className="grid gap-6 lg:grid-cols-2">
          {draft.status !== "completed" && (
            <Card>
              <CardHeader className="pb-3 space-y-3">
                <div className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    Auto-Draft List
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {autoDraftList && autoDraftList.length > 0 && (() => {
                      const remaining = autoDraftList.filter(i => !draftedPlayerLookup.has(i.mlbPlayerId)).length;
                      return (
                        <Badge variant="secondary" data-testid="badge-auto-draft-count">
                          {remaining}/{autoDraftList.length}
                        </Badge>
                      );
                    })()}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setUploadDialogOpen(true)}
                      data-testid="button-auto-draft-upload"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      Upload
                    </Button>
                    {autoDraftList && autoDraftList.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid="button-auto-draft-clear"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Clear
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Clear auto-draft list?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove all {autoDraftList.length} players from your auto-draft list. You can upload a new list afterward.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => clearAutoDraft.mutate()}
                              disabled={clearAutoDraft.isPending}
                              data-testid="button-confirm-clear-auto-draft"
                            >
                              {clearAutoDraft.isPending ? "Clearing..." : "Clear List"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Set your priority order here. The system picks the highest available player from this list when it's your turn. Click any rank number to jump a player to a new position.
                </div>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/30">
                  <Checkbox
                    id="deadline-only-toggle"
                    checked={autoDraftSettings?.autoDraftMode === "deadline_only"}
                    onCheckedChange={(checked) => {
                      toggleAutoDraftMode.mutate(checked ? "deadline_only" : "immediate");
                    }}
                    disabled={toggleAutoDraftMode.isPending}
                    data-testid="checkbox-auto-draft-deadline-only"
                  />
                  <label htmlFor="deadline-only-toggle" className="text-xs cursor-pointer select-none">
                    <span className="font-medium">Deadline only</span>
                    <span className="text-muted-foreground"> — only auto-draft when the pick deadline expires (prevents skips but lets you pick manually first). Applies to team draft rounds too.</span>
                  </label>
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
                {autoDraftSearch.trim().length >= 2 && (
                  <div className="border-t border-b p-2 space-y-1 max-h-60 overflow-y-auto">
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
                              {dp.player.primaryPosition} - {getMlbAffiliationAbbreviation(dp.player.parentOrgName) || dp.player.parentOrgName || "-"} ({dp.player.sportLevel})
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
                        {autoDraftList.map((item, idx) => {
                          const drafted = draftedPlayerLookup.get(item.mlbPlayerId);
                          const isDrafted = !!drafted;
                          return (
                          <TableRow key={item.id} data-testid={`row-auto-draft-${item.id}`} className={isDrafted ? "opacity-50" : ""}>
                            <TableCell className="font-mono text-xs text-muted-foreground w-12">
                              {!isDrafted && editingRankId === item.id ? (
                                <input
                                  type="number"
                                  min={1}
                                  max={autoDraftList.length}
                                  value={editingRankValue}
                                  onChange={(e) => setEditingRankValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") jumpToPosition(item.id, idx, editingRankValue);
                                    if (e.key === "Escape") setEditingRankId(null);
                                  }}
                                  onBlur={() => setEditingRankId(null)}
                                  autoFocus
                                  className="w-12 h-6 px-1 text-xs font-mono text-center border rounded bg-background"
                                  data-testid={`input-auto-draft-rank-${item.id}`}
                                />
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-0.5 group/rank ${isDrafted ? "" : "cursor-pointer text-primary/70 hover:text-primary border-b border-dashed border-primary/30 hover:border-primary/60"}`}
                                  onClick={() => {
                                    if (isDrafted) return;
                                    setEditingRankId(item.id);
                                    setEditingRankValue(String(idx + 1));
                                  }}
                                  title={isDrafted ? undefined : "Click to move to position"}
                                  data-testid={`text-auto-draft-rank-${item.id}`}
                                >
                                  {idx + 1}
                                  {!isDrafted && <Pencil className="h-2.5 w-2.5 opacity-0 group-hover/rank:opacity-100 transition-opacity" />}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className={`text-sm font-medium ${isDrafted ? "line-through" : ""}`}>{item.player.fullName}</div>
                              {isDrafted ? (
                                <div className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Drafted by {drafted.teamName || `${drafted.firstName || ""} ${drafted.lastName || ""}`.trim() || "Unknown"}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">
                                  {item.player.primaryPosition} - {getMlbAffiliationAbbreviation(item.player.parentOrgName) || item.player.parentOrgName || "-"} ({item.player.sportLevel})
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {!isDrafted && (
                                <Badge variant={item.rosterType === "mlb" ? "default" : "outline"} className="text-xs">
                                  {item.rosterType === "mlb" ? "MLB" : "MiLB"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-0">
                                {!isDrafted && (
                                  <>
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
                                  </>
                                )}
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
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Auto-Draft List</DialogTitle>
                <DialogDescription>
                  Paste a list of MLB player IDs (one per line, or comma/space separated). Players will be appended to the end of your list in the order provided.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={uploadText}
                onChange={(e) => setUploadText(e.target.value)}
                placeholder={"660271\n545361\n592450\n..."}
                rows={8}
                className="font-mono text-sm"
                data-testid="textarea-auto-draft-upload"
              />
              <div className="text-xs text-muted-foreground">
                Players will be queued as <strong>{autoDraftRosterType.toUpperCase()}</strong>. Change the roster type dropdown before uploading to use a different default.
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)} data-testid="button-auto-draft-upload-cancel">Cancel</Button>
                <Button
                  onClick={() => {
                    const ids = uploadText.trim()
                      .split(/[\r\n,\s]+/)
                      .map(s => s.trim())
                      .filter(s => s.length > 0)
                      .map(s => parseInt(s))
                      .filter(n => !isNaN(n) && n > 0);
                    if (ids.length === 0) {
                      toast({ title: "No valid IDs", description: "Enter at least one numeric MLB player ID.", variant: "destructive" });
                      return;
                    }
                    uploadAutoDraft.mutate(ids);
                  }}
                  disabled={uploadAutoDraft.isPending || !uploadText.trim()}
                  data-testid="button-auto-draft-upload-submit"
                >
                  {uploadAutoDraft.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  Upload {(() => { const c = uploadText.trim().split(/[\r\n,\s]+/).filter(s => /^\d+$/.test(s.trim())).length; return c > 0 ? `(${c})` : ""; })()}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!uploadResult} onOpenChange={(open) => { if (!open) setUploadResult(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Results</DialogTitle>
                <DialogDescription>
                  Matched {uploadResult ? (uploadResult.added + uploadResult.alreadyInList + uploadResult.notInPool) : 0} of {uploadResult?.total || 0} IDs submitted.
                  {uploadResult?.added > 0 && ` Added ${uploadResult.added} player${uploadResult.added !== 1 ? "s" : ""} to your list.`}
                </DialogDescription>
              </DialogHeader>
              {uploadResult && (uploadResult.notFound > 0 || uploadResult.notInPool > 0 || uploadResult.inputDuplicates > 0 || uploadResult.alreadyInList > 0) && (
                <div className="space-y-3 text-sm">
                  {uploadResult.alreadyInList > 0 && (
                    <div>
                      <div className="font-medium text-muted-foreground mb-1">{uploadResult.alreadyInList} already in list (skipped):</div>
                      <div className="text-xs text-muted-foreground">{uploadResult.alreadyInListNames.join(", ")}</div>
                    </div>
                  )}
                  {uploadResult.inputDuplicates > 0 && (
                    <div>
                      <div className="font-medium text-muted-foreground">{uploadResult.inputDuplicates} duplicate ID{uploadResult.inputDuplicates !== 1 ? "s" : ""} in your input (ignored)</div>
                    </div>
                  )}
                  {uploadResult.notInPool > 0 && (
                    <div>
                      <div className="font-medium text-orange-600 dark:text-orange-400 mb-1">{uploadResult.notInPool} player{uploadResult.notInPool !== 1 ? "s" : ""} not in draft pool:</div>
                      <div className="text-xs text-muted-foreground">{uploadResult.notInPoolNames.join(", ")}</div>
                    </div>
                  )}
                  {uploadResult.notFound > 0 && (
                    <div>
                      <div className="font-medium text-orange-600 dark:text-orange-400 mb-1">{uploadResult.notFound} ID{uploadResult.notFound !== 1 ? "s" : ""} not found in player database:</div>
                      <div className="font-mono text-xs bg-muted p-2 rounded max-h-32 overflow-y-auto">{uploadResult.notFoundIds.join(", ")}</div>
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => setUploadResult(null)} data-testid="button-upload-result-close">OK</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {draft.status !== "completed" && hasTeamDraftRound && (
            <Card>
              <CardHeader className="pb-3 space-y-3">
                <div className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    Team Auto-Draft List
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {teamAutoDraftList && teamAutoDraftList.length > 0 && (() => {
                      const remaining = teamAutoDraftList.filter(i => !claimedOrgs.has(i.orgName)).length;
                      return (
                        <Badge variant="secondary" data-testid="badge-team-auto-draft-count">
                          {remaining}/{teamAutoDraftList.length}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Rank your preferred organizations for the team draft round. The system picks the highest available org from this list when it's your turn.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={teamAutoDraftSearch}
                      onChange={(e) => setTeamAutoDraftSearch(e.target.value)}
                      placeholder="Search organizations to queue..."
                      className="pl-9"
                      data-testid="input-team-auto-draft-search"
                    />
                  </div>
                  <Select value={teamAutoDraftRosterType} onValueChange={setTeamAutoDraftRosterType}>
                    <SelectTrigger className="w-[100px]" data-testid="select-team-auto-draft-roster-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="milb">MiLB</SelectItem>
                      <SelectItem value="mlb">MLB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {teamAutoDraftSearch.trim().length >= 2 && (
                  <div className="border-t border-b p-2 space-y-1 max-h-60 overflow-y-auto">
                    {teamAutoDraftCandidateOrgs.length === 0 ? (
                      <div className="px-2 py-1 text-xs text-muted-foreground">
                        No matching available organizations found.
                      </div>
                    ) : (
                      teamAutoDraftCandidateOrgs.map((org) => (
                        <div
                          key={org}
                          className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                          data-testid={`row-team-auto-draft-candidate-${org}`}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{org}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {getMlbAffiliationAbbreviation(org) || org}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addToTeamAutoDraft.mutate({ orgName: org, rosterType: teamAutoDraftRosterType })}
                            disabled={addToTeamAutoDraft.isPending}
                            data-testid={`button-team-auto-draft-candidate-add-${org}`}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Queue
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
                {!teamAutoDraftList?.length ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No organizations in your team auto-draft list yet. Search above to add.
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold w-8">#</TableHead>
                          <TableHead className="font-semibold">Organization</TableHead>
                          <TableHead className="font-semibold">Roster</TableHead>
                          <TableHead className="font-semibold text-right w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamAutoDraftList.map((item, idx) => {
                          const isClaimed = claimedOrgs.has(item.orgName);
                          return (
                          <TableRow key={item.id} data-testid={`row-team-auto-draft-${item.id}`} className={isClaimed ? "opacity-50" : ""}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell>
                              <div className={`text-sm font-medium ${isClaimed ? "line-through" : ""}`}>{item.orgName}</div>
                              {isClaimed ? (
                                <div className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Already claimed
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">
                                  {getMlbAffiliationAbbreviation(item.orgName) || item.orgName}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {!isClaimed && (
                                <Badge variant={item.rosterType === "mlb" ? "default" : "outline"} className="text-xs">
                                  {item.rosterType === "mlb" ? "MLB" : "MiLB"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-0">
                                {!isClaimed && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => moveTeamAutoDraftItem(idx, "up")}
                                      disabled={idx === 0 || reorderTeamAutoDraft.isPending}
                                      data-testid={`button-team-auto-draft-up-${item.id}`}
                                    >
                                      <ArrowUp className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => moveTeamAutoDraftItem(idx, "down")}
                                      disabled={idx === teamAutoDraftList.length - 1 || reorderTeamAutoDraft.isPending}
                                      data-testid={`button-team-auto-draft-down-${item.id}`}
                                    >
                                      <ArrowDown className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeFromTeamAutoDraft.mutate(item.id)}
                                  disabled={removeFromTeamAutoDraft.isPending}
                                  data-testid={`button-team-auto-draft-remove-${item.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

      </div>

        <div>
          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="text-lg">
                {isMyPickTeamDraft ? `Available Organizations (${filteredOrgs.length})` : `Available Players${allAvailablePlayers ? ` (${allAvailablePlayers.length})` : ""}`}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {!isMyPickTeamDraft && allAvailablePlayers && allAvailablePlayers.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const header = "MLB ID,Player Name,Position,Age,Organization,Level";
                      const rows = allAvailablePlayers.map(dp => {
                        const p = dp.player;
                        const escapeCsv = (v: string) => v.includes(",") ? `"${v}"` : v;
                        return [
                          p.mlbId,
                          escapeCsv(p.fullName || ""),
                          p.primaryPosition || "",
                          p.age ?? "",
                          escapeCsv(p.parentOrgName || ""),
                          p.sportLevel || "",
                        ].join(",");
                      });
                      const csv = [header, ...rows].join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "available_players.csv";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    data-testid="button-download-available-players"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    CSV
                  </Button>
                )}
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={isMyPickTeamDraft ? "Search organizations..." : "Search players..."}
                    value={isMyPickTeamDraft ? orgSearch : playerSearch}
                    onChange={(e) => isMyPickTeamDraft ? setOrgSearch(e.target.value) : setPlayerSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-players"
                  />
                </div>
                {!isMyPickTeamDraft && (
                  <>
                    <Select value={positionFilter} onValueChange={setPositionFilter}>
                      <SelectTrigger className="w-[100px]" data-testid="select-position-filter">
                        <SelectValue placeholder="Position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Pos</SelectItem>
                        {availablePositions.map(pos => (
                          <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={orgFilter} onValueChange={setOrgFilter}>
                      <SelectTrigger className="w-[140px]" data-testid="select-org-filter">
                        <SelectValue placeholder="Organization" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Orgs</SelectItem>
                        {availableOrgOptions.map(org => (
                          <SelectItem key={org} value={org}>
                            {getMlbAffiliationAbbreviation(org) || org}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              {isMyPickTeamDraft && draft.status === "active" ? (
                <div className="overflow-x-auto h-full overflow-y-auto">
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
                          <TableHead className="font-semibold text-right">Action</TableHead>
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
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {canPick ? (
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
                                  ) : draft?.status !== "completed" && !teamAutoDraftOrgNames.has(org) ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => addToTeamAutoDraft.mutate({ orgName: org, rosterType: teamAutoDraftRosterType })}
                                      disabled={addToTeamAutoDraft.isPending}
                                      data-testid={`button-queue-org-${org.replace(/\s/g, '-')}`}
                                    >
                                      <Plus className="h-3.5 w-3.5 mr-1" />
                                      Queue
                                    </Button>
                                  ) : teamAutoDraftOrgNames.has(org) ? (
                                    <Badge variant="secondary" className="text-xs">
                                      <ListOrdered className="h-3 w-3 mr-1" />
                                      Queued
                                    </Badge>
                                  ) : null}
                                </div>
                              </TableCell>
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
              ) : !filteredAvailablePlayers?.length ? (
                <div className="p-8 text-center text-muted-foreground">
                  {playerSearch || positionFilter !== "all" || orgFilter !== "all" ? "No players match your filters." : "No available players remaining."}
                </div>
              ) : (
                <div className="overflow-x-auto h-full overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Player</TableHead>
                        <TableHead className="font-semibold">Pos</TableHead>
                        <TableHead className="font-semibold">Age</TableHead>
                        <TableHead className="font-semibold">Org</TableHead>
                        <TableHead className="font-semibold">Level</TableHead>
                        {!isMyPickTeamDraft && <TableHead className="font-semibold text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAvailablePlayers.map((dp) => (
                        <TableRow key={dp.id} data-testid={`row-player-${dp.id}`}>
                          <TableCell className="font-medium">{dp.player.fullName}</TableCell>
                          <TableCell>{dp.player.primaryPosition}</TableCell>
                          <TableCell className="text-muted-foreground">{dp.player.age ?? "-"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {getMlbAffiliationAbbreviation(dp.player.parentOrgName) || dp.player.parentOrgName || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{dp.player.sportLevel}</Badge>
                          </TableCell>
                          {!isMyPickTeamDraft && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {canPick ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handlePickClick(dp)}
                                    data-testid={`button-pick-${dp.id}`}
                                  >
                                    Pick
                                  </Button>
                                ) : draft?.status !== "completed" && !autoDraftListIds.has(dp.mlbPlayerId) ? (
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
                                ) : autoDraftListIds.has(dp.mlbPlayerId) ? (
                                  <Badge variant="secondary" className="text-xs">
                                    <ListOrdered className="h-3 w-3 mr-1" />
                                    Queued
                                  </Badge>
                                ) : null}
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

      <Dialog open={pickDialogOpen} onOpenChange={setPickDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Pick</DialogTitle>
            <DialogDescription>
              Select this player for {(isMyTurn ? currentTeam?.user.teamName : myEligibleSlot?.user?.teamName) || "your team"}.
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
