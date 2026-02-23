import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLeague } from "@/hooks/useLeague";
import { useToast } from "@/hooks/use-toast";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatAffiliatedTeamLabel } from "@/lib/teamDisplay";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatInTimeZone } from "date-fns-tz";
import type { DraftWithDetails, DraftPlayerWithDetails, DraftPickWithDetails, DraftRound, DraftOrder, User, LeagueMember } from "@shared/schema";
import {
  ArrowLeft, Loader2, Trash2, Play, Settings, Upload, Users, ListOrdered,
  FileSpreadsheet, Clock, X, UserPlus, Download,
} from "lucide-react";

export default function CommissionerDraftDetail() {
  const { draftId: draftIdParam } = useParams<{ draftId: string }>();
  const draftId = parseInt(draftIdParam || "0");
  const { selectedLeagueId, currentLeague } = useLeague();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [editName, setEditName] = useState("");
  const [editPickDuration, setEditPickDuration] = useState(30);
  const [editTeamDraftRound, setEditTeamDraftRound] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [playerIdsText, setPlayerIdsText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [commPickDialogOpen, setCommPickDialogOpen] = useState(false);
  const [commPickUserId, setCommPickUserId] = useState("");
  const [commPickPlayerId, setCommPickPlayerId] = useState<number | null>(null);
  const [commPickOrgName, setCommPickOrgName] = useState("");
  const [commPickRosterType, setCommPickRosterType] = useState<"mlb" | "milb">("milb");
  const [playerSearchText, setPlayerSearchText] = useState("");

  const { data: drafts, isLoading: draftsLoading } = useQuery<DraftWithDetails[]>({
    queryKey: ["/api/drafts", selectedLeagueId],
    queryFn: async () => {
      const res = await fetch(`/api/drafts?leagueId=${selectedLeagueId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch drafts");
      return res.json();
    },
    enabled: !!selectedLeagueId,
  });

  const draft = drafts?.find(d => d.id === draftId);

  const { data: draftPlayers, isLoading: loadingPlayers } = useQuery<DraftPlayerWithDetails[]>({
    queryKey: ["/api/drafts", draftId, "players"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftId}/players`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch players");
      return res.json();
    },
    enabled: !!draftId,
  });

  const { data: draftRounds } = useQuery<DraftRound[]>({
    queryKey: ["/api/drafts", draftId, "rounds"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftId}/rounds`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch rounds");
      return res.json();
    },
    enabled: !!draftId,
  });

  const { data: draftOrderData } = useQuery<(DraftOrder & { user: User })[]>({
    queryKey: ["/api/drafts", draftId, "order"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftId}/order`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch order");
      return res.json();
    },
    enabled: !!draftId && draft?.status === "setup",
  });

  const { data: draftPicks } = useQuery<DraftPickWithDetails[]>({
    queryKey: ["/api/drafts", draftId, "picks"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftId}/picks`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch picks");
      return res.json();
    },
    enabled: !!draftId && draft?.status !== "setup",
  });

  const { data: leagueMembers } = useQuery<(LeagueMember & { user: User })[]>({
    queryKey: ["/api/leagues", selectedLeagueId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${selectedLeagueId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: !!selectedLeagueId,
  });

  const activeMembers = leagueMembers?.filter(m => !m.isArchived) || [];

  const updateDraft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/drafts/${draftId}`, {
        name: editName, pickDurationMinutes: editPickDuration, teamDraftRound: editTeamDraftRound ? Number(editTeamDraftRound) : null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Draft Updated" });
      setShowSettings(false);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteDraft = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/drafts/${draftId}`);
    },
    onSuccess: () => {
      toast({ title: "Draft Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
      navigate("/commissioner/draft");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const uploadPlayers = useMutation({
    mutationFn: async ({
      mlbIds,
      middleNamesByMlbId,
      minorLeagueStatusByMlbId,
      minorLeagueYearsByMlbId,
    }: {
      mlbIds: number[];
      middleNamesByMlbId: Record<number, string>;
      minorLeagueStatusByMlbId: Record<number, string>;
      minorLeagueYearsByMlbId: Record<number, number>;
    }) => {
      const res = await apiRequest("POST", `/api/drafts/${draftId}/players/upload`, {
        mlbIds,
        middleNamesByMlbId,
        minorLeagueStatusByMlbId,
        minorLeagueYearsByMlbId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      const parts = [`${data.added} added`];
      if (data.alreadyInPool > 0) parts.push(`${data.alreadyInPool} already in pool`);
      if (data.notFound?.length > 0) parts.push(`${data.notFound.length} not found`);
      if (data.middleNamesUpdated > 0) parts.push(`${data.middleNamesUpdated} middle names saved`);
      toast({ title: "Upload Complete", description: parts.join(", ") });
      setPlayerIdsText("");
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftId, "players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const clearPlayers = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/drafts/${draftId}/players`);
    },
    onSuccess: () => {
      toast({ title: "Player Pool Cleared" });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftId, "players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const uploadCsvOrder = useMutation({
    mutationFn: async (csvData: string) => {
      const res = await apiRequest("POST", `/api/drafts/${draftId}/order/upload-csv`, { csvData });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Draft Order Uploaded", description: `${data.rounds} rounds, ${data.picksPerRound} picks per round` });
      setCsvText("");
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftId, "rounds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftId, "order"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Upload Failed", description: e.message, variant: "destructive" }),
  });

  const updateRound = useMutation({
    mutationFn: async ({ roundId, data }: { roundId: number; data: { name?: string; isTeamDraft?: boolean; startTime?: string; pickDurationMinutes?: string } }) => {
      const res = await apiRequest("PATCH", `/api/drafts/${draftId}/rounds/${roundId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftId, "rounds"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startDraft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/drafts/${draftId}/start`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Draft Started" });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const completeDraft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/drafts/${draftId}/complete`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Draft Completed" });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const commissionerPick = useMutation({
    mutationFn: async (data: { userId: string; mlbPlayerId?: number; selectedOrgName?: string; selectedOrgId?: number | null; rosterType: string }) => {
      const res = await apiRequest("POST", `/api/drafts/${draftId}/commissioner-pick`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Pick Made" });
      setCommPickDialogOpen(false);
      setCommPickUserId("");
      setCommPickPlayerId(null);
      setCommPickOrgName("");
      setPlayerSearchText("");
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftId, "picks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftId, "players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const nullifyPick = useMutation({
    mutationFn: async (pickId: number) => {
      await apiRequest("DELETE", `/api/drafts/${draftId}/picks/${pickId}`);
    },
    onSuccess: () => {
      toast({ title: "Pick Nullified" });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftId, "picks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", draftId, "players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const playerIdAnalysis = useMemo(() => {
    const rows = playerIdsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const hasHeader = rows.length > 0 && /mlb[_\s]?api[_\s]?id|mlb[_\s]?id|mlbid|player[_\s]?id|id/i.test(rows[0]);
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const headerCols = hasHeader
      ? rows[0].split(",").map((h) => h.trim().toLowerCase())
      : [];
    const idIdx = hasHeader
      ? headerCols.findIndex((h) => ["mlb_api_id", "mlb_id", "mlbid", "player_id", "id"].includes(h))
      : 0;
    const middleIdx = hasHeader
      ? headerCols.findIndex((h) => ["middle_name", "middlename", "middle"].includes(h))
      : 1;
    const statusIdx = hasHeader
      ? headerCols.findIndex((h) => ["status", "minor_league_status", "milb_status"].includes(h))
      : 2;
    const yearsIdx = hasHeader
      ? headerCols.findIndex((h) => ["years", "minor_league_years", "milb_years", "year"].includes(h))
      : 3;
    const statusYearsIdx = hasHeader
      ? headerCols.findIndex((h) => ["status_year", "status_years", "milb_status_year"].includes(h))
      : -1;
    const validIds: number[] = [];
    const invalidTokens: string[] = [];
    const middleNamesByMlbId = new Map<number, string>();
    const minorLeagueStatusByMlbId = new Map<number, string>();
    const minorLeagueYearsByMlbId = new Map<number, number>();
    const parseStatusToken = (value: string): string | null => {
      const token = String(value || "").trim().toUpperCase();
      if (!token) return null;
      if (["MH", "MC", "FA"].includes(token)) return token;
      const slash = /^([A-Z]{2,3})\s*\/\s*(\d+)$/.exec(token);
      if (slash && ["MH", "MC", "FA"].includes(slash[1])) return slash[1];
      return null;
    };
    const parseYearsToken = (value: string): number | null => {
      const token = String(value || "").trim();
      if (!token) return null;
      const parsed = Number(token);
      if (!Number.isInteger(parsed) || parsed < 0) return null;
      return parsed;
    };
    const parseStatusYears = (value: string): { status: string | null; years: number | null } => {
      const token = String(value || "").trim().toUpperCase();
      const slash = /^([A-Z]{2,3})\s*\/\s*(\d+)$/.exec(token);
      if (!slash) return { status: parseStatusToken(token), years: null };
      return {
        status: parseStatusToken(slash[1]),
        years: parseYearsToken(slash[2]),
      };
    };
    for (const row of dataRows) {
      if (row.includes(",")) {
        const cols = row.split(",").map((s) => s.trim());
        const idToken = cols[Math.max(0, idIdx)] || "";
        const middleName = middleIdx >= 0 ? (cols[middleIdx] || "") : "";
        const statusToken = statusIdx >= 0 ? (cols[statusIdx] || "") : "";
        const yearsToken = yearsIdx >= 0 ? (cols[yearsIdx] || "") : "";
        const statusYearsToken = statusYearsIdx >= 0 ? (cols[statusYearsIdx] || "") : "";
        if (/^\d+$/.test(idToken)) {
          const id = Number(idToken);
          validIds.push(id);
          if (middleName) middleNamesByMlbId.set(id, middleName);
          const parsedFromCombined = parseStatusYears(statusYearsToken);
          const parsedStatus = parseStatusToken(statusToken) ?? parsedFromCombined.status;
          const parsedYears = parseYearsToken(yearsToken) ?? parsedFromCombined.years;
          if (parsedStatus) minorLeagueStatusByMlbId.set(id, parsedStatus);
          if (parsedYears != null) minorLeagueYearsByMlbId.set(id, parsedYears);
        } else {
          invalidTokens.push(row);
        }
        continue;
      }

      const tokens = row
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const token of tokens) {
        if (/^\d+$/.test(token)) {
          validIds.push(Number(token));
        } else {
          invalidTokens.push(token);
        }
      }
    }
    const seen = new Set<number>();
    const duplicateIds = new Set<number>();
    for (const id of validIds) {
      if (seen.has(id)) duplicateIds.add(id);
      seen.add(id);
    }
    return {
      totalTokens: dataRows.length,
      validCount: validIds.length,
      uniqueIds: Array.from(seen),
      duplicateIds: Array.from(duplicateIds),
      invalidTokens,
      middleNamesByMlbId: Object.fromEntries(middleNamesByMlbId.entries()) as Record<number, string>,
      minorLeagueStatusByMlbId: Object.fromEntries(minorLeagueStatusByMlbId.entries()) as Record<number, string>,
      minorLeagueYearsByMlbId: Object.fromEntries(minorLeagueYearsByMlbId.entries()) as Record<number, number>,
    };
  }, [playerIdsText]);

  const csvTemplateText = useMemo(() => {
    const roundCount = Math.max(draftRounds?.length || 3, 1);
    const headers = Array.from({ length: roundCount }, (_, i) => `Round ${i + 1}`);
    const abbreviations = activeMembers
      .map((m) => (m.user?.teamAbbreviation || "").toUpperCase().trim())
      .filter(Boolean);
    if (abbreviations.length === 0) {
      return `${headers.join(",")}\n`;
    }
    const snakeOrder = [...abbreviations];
    const reversed = [...abbreviations].reverse();
    const rows = snakeOrder.map((_, rowIdx) =>
      headers
        .map((__, roundIdx) => (roundIdx % 2 === 0 ? snakeOrder[rowIdx] : reversed[rowIdx]))
        .join(","),
    );
    return [headers.join(","), ...rows].join("\n");
  }, [activeMembers, draftRounds]);

  const playerIdTemplateText = useMemo(() => {
    return "mlb_api_id,middle_name,status,years\n660271,,MH,0\n665742,James,MC,0\n592450,,MH,1";
  }, []);

  const downloadTextFile = (filename: string, text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUploadPlayers = () => {
    if (playerIdAnalysis.uniqueIds.length === 0) {
      toast({ title: "No valid IDs", description: "Enter numeric MLB player IDs separated by commas or newlines.", variant: "destructive" });
      return;
    }
    uploadPlayers.mutate({
      mlbIds: playerIdAnalysis.uniqueIds,
      middleNamesByMlbId: playerIdAnalysis.middleNamesByMlbId,
      minorLeagueStatusByMlbId: playerIdAnalysis.minorLeagueStatusByMlbId,
      minorLeagueYearsByMlbId: playerIdAnalysis.minorLeagueYearsByMlbId,
    });
  };

  const csvPreview = useMemo(() => {
    if (!csvText.trim()) return null;
    const lines = csvText.trim().split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return { error: "CSV must have a header row and at least one pick row" };
    const headers = lines[0].split(",").map(h => h.trim());
    const abbrSet = new Set(activeMembers.map(m => (m.user?.teamAbbreviation || "").toUpperCase()).filter(Boolean));
    const unknownAbbrs: string[] = [];
    const rows: string[][] = [];
    const rowLengthIssues: number[] = [];
    const blankCells: Array<{ row: number; round: string }> = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(",").map(c => c.trim().toUpperCase());
      rows.push(cells);
      if (cells.length !== headers.length) rowLengthIssues.push(i + 1);
      headers.forEach((roundName, idx) => {
        if (!cells[idx]) blankCells.push({ row: i + 1, round: roundName || `Round ${idx + 1}` });
      });
      cells.forEach(c => {
        if (c && !abbrSet.has(c) && !unknownAbbrs.includes(c)) unknownAbbrs.push(c);
      });
    }
    return { headers, rows, unknownAbbrs, rowLengthIssues, blankCells, rounds: headers.length, picks: rows.length };
  }, [csvText, activeMembers]);

  const handleUploadCsv = () => {
    if (!csvText.trim()) {
      toast({ title: "No CSV Data", description: "Paste your draft order CSV first.", variant: "destructive" });
      return;
    }
    if (csvPreview?.error) {
      toast({ title: "Invalid CSV", description: csvPreview.error, variant: "destructive" });
      return;
    }
    if (csvPreview?.unknownAbbrs && csvPreview.unknownAbbrs.length > 0) {
      toast({ title: "Unknown Abbreviations", description: `Fix these before uploading: ${csvPreview.unknownAbbrs.join(", ")}`, variant: "destructive" });
      return;
    }
    if (csvPreview?.rowLengthIssues && csvPreview.rowLengthIssues.length > 0) {
      toast({ title: "Invalid CSV Rows", description: `Rows with wrong column count: ${csvPreview.rowLengthIssues.join(", ")}`, variant: "destructive" });
      return;
    }
    if (csvPreview?.blankCells && csvPreview.blankCells.length > 0) {
      toast({ title: "Blank Cells Found", description: "Each pick slot needs a team abbreviation.", variant: "destructive" });
      return;
    }
    uploadCsvOrder.mutate(csvText);
  };

  const orderByRound = (roundNumber: number) => {
    if (!draftOrderData) return [];
    return draftOrderData
      .filter(o => o.roundNumber === roundNumber)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  };

  const availablePlayers = draftPlayers?.filter(dp => dp.status === "available") || [];
  const filteredPlayers = playerSearchText.trim()
    ? availablePlayers.filter(dp =>
        dp.player.fullName.toLowerCase().includes(playerSearchText.toLowerCase()) ||
        (dp.player.currentTeamName || "").toLowerCase().includes(playerSearchText.toLowerCase()) ||
        (dp.player.primaryPosition || "").toLowerCase().includes(playerSearchText.toLowerCase())
      )
    : availablePlayers;
  const nowMs = Date.now();
  const formatCentralInput = (value?: string | Date | null) =>
    value ? formatInTimeZone(new Date(value), "America/Chicago", "yyyy-MM-dd'T'HH:mm") : "";

  const commissionerTargetSlot = useMemo(() => {
    if (!commPickUserId || !draftPicks) return null;
    const eligible = draftPicks
      .filter((slot) =>
        slot.userId === commPickUserId &&
        !slot.madeAt &&
        new Date(slot.scheduledAt).getTime() <= nowMs)
      .sort((a, b) => a.overallPickNumber - b.overallPickNumber);
    return eligible[0] || null;
  }, [commPickUserId, draftPicks, nowMs]);

  const commissionerSlotRound = useMemo(() => {
    if (!commissionerTargetSlot || !draftRounds) return null;
    return draftRounds.find((r) => r.roundNumber === commissionerTargetSlot.round) || null;
  }, [commissionerTargetSlot, draftRounds]);

  const commissionerIsTeamDraftSlot = commissionerSlotRound?.isTeamDraft === true;

  const remainingOrgOptions = useMemo(() => {
    const counts = new Map<string, { count: number; orgId: number | null }>();
    const claimed = new Set(
      (draftPicks || [])
        .filter((slot) => !!slot.madeAt && !!slot.selectedOrgName)
        .map((slot) => slot.selectedOrgName as string),
    );
    for (const dp of availablePlayers) {
      const orgName = dp.player.parentOrgName;
      if (!orgName || claimed.has(orgName)) continue;
      const entry = counts.get(orgName);
      if (entry) {
        entry.count += 1;
      } else {
        counts.set(orgName, { count: 1, orgId: dp.player.parentOrgId ?? null });
      }
    }
    return Array.from(counts.entries())
      .map(([name, meta]) => ({ name, count: meta.count, orgId: meta.orgId }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [availablePlayers, draftPicks]);

  const nextOpenSlot = useMemo(() => {
    if (!draftPicks) return null;
    return draftPicks
      .filter((slot) => !slot.madeAt)
      .sort((a, b) => a.overallPickNumber - b.overallPickNumber)[0] || null;
  }, [draftPicks]);

  const handleInitSettings = () => {
    if (draft) {
      setEditName(draft.name);
      setEditPickDuration(draft.pickDurationMinutes || 30);
      setEditTeamDraftRound(draft.teamDraftRound ? String(draft.teamDraftRound) : "");
      setShowSettings(true);
    }
  };

  if (!draftId || isNaN(draftId)) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-muted-foreground">Invalid draft.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/commissioner/draft")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Drafts
        </Button>
      </div>
    );
  }

  if (!draft && draftsLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!draft && !draftsLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-4">
        <p className="text-muted-foreground">Draft not found in the selected league context.</p>
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          <p className="font-medium">Current league: {currentLeague?.name || "Not selected"}</p>
          <p className="text-muted-foreground">If this draft belongs to a different league, switch leagues in the header and reopen this page.</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/commissioner/draft")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Drafts
        </Button>
      </div>
    );
  }

  if (!draft) return null;

  const statusBadge = (status: string) => {
    const variant = status === "active" ? "default" : status === "completed" ? "secondary" : "outline";
    return <Badge variant={variant}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate("/commissioner/draft")} data-testid="button-back-drafts">
          <ArrowLeft className="h-4 w-4 mr-1" />Drafts
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-draft-detail-title">
          {draft.name}
        </h1>
        {statusBadge(draft.status)}
        <span className="text-sm text-muted-foreground">Season {draft.season}</span>
      </div>

      {draft.status === "setup" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Commissioner Setup Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="font-medium">League scope</p>
                <p className="text-muted-foreground">You are editing this draft in league: <span className="font-medium text-foreground">{currentLeague?.name || "Unknown league"}</span> (ID {selectedLeagueId || "?"}).</p>
              </div>
              <p>1. Upload MLB API player IDs and verify the parsing summary before submitting.</p>
              <p>2. Download or paste the draft-order CSV template, then replace abbreviations as needed.</p>
              <p>3. Review round settings and start times, then click Start Draft.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Upload Player IDs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Paste MLB API player IDs from your source list. You can use commas/spaces/one per line, or CSV rows like <code>mlb_api_id,middle_name</code> to save optional middle names.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPlayerIdsText("660271\n665742\n592450")}
                  data-testid="button-load-player-id-template"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />Load Example IDs
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadTextFile("draft-player-ids-template.csv", playerIdTemplateText)}
                  data-testid="button-download-player-id-template"
                >
                  <Download className="h-4 w-4 mr-2" />Download ID Template
                </Button>
              </div>
              <Textarea
                placeholder="IDs only: 660271,665742 OR CSV rows: 660271, 665742,James"
                value={playerIdsText}
                onChange={e => setPlayerIdsText(e.target.value)}
                rows={5}
                data-testid="textarea-player-ids"
              />
              {!!playerIdsText.trim() && (
                <div className="rounded-md border bg-muted/20 p-3 space-y-2 text-sm" data-testid="player-id-preview">
                  <p>
                    <span className="font-medium">{playerIdAnalysis.uniqueIds.length}</span> unique valid IDs
                    {playerIdAnalysis.duplicateIds.length > 0 && (
                      <span className="text-muted-foreground">, {playerIdAnalysis.duplicateIds.length} duplicates ignored</span>
                    )}
                    {playerIdAnalysis.invalidTokens.length > 0 && (
                      <span className="text-muted-foreground">, {playerIdAnalysis.invalidTokens.length} non-numeric values ignored</span>
                    )}
                  </p>
                  {playerIdAnalysis.duplicateIds.length > 0 && (
                    <p className="text-muted-foreground">
                      Duplicate IDs: {playerIdAnalysis.duplicateIds.slice(0, 10).join(", ")}
                      {playerIdAnalysis.duplicateIds.length > 10 ? "..." : ""}
                    </p>
                  )}
                  {playerIdAnalysis.invalidTokens.length > 0 && (
                    <p className="text-muted-foreground">
                      Ignored values: {playerIdAnalysis.invalidTokens.slice(0, 10).join(", ")}
                      {playerIdAnalysis.invalidTokens.length > 10 ? "..." : ""}
                    </p>
                  )}
                </div>
              )}
              <Button onClick={handleUploadPlayers} disabled={uploadPlayers.isPending || !playerIdsText.trim()} data-testid="button-upload-players">
                {uploadPlayers.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : <><Upload className="mr-2 h-4 w-4" />Upload Players</>}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Player Pool ({draftPlayers?.length ?? 0})</CardTitle>
              {draftPlayers && draftPlayers.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" data-testid="button-clear-players"><Trash2 className="h-4 w-4 mr-1" />Clear All</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear Player Pool</AlertDialogTitle>
                      <AlertDialogDescription>Remove all players from the draft pool? This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => clearPlayers.mutate()} data-testid="button-confirm-clear-players">Clear All</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardHeader>
            <CardContent>
              {loadingPlayers ? (
                <Skeleton className="h-32 w-full" />
              ) : draftPlayers && draftPlayers.length > 0 ? (
                <div className="border rounded-md overflow-hidden max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftPlayers.map(dp => (
                        <TableRow key={dp.id} data-testid={`row-player-${dp.id}`}>
                          <TableCell className="font-medium">{dp.player.fullName}</TableCell>
                          <TableCell>{dp.player.primaryPosition || "-"}</TableCell>
                          <TableCell>
                            {formatAffiliatedTeamLabel({
                              currentTeamName: dp.player.currentTeamName,
                              parentOrgName: dp.player.parentOrgName,
                              sportLevel: dp.player.sportLevel,
                            })}
                          </TableCell>
                          <TableCell><Badge variant={dp.status === "available" ? "outline" : "secondary"}>{dp.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No players in the pool yet. Upload MLB player IDs above.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Draft Order (CSV Upload)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Upload a CSV where column headers are round names and each row is one pick position.</p>
                <p>Each cell must be a team abbreviation (for example: NYY, BOS, LAD).</p>
                {activeMembers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs font-medium">Available abbreviations:</span>
                    {activeMembers.map(m => (
                      <Badge key={m.userId} variant="outline" className="text-xs">
                        {m.user?.teamAbbreviation || "?"} = {m.user?.teamName || m.user?.email}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCsvText(csvTemplateText)}
                  data-testid="button-load-csv-template"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />Load Template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadTextFile("draft-order-template.csv", csvTemplateText)}
                  data-testid="button-download-csv-template"
                >
                  <Download className="h-4 w-4 mr-2" />Download Template
                </Button>
              </div>
              <Textarea
                placeholder={`Round 1,Round 2,Round 3\nNYY,BOS,NYY\nBOS,NYY,BOS\nLAD,LAD,LAD`}
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                rows={8}
                className="font-mono text-sm"
                data-testid="textarea-csv-order"
              />
              {csvPreview && !csvPreview.error && (
                <div className="border rounded-md p-3 bg-muted/30 space-y-2" data-testid="csv-preview">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-medium">{csvPreview.rounds} rounds</span>
                    <span className="text-muted-foreground">{csvPreview.picks} picks per round</span>
                  </div>
                  {csvPreview.rowLengthIssues && csvPreview.rowLengthIssues.length > 0 && (
                    <p className="text-sm text-destructive" data-testid="csv-row-length-error">
                      Rows with missing/extra columns: {csvPreview.rowLengthIssues.join(", ")}
                    </p>
                  )}
                  {csvPreview.blankCells && csvPreview.blankCells.length > 0 && (
                    <p className="text-sm text-destructive" data-testid="csv-blank-cell-error">
                      Blank pick slots found: {csvPreview.blankCells.length}
                    </p>
                  )}
                  {csvPreview.unknownAbbrs && csvPreview.unknownAbbrs.length > 0 && (
                    <div className="text-sm text-destructive flex flex-wrap gap-1 items-center" data-testid="csv-unknown-abbrs">
                      <span className="font-medium">Unknown abbreviations:</span>
                      {csvPreview.unknownAbbrs.map(a => (
                        <Badge key={a} variant="destructive" className="text-xs">{a}</Badge>
                      ))}
                    </div>
                  )}
                  {csvPreview.unknownAbbrs && csvPreview.unknownAbbrs.length === 0 && (!csvPreview.rowLengthIssues || csvPreview.rowLengthIssues.length === 0) && (!csvPreview.blankCells || csvPreview.blankCells.length === 0) && (
                    <p className="text-sm text-green-600 dark:text-green-400" data-testid="csv-valid">All team abbreviations valid</p>
                  )}
                </div>
              )}
              {csvPreview?.error && (
                <p className="text-sm text-destructive" data-testid="csv-error">{csvPreview.error}</p>
              )}
              <Button onClick={handleUploadCsv} disabled={uploadCsvOrder.isPending || !csvText.trim() || !!(csvPreview?.error) || !!(csvPreview?.unknownAbbrs?.length) || !!(csvPreview?.rowLengthIssues?.length) || !!(csvPreview?.blankCells?.length)} data-testid="button-upload-csv-order">
                {uploadCsvOrder.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : <><FileSpreadsheet className="mr-2 h-4 w-4" />Upload Draft Order</>}
              </Button>
            </CardContent>
          </Card>

          {draftRounds && draftRounds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ListOrdered className="h-5 w-5" />Round Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead className="min-w-[140px]">Round Name</TableHead>
                        <TableHead className="w-28 text-center">Team Draft</TableHead>
                        <TableHead className="min-w-[200px]">Start Date/Time</TableHead>
                        <TableHead className="min-w-[100px]">Pick Duration</TableHead>
                        <TableHead className="min-w-[200px]">Order Preview</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftRounds.map(round => {
                        const roundEntries = orderByRound(round.roundNumber);
                        const startTimeCentral = formatCentralInput(round.startTime);
                        return (
                          <TableRow key={round.id} data-testid={`row-round-${round.id}`}>
                            <TableCell className="font-mono">{round.roundNumber}</TableCell>
                            <TableCell>
                              <Input
                                value={round.name}
                                onChange={e => updateRound.mutate({ roundId: round.id, data: { name: e.target.value } })}
                                className="h-8 text-sm"
                                data-testid={`input-round-name-${round.id}`}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={round.isTeamDraft}
                                onCheckedChange={checked => updateRound.mutate({ roundId: round.id, data: { isTeamDraft: checked } })}
                                data-testid={`switch-team-draft-${round.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="datetime-local"
                                value={startTimeCentral}
                                onChange={e => {
                                  const val = e.target.value;
                                  updateRound.mutate({
                                    roundId: round.id,
                                    data: { startTime: val || "" },
                                  });
                                }}
                                className="h-8 text-sm"
                                data-testid={`input-round-start-${round.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={1}
                                  max={1440}
                                  value={round.pickDurationMinutes}
                                  onChange={e => updateRound.mutate({
                                    roundId: round.id,
                                    data: { pickDurationMinutes: e.target.value },
                                  })}
                                  className="h-8 text-sm w-16"
                                  data-testid={`input-pick-duration-${round.id}`}
                                />
                                <span className="text-xs text-muted-foreground">min</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {roundEntries.map((entry, idx) => (
                                  <Badge key={`${entry.userId}-${idx}`} variant="outline" className="text-xs">
                                    {entry.user.teamAbbreviation || entry.user.teamName || entry.user.email}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    <Clock className="inline h-3.5 w-3.5 mr-1" />
                    Enter each round start in Central Time (America/Chicago). Picks open on the configured cadence; missed picks stay open while later slots still open on schedule.
                  </p>
                  {draftRounds.some(r => r.isTeamDraft) && (
                    <p className="text-sm text-muted-foreground">
                      Rounds marked as "Team Draft" let the picking team select an MLB organization, drafting all remaining affiliated players at once.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Draft Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {showSettings ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} data-testid="input-edit-draft-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-pick-duration">Pick Duration (minutes)</Label>
                    <Input id="edit-pick-duration" type="number" value={editPickDuration} onChange={e => setEditPickDuration(Number(e.target.value))} min={1} max={1440} data-testid="input-edit-pick-duration" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-team-round">Team Draft Round (optional)</Label>
                    <Input id="edit-team-round" type="number" value={editTeamDraftRound} onChange={e => setEditTeamDraftRound(e.target.value)} min={1} placeholder="Leave blank for none" data-testid="input-edit-team-round" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button onClick={() => updateDraft.mutate()} disabled={updateDraft.isPending} data-testid="button-save-settings">
                      {updateDraft.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Settings"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm"><span className="text-muted-foreground">Name:</span> {draft.name}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Pick Duration:</span> {draft.pickDurationMinutes || 30} minutes</p>
                  <p className="text-sm"><span className="text-muted-foreground">Team Draft Round:</span> {draft.teamDraftRound || "None"}</p>
                  <Button variant="outline" onClick={handleInitSettings} data-testid="button-edit-settings">
                    <Settings className="h-4 w-4 mr-2" />Edit Settings
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 flex-wrap">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button data-testid="button-start-draft"><Play className="h-4 w-4 mr-2" />Start Draft</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start Draft</AlertDialogTitle>
                  <AlertDialogDescription>Once started, the draft setup cannot be changed. Are you ready to begin?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => startDraft.mutate()} data-testid="button-confirm-start-draft">
                    {startDraft.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting...</> : "Start Draft"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" data-testid="button-delete-draft"><Trash2 className="h-4 w-4 mr-2" />Delete Draft</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Draft</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete the draft and all associated data. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteDraft.mutate()} data-testid="button-confirm-delete-draft">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {(draft.status === "active" || draft.status === "completed") && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                {draft.status === "active" ? "Active Draft" : "Draft Results"}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {draft.status === "active" && (
                  <>
                    <Button onClick={() => setCommPickDialogOpen(true)} data-testid="button-commissioner-pick">
                      <UserPlus className="h-4 w-4 mr-2" />Make Pick
                    </Button>
                    <Button variant="outline" onClick={() => window.open(`/draft/${draft.id}`, '_blank')} data-testid="button-open-draft-board">
                      Open Draft Board
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" data-testid="button-complete-draft">Complete Draft</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Complete Draft</AlertDialogTitle>
                          <AlertDialogDescription>End this draft early? Any remaining picks will not be made.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => completeDraft.mutate()} data-testid="button-confirm-complete-draft">
                            Complete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {draft.status === "active" && (
                <p className="text-sm text-muted-foreground mb-4">
                  {nextOpenSlot
                    ? `Next open slot: Round ${nextOpenSlot.round}, Pick ${nextOpenSlot.roundPickIndex + 1} (Overall ${nextOpenSlot.overallPickNumber})`
                    : "All slots are currently filled"}
                </p>
              )}
              {draftPicks && draftPicks.length > 0 ? (
                <div className="border rounded-md overflow-hidden overflow-x-auto max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Overall</TableHead>
                        <TableHead>Round</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Selection</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead>Roster</TableHead>
                        {draft.status === "active" && <TableHead className="w-16">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftPicks.map(pick => (
                        <TableRow key={pick.id} data-testid={`row-pick-${pick.id}`}>
                          <TableCell className="font-mono">{pick.overallPickNumber}</TableCell>
                          <TableCell className="font-mono">{pick.round}</TableCell>
                          <TableCell className="font-medium">{pick.user.teamName || `${pick.user.firstName} ${pick.user.lastName}`}</TableCell>
                          <TableCell>{pick.player?.fullName || pick.selectedOrgName || <span className="text-muted-foreground">Unfilled</span>}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(pick.scheduledAt).toLocaleString()}</TableCell>
                          <TableCell>
                            {pick.rosterType ? (
                              <Badge variant={pick.rosterType === "mlb" ? "default" : "outline"}>
                                {pick.rosterType === "mlb" ? "MLB" : "MiLB"}
                              </Badge>
                            ) : (
                              <Badge variant="outline">-</Badge>
                            )}
                          </TableCell>
                          {draft.status === "active" && pick.madeAt && (
                            <TableCell>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`button-nullify-pick-${pick.id}`}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Nullify Pick</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Undo this pick? The selection will be returned to the available pool and removed from {pick.user.teamName || "the team"}'s roster.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => nullifyPick.mutate(pick.id)} data-testid={`button-confirm-nullify-${pick.id}`}>
                                      Nullify Pick
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          )}
                          {draft.status === "active" && !pick.madeAt && <TableCell />}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No picks made yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={commPickDialogOpen} onOpenChange={setCommPickDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Commissioner Pick</DialogTitle>
            <DialogDescription>Make a pick on behalf of a team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={commPickUserId} onValueChange={(value) => {
                setCommPickUserId(value);
                setCommPickPlayerId(null);
                setCommPickOrgName("");
              }}>
                <SelectTrigger data-testid="select-comm-pick-team">
                  <SelectValue placeholder="Select team..." />
                </SelectTrigger>
                <SelectContent>
                  {activeMembers.map(m => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.user?.teamName || m.user?.teamAbbreviation || m.user?.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {commissionerTargetSlot && (
              <div className="text-sm text-muted-foreground">
                Slot: Round {commissionerTargetSlot.round}, Pick {commissionerTargetSlot.roundPickIndex + 1} (Overall {commissionerTargetSlot.overallPickNumber})
              </div>
            )}
            {!commissionerTargetSlot && commPickUserId && (
              <div className="text-sm text-muted-foreground">
                This team has no eligible open slot right now.
              </div>
            )}
            <div className="space-y-2">
              <Label>Roster Type</Label>
              <Select value={commPickRosterType} onValueChange={v => setCommPickRosterType(v as "mlb" | "milb")}>
                <SelectTrigger data-testid="select-comm-pick-roster">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mlb">MLB</SelectItem>
                  <SelectItem value="milb">MiLB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {commissionerIsTeamDraftSlot ? (
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select value={commPickOrgName} onValueChange={setCommPickOrgName}>
                  <SelectTrigger data-testid="select-comm-pick-org">
                    <SelectValue placeholder="Select organization..." />
                  </SelectTrigger>
                  <SelectContent>
                    {remainingOrgOptions.map((org) => (
                      <SelectItem key={org.name} value={org.name}>
                        {org.name} ({org.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {remainingOrgOptions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No organizations with available players remain.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Player</Label>
                <Input
                  placeholder="Search available players..."
                  value={playerSearchText}
                  onChange={e => setPlayerSearchText(e.target.value)}
                  data-testid="input-comm-pick-search"
                />
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {filteredPlayers.length > 0 ? (
                    <Table>
                      <TableBody>
                        {filteredPlayers.slice(0, 50).map(dp => (
                          <TableRow
                            key={dp.id}
                            className={`cursor-pointer ${commPickPlayerId === dp.mlbPlayerId ? "bg-primary/10" : ""}`}
                            onClick={() => setCommPickPlayerId(dp.mlbPlayerId)}
                            data-testid={`row-comm-pick-player-${dp.mlbPlayerId}`}
                          >
                            <TableCell className="font-medium py-2">{dp.player.fullName}</TableCell>
                            <TableCell className="py-2 text-muted-foreground">{dp.player.primaryPosition || "-"}</TableCell>
                            <TableCell className="py-2 text-muted-foreground">
                              {formatAffiliatedTeamLabel({
                                currentTeamName: dp.player.currentTeamName,
                                parentOrgName: dp.player.parentOrgName,
                                sportLevel: dp.player.sportLevel,
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground p-3">No available players found.</p>
                  )}
                </div>
                {commPickPlayerId && (
                  <p className="text-sm">
                    Selected: <span className="font-medium">{availablePlayers.find(p => p.mlbPlayerId === commPickPlayerId)?.player.fullName}</span>
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommPickDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!commPickUserId) return;
                if (commissionerIsTeamDraftSlot) {
                  if (!commPickOrgName) return;
                  const orgMeta = remainingOrgOptions.find((o) => o.name === commPickOrgName);
                  commissionerPick.mutate({
                    userId: commPickUserId,
                    selectedOrgName: commPickOrgName,
                    selectedOrgId: orgMeta?.orgId ?? null,
                    rosterType: commPickRosterType,
                  });
                } else if (commPickPlayerId) {
                  commissionerPick.mutate({ userId: commPickUserId, mlbPlayerId: commPickPlayerId, rosterType: commPickRosterType });
                }
              }}
              disabled={
                !commPickUserId ||
                !commissionerTargetSlot ||
                commissionerPick.isPending ||
                (commissionerIsTeamDraftSlot ? !commPickOrgName : !commPickPlayerId)
              }
              data-testid="button-confirm-comm-pick"
            >
              {commissionerPick.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Making Pick...</> : "Make Pick"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
