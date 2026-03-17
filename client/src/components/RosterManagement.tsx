import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { stripAccents } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatAffiliatedTeamLabel } from "@/lib/teamDisplay";
import { isUncardedOnMlbRoster } from "@/lib/playerCarding";
import { useToast } from "@/hooks/use-toast";
import type { MlbPlayer, LeagueMember, League } from "@shared/schema";
import { Search, UserPlus, Trash2, ArrowRightLeft, Loader2, Users, ChevronLeft, ChevronRight, AlertTriangle, Download, FileSpreadsheet, HeartPulse, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";

interface RosterAssignment {
  id: number;
  leagueId: number;
  userId: string;
  mlbPlayerId: number;
  rosterType: string;
  season: number;
  createdAt: string;
  acquired: string | null;
  contractStatus: string | null;
  salary2026: string | null;
  rosterSlot: string | null;
  minorLeagueStatus: string | null;
  minorLeagueYears: number | null;
  player: MlbPlayer;
}

interface RosterCount {
  userId: string;
  rosterType: string;
  count: number;
}

interface RosterManagementProps {
  leagueId: number;
  league: League;
  members: LeagueMember[];
  isCommissioner: boolean;
  rosterLevel?: "mlb" | "milb";
  showOnboardingTools?: boolean;
  onboardingScope?: "mlb" | "milb";
}

interface ReconciliationCandidate {
  mlbApiId: number;
  fullName: string;
  age: number | null;
  currentTeamName: string | null;
  parentOrgName: string | null;
  sportLevel: string;
  lastActiveSeason?: number | null;
  score: number;
}

interface ReconciliationRow {
  rowNum: number;
  playerName: string;
  teamAbbreviation: string;
  rosterType: "mlb" | "milb" | "draft";
  ageHint?: number | null;
  mlbTeamHint?: string | null;
  orgHint?: string | null;
  fangraphsId?: string | null;
  resolutionHint?: string | null;
  duplicateConflictKey?: string | null;
  duplicateTeamOptions?: Array<{
    userId: string;
    teamAbbreviation: string;
    rowNums: number[];
  }>;
  candidates: ReconciliationCandidate[];
}

interface CsvUploadResult {
  processed: number;
  created: number;
  errors: string[];
  warnings: string[];
  unresolvedCount: number;
  cutCount: number;
  middleNamesUpdated: number;
}

interface LatestReconciliationResponse {
  source: string;
  rosterType?: "mlb" | "milb" | "draft";
  processed: number;
  created: number;
  unresolvedCount: number;
  errors?: string[];
  csvData?: string | null;
  persistedCutRows?: number[];
  unresolved: ReconciliationRow[];
}

interface ReconciliationProgressResponse {
  leagueId: number;
  season: number;
  rosterType?: "mlb" | "milb" | "draft";
  updatedAt: string;
  running: boolean;
  processed: number;
  totalRows: number;
  percent: number;
  stage: "matching" | "applying" | "awaiting_resolution" | "importing" | "completed" | "error";
  message?: string | null;
}

type ReconciliationAction = "idle" | "upload" | "rerun" | "apply" | "save";

interface DuplicateMlbAssignment {
  assignmentId: number;
  userId: string;
  teamName: string | null;
  teamAbbreviation: string | null;
  createdAt?: string | null;
}

interface DuplicateMlbPlayerRecord {
  mlbPlayerId: number;
  mlbApiId: number | null;
  playerName: string;
  assignments: DuplicateMlbAssignment[];
}

interface DuplicateMlbAssignmentsResponse {
  leagueId: number;
  season: number;
  rosterType: "mlb";
  duplicatePlayerCount: number;
  duplicateAssignmentCount: number;
  duplicates: DuplicateMlbPlayerRecord[];
}

function formatLevelWithYear(sportLevel: string, lastActiveSeason?: number | null, lastActiveLevel?: string | null): string {
  const cardYear = new Date().getFullYear() - 1;
  if (lastActiveSeason && lastActiveSeason < cardYear) {
    const displayLevel = lastActiveLevel || sportLevel;
    return `${displayLevel} (${lastActiveSeason})`;
  }
  return lastActiveLevel || sportLevel;
}

export default function RosterManagement({ leagueId, league, members, isCommissioner, rosterLevel, showOnboardingTools = false, onboardingScope }: RosterManagementProps) {
  const { toast } = useToast();
  const season = new Date().getFullYear();
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");
  const [selectedRosterType, setSelectedRosterType] = useState<string>(rosterLevel || "all");
  const [rosterSearch, setRosterSearch] = useState("");
  const [faSearch, setFaSearch] = useState("");
  const [faLevel, setFaLevel] = useState<string>(rosterLevel === "mlb" ? "MLB" : rosterLevel === "milb" ? "MiLB" : "all");
  const [faPage, setFaPage] = useState(0);
  const FA_PAGE_SIZE = 50;
  const [csvUploadText, setCsvUploadText] = useState("");
  const [csvDefaultRosterType, setCsvDefaultRosterType] = useState<"mlb" | "milb">(
    onboardingScope || (rosterLevel === "mlb" ? "mlb" : "milb"),
  );


  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignPlayer, setAssignPlayer] = useState<MlbPlayer | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRosterType, setAssignRosterType] = useState("mlb");
  const [unresolvedRows, setUnresolvedRows] = useState<ReconciliationRow[]>([]);
  const [resolutionMap, setResolutionMap] = useState<Record<string, string>>({});
  const [duplicateTeamResolutionMap, setDuplicateTeamResolutionMap] = useState<Record<string, string>>({});
  const [cutMap, setCutMap] = useState<Record<string, boolean>>({});
  const [confirmedRowMap, setConfirmedRowMap] = useState<Record<string, boolean>>({});
  const [confirmedDuplicateConflictMap, setConfirmedDuplicateConflictMap] = useState<Record<string, string>>({});
  const [lastCsvUploadResult, setLastCsvUploadResult] = useState<CsvUploadResult | null>(null);
  const [hydratedFromLatest, setHydratedFromLatest] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconciliationAction, setReconciliationAction] = useState<ReconciliationAction>("idle");
  const reconciliationScope = useMemo(() => {
    if (showOnboardingTools && onboardingScope) return onboardingScope;
    if (showOnboardingTools) return csvDefaultRosterType;
    return (rosterLevel === "mlb" || rosterLevel === "milb") ? rosterLevel : csvDefaultRosterType;
  }, [showOnboardingTools, rosterLevel, csvDefaultRosterType, onboardingScope]);
  const reconciliationDraftStorageKey = useMemo(
    () => `cbl.reconcileDraft.${leagueId}.${season}.${reconciliationScope}`,
    [leagueId, season, reconciliationScope],
  );
  const reconciliationCsvStorageKey = useMemo(
    () => `cbl.reconcileCsv.${leagueId}.${season}.${reconciliationScope}`,
    [leagueId, season, reconciliationScope],
  );
  const normalizeCsvForHash = (text: string) =>
    String(text || "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();
  const hashText = (text: string) => {
    const normalized = normalizeCsvForHash(text);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
    }
    return String(hash);
  };
  const isTemplateLikeCsv = (rawCsv: string) => {
    const normalized = String(rawCsv || "").toLowerCase();
    if (!normalized.trim()) return false;
    const hasExampleProspect = normalized.includes("example prospect");
    const hasShoheiTemplate = normalized.includes("shohei ohtani");
    const lines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.length <= 6 && hasExampleProspect && hasShoheiTemplate;
  };

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState<RosterAssignment | null>(null);
  const [editRosterType, setEditRosterType] = useState("");
  const [editUserId, setEditUserId] = useState("");
  const [editContractStatus, setEditContractStatus] = useState("");
  const [editSalary, setEditSalary] = useState("");
  const [editMinorLeagueStatus, setEditMinorLeagueStatus] = useState("");
  const [editMinorLeagueYears, setEditMinorLeagueYears] = useState("");
  const [editAcquired, setEditAcquired] = useState("");
  const [editRosterSlot, setEditRosterSlot] = useState("");
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [tradeTeamAUserId, setTradeTeamAUserId] = useState("");
  const [tradeTeamBUserId, setTradeTeamBUserId] = useState("");
  const [tradeTeamAAssignmentIds, setTradeTeamAAssignmentIds] = useState<number[]>([]);
  const [tradeTeamBAssignmentIds, setTradeTeamBAssignmentIds] = useState<number[]>([]);

  const activeMembers = useMemo(
    () =>
      members
        .filter((m) => !m.isArchived)
        .slice()
        .sort((a, b) => {
          const aKey = (a.teamName || a.teamAbbreviation || a.userId).toLowerCase();
          const bKey = (b.teamName || b.teamAbbreviation || b.userId).toLowerCase();
          return aKey.localeCompare(bKey);
        }),
    [members],
  );

  const { data: rosterData, isLoading: loadingRoster } = useQuery<{
    assignments: RosterAssignment[];
    counts: RosterCount[];
    il60Counts: Record<string, number>;
  }>({
    queryKey: ["/api/leagues", leagueId, "roster-assignments", selectedTeamId, selectedRosterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTeamId !== "all") params.set("userId", selectedTeamId);
      if (selectedRosterType !== "all") params.set("rosterType", selectedRosterType);
      const res = await fetch(`/api/leagues/${leagueId}/roster-assignments?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: faData, isLoading: loadingFA } = useQuery<{
    players: MlbPlayer[];
    total: number;
  }>({
    queryKey: ["/api/leagues", leagueId, "unassigned-players", faSearch, faLevel, faPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(FA_PAGE_SIZE),
        offset: String(faPage * FA_PAGE_SIZE),
      });
      if (faSearch) params.set("search", faSearch);
      if (faLevel !== "all") params.set("sportLevel", faLevel);
      const res = await fetch(`/api/leagues/${leagueId}/unassigned-players?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (data: { mlbPlayerId: number; assignToUserId: string; rosterType: string; season: number }) => {
      return apiRequest("POST", `/api/leagues/${leagueId}/roster-assignments`, data);
    },
    onSuccess: () => {
      toast({ title: "Player assigned to roster" });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "roster-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "unassigned-players"] });
      setAssignDialogOpen(false);
      setAssignPlayer(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to assign", description: error.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: { id: number; [key: string]: any }) => {
      const { id, ...body } = data;
      return apiRequest("PATCH", `/api/leagues/${leagueId}/roster-assignments/${id}`, body);
    },
    onSuccess: () => {
      toast({ title: "Player assignment updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "roster-assignments"] });
      setEditDialogOpen(false);
      setEditAssignment(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      return apiRequest("DELETE", `/api/leagues/${leagueId}/roster-assignments/${assignmentId}`);
    },
    onSuccess: () => {
      toast({ title: "Player removed from roster" });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "roster-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "unassigned-players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "roster-assignments", "duplicates", reconciliationScope] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
    },
  });

  const toggleIL60Mutation = useMutation({
    mutationFn: async ({ assignmentId, currentSlot }: { assignmentId: number; currentSlot: string | null }) => {
      const newSlot = currentSlot === "60" ? null : "60";
      return apiRequest("PATCH", `/api/leagues/${leagueId}/roster-assignments/${assignmentId}`, { rosterSlot: newSlot });
    },
    onSuccess: (_data, variables) => {
      const action = variables.currentSlot === "60" ? "removed from" : "placed on";
      toast({ title: `Player ${action} 60-day IL` });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "roster-assignments"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update IL status", description: error.message, variant: "destructive" });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/leagues/${leagueId}/roster-assignments?season=${season}`);
    },
    onSuccess: () => {
      toast({ title: "All roster assignments cleared" });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "roster-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "unassigned-players"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to clear", description: error.message, variant: "destructive" });
    },
  });

  const scopeLabel = reconciliationScope.toUpperCase();
  const latestReconciliationQuery = useQuery<LatestReconciliationResponse | null>({
    queryKey: ["/api/leagues", leagueId, "roster-reconciliation", "latest", reconciliationScope],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${leagueId}/roster-reconciliation/latest?rosterType=${encodeURIComponent(reconciliationScope)}`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load latest unresolved rows");
      return res.json();
    },
    enabled: isCommissioner && showOnboardingTools,
    retry: false,
  });
  const reconciliationProgressQuery = useQuery<ReconciliationProgressResponse | null>({
    queryKey: ["/api/leagues", leagueId, "roster-reconciliation", "progress", reconciliationScope],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${leagueId}/roster-reconciliation/progress?rosterType=${encodeURIComponent(reconciliationScope)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load reconciliation progress");
      return res.json();
    },
    enabled: isCommissioner && showOnboardingTools,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as ReconciliationProgressResponse | null | undefined;
      if (isReconciling || data?.running) return 1000;
      return false;
    },
  });
  const duplicateAssignmentsQuery = useQuery<DuplicateMlbAssignmentsResponse>({
    queryKey: ["/api/leagues", leagueId, "roster-assignments", "duplicates", reconciliationScope],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${leagueId}/roster-assignments/duplicates?rosterType=${encodeURIComponent(reconciliationScope)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load duplicate assignments");
      return res.json();
    },
    enabled: isCommissioner && showOnboardingTools,
    retry: false,
  });
  const resetReconciliationScopeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/leagues/${leagueId}/roster-reconciliation/reset`, {
        rosterType: reconciliationScope,
        season,
      });
    },
    onSuccess: () => {
      setCsvUploadText("");
      setUnresolvedRows([]);
      setResolutionMap({});
      setDuplicateTeamResolutionMap({});
      setCutMap({});
      setConfirmedRowMap({});
      setConfirmedDuplicateConflictMap({});
      setLastCsvUploadResult(null);
      setHydratedFromLatest(false);
      localStorage.removeItem(reconciliationDraftStorageKey);
      localStorage.removeItem(reconciliationCsvStorageKey);
      latestReconciliationQuery.refetch();
      reconciliationProgressQuery.refetch();
      toast({ title: `${scopeLabel} reconciliation reset` });
    },
    onError: (error: any) => {
      toast({ title: "Failed to reset reconciliation", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (hydratedFromLatest) return;
    if (!latestReconciliationQuery.isFetchedAfterMount) return;
    if (lastCsvUploadResult) return;
    if (unresolvedRows.length > 0) return;
    const latest = latestReconciliationQuery.data;
    if (!latest) return;
    if (isTemplateLikeCsv(String(latest.csvData || ""))) {
      setHydratedFromLatest(true);
      setLastCsvUploadResult(null);
      setUnresolvedRows([]);
      setResolutionMap({});
      setDuplicateTeamResolutionMap({});
      setCutMap({});
      setConfirmedRowMap({});
      setConfirmedDuplicateConflictMap({});
      toast({
        title: "Template snapshot ignored",
        description: "Latest reconciliation state contains sample template rows. Upload your real CSV to continue.",
        variant: "destructive",
      });
      return;
    }
    const unresolved = Array.isArray(latest.unresolved) ? latest.unresolved : [];
    const latestErrors = Array.isArray(latest.errors) ? latest.errors : [];
    if (unresolved.length === 0 && latestErrors.length === 0) return;
    const incomingCsvData = (!csvUploadText.trim() && latest.csvData) ? String(latest.csvData) : csvUploadText;
    if (!csvUploadText.trim() && latest.csvData) setCsvUploadText(latest.csvData);
    const incomingCsvHash = hashText(String(incomingCsvData || "").trim());
    const initialMap: Record<string, string> = {};
    for (const row of unresolved) {
      if (row.candidates?.[0]?.mlbApiId) {
        initialMap[String(row.rowNum)] = String(row.candidates[0].mlbApiId);
      }
    }
    let storedResolutionMap: Record<string, string> = {};
    let storedDuplicateTeamResolutionMap: Record<string, string> = {};
    let storedCutMap: Record<string, boolean> = {};
    const unresolvedRowNums = new Set(unresolved.map((r) => String(r.rowNum)));
    const unresolvedConflictKeys = new Set(
      unresolved
        .map((r) => String(r.duplicateConflictKey || "").trim())
        .filter(Boolean),
    );
    try {
      const raw = localStorage.getItem(reconciliationDraftStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const filterStringMap = (value: unknown) => {
          const out: Record<string, string> = {};
          if (!value || typeof value !== "object") return out;
          for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (!unresolvedRowNums.has(String(k))) continue;
            if (typeof v === "string") out[String(k)] = v;
            else if (typeof v === "number" && Number.isFinite(v)) out[String(k)] = String(v);
          }
          return out;
        };
        const filterBooleanMap = (value: unknown) => {
          const out: Record<string, boolean> = {};
          if (!value || typeof value !== "object") return out;
          for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (!unresolvedRowNums.has(String(k))) continue;
            out[String(k)] = v === true;
          }
          return out;
        };
        const sameLeagueSeason =
          Number(parsed?.leagueId) === Number(leagueId) &&
          Number(parsed?.season) === Number(season) &&
          String(parsed?.scope || "") === String(reconciliationScope);
        const sameCsv = String(parsed?.csvHash || "") === incomingCsvHash;
        if (sameLeagueSeason && (sameCsv || unresolvedRowNums.size > 0)) {
          storedResolutionMap = filterStringMap(parsed?.resolutionMap);
          const duplicateMapRaw = parsed?.duplicateTeamResolutionMap;
          if (duplicateMapRaw && typeof duplicateMapRaw === "object") {
            for (const [k, v] of Object.entries(duplicateMapRaw as Record<string, unknown>)) {
              if (!unresolvedConflictKeys.has(String(k))) continue;
              if (typeof v === "string" && v.trim()) storedDuplicateTeamResolutionMap[String(k)] = v;
            }
          }
          storedCutMap = filterBooleanMap(parsed?.cutMap);
        }
      }
    } catch {
      // Ignore bad local draft state.
    }
    const persistedCutsFromServer: Record<string, boolean> = {};
    for (const rowNum of Array.isArray(latest.persistedCutRows) ? latest.persistedCutRows : []) {
      const numericRowNum = Number(rowNum);
      if (Number.isInteger(numericRowNum) && numericRowNum > 0) {
        persistedCutsFromServer[String(numericRowNum)] = true;
      }
    }
    const mergedCutMap: Record<string, boolean> = { ...persistedCutsFromServer, ...storedCutMap };
    // Server unresolved rows are source of truth; do not re-hide rows from stale local confirmations.
    const mergedConfirmedMap: Record<string, boolean> = {};
    const visibleUnresolved = unresolved;
    setUnresolvedRows(visibleUnresolved);
    setResolutionMap({ ...initialMap, ...storedResolutionMap });
    setDuplicateTeamResolutionMap(storedDuplicateTeamResolutionMap);
    setCutMap(mergedCutMap);
    setConfirmedRowMap(mergedConfirmedMap);
    setLastCsvUploadResult((prev) => prev ?? ({
      processed: Number(latest.processed || 0),
      created: Number(latest.created || 0),
      errors: latestErrors,
      warnings: [],
      unresolvedCount: Number(latest.unresolvedCount || unresolved.length),
      cutCount: Object.keys(mergedCutMap).filter((rowNum) => !!mergedCutMap[rowNum]).length,
      middleNamesUpdated: 0,
    }));
    setHydratedFromLatest(true);
  }, [
    hydratedFromLatest,
    latestReconciliationQuery.data,
    latestReconciliationQuery.isFetchedAfterMount,
    csvUploadText,
    reconciliationDraftStorageKey,
    lastCsvUploadResult,
    unresolvedRows.length,
  ]);

  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      const csvHash = hashText(csvUploadText.trim());
      const hasDraftState =
        Object.keys(resolutionMap).length > 0 ||
        Object.keys(duplicateTeamResolutionMap).length > 0 ||
        Object.keys(cutMap).some((rowNum) => !!cutMap[rowNum]) ||
        Object.keys(confirmedRowMap).some((rowNum) => !!confirmedRowMap[rowNum]);
      if (!hasDraftState) {
        localStorage.removeItem(reconciliationDraftStorageKey);
        return;
      }
      const payload = {
        leagueId,
        season,
        scope: reconciliationScope,
        csvHash,
        resolutionMap,
        duplicateTeamResolutionMap,
        cutMap,
        confirmedRowMap,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(reconciliationDraftStorageKey, JSON.stringify(payload));
    }, 300);
    return () => { if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current); };
  }, [csvUploadText, resolutionMap, duplicateTeamResolutionMap, cutMap, confirmedRowMap, reconciliationDraftStorageKey]);

  useEffect(() => {
    if (!showOnboardingTools) return;
    try {
      const scopedCsv = localStorage.getItem(reconciliationCsvStorageKey);
      setCsvUploadText(scopedCsv || "");
    } catch {
      setCsvUploadText("");
    }
  }, [showOnboardingTools, reconciliationCsvStorageKey]);

  useEffect(() => {
    if (!showOnboardingTools) return;
    const trimmed = csvUploadText.trim();
    if (!trimmed) {
      localStorage.removeItem(reconciliationCsvStorageKey);
      return;
    }
    localStorage.setItem(reconciliationCsvStorageKey, csvUploadText);
  }, [showOnboardingTools, reconciliationCsvStorageKey, csvUploadText]);

  const handleReloadLatestReconciliation = () => {
    // Force re-hydration from latest server snapshot.
    setHydratedFromLatest(false);
    setUnresolvedRows([]);
    setResolutionMap({});
    setDuplicateTeamResolutionMap({});
    setCutMap({});
    setConfirmedRowMap({});
    setConfirmedDuplicateConflictMap({});
    setLastCsvUploadResult(null);
    queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "roster-reconciliation", "latest", reconciliationScope] });
    latestReconciliationQuery.refetch();
  };

  useEffect(() => {
    if (!showOnboardingTools) return;
    if (onboardingScope) {
      setCsvDefaultRosterType(onboardingScope);
      return;
    }
    // Switching MLB/MiLB upload mode should switch reconciliation scope and reload scoped state.
    setHydratedFromLatest(false);
    setUnresolvedRows([]);
    setResolutionMap({});
    setDuplicateTeamResolutionMap({});
    setCutMap({});
    setConfirmedRowMap({});
    setConfirmedDuplicateConflictMap({});
    setLastCsvUploadResult(null);
  }, [showOnboardingTools, reconciliationScope, onboardingScope]);

  const tradeMutation = useMutation({
    mutationFn: async (payload: {
      season: number;
      teamAUserId: string;
      teamBUserId: string;
      teamAAssignmentIds: number[];
      teamBAssignmentIds: number[];
    }) => {
      const res = await apiRequest("POST", `/api/leagues/${leagueId}/roster-assignments/trade`, payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Trade Completed",
        description: `${data.movedFromA || 0} moved from Team A, ${data.movedFromB || 0} moved from Team B`,
      });
      setTradeDialogOpen(false);
      setTradeTeamAAssignmentIds([]);
      setTradeTeamBAssignmentIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "roster-assignments"] });
    },
    onError: (error: any) => {
      toast({ title: "Trade Failed", description: error.message, variant: "destructive" });
    },
  });

  const uploadRosterCsvMutation = useMutation({
    onMutate: () => {
      setIsReconciling(true);
    },
    mutationFn: async (payload?: {
      resolutions?: Record<string, number>;
      duplicateTeamResolutions?: Record<string, string>;
      cuts?: number[];
      action?: ReconciliationAction;
    }) => {
      const action = payload?.action || "upload";
      const resolutions = payload?.resolutions;
      const cuts = payload?.cuts ?? Object.entries(cutMap)
        .filter(([, isCut]) => isCut)
        .map(([rowNum]) => Number(rowNum))
        .filter((rowNum) => Number.isInteger(rowNum) && rowNum > 0);
      const duplicateTeamResolutions =
        payload?.duplicateTeamResolutions ?? duplicateTeamResolutionMap;
      const response = await apiRequest("POST", `/api/leagues/${leagueId}/roster-assignments/upload-csv`, {
        csvData: csvUploadText,
        season,
        defaultRosterType: csvDefaultRosterType,
        operation: action,
        assumePageScope: !!onboardingScope,
        resolutions,
        duplicateTeamResolutions,
        cuts,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      if (data.requiresResolution && Array.isArray(data.unresolved)) {
        // We are already handling fresh server response; prevent stale latest-snapshot hydration.
        setHydratedFromLatest(true);
        const unresolvedRowsData = (data.unresolved as ReconciliationRow[]).filter(
          (row) => row.rosterType === reconciliationScope,
        );
        const isApplyResult = reconciliationAction === "apply";
        const isSaveResult = reconciliationAction === "save";
        const confirmedSnapshot = (isApplyResult || isSaveResult) ? {} : { ...confirmedRowMap };
        const visibleUnresolvedRows = unresolvedRowsData.filter((row) => !confirmedSnapshot[String(row.rowNum)]);
        const unresolvedCount = visibleUnresolvedRows.length;
        setLastCsvUploadResult({
          processed: Number(data.processed || 0),
          created: Number(data.created || 0),
          errors: Array.isArray(data.errors) ? data.errors : [],
          warnings: Array.isArray(data.warnings) ? data.warnings : [],
          unresolvedCount,
          cutCount: Number(data.cutCount || 0),
          middleNamesUpdated: Number(data.middleNamesUpdated || 0),
        });
        const nextPersistedCuts: Record<string, boolean> = {};
        for (const rowNum of Array.isArray(data.persistedCutRows) ? data.persistedCutRows : []) {
          const numericRowNum = Number(rowNum);
          if (Number.isInteger(numericRowNum) && numericRowNum > 0) {
            nextPersistedCuts[String(numericRowNum)] = true;
          }
        }
        setUnresolvedRows(visibleUnresolvedRows);
        const initialMap: Record<string, string> = {};
        const duplicateInitialMap: Record<string, string> = {};
        for (const row of unresolvedRowsData) {
          if (row.candidates?.[0]?.mlbApiId) {
            initialMap[String(row.rowNum)] = String(row.candidates[0].mlbApiId);
          }
          if (row.duplicateConflictKey && row.duplicateTeamOptions?.length) {
            const preferred = row.duplicateTeamOptions.find((o) => o.teamAbbreviation === row.teamAbbreviation);
            if (preferred) duplicateInitialMap[row.duplicateConflictKey] = preferred.userId;
          }
        }
        setResolutionMap((prev) => ({ ...initialMap, ...prev }));
        setDuplicateTeamResolutionMap((prev) => ({ ...duplicateInitialMap, ...prev }));
        setCutMap((prev) => ({ ...nextPersistedCuts, ...prev }));
        if (isApplyResult) {
          // Re-validate from server after apply: server is source of truth for remaining unresolved rows.
          setConfirmedRowMap({});
          setConfirmedDuplicateConflictMap({});
        }
        if (unresolvedCount > 0) {
          toast({ title: "Review Needed", description: `${unresolvedCount} rows need commissioner confirmation before import.` });
        } else if (isSaveResult) {
          toast({ title: "Saved", description: "Confirmed reconciliation saved. Continue confirming rows, then apply to import." });
        } else {
          toast({ title: "Fix CSV Rows", description: "No players were imported. Correct the row errors and upload again.", variant: "destructive" });
        }
        return;
      }
      setLastCsvUploadResult({
        processed: Number(data.processed || 0),
        created: Number(data.created || 0),
        errors: Array.isArray(data.errors) ? data.errors : [],
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
        unresolvedCount: 0,
        cutCount: Number(data.cutCount || 0),
        middleNamesUpdated: Number(data.middleNamesUpdated || 0),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "roster-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "unassigned-players"] });
      const parts = [`${data.created || 0} assigned`];
      if ((data.cutCount || 0) > 0) parts.push(`${data.cutCount} cut`);
      if (data.middleNamesUpdated > 0) parts.push(`${data.middleNamesUpdated} middle names saved`);
      if (data.errors?.length) parts.push(`${data.errors.length} errors`);
      if (data.warnings?.length) parts.push(`${data.warnings.length} warnings`);
      toast({ title: "CSV Upload Complete", description: parts.join(", ") });
      setUnresolvedRows([]);
      setResolutionMap({});
      setDuplicateTeamResolutionMap({});
      setCutMap({});
      setConfirmedRowMap({});
      setConfirmedDuplicateConflictMap({});
      // Finalize completed; keep current in-memory result and refresh latest snapshot in background.
      setHydratedFromLatest(true);
      latestReconciliationQuery.refetch();
      if (data.errors?.length) {
        toast({ title: "CSV Errors", description: data.errors.slice(0, 3).join(" | "), variant: "destructive" });
      }
      if (data.warnings?.length) {
        toast({ title: "Roster Limit Warnings", description: data.warnings.slice(0, 3).join(" | ") });
      }
      if ((data.created || 0) > 0) {
        setCsvUploadText("");
      }
    },
    onError: (error: any) => {
      const isTimeout = /timeout|network|fetch|abort|failed to fetch/i.test(error?.message || "");
      if (isTimeout) {
        toast({ title: "Request timed out", description: "Processing continues on the server. Progress will update automatically." });
      } else {
        toast({ title: "CSV Upload Failed", description: error.message, variant: "destructive" });
      }
    },
    onSettled: () => {
      setIsReconciling(false);
      setReconciliationAction("idle");
      reconciliationProgressQuery.refetch();
    },
  });
  const runReconciliationUpload = (
    action: ReconciliationAction,
    resolutions?: Record<string, number>,
    options?: { duplicateTeamResolutions?: Record<string, string>; cuts?: number[] },
  ) => {
    // During active upload/rerun/apply, never auto-hydrate from cached latest snapshots.
    setHydratedFromLatest(true);
    if (action === "upload" || action === "rerun") {
      setUnresolvedRows([]);
      setResolutionMap({});
      setDuplicateTeamResolutionMap({});
      setCutMap({});
      setConfirmedRowMap({});
      setConfirmedDuplicateConflictMap({});
      setLastCsvUploadResult(null);
      localStorage.removeItem(reconciliationDraftStorageKey);
    }
    setReconciliationAction(action);
    uploadRosterCsvMutation.mutate({
      resolutions,
      action,
      duplicateTeamResolutions: options?.duplicateTeamResolutions,
      cuts: options?.cuts,
    });
  };

  const filteredAssignments = useMemo(() => {
    if (!rosterData?.assignments) return [];
    if (!rosterSearch) return rosterData.assignments;
    const q = stripAccents(rosterSearch.toLowerCase());
    return rosterData.assignments.filter(a => stripAccents(a.player.fullName.toLowerCase()).includes(q));
  }, [rosterData?.assignments, rosterSearch]);

  const parsedUploadErrors = useMemo(() => {
    if (!lastCsvUploadResult?.errors?.length) return [];
    return lastCsvUploadResult.errors.map((err) => {
      const match = /^Row\s+(\d+):\s*(.+)$/i.exec(err);
      return {
        rowNum: match ? Number(match[1]) : null,
        reason: match ? match[2] : err,
        raw: err,
      };
    });
  }, [lastCsvUploadResult?.errors]);

  const numericResolutionMap = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [rowNum, value] of Object.entries(resolutionMap)) {
      if (cutMap[rowNum]) continue;
      const id = Number(value);
      if (Number.isInteger(id) && id > 0) out[rowNum] = id;
    }
    return out;
  }, [resolutionMap, cutMap]);
  const progressPayload = reconciliationProgressQuery.data;
  const progressActive = Boolean(isReconciling || progressPayload?.running);
  const progressProcessed = Number(progressPayload?.processed || 0);
  const progressTotal = Number(progressPayload?.totalRows || 0);
  const progressPercent = progressTotal > 0
    ? Math.max(0, Math.min(100, Math.round((progressProcessed / progressTotal) * 100)))
    : Number(progressPayload?.percent || 0);
  const selectedCutCount = useMemo(
    () => Object.values(cutMap).filter((v) => v === true).length,
    [cutMap],
  );
  const reconciliationUnresolvedCount = unresolvedRows.length;
  const alreadyImportedCount = Number(lastCsvUploadResult?.created || 0);
  const readyToImportCount = Math.max(
    0,
    Number(lastCsvUploadResult?.processed || 0) - alreadyImportedCount - reconciliationUnresolvedCount - selectedCutCount,
  );
  const hideFinalTotalsWhileProcessing = progressActive && (
    progressPayload?.stage === "matching" ||
    progressPayload?.stage === "applying" ||
    progressPayload?.stage === "importing"
  );
  const confirmedRowCount = useMemo(
    () => Object.keys(confirmedRowMap).filter((rowNum) => confirmedRowMap[rowNum]).length,
    [confirmedRowMap],
  );
  const confirmedNumericResolutionMap = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [rowNum, confirmed] of Object.entries(confirmedRowMap)) {
      if (!confirmed) continue;
      if (cutMap[rowNum]) continue;
      const id = Number(resolutionMap[rowNum]);
      if (Number.isInteger(id) && id > 0) out[rowNum] = id;
    }
    return out;
  }, [confirmedRowMap, cutMap, resolutionMap]);
  const confirmedDuplicateTeamResolutionMap = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [rowNum, confirmed] of Object.entries(confirmedRowMap)) {
      if (!confirmed) continue;
      const conflictKey = confirmedDuplicateConflictMap[rowNum];
      if (!conflictKey) continue;
      const selectedUserId = String(duplicateTeamResolutionMap[conflictKey] || "").trim();
      if (selectedUserId) out[conflictKey] = selectedUserId;
    }
    return out;
  }, [confirmedRowMap, confirmedDuplicateConflictMap, duplicateTeamResolutionMap]);
  const confirmedCutRows = useMemo(() => {
    return Object.entries(confirmedRowMap)
      .filter(([rowNum, confirmed]) => confirmed && !!cutMap[rowNum])
      .map(([rowNum]) => Number(rowNum))
      .filter((rowNum) => Number.isInteger(rowNum) && rowNum > 0);
  }, [confirmedRowMap, cutMap]);
  const selectedCandidateRowsByMlbId = useMemo(() => {
    const out = new Map<number, number[]>();
    const push = (mlbApiId: number, rowNum: number) => {
      const existing = out.get(mlbApiId) || [];
      existing.push(rowNum);
      out.set(mlbApiId, existing);
    };
    for (const row of unresolvedRows) {
      const rowKey = String(row.rowNum);
      if (cutMap[rowKey]) continue;
      if (row.duplicateConflictKey) continue;
      const id = Number(resolutionMap[rowKey]);
      if (Number.isInteger(id) && id > 0) push(id, row.rowNum);
    }
    for (const [rowKey, confirmed] of Object.entries(confirmedRowMap)) {
      if (!confirmed || cutMap[rowKey]) continue;
      const rowNum = Number(rowKey);
      if (!Number.isInteger(rowNum) || rowNum <= 0) continue;
      const id = Number(resolutionMap[rowKey]);
      if (Number.isInteger(id) && id > 0) push(id, rowNum);
    }
    return out;
  }, [unresolvedRows, resolutionMap, confirmedRowMap, cutMap]);
  const hideReconciliationCardDuringProcessing = progressActive && (
    progressPayload?.stage === "matching" ||
    progressPayload?.stage === "applying" ||
    progressPayload?.stage === "importing"
  );
  const phaseState = useMemo(() => {
    type Phase = "matching" | "reconciliation" | "finalize";
    const phases: Phase[] = ["matching", "reconciliation", "finalize"];
    let current: Phase = "matching";
    const stage = progressPayload?.stage;
    if (stage === "awaiting_resolution") current = "reconciliation";
    else if (stage === "importing" || stage === "completed" || stage === "applying") current = "finalize";
    else if (!progressActive) {
      if (unresolvedRows.length > 0 || confirmedRowCount > 0) current = "reconciliation";
      else if (lastCsvUploadResult) current = "finalize";
    }
    const currentIndex = phases.indexOf(current);
    return phases.map((phase, index) => ({
      phase,
      label: phase === "matching" ? "Matching" : phase === "reconciliation" ? "Reconciliation" : "Finalize",
      status: index < currentIndex ? "done" : index === currentIndex ? "current" : "todo",
    }));
  }, [progressPayload?.stage, progressActive, unresolvedRows.length, confirmedRowCount, lastCsvUploadResult]);
  const inReconciliationPhase = phaseState.some((p) => p.phase === "reconciliation" && p.status === "current");
  const canConfirmRow = (row: ReconciliationRow) => {
    if (cutMap[String(row.rowNum)]) return true;
    if (row.duplicateConflictKey) {
      const selectedUserId = String(duplicateTeamResolutionMap[row.duplicateConflictKey] || "").trim();
      if (selectedUserId) return true;
    }
    const id = Number(resolutionMap[String(row.rowNum)]);
    return Number.isInteger(id) && id > 0;
  };
  const handleConfirmRow = (row: ReconciliationRow) => {
    const rowKey = String(row.rowNum);
    if (!canConfirmRow(row)) {
      toast({
        title: "Resolve row first",
        description: "Choose team/player, enter an MLB ID, or mark Cut before confirming this row.",
        variant: "destructive",
      });
      return;
    }
    setConfirmedRowMap((prev) => ({ ...prev, [rowKey]: true }));
    if (row.duplicateConflictKey) {
      setConfirmedDuplicateConflictMap((prev) => ({ ...prev, [rowKey]: row.duplicateConflictKey! }));
    }
    setUnresolvedRows((prev) => prev.filter((r) => r.rowNum !== row.rowNum));
    toast({
      title: "Confirmed",
      description: "Row confirmed locally. Click Save Progress to persist, or keep confirming and apply when ready.",
    });
  };

  const teamCountMap = useMemo(() => {
    const map: Record<string, { mlb: number; milb: number; draft: number; il60: number }> = {};
    if (!rosterData?.counts) return map;
    for (const c of rosterData.counts) {
      if (!map[c.userId]) map[c.userId] = { mlb: 0, milb: 0, draft: 0, il60: 0 };
      if (c.rosterType === 'mlb') map[c.userId].mlb = c.count;
      else if (c.rosterType === 'milb') map[c.userId].milb = c.count;
      else if (c.rosterType === 'draft') map[c.userId].draft = c.count;
    }
    if (rosterData?.il60Counts) {
      for (const [userId, count] of Object.entries(rosterData.il60Counts)) {
        if (!map[userId]) map[userId] = { mlb: 0, milb: 0, draft: 0, il60: 0 };
        map[userId].il60 = count;
      }
    }
    return map;
  }, [rosterData?.counts, rosterData?.il60Counts]);

  const totalAssigned = useMemo(() => {
    return Object.values(teamCountMap).reduce((sum, c) => sum + c.mlb + c.milb + c.draft, 0);
  }, [teamCountMap]);
  const rosterSummaryTotals = useMemo(() => {
    return activeMembers.reduce(
      (acc, member) => {
        const counts = teamCountMap[member.userId] || { mlb: 0, milb: 0, draft: 0, il60: 0 };
        acc.mlb += counts.mlb;
        acc.milb += counts.milb;
        acc.draft += counts.draft;
        acc.il60 += counts.il60;
        return acc;
      },
      { mlb: 0, milb: 0, draft: 0, il60: 0 },
    );
  }, [activeMembers, teamCountMap]);

  const getMemberName = (userId: string) => {
    const m = members.find(m => m.userId === userId);
    return m?.teamName || m?.teamAbbreviation || userId;
  };

  const tradeTeamAAssignments = useMemo(() => {
    if (!rosterData?.assignments || !tradeTeamAUserId) return [];
    return rosterData.assignments.filter((a) => a.userId === tradeTeamAUserId);
  }, [rosterData?.assignments, tradeTeamAUserId]);

  const tradeTeamBAssignments = useMemo(() => {
    if (!rosterData?.assignments || !tradeTeamBUserId) return [];
    return rosterData.assignments.filter((a) => a.userId === tradeTeamBUserId);
  }, [rosterData?.assignments, tradeTeamBUserId]);

  const csvUploadTemplate = useMemo(() => {
    const teamAbbr = (activeMembers[0]?.teamAbbreviation || "NYY").toUpperCase();
    if (csvDefaultRosterType === "mlb") {
      return `mlb_api_id,team_abbreviation,status,2026,acquired\n660271,${teamAbbr},ARB,45,FA 2024\n`;
    }
    return `mlb_api_id,last_name,first_name,team_abbreviation,org,status,years,acquired\n,Prospect,Example James,${teamAbbr},Dodgers,MH,0,D 2026\n`;
  }, [activeMembers, csvDefaultRosterType]);

  const [csvUploadPreview, setCsvUploadPreview] = useState<{
    error?: string;
    totalRows?: number;
    validRows?: number;
    invalidMlbIds?: number;
    missingValues?: number;
    invalidRosterTypes?: number;
    unknownTeams?: string[];
  } | null>(null);
  const [csvParsing, setCsvParsing] = useState(false);
  const csvPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raw = csvUploadText.trim();
    if (!raw) {
      setCsvUploadPreview(null);
      setCsvParsing(false);
      if (csvPreviewTimerRef.current) clearTimeout(csvPreviewTimerRef.current);
      return;
    }
    setCsvParsing(true);
    if (csvPreviewTimerRef.current) clearTimeout(csvPreviewTimerRef.current);
    csvPreviewTimerRef.current = setTimeout(() => {
      const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setCsvUploadPreview({ error: "CSV must include a header and at least one data row." });
        setCsvParsing(false);
        return;
      }
      const detectDelimiter = (line: string) => {
        const comma = (line.match(/,/g) || []).length;
        const semicolon = (line.match(/;/g) || []).length;
        const tab = (line.match(/\t/g) || []).length;
        if (tab > comma && tab > semicolon) return "\t";
        if (semicolon > comma) return ";";
        return ",";
      };
      const delimiter = detectDelimiter(lines[0]);
      const normalizeHeader = (rawHeader: string) =>
        String(rawHeader || "")
          .replace(/^\uFEFF/, "")
          .replace(/^"+|"+$/g, "")
          .trim()
          .toLowerCase();
      const headers = lines[0].split(delimiter).map((h) => normalizeHeader(h));
      const mlbIdIdx = headers.findIndex((h) => ["mlb_api_id", "mlb_id", "mlbid", "player_id", "id"].includes(h));
      const nameIdx = headers.findIndex((h) => ["player_name", "name", "player", "full_name", "player full name"].includes(h));
      const firstNameIdx = headers.findIndex((h) => ["first_name", "first name", "firstname", "first", "fname"].includes(h));
      const lastNameIdx = headers.findIndex((h) => ["last_name", "last name", "lastname", "last", "lname"].includes(h));
      const abbrIdx = headers.findIndex((h) => ["team_abbreviation", "team_abbrev", "abbreviation", "team", "abbr", "cbl"].includes(h));
      const rosterTypeIdx = headers.findIndex((h) => ["roster_type", "roster type", "type", "scope"].includes(h));
      if ((mlbIdIdx === -1 && nameIdx === -1 && (firstNameIdx === -1 || lastNameIdx === -1)) || abbrIdx === -1) {
        setCsvUploadPreview({ error: "Missing required columns. Include team abbreviation and either MLB API ID, player_name, or first_name + last_name." });
        setCsvParsing(false);
        return;
      }
      if (isTemplateLikeCsv(raw)) {
        setCsvUploadPreview({ error: "Template rows detected (Example Prospect/Shohei Ohtani). Replace with real rows before uploading." });
        setCsvParsing(false);
        return;
      }

      const knownAbbr = new Set(activeMembers.map((m) => (m.teamAbbreviation || "").toUpperCase()).filter(Boolean));
      const unknownTeams = new Set<string>();
      let validRows = 0;
      let invalidMlbIds = 0;
      let missingValues = 0;
      let invalidRosterTypes = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map((c) => c.trim());
        const mlbRaw = mlbIdIdx >= 0 ? cols[mlbIdIdx] : "";
        const firstNameRaw = firstNameIdx >= 0 ? cols[firstNameIdx] : "";
        const lastNameRaw = lastNameIdx >= 0 ? cols[lastNameIdx] : "";
        const nameRaw = nameIdx >= 0
          ? cols[nameIdx]
          : [firstNameRaw, lastNameRaw].filter(Boolean).join(" ").trim();
        const abbrRaw = (cols[abbrIdx] || "").toUpperCase();
        const rosterRaw = (rosterTypeIdx >= 0 ? cols[rosterTypeIdx] : csvDefaultRosterType).toLowerCase();
        const rosterTypeValid = rosterRaw === "" || rosterRaw === "mlb" || rosterRaw === "milb" || rosterRaw === "draft";
        if ((!mlbRaw && !nameRaw) || !abbrRaw) {
          missingValues++;
          continue;
        }
        if (mlbRaw) {
          const mlbId = Number(mlbRaw);
          if (!Number.isInteger(mlbId) || mlbId <= 0) {
            invalidMlbIds++;
            continue;
          }
        }
        if (!knownAbbr.has(abbrRaw)) {
          unknownTeams.add(abbrRaw);
        }
        if (!rosterTypeValid) {
          invalidRosterTypes++;
          continue;
        }
        validRows++;
      }

      setCsvUploadPreview({
        totalRows: lines.length - 1,
        validRows,
        invalidMlbIds,
        missingValues,
        invalidRosterTypes,
        unknownTeams: Array.from(unknownTeams),
      });
      setCsvParsing(false);
    }, 300);
    return () => { if (csvPreviewTimerRef.current) clearTimeout(csvPreviewTimerRef.current); };
  }, [csvUploadText, activeMembers, csvDefaultRosterType]);

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
  const downloadReconciliationAudit = async () => {
    try {
      const res = await fetch(
        `/api/leagues/${leagueId}/roster-reconciliation/audit?rosterType=${encodeURIComponent(reconciliationScope)}&format=csv`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to download reconciliation audit report");
      const blob = await res.blob();
      const filename = `reconciliation-audit-${reconciliationScope}-${season}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ title: "Download Failed", description: error.message, variant: "destructive" });
    }
  };

  const getRosterTypeBadge = (type: string) => {
    switch (type) {
      case 'mlb': return <Badge variant="default" data-testid={`badge-roster-mlb`}>ML</Badge>;
      case 'milb': return <Badge variant="secondary" data-testid={`badge-roster-milb`}>MiLB</Badge>;
      case 'draft': return <Badge variant="outline" data-testid={`badge-roster-draft`}>Draft</Badge>;
      default: return <Badge>{type}</Badge>;
    }
  };

  const openAssignDialog = (player: MlbPlayer) => {
    setAssignPlayer(player);
    setAssignUserId(activeMembers[0]?.userId || "");
    setAssignRosterType("mlb");
    setAssignDialogOpen(true);
  };

  const openEditDialog = (assignment: RosterAssignment) => {
    setEditAssignment(assignment);
    setEditRosterType(assignment.rosterType);
    setEditUserId(assignment.userId);
    setEditContractStatus(assignment.contractStatus || "");
    setEditSalary(assignment.salary2026 != null ? String(assignment.salary2026) : "");
    setEditMinorLeagueStatus(assignment.minorLeagueStatus || "");
    setEditMinorLeagueYears(assignment.minorLeagueYears != null ? String(assignment.minorLeagueYears) : "");
    setEditAcquired(assignment.acquired || "");
    setEditRosterSlot(assignment.rosterSlot || "");
    setEditDialogOpen(true);
  };

  const parsedCsvUploadPreview = csvUploadPreview && !("error" in csvUploadPreview)
    ? csvUploadPreview
    : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-assigned">{totalAssigned}</div>
            <p className="text-xs text-muted-foreground">across {Object.keys(teamCountMap).length} teams</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-unassigned">{faData?.total ?? "..."}</div>
            <p className="text-xs text-muted-foreground">major/minor league free agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Roster Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm" data-testid="text-roster-limits">
              <span className="font-medium">ML:</span> {league.mlRosterLimit || 40} per team
              <span className="mx-2">|</span>
              <span className="font-medium">MiLB:</span> {league.milbRosterLimit || 150} per team
            </div>
          </CardContent>
        </Card>
      </div>

      {isCommissioner && showOnboardingTools && (
        <Card id="reconciliation">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 flex-wrap">
            <CardTitle>Commissioner CSV Upload ({scopeLabel} Scope)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Step 1: {onboardingScope ? `This page is locked to ${scopeLabel} scope.` : "Choose upload type (MiLB or MLB)."} Step 2: Load or download the template. Step 3: Fill rows using MLB API IDs or name columns (<code>player_name</code> or <code>first_name</code> + <code>last_name</code>) with team abbreviation. Optional: add <code>middle_name</code>, <code>org</code>, and MiLB contract status + years. Age and MLB team are auto-populated from API data. Step 4: Upload and resolve every row until there are zero unresolved/errors.
            </p>
            <p className="text-xs text-muted-foreground">
              For MiLB onboarding, use <code>last_name</code> + <code>first_name</code>. The <code>first_name</code> field can include middle names (example: <code>Benjamin David</code>).
            </p>
            <p className="text-xs text-muted-foreground">
              After each upload, review the "Reconciliation Summary" below for imported vs skipped rows and exact skip reasons. Roster type defaults to <code>{reconciliationScope}</code> based on the selected scope.
            </p>
            {!onboardingScope ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant={csvDefaultRosterType === "milb" ? "default" : "outline"}
                  onClick={() => setCsvDefaultRosterType("milb")}
                  data-testid="button-upload-type-milb"
                >
                  MiLB Upload
                </Button>
                <Button
                  type="button"
                  variant={csvDefaultRosterType === "mlb" ? "default" : "outline"}
                  onClick={() => setCsvDefaultRosterType("mlb")}
                  data-testid="button-upload-type-mlb"
                >
                  MLB Upload
                </Button>
                <span className="text-xs text-muted-foreground">
                  Missing <code>roster_type</code> will default to <code>{csvDefaultRosterType}</code>.
                </span>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                This page is locked to <code>{onboardingScope}</code> reconciliation scope.
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={() => setCsvUploadText(csvUploadTemplate)} data-testid="button-load-roster-csv-template">
                <FileSpreadsheet className="h-4 w-4 mr-2" />Load Template
              </Button>
              <Button type="button" variant="outline" onClick={() => downloadTextFile(`roster-assignment-template-${csvDefaultRosterType}.csv`, csvUploadTemplate)} data-testid="button-download-roster-csv-template">
                <Download className="h-4 w-4 mr-2" />Download Template
              </Button>
            </div>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => setCsvUploadText(String(ev.target?.result || ""));
                reader.readAsText(file);
              }}
              data-testid="input-roster-csv-file"
            />
            <Textarea
              rows={6}
              value={csvUploadText}
              onChange={(e) => setCsvUploadText(e.target.value)}
              placeholder={csvUploadTemplate}
              data-testid="textarea-roster-csv"
            />
            {csvParsing && csvUploadText.trim() && (
              <p className="text-sm text-muted-foreground" data-testid="text-roster-csv-parsing">Parsing {csvUploadText.trim().split(/\r?\n/).length.toLocaleString()} lines...</p>
            )}
            {csvUploadPreview?.error && (
              <p className="text-sm text-destructive" data-testid="text-roster-csv-error">{csvUploadPreview.error}</p>
            )}
            {!!parsedCsvUploadPreview && (
              <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-1" data-testid="roster-csv-preview">
                <p><span className="font-medium">{parsedCsvUploadPreview.validRows}</span> valid rows out of {parsedCsvUploadPreview.totalRows}</p>
                {parsedCsvUploadPreview.invalidMlbIds > 0 && <p className="text-muted-foreground">{parsedCsvUploadPreview.invalidMlbIds} rows have invalid MLB API IDs</p>}
                {parsedCsvUploadPreview.missingValues > 0 && <p className="text-muted-foreground">{parsedCsvUploadPreview.missingValues} rows are missing required values</p>}
                {parsedCsvUploadPreview.invalidRosterTypes > 0 && <p className="text-muted-foreground">{parsedCsvUploadPreview.invalidRosterTypes} rows use unsupported roster type values</p>}
                {parsedCsvUploadPreview.unknownTeams.length > 0 && (
                  <p className="text-destructive">
                    Unknown team abbreviations: {parsedCsvUploadPreview.unknownTeams.slice(0, 10).join(", ")}
                    {parsedCsvUploadPreview.unknownTeams.length > 10 ? "..." : ""}
                  </p>
                )}
              </div>
            )}
            <Button
              onClick={() => runReconciliationUpload("upload", undefined)}
              disabled={uploadRosterCsvMutation.isPending || !csvUploadText.trim() || !!csvUploadPreview?.error}
              data-testid="button-upload-roster-csv"
            >
              {uploadRosterCsvMutation.isPending && reconciliationAction === "upload"
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
                : "Upload CSV Assignments"}
            </Button>
            {isCommissioner && (
              <div className="rounded-md border border-amber-400/60 bg-amber-50/40 p-3 space-y-2" data-testid="roster-reconcile-load-latest">
                <p className="text-sm">
                  Active reconciliation scope: <span className="font-medium">{scopeLabel}</span>. Upload, re-run, apply, and latest-load actions only process this scope.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReloadLatestReconciliation}
                    disabled={latestReconciliationQuery.isFetching}
                    data-testid="button-load-latest-unresolved"
                  >
                    {latestReconciliationQuery.isFetching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</> : "Reload Latest Reconciliation"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => runReconciliationUpload("rerun", undefined)}
                    disabled={uploadRosterCsvMutation.isPending || !csvUploadText.trim() || !!csvUploadPreview?.error}
                    data-testid="button-rerun-roster-matching"
                  >
                    {uploadRosterCsvMutation.isPending && reconciliationAction === "rerun"
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Re-running...</>
                      : "Re-run Matching on Loaded CSV"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resetReconciliationScopeMutation.mutate()}
                    disabled={resetReconciliationScopeMutation.isPending || uploadRosterCsvMutation.isPending}
                    data-testid="button-reset-reconciliation-scope"
                  >
                    {resetReconciliationScopeMutation.isPending
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Resetting...</>
                      : "Reset This Scope"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={downloadReconciliationAudit}
                    disabled={uploadRosterCsvMutation.isPending}
                    data-testid="button-download-reconciliation-audit"
                  >
                    Download Audit Report
                  </Button>
                </div>
              </div>
            )}
            {(lastCsvUploadResult || progressActive) && (
              <div className="rounded-md border bg-muted/20 p-3 space-y-2" data-testid="roster-upload-reconciliation-summary">
                <div className="flex items-center gap-3 text-xs" data-testid="reconciliation-phase-dots">
                  {phaseState.map((p, idx) => (
                    <div key={`phase-${p.phase}`} className="flex items-center gap-2">
                      <span
                        className={
                          p.status === "done"
                            ? "inline-block h-2.5 w-2.5 rounded-full bg-emerald-600"
                            : p.status === "current"
                              ? "inline-block h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-blue-200"
                              : "inline-block h-2.5 w-2.5 rounded-full bg-slate-300"
                        }
                      />
                      <span className={p.status === "current" ? "font-medium text-foreground" : "text-muted-foreground"}>
                        {p.label}
                      </span>
                      {idx < phaseState.length - 1 ? <span className="text-muted-foreground">-</span> : null}
                    </div>
                  ))}
                </div>
                <div className="text-sm font-medium">
                  Reconciliation Summary: {
                    hideFinalTotalsWhileProcessing
                      ? `Processing ${progressProcessed.toLocaleString()} / ${progressTotal.toLocaleString()} rows`
                      : (lastCsvUploadResult ? `${lastCsvUploadResult.created} imported / ${lastCsvUploadResult.processed} rows` : "Running...")
                  }
                </div>
                {progressActive && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2" data-testid="text-reconciliation-progress-live">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {reconciliationAction === "apply" ? "Validating and importing confirmed mappings. " : ""}
                    Processing {progressProcessed.toLocaleString()} / {progressTotal.toLocaleString()} rows ({progressPercent}%)
                    {progressPayload?.message ? ` | ${progressPayload.message}` : ""}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {hideFinalTotalsWhileProcessing ? (
                    <>Rows are being evaluated. Imported/skipped totals will appear after processing completes.</>
                  ) : ((reconciliationUnresolvedCount > 0 || confirmedRowCount > 0) || inReconciliationPhase) ? (
                    <>
                      Auto-imported: {alreadyImportedCount.toLocaleString()}
                      {readyToImportCount > 0 ? ` | Skipped: ${readyToImportCount.toLocaleString()}` : ""}
                      {reconciliationUnresolvedCount > 0 ? ` | Needs manual resolution: ${reconciliationUnresolvedCount}` : ""}
                      {confirmedRowCount > 0 ? ` | Confirmed: ${confirmedRowCount}` : ""}
                      {selectedCutCount > 0 ? ` | Marked cut: ${selectedCutCount}` : ""}
                    </>
                  ) : lastCsvUploadResult ? (
                    <>
                      Skipped: {Math.max(0, lastCsvUploadResult.processed - lastCsvUploadResult.created)} rows
                      {lastCsvUploadResult.unresolvedCount > 0 ? ` | Needs manual resolution: ${lastCsvUploadResult.unresolvedCount}` : ""}
                      {lastCsvUploadResult.cutCount > 0 ? ` | Cut: ${lastCsvUploadResult.cutCount}` : ""}
                      {lastCsvUploadResult.middleNamesUpdated > 0 ? ` | Middle names updated: ${lastCsvUploadResult.middleNamesUpdated}` : ""}
                    </>
                  ) : (
                    <>Waiting for reconciliation result...</>
                  )}
                </div>
                {lastCsvUploadResult && lastCsvUploadResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-destructive">Skipped Row Reasons ({lastCsvUploadResult.errors.length})</p>
                    <div className="max-h-36 overflow-y-auto rounded border bg-background p-2 text-xs">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-7 text-xs">Row</TableHead>
                            <TableHead className="h-7 text-xs">Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedUploadErrors.map((err, idx) => (
                            <TableRow key={`upload-error-${idx}`}>
                              <TableCell className="py-1 text-destructive">{err.rowNum ?? "-"}</TableCell>
                              <TableCell className="py-1 text-destructive">{err.reason}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Tip: fix these rows in your CSV (or add MLB IDs), then re-upload.
                    </p>
                  </div>
                )}
                {lastCsvUploadResult && lastCsvUploadResult.warnings.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Warnings ({lastCsvUploadResult.warnings.length})</p>
                    <div className="max-h-24 overflow-y-auto rounded border bg-background p-2 text-xs text-muted-foreground">
                      {lastCsvUploadResult.warnings.map((warning, idx) => (
                        <div key={`upload-warning-${idx}`}>{warning}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {isCommissioner && showOnboardingTools && (duplicateAssignmentsQuery.data?.duplicatePlayerCount || 0) > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2" data-testid="roster-duplicate-mlb-panel">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium text-destructive">
                    Duplicate {scopeLabel} assignments detected: {duplicateAssignmentsQuery.data?.duplicatePlayerCount ?? 0} players
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => duplicateAssignmentsQuery.refetch()}
                    disabled={duplicateAssignmentsQuery.isFetching}
                    data-testid="button-refresh-duplicate-mlb-panel"
                  >
                    {duplicateAssignmentsQuery.isFetching ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Refreshing...</> : "Refresh"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Duplicate assignments are blocked going forward. Remove incorrect assignments here, then continue reconciliation.
                </p>
                <div className="max-h-44 overflow-y-auto rounded border bg-background p-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-7 text-xs">Player</TableHead>
                        <TableHead className="h-7 text-xs">Assigned Teams</TableHead>
                        <TableHead className="h-7 text-xs">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(duplicateAssignmentsQuery.data?.duplicates || []).map((dup) => (
                        <TableRow key={`dup-mlb-${dup.mlbPlayerId}`}>
                          <TableCell className="py-1 align-top">
                            <div className="text-sm font-medium">{dup.playerName}</div>
                            <div className="text-xs text-muted-foreground">{dup.mlbApiId ? `MLB ID ${dup.mlbApiId}` : "No MLB ID"}</div>
                          </TableCell>
                          <TableCell className="py-1 align-top">
                            <div className="space-y-1">
                              {dup.assignments.map((a, index) => (
                                <div key={`dup-mlb-assignment-${a.assignmentId}`} className="text-xs">
                                  {a.teamName || a.teamAbbreviation || a.userId}
                                  {index === 0 ? " (keep)" : ""}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="py-1 align-top">
                            <div className="space-y-1">
                              {dup.assignments.map((a, index) => (
                                <Button
                                  key={`button-remove-dup-mlb-${a.assignmentId}`}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={removeMutation.isPending || index === 0}
                                  onClick={() => removeMutation.mutate(a.assignmentId)}
                                  data-testid={`button-remove-duplicate-mlb-${a.assignmentId}`}
                                >
                                  {index === 0 ? "Keep" : `Remove ${a.teamAbbreviation || a.teamName || a.userId}`}
                                </Button>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            {!hideReconciliationCardDuringProcessing && (unresolvedRows.length > 0 || confirmedRowCount > 0) && (
              <div className="rounded-md border border-amber-400/60 bg-amber-50/40 p-3 space-y-3" data-testid="roster-reconcile-panel">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Roster Reconciliation Needed ({unresolvedRows.length} remaining{confirmedRowCount > 0 ? `, ${confirmedRowCount} confirmed` : ""})
                </div>
                <p className="text-sm text-muted-foreground">
                  Confirm each mapped row to remove it from the list, then apply all confirmed rows to import. Apply re-validates the loaded CSV with your confirmed mappings/cuts; it does not clear your confirmations.
                </p>
                {unresolvedRows.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Input</TableHead>
                          <TableHead>Hints</TableHead>
                          <TableHead>Choose Team</TableHead>
                          <TableHead>Choose Player</TableHead>
                          <TableHead>Manual MLB ID</TableHead>
                          <TableHead>Cut</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unresolvedRows.map((row) => (
                          <TableRow key={`resolve-${row.rowNum}`}>
                            <TableCell className="font-medium">{row.rowNum}</TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{row.playerName}</div>
                              <div className="text-xs text-muted-foreground">{row.teamAbbreviation} | {row.rosterType.toUpperCase()}</div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {row.ageHint ? `Age ${row.ageHint}` : "No age hint"}
                              {row.mlbTeamHint ? ` | Team ${row.mlbTeamHint}` : ""}
                              {row.orgHint ? ` | Org ${row.orgHint}` : ""}
                              {row.fangraphsId ? ` | FG ${row.fangraphsId}` : ""}
                              {row.resolutionHint ? (
                                <div className="mt-1 text-amber-700">{row.resolutionHint}</div>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              {row.duplicateConflictKey && row.duplicateTeamOptions?.length ? (
                                <Select
                                  value={duplicateTeamResolutionMap[row.duplicateConflictKey] || ""}
                                  onValueChange={(v) =>
                                    setDuplicateTeamResolutionMap((prev) => ({ ...prev, [String(row.duplicateConflictKey)]: v }))
                                  }
                                  disabled={!!cutMap[String(row.rowNum)]}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Choose team" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {row.duplicateTeamOptions.map((opt) => (
                                      <SelectItem key={`${row.rowNum}-dup-team-${opt.userId}`} value={opt.userId}>
                                        {opt.teamAbbreviation} (rows {opt.rowNums.join(", ")})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={resolutionMap[String(row.rowNum)] || ""}
                                onValueChange={(v) => setResolutionMap((prev) => ({ ...prev, [String(row.rowNum)]: v }))}
                                disabled={!!cutMap[String(row.rowNum)] || !!row.duplicateConflictKey}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Choose player" />
                                </SelectTrigger>
                                  <SelectContent>
                                    {row.candidates.map((c) => (
                                      <SelectItem key={`${row.rowNum}-${c.mlbApiId}`} value={String(c.mlbApiId)}>
                                        {(() => {
                                          const selectedRows = selectedCandidateRowsByMlbId.get(c.mlbApiId) || [];
                                          const usedElsewhere = selectedRows.some((r) => r !== row.rowNum);
                                          const selectedElsewhereText = usedElsewhere
                                            ? ` * selected on row${selectedRows.filter((r) => r !== row.rowNum).length > 1 ? "s" : ""} ${selectedRows.filter((r) => r !== row.rowNum).join(", ")}`
                                            : "";
                                          return `${c.fullName} (${c.sportLevel})${c.lastActiveSeason ? ` | last played ${c.lastActiveSeason}` : ""} | ${formatAffiliatedTeamLabel({
                                            currentTeamName: c.currentTeamName,
                                            parentOrgName: c.parentOrgName,
                                            sportLevel: c.sportLevel,
                                            fallback: "No team",
                                          })} | score ${c.score}${selectedElsewhereText}`;
                                        })()}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={resolutionMap[String(row.rowNum)] || ""}
                                onChange={(e) => {
                                  const onlyDigits = e.target.value.replace(/\D/g, "");
                                  setResolutionMap((prev) => ({ ...prev, [String(row.rowNum)]: onlyDigits }));
                                }}
                                placeholder={row.candidates.length ? "Optional override" : "Enter MLB ID"}
                                className="h-8"
                                data-testid={`input-reconcile-mlb-id-${row.rowNum}`}
                                disabled={!!cutMap[String(row.rowNum)] || !!row.duplicateConflictKey}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={!!cutMap[String(row.rowNum)]}
                                  onCheckedChange={(checked) => {
                                    const isChecked = checked === true;
                                    setCutMap((prev) => ({ ...prev, [String(row.rowNum)]: isChecked }));
                                  }}
                                />
                                <span className="text-xs text-muted-foreground">Cut</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConfirmRow(row)}
                                disabled={uploadRosterCsvMutation.isPending || !canConfirmRow(row)}
                                data-testid={`button-confirm-reconcile-row-${row.rowNum}`}
                              >
                                Confirm
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                    All listed rows are confirmed. Click apply to import confirmed resolutions/cuts.
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => runReconciliationUpload("apply", numericResolutionMap)}
                    disabled={
                      uploadRosterCsvMutation.isPending ||
                      unresolvedRows.length > 0 ||
                      (unresolvedRows.length === 0 && confirmedRowCount === 0)
                    }
                    data-testid="button-apply-roster-reconciliation"
                  >
                    {uploadRosterCsvMutation.isPending && reconciliationAction === "apply"
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Applying confirmed mappings...</>
                      : `Apply Confirmed Resolutions/Cuts and Import${confirmedRowCount > 0 ? ` (${confirmedRowCount})` : ""}`}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => runReconciliationUpload("save", confirmedNumericResolutionMap, {
                      duplicateTeamResolutions: confirmedDuplicateTeamResolutionMap,
                      cuts: confirmedCutRows,
                    })}
                    disabled={uploadRosterCsvMutation.isPending || confirmedRowCount === 0}
                    data-testid="button-save-roster-reconciliation-progress"
                  >
                    {uploadRosterCsvMutation.isPending && reconciliationAction === "save"
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                      : `Save Progress${confirmedRowCount > 0 ? ` (${confirmedRowCount})` : ""}`}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => runReconciliationUpload("rerun", undefined)}
                    disabled={uploadRosterCsvMutation.isPending || !csvUploadText.trim() || !!csvUploadPreview?.error}
                    data-testid="button-reset-saved-reconciliation-progress"
                  >
                    Reset Saved Progress
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUnresolvedRows([]);
                      setResolutionMap({});
                      setDuplicateTeamResolutionMap({});
                      setCutMap({});
                      setConfirmedRowMap({});
                      setConfirmedDuplicateConflictMap({});
                    }}
                    disabled={uploadRosterCsvMutation.isPending}
                  >
                    Clear Review
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Team Roster Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRoster ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-center">ML ({league.mlRosterLimit || 40})</TableHead>
                  <TableHead className="text-center">60-day IL</TableHead>
                  <TableHead className="text-center">MiLB ({league.milbRosterLimit || 150})</TableHead>
                  <TableHead className="text-center">Draft</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeMembers.map(m => {
                  const counts = teamCountMap[m.userId] || { mlb: 0, milb: 0, draft: 0, il60: 0 };
                  const mlbActive = counts.mlb - counts.il60;
                  const mlbLimit = league.mlRosterLimit || 40;
                  const milbLimit = league.milbRosterLimit || 150;
                  return (
                    <TableRow key={m.userId} data-testid={`row-team-summary-${m.userId}`}>
                      <TableCell className="font-medium">{m.teamName || m.teamAbbreviation || m.userId}</TableCell>
                      <TableCell className="text-center">
                        <span className={mlbActive > mlbLimit ? "text-destructive font-bold" : ""}>
                          {mlbActive}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{counts.il60 || "-"}</TableCell>
                      <TableCell className="text-center">
                        <span className={counts.milb > milbLimit ? "text-destructive font-bold" : ""}>
                          {counts.milb}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{counts.draft}</TableCell>
                      <TableCell className="text-center font-medium">{counts.mlb + counts.milb + counts.draft}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow data-testid="row-team-summary-totals">
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-center font-semibold">{rosterSummaryTotals.mlb - rosterSummaryTotals.il60}</TableCell>
                  <TableCell className="text-center font-semibold">{rosterSummaryTotals.il60 || "-"}</TableCell>
                  <TableCell className="text-center font-semibold">{rosterSummaryTotals.milb}</TableCell>
                  <TableCell className="text-center font-semibold">{rosterSummaryTotals.draft}</TableCell>
                  <TableCell className="text-center font-semibold">
                    {rosterSummaryTotals.mlb + rosterSummaryTotals.milb + rosterSummaryTotals.draft}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 flex-wrap">
          <CardTitle>Roster Assignments</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={rosterSearch}
                onChange={e => setRosterSearch(e.target.value)}
                className="pl-8 w-48"
                data-testid="input-roster-search"
              />
            </div>
            <Select value={selectedTeamId} onValueChange={v => setSelectedTeamId(v)}>
              <SelectTrigger className="w-40" data-testid="select-roster-team">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {activeMembers.map(m => (
                  <SelectItem key={m.userId} value={m.userId}>{m.teamName || m.teamAbbreviation || m.userId}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!rosterLevel && (
              <Select value={selectedRosterType} onValueChange={v => setSelectedRosterType(v)}>
                <SelectTrigger className="w-32" data-testid="select-roster-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="mlb">MLB Roster</SelectItem>
                  <SelectItem value="milb">MiLB System</SelectItem>
                  <SelectItem value="draft">Draft List</SelectItem>
                </SelectContent>
              </Select>
            )}
            {isCommissioner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const first = activeMembers[0]?.userId || "";
                  const second = activeMembers.find((m) => m.userId !== first)?.userId || "";
                  setTradeTeamAUserId(first);
                  setTradeTeamBUserId(second);
                  setTradeTeamAAssignmentIds([]);
                  setTradeTeamBAssignmentIds([]);
                  setTradeDialogOpen(true);
                }}
                data-testid="button-open-trade-dialog"
              >
                <ArrowRightLeft className="h-4 w-4 mr-1" />
                Trade
              </Button>
            )}
            {isCommissioner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" data-testid="button-clear-all-assignments">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Roster Assignments?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all {totalAssigned} roster assignments for the {season} season. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearAllMutation.mutate()} data-testid="button-confirm-clear-all">
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingRoster ? (
            <Skeleton className="h-48 w-full" />
          ) : filteredAssignments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-assignments">
              No roster assignments found. Assign players from the Free Agent Pool below.
            </p>
          ) : (
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Acquired</TableHead>
                    {rosterLevel === "mlb" && <TableHead>Status</TableHead>}
                    {rosterLevel === "mlb" && <TableHead>Salary</TableHead>}
                    <TableHead>Team</TableHead>
                    <TableHead>Roster</TableHead>
                    <TableHead>MLB Team</TableHead>
                    {isCommissioner && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map(a => (
                    <TableRow key={a.id} data-testid={`row-assignment-${a.id}`}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1.5">
                          {a.player.fullName}
                          {isUncardedOnMlbRoster(a.player, a.rosterType) ? " (uncarded)" : ""}
                          {a.rosterSlot === "60" && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0" data-testid={`badge-il60-${a.id}`}>
                              60-day IL
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>{a.player.primaryPosition || "-"}</TableCell>
                      <TableCell>
                        {formatLevelWithYear(a.player.sportLevel, (a.player as any).lastActiveSeason, (a.player as any).lastActiveLevel)}
                      </TableCell>
                      <TableCell className="text-[11px]">{a.acquired || "-"}</TableCell>
                      {rosterLevel === "mlb" && <TableCell className="text-[11px]">{a.contractStatus || "-"}</TableCell>}
                      {rosterLevel === "mlb" && <TableCell className="text-[11px]">{a.salary2026 || "-"}</TableCell>}
                      <TableCell>{getMemberName(a.userId)}</TableCell>
                      <TableCell>{getRosterTypeBadge(a.rosterType)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatAffiliatedTeamLabel({
                          currentTeamName: a.player.currentTeamName,
                          parentOrgName: a.player.parentOrgName,
                          sportLevel: a.player.sportLevel,
                        })}
                      </TableCell>
                      {isCommissioner && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {rosterLevel === "mlb" && (
                              <Button
                                size="icon"
                                variant={a.rosterSlot === "60" ? "destructive" : "ghost"}
                                onClick={() => toggleIL60Mutation.mutate({ assignmentId: a.id, currentSlot: a.rosterSlot })}
                                disabled={toggleIL60Mutation.isPending}
                                title={a.rosterSlot === "60" ? "Remove from 60-day IL" : "Place on 60-day IL"}
                                data-testid={`button-toggle-il60-${a.id}`}
                              >
                                <HeartPulse className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditDialog(a)}
                              title="Edit player assignment"
                              data-testid={`button-edit-${a.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeMutation.mutate(a.id)}
                              disabled={removeMutation.isPending}
                              data-testid={`button-remove-${a.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 flex-wrap">
          <CardTitle>Free Agent Pool</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search free agents..."
                value={faSearch}
                onChange={e => { setFaSearch(e.target.value); setFaPage(0); }}
                className="pl-8 w-48"
                data-testid="input-fa-search"
              />
            </div>
            <Select value={faLevel} onValueChange={v => { setFaLevel(v); setFaPage(0); }}>
              <SelectTrigger className="w-40" data-testid="select-fa-level">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="MLB">MLB Free Agents</SelectItem>
                <SelectItem value="MiLB">MiLB Free Agents</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loadingFA ? (
            <Skeleton className="h-48 w-full" />
          ) : !faData?.players?.length ? (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-fa">
              No unassigned players found. All players have been assigned to rosters.
            </p>
          ) : (
            <>
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>FA Class</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>MLB Team</TableHead>
                      <TableHead>B/T</TableHead>
                      {isCommissioner && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faData.players.map(p => (
                      <TableRow key={p.id} data-testid={`row-fa-${p.id}`}>
                        <TableCell className="font-medium">{p.fullName}</TableCell>
                        <TableCell>{p.primaryPosition || "-"}</TableCell>
                        <TableCell>
                          {p.sportLevel === "MLB" ? (
                            <Badge variant="default">MLB FA</Badge>
                          ) : (
                            <Badge variant="secondary">MiLB FA</Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatLevelWithYear(p.sportLevel, (p as any).lastActiveSeason, (p as any).lastActiveLevel)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatAffiliatedTeamLabel({
                            currentTeamName: p.currentTeamName,
                            parentOrgName: p.parentOrgName,
                            sportLevel: p.sportLevel,
                          })}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.batSide || "-"}/{p.throwHand || "-"}</TableCell>
                        {isCommissioner && (
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAssignDialog(p)}
                              data-testid={`button-assign-${p.id}`}
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              Assign
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground" data-testid="text-fa-count">
                  Showing {faPage * FA_PAGE_SIZE + 1}-{Math.min((faPage + 1) * FA_PAGE_SIZE, faData.total)} of {faData.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={faPage === 0}
                    onClick={() => setFaPage(p => p - 1)}
                    data-testid="button-fa-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={(faPage + 1) * FA_PAGE_SIZE >= faData.total}
                    onClick={() => setFaPage(p => p + 1)}
                    data-testid="button-fa-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={tradeDialogOpen} onOpenChange={setTradeDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Commissioner Trade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select two teams and choose any MLB or MiLB players from each side. The trade executes atomically.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Team A</label>
                <Select
                  value={tradeTeamAUserId}
                  onValueChange={(v) => {
                    setTradeTeamAUserId(v);
                    if (v === tradeTeamBUserId) {
                      const alt = activeMembers.find((m) => m.userId !== v)?.userId || "";
                      setTradeTeamBUserId(alt);
                    }
                    setTradeTeamAAssignmentIds([]);
                  }}
                >
                  <SelectTrigger data-testid="select-trade-team-a">
                    <SelectValue placeholder="Select Team A" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMembers.map((m) => (
                      <SelectItem key={`trade-a-${m.userId}`} value={m.userId}>
                        {m.teamName || m.teamAbbreviation || m.userId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="max-h-72 overflow-y-auto border rounded-md p-2 space-y-1">
                  {tradeTeamAAssignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">No players available for Team A</p>
                  ) : tradeTeamAAssignments.map((a) => (
                    <label key={`trade-a-assign-${a.id}`} className="flex items-start gap-2 p-1 rounded hover:bg-muted/40">
                      <Checkbox
                        checked={tradeTeamAAssignmentIds.includes(a.id)}
                        onCheckedChange={(checked) => {
                          setTradeTeamAAssignmentIds((prev) =>
                            checked ? [...prev, a.id] : prev.filter((id) => id !== a.id),
                          );
                        }}
                      />
                      <div className="text-sm">
                        <div className="font-medium">
                          {a.player.fullName}
                          {isUncardedOnMlbRoster(a.player, a.rosterType) ? " (uncarded)" : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.player.primaryPosition || "-"} | {a.rosterType.toUpperCase()} | {formatLevelWithYear(a.player.sportLevel, (a.player as any).lastActiveSeason, (a.player as any).lastActiveLevel)}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Team B</label>
                <Select
                  value={tradeTeamBUserId}
                  onValueChange={(v) => {
                    setTradeTeamBUserId(v);
                    if (v === tradeTeamAUserId) {
                      const alt = activeMembers.find((m) => m.userId !== v)?.userId || "";
                      setTradeTeamAUserId(alt);
                    }
                    setTradeTeamBAssignmentIds([]);
                  }}
                >
                  <SelectTrigger data-testid="select-trade-team-b">
                    <SelectValue placeholder="Select Team B" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMembers.map((m) => (
                      <SelectItem key={`trade-b-${m.userId}`} value={m.userId}>
                        {m.teamName || m.teamAbbreviation || m.userId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="max-h-72 overflow-y-auto border rounded-md p-2 space-y-1">
                  {tradeTeamBAssignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">No players available for Team B</p>
                  ) : tradeTeamBAssignments.map((a) => (
                    <label key={`trade-b-assign-${a.id}`} className="flex items-start gap-2 p-1 rounded hover:bg-muted/40">
                      <Checkbox
                        checked={tradeTeamBAssignmentIds.includes(a.id)}
                        onCheckedChange={(checked) => {
                          setTradeTeamBAssignmentIds((prev) =>
                            checked ? [...prev, a.id] : prev.filter((id) => id !== a.id),
                          );
                        }}
                      />
                      <div className="text-sm">
                        <div className="font-medium">
                          {a.player.fullName}
                          {isUncardedOnMlbRoster(a.player, a.rosterType) ? " (uncarded)" : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.player.primaryPosition || "-"} | {a.rosterType.toUpperCase()} | {formatLevelWithYear(a.player.sportLevel, (a.player as any).lastActiveSeason, (a.player as any).lastActiveLevel)}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 p-2 text-sm">
              Trading <span className="font-medium">{tradeTeamAAssignmentIds.length}</span> from Team A and{" "}
              <span className="font-medium">{tradeTeamBAssignmentIds.length}</span> from Team B.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTradeDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => tradeMutation.mutate({
                season,
                teamAUserId: tradeTeamAUserId,
                teamBUserId: tradeTeamBUserId,
                teamAAssignmentIds: tradeTeamAAssignmentIds,
                teamBAssignmentIds: tradeTeamBAssignmentIds,
              })}
              disabled={
                tradeMutation.isPending ||
                !tradeTeamAUserId ||
                !tradeTeamBUserId ||
                tradeTeamAUserId === tradeTeamBUserId ||
                (tradeTeamAAssignmentIds.length === 0 && tradeTeamBAssignmentIds.length === 0)
              }
              data-testid="button-confirm-trade"
            >
              {tradeMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Execute Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Player to Roster</DialogTitle>
          </DialogHeader>
          {assignPlayer && (
            <div className="space-y-4">
              <div>
                <p className="font-medium">{assignPlayer.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {assignPlayer.primaryPosition} | {formatLevelWithYear(assignPlayer.sportLevel, (assignPlayer as any).lastActiveSeason, (assignPlayer as any).lastActiveLevel)} | {formatAffiliatedTeamLabel({
                    currentTeamName: assignPlayer.currentTeamName,
                    parentOrgName: assignPlayer.parentOrgName,
                    sportLevel: assignPlayer.sportLevel,
                    fallback: "No team",
                  })}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign to Team</label>
                <Select value={assignUserId} onValueChange={setAssignUserId}>
                  <SelectTrigger data-testid="select-assign-team">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMembers.map(m => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.teamName || m.teamAbbreviation || m.userId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Roster Type</label>
                <Select value={assignRosterType} onValueChange={setAssignRosterType}>
                  <SelectTrigger data-testid="select-assign-roster-type">
                    <SelectValue placeholder="Select roster" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mlb">MLB Roster</SelectItem>
                    <SelectItem value="milb">MiLB System</SelectItem>
                    <SelectItem value="draft">Draft List</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {assignUserId && (() => {
                const counts = teamCountMap[assignUserId] || { mlb: 0, milb: 0, draft: 0, il60: 0 };
                const mlbActive = counts.mlb - counts.il60;
                const mlbLimit = league.mlRosterLimit || 40;
                const milbLimit = league.milbRosterLimit || 150;
                const wouldExceed =
                  (assignRosterType === 'mlb' && mlbActive >= mlbLimit) ||
                  (assignRosterType === 'milb' && counts.milb >= milbLimit);
                if (!wouldExceed) return null;
                const limitLabel = assignRosterType === 'mlb' ? `ML limit of ${mlbLimit}` : `MiLB limit of ${milbLimit}`;
                const currentCount = assignRosterType === 'mlb' ? mlbActive : counts.milb;
                return (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3" data-testid="warning-roster-limit">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">
                      This team already has {currentCount} players on this roster, which meets or exceeds the {limitLabel}. You can still assign, but the team will be over the limit.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (assignPlayer && assignUserId) {
                  assignMutation.mutate({
                    mlbPlayerId: assignPlayer.id,
                    assignToUserId: assignUserId,
                    rosterType: assignRosterType,
                    season,
                  });
                }
              }}
              disabled={assignMutation.isPending || !assignUserId}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Assign Player
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Player Assignment</DialogTitle>
          </DialogHeader>
          {editAssignment && (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-lg">
                  {editAssignment.player.fullName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {editAssignment.player.primaryPosition} · {editAssignment.player.currentTeamName || "—"} · {editAssignment.player.sportLevel || "—"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Team</Label>
                  <Select value={editUserId} onValueChange={setEditUserId}>
                    <SelectTrigger data-testid="select-edit-team">
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeMembers.map(m => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.teamName || m.teamAbbreviation || m.userId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Roster Type</Label>
                  <Select value={editRosterType} onValueChange={setEditRosterType}>
                    <SelectTrigger data-testid="select-edit-roster-type">
                      <SelectValue placeholder="Select roster" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mlb">MLB Roster</SelectItem>
                      <SelectItem value="milb">MiLB System</SelectItem>
                      <SelectItem value="draft">Draft List</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Contract Status</Label>
                  <Input
                    value={editContractStatus}
                    onChange={(e) => setEditContractStatus(e.target.value)}
                    placeholder="e.g. 3yr/$15M"
                    data-testid="input-edit-contract-status"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Salary (2026)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editSalary}
                    onChange={(e) => setEditSalary(e.target.value)}
                    placeholder="e.g. 5.5"
                    data-testid="input-edit-salary"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Acquired</Label>
                  <Input
                    value={editAcquired}
                    onChange={(e) => setEditAcquired(e.target.value)}
                    placeholder="e.g. FA 2026, D 2026, Trade"
                    data-testid="input-edit-acquired"
                  />
                </div>
                {editRosterType === "mlb" && (
                  <div className="space-y-1.5">
                    <Label>Roster Slot</Label>
                    <Select value={editRosterSlot || "none"} onValueChange={(v) => setEditRosterSlot(v === "none" ? "" : v)}>
                      <SelectTrigger data-testid="select-edit-roster-slot">
                        <SelectValue placeholder="Normal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Normal (40-man)</SelectItem>
                        <SelectItem value="60">60-day IL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {editRosterType === "milb" && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Minor League Status</Label>
                      <Input
                        value={editMinorLeagueStatus}
                        onChange={(e) => setEditMinorLeagueStatus(e.target.value)}
                        placeholder="e.g. Active, Injured"
                        data-testid="input-edit-milb-status"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Minor League Years</Label>
                      <Input
                        type="number"
                        value={editMinorLeagueYears}
                        onChange={(e) => setEditMinorLeagueYears(e.target.value)}
                        placeholder="e.g. 3"
                        data-testid="input-edit-milb-years"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (editAssignment) {
                  const updates: any = {};
                  if (editRosterType !== editAssignment.rosterType) updates.rosterType = editRosterType;
                  if (editUserId !== editAssignment.userId) updates.userId = editUserId;
                  if (editContractStatus !== (editAssignment.contractStatus || "")) updates.contractStatus = editContractStatus;
                  if (editSalary !== (editAssignment.salary2026 != null ? String(editAssignment.salary2026) : "")) updates.salary2026 = editSalary;
                  if (editAcquired !== (editAssignment.acquired || "")) updates.acquired = editAcquired;
                  const newSlot = editRosterSlot || null;
                  if (newSlot !== editAssignment.rosterSlot) updates.rosterSlot = newSlot;
                  if (editMinorLeagueStatus !== (editAssignment.minorLeagueStatus || "")) updates.minorLeagueStatus = editMinorLeagueStatus;
                  if (editMinorLeagueYears !== (editAssignment.minorLeagueYears != null ? String(editAssignment.minorLeagueYears) : "")) updates.minorLeagueYears = editMinorLeagueYears;
                  editMutation.mutate({ id: editAssignment.id, ...updates });
                }
              }}
              disabled={editMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {editMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
