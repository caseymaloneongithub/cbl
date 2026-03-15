import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { League, LeagueMember, User } from "@shared/schema";
import { Plus, Users, Globe, Loader2, Crown, Trash2, UserPlus, Pencil, Key, Database, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function MlbPlayerSync() {
  const { toast } = useToast();
  const [syncSeason, setSyncSeason] = useState(new Date().getFullYear() - 1);

  const toCount = (value: unknown): number => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if ("count" in record) return toCount(record.count);
      if ("total" in record) return toCount(record.total);
    }
    return 0;
  };
  
  const { data: status, isLoading: loadingStatus } = useQuery<{
    total: number;
    season: number;
    twoWayQualified: number;
    byLevel: Record<string, { total: number; hitters: number; pitchers: number; twoWayQualified: number }>;
    seasonCounts: { season: number; count: number }[];
  }>({
    queryKey: ["/api/admin/mlb-players/status", String(syncSeason)],
    queryFn: async () => {
      const res = await fetch(`/api/admin/mlb-players/status?season=${syncSeason}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch MLB player status");
      const raw = await res.json();
      const levels = ["MLB", "AAA", "AA", "High-A", "Single-A", "Rookie"];
      const byLevel: Record<string, { total: number; hitters: number; pitchers: number; twoWayQualified: number }> = {};
      for (const level of levels) {
        const levelRaw = (raw?.byLevel?.[level] ?? {}) as Record<string, unknown>;
        byLevel[level] = {
          total: toCount(levelRaw.total ?? raw?.byLevel?.[level]),
          hitters: toCount(levelRaw.hitters),
          pitchers: toCount(levelRaw.pitchers),
          twoWayQualified: toCount(levelRaw.twoWayQualified),
        };
      }
      return {
        total: toCount(raw?.total),
        season: toCount(raw?.season),
        twoWayQualified: toCount(raw?.twoWayQualified),
        byLevel,
        seasonCounts: Array.isArray(raw?.seasonCounts) ? raw.seasonCounts : [],
      };
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (season: number) => {
      const res = await apiRequest("POST", "/api/admin/mlb-players/sync", { season });
      return res.json();
    },
    onSuccess: (data) => {
      setSyncPolling(true);
      toast({ title: "Sync Started", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const syncRangeMutation = useMutation({
    mutationFn: async ({ startSeason, endSeason }: { startSeason: number; endSeason: number }) => {
      const res = await apiRequest("POST", "/api/admin/mlb-players/sync-range", { startSeason, endSeason });
      return res.json();
    },
    onSuccess: (data) => {
      setSyncPolling(true);
      toast({ title: "Range Sync Started", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const [syncPolling, setSyncPolling] = useState(false);

  const syncStatusQuery = useQuery<{
    running: boolean;
    type: "single" | "range" | null;
    currentSeason: number | null;
    totalSeasons: number;
    completedSeasons: number;
    playersInCurrentSeason: number;
    statsInCurrentSeason: number;
    results: { season: number; playerCount: number; statRows: number }[];
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
  }>({
    queryKey: ["/api/admin/mlb-players/sync-status"],
    refetchInterval: syncPolling ? 2000 : false,
    enabled: syncPolling,
  });

  useEffect(() => {
    if (syncPolling && syncStatusQuery.data && !syncStatusQuery.data.running && syncStatusQuery.data.completedAt) {
      setSyncPolling(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mlb-players/status"] });
      const d = syncStatusQuery.data;
      if (d.error) {
        toast({ title: "Sync Error", description: d.error, variant: "destructive" });
      } else {
        const totalPlayers = d.results.reduce((s, r) => s + r.playerCount, 0);
        const totalStats = d.results.reduce((s, r) => s + r.statRows, 0);
        toast({
          title: "Sync Complete",
          description: `${totalPlayers.toLocaleString()} players, ${totalStats.toLocaleString()} stat rows across ${d.results.length} season(s)`,
        });
      }
    }
  }, [syncStatusQuery.data, syncPolling]);

  const currentYear = new Date().getFullYear();
  const maxSeason = currentYear - 1;
  const seasonOptions = Array.from({ length: maxSeason - 2018 }, (_, i) => maxSeason - i);
  const isSyncing = syncMutation.isPending || syncRangeMutation.isPending || syncPolling;

  const seasonCounts: { season: number; count: number }[] = status?.seasonCounts || [];
  const syncedSeasons = new Set(seasonCounts.map((s: { season: number }) => s.season));
  const missingSeasonsFrom2019 = Array.from({ length: maxSeason - 2019 + 1 }, (_, i) => 2019 + i)
    .filter(yr => !syncedSeasons.has(yr));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <Select
          value={syncSeason.toString()}
          onValueChange={(v) => setSyncSeason(parseInt(v))}
        >
          <SelectTrigger className="w-32" data-testid="select-mlb-season">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {seasonOptions.map((yr) => (
              <SelectItem key={yr} value={yr.toString()}>
                {yr}{syncedSeasons.has(yr) ? " \u2713" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => syncMutation.mutate(syncSeason)}
          disabled={isSyncing}
          data-testid="button-sync-mlb-players"
        >
          {syncMutation.isPending || (syncPolling && syncStatusQuery.data?.type === "single") ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing {syncStatusQuery.data?.currentSeason ?? syncSeason}...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync {syncSeason}
            </>
          )}
        </Button>
        {missingSeasonsFrom2019.length > 0 && (
          <Button
            variant="outline"
            onClick={() => syncRangeMutation.mutate({ startSeason: 2019, endSeason: maxSeason })}
            disabled={isSyncing}
            data-testid="button-sync-mlb-range"
          >
            {syncRangeMutation.isPending || (syncPolling && syncStatusQuery.data?.type === "range") ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing {syncStatusQuery.data?.completedSeasons ?? 0}/{syncStatusQuery.data?.totalSeasons ?? "?"}...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Sync All (2019–{maxSeason})
              </>
            )}
          </Button>
        )}
      </div>

      {syncPolling && syncStatusQuery.data && (
        <div className="rounded-md border p-3 space-y-2" data-testid="sync-progress">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {syncStatusQuery.data.type === "range"
                ? `Syncing season ${syncStatusQuery.data.currentSeason} (${syncStatusQuery.data.completedSeasons}/${syncStatusQuery.data.totalSeasons})`
                : `Syncing season ${syncStatusQuery.data.currentSeason}...`}
            </span>
            {syncStatusQuery.data.type === "range" && (
              <span className="text-muted-foreground">
                {syncStatusQuery.data.totalSeasons > 0
                  ? Math.round((syncStatusQuery.data.completedSeasons / syncStatusQuery.data.totalSeasons) * 100)
                  : 0}%
              </span>
            )}
          </div>
          {syncStatusQuery.data.type === "range" && (
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all duration-500"
                style={{
                  width: `${syncStatusQuery.data.totalSeasons > 0
                    ? (syncStatusQuery.data.completedSeasons / syncStatusQuery.data.totalSeasons) * 100
                    : 0}%`,
                }}
              />
            </div>
          )}
          {syncStatusQuery.data.results.length > 0 && (
            <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
              {syncStatusQuery.data.results.map(r => (
                <span key={r.season}>{r.season}: {r.playerCount.toLocaleString()} players</span>
              ))}
            </div>
          )}
          {syncStatusQuery.data.type === "single" && syncStatusQuery.data.running && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Fetching players from MLB API...
            </div>
          )}
        </div>
      )}

      {seasonCounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {seasonCounts.map((sc: { season: number; count: number }) => (
            <Badge key={sc.season} variant="secondary" data-testid={`badge-season-${sc.season}`}>
              {sc.season}: {sc.count.toLocaleString()}
            </Badge>
          ))}
        </div>
      )}

      {loadingStatus ? (
        <Skeleton className="h-20 w-full" />
      ) : status && status.total > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="text-center p-3 rounded-md bg-muted/50">
            <div className="text-2xl font-bold" data-testid="text-mlb-total">{status.total.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          {["MLB", "AAA", "AA", "High-A", "Single-A", "Rookie"].map((level) => (
            <div key={level} className="text-center p-3 rounded-md bg-muted/50">
              <div className="text-lg font-semibold" data-testid={`text-mlb-${level.toLowerCase()}`}>
                {(status.byLevel[level]?.total || 0).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">{level}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                H {status.byLevel[level]?.hitters || 0} | P {status.byLevel[level]?.pitchers || 0} | 2W {status.byLevel[level]?.twoWayQualified || 0}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          <Database className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>{seasonCounts.length > 0
            ? `No players found for season ${syncSeason}. Select a synced season or sync this one.`
            : "No players synced yet. Click the sync button to populate the database."}</p>
        </div>
      )}
    </div>
  );
}

function RosterDataTransfer({ leagues }: { leagues: League[] }) {
  const { toast } = useToast();
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importRosterType, setImportRosterType] = useState<string>("mlb");
  const [clearOnImport, setClearOnImport] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");
  const [wipeType, setWipeType] = useState<string>("all");
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    duplicateErrors: number;
    errors: string[];
  } | null>(null);

  const selectedLeagueName = leagues.find(l => String(l.id) === selectedLeagueId)?.name || "";

  const doExport = async (rosterType: string) => {
    try {
      const res = await fetch(`/api/admin/roster-assignments/export/${selectedLeagueId}?rosterType=${rosterType}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to export");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `roster-${rosterType}-${data.leagueName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export complete", description: `${data.totalAssignments} ${rosterType.toUpperCase()} assignments exported` });
    } catch (error: any) {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLeagueId) return;

    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const assignments = data.assignments || data;

      if (!Array.isArray(assignments)) {
        throw new Error("Invalid file format: expected an assignments array");
      }

      const res = await fetch(`/api/admin/roster-assignments/import/${selectedLeagueId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assignments,
          clearExisting: clearOnImport,
          clearRosterType: clearOnImport ? importRosterType : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Import failed");
      }

      const result = await res.json();
      setImportResult(result);
      toast({
        title: "Import complete",
        description: `${result.imported} assigned, ${result.skipped} skipped, ${result.duplicateErrors} duplicates`,
      });
    } catch (error: any) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const wipeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/roster-assignments/wipe/${selectedLeagueId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rosterType: wipeType === "all" ? undefined : wipeType,
          confirmText: wipeConfirmText,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Wipe failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setWipeConfirmText("");
      toast({ title: "Roster wiped", description: `${data.deleted} ${data.rosterType} assignments deleted` });
    },
    onError: (error: Error) => {
      toast({ title: "Wipe failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Select League</Label>
        <Select value={selectedLeagueId} onValueChange={(v) => { setSelectedLeagueId(v); setImportResult(null); setWipeConfirmText(""); }}>
          <SelectTrigger data-testid="select-transfer-league">
            <SelectValue placeholder="Choose a league..." />
          </SelectTrigger>
          <SelectContent>
            {leagues.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedLeagueId && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3 p-4 border rounded-lg">
              <h4 className="font-medium">Export</h4>
              <p className="text-sm text-muted-foreground">
                Download roster assignments as JSON. Teams matched by name/abbreviation across environments.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => doExport("mlb")}
                  variant="outline"
                  data-testid="button-export-mlb"
                >
                  Export MLB Roster
                </Button>
                <Button
                  onClick={() => doExport("milb")}
                  variant="outline"
                  data-testid="button-export-milb"
                >
                  Export MiLB Roster
                </Button>
              </div>
            </div>

            <div className="space-y-3 p-4 border rounded-lg">
              <h4 className="font-medium">Import</h4>
              <p className="text-sm text-muted-foreground">
                Upload a previously exported JSON file. Teams matched by name or abbreviation.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="clear-on-import"
                  checked={clearOnImport}
                  onChange={(e) => setClearOnImport(e.target.checked)}
                  className="rounded"
                  data-testid="checkbox-clear-on-import"
                />
                <Label htmlFor="clear-on-import" className="text-sm font-normal cursor-pointer">
                  Clear matching roster type before import
                </Label>
              </div>
              {clearOnImport && (
                <Select value={importRosterType} onValueChange={setImportRosterType}>
                  <SelectTrigger className="w-40" data-testid="select-import-roster-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mlb">MLB only</SelectItem>
                    <SelectItem value="milb">MiLB only</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={importing}
                data-testid="input-import-file"
              />
              {importing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </div>
              )}
            </div>
          </div>

          {importResult && (
            <div className="p-4 border rounded-lg space-y-2">
              <h4 className="font-medium">Import Results</h4>
              <div className="flex gap-4 text-sm">
                <Badge variant="default">{importResult.imported} imported</Badge>
                {importResult.skipped > 0 && <Badge variant="secondary">{importResult.skipped} skipped</Badge>}
                {importResult.duplicateErrors > 0 && <Badge variant="destructive">{importResult.duplicateErrors} duplicates</Badge>}
              </div>
              {importResult.errors.length > 0 && (
                <div className="text-sm text-destructive mt-2 max-h-40 overflow-auto">
                  {importResult.errors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-4 border border-destructive/30 rounded-lg space-y-3">
            <h4 className="font-medium text-destructive">Wipe Roster Assignments</h4>
            <p className="text-sm text-muted-foreground">
              Permanently delete roster assignments for this league. This cannot be undone.
            </p>
            <Select value={wipeType} onValueChange={setWipeType}>
              <SelectTrigger className="w-48" data-testid="select-wipe-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roster types</SelectItem>
                <SelectItem value="mlb">MLB only</SelectItem>
                <SelectItem value="milb">MiLB only</SelectItem>
                <SelectItem value="draft">Draft only</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <Label className="text-sm">Type the league name to confirm: <span className="font-semibold">{selectedLeagueName}</span></Label>
              <Input
                value={wipeConfirmText}
                onChange={(e) => setWipeConfirmText(e.target.value)}
                placeholder={selectedLeagueName}
                className="max-w-sm"
                data-testid="input-wipe-confirm"
              />
            </div>
            <Button
              variant="destructive"
              onClick={() => wipeMutation.mutate()}
              disabled={wipeConfirmText !== selectedLeagueName || wipeMutation.isPending}
              data-testid="button-wipe-roster"
            >
              {wipeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wiping...
                </>
              ) : (
                `Wipe ${wipeType === "all" ? "All" : wipeType.toUpperCase()} Assignments`
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function SuperAdmin() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [createLeagueDialogOpen, setCreateLeagueDialogOpen] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [newLeagueSlug, setNewLeagueSlug] = useState("");
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [selectedLeagueForMember, setSelectedLeagueForMember] = useState<number | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"owner" | "commissioner">("owner");
  const [memberTeamName, setMemberTeamName] = useState("");
  const [memberTeamAbbreviation, setMemberTeamAbbreviation] = useState("");
  const [viewingLeagueId, setViewingLeagueId] = useState<number | null>(null);
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<(LeagueMember & { user?: User }) | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamAbbreviation, setEditTeamAbbreviation] = useState("");
  const [setPasswordDialogOpen, setSetPasswordDialogOpen] = useState(false);
  const [passwordMember, setPasswordMember] = useState<(LeagueMember & { user?: User }) | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: allLeagues, isLoading: loadingLeagues } = useQuery<League[]>({
    queryKey: ["/api/leagues"],
    queryFn: async () => {
      const res = await fetch("/api/leagues", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leagues");
      return res.json();
    },
    enabled: isAuthenticated && user?.isSuperAdmin,
  });

  const { data: leagueMembers, isLoading: loadingMembers } = useQuery<(LeagueMember & { user?: User })[]>({
    queryKey: ["/api/leagues", viewingLeagueId, "members"],
    queryFn: async () => {
      if (!viewingLeagueId) return [];
      const res = await fetch(`/api/leagues/${viewingLeagueId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: isAuthenticated && user?.isSuperAdmin && !!viewingLeagueId,
  });

  const createLeague = useMutation({
    mutationFn: async (data: { name: string; slug: string }) => {
      const res = await apiRequest("POST", "/api/leagues", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "League Created", description: "New league has been created." });
      setCreateLeagueDialogOpen(false);
      setNewLeagueName("");
      setNewLeagueSlug("");
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addLeagueMember = useMutation({
    mutationFn: async (data: { leagueId: number; email: string; role: "owner" | "commissioner"; teamName?: string; teamAbbreviation?: string }) => {
      const res = await apiRequest("POST", `/api/leagues/${data.leagueId}/members`, { 
        email: data.email, 
        role: data.role,
        teamName: data.teamName,
        teamAbbreviation: data.teamAbbreviation
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Member Added", description: "User has been added to the league." });
      setAddMemberDialogOpen(false);
      setMemberEmail("");
      setMemberRole("owner");
      setMemberTeamName("");
      setMemberTeamAbbreviation("");
      setSelectedLeagueForMember(null);
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", viewingLeagueId, "members"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: async (data: { leagueId: number; userId: string; role: "owner" | "commissioner" }) => {
      const res = await apiRequest("PATCH", `/api/leagues/${data.leagueId}/members/${data.userId}`, { 
        role: data.role 
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Role Updated", description: "Member role has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", viewingLeagueId, "members"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMemberTeam = useMutation({
    mutationFn: async (data: { leagueId: number; userId: string; teamName: string; teamAbbreviation: string }) => {
      const res = await apiRequest("PATCH", `/api/leagues/${data.leagueId}/members/${data.userId}`, { 
        teamName: data.teamName,
        teamAbbreviation: data.teamAbbreviation
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Team Updated", description: "Team name and abbreviation have been updated." });
      setEditMemberDialogOpen(false);
      setEditingMember(null);
      setEditTeamName("");
      setEditTeamAbbreviation("");
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", viewingLeagueId, "members"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const setUserPassword = useMutation({
    mutationFn: async (data: { userId: string; password: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${data.userId}/set-password`, { 
        password: data.password
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password Set", description: "User password has been updated." });
      setSetPasswordDialogOpen(false);
      setPasswordMember(null);
      setNewPassword("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeLeagueMember = useMutation({
    mutationFn: async (data: { leagueId: number; userId: string }) => {
      const res = await fetch(`/api/leagues/${data.leagueId}/members/${data.userId}`, { 
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to remove member");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Member Removed", description: "User has been removed from the league." });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", viewingLeagueId, "members"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAuthenticated || !user?.isSuperAdmin) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Super Admin Access Required</h2>
            <p className="text-muted-foreground">
              Only super admins can access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Globe className="h-8 w-8" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-super-admin-title">Super Admin</h1>
          <p className="text-muted-foreground">Manage leagues and platform-wide settings</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            League Management
          </CardTitle>
          <CardDescription>
            Create and manage leagues across the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setCreateLeagueDialogOpen(true)}
              data-testid="button-create-league"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create League
            </Button>
          </div>

          {loadingLeagues ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : allLeagues && allLeagues.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allLeagues.map((league) => (
                  <TableRow key={league.id} data-testid={`row-league-${league.id}`}>
                    <TableCell className="font-medium" data-testid={`text-league-name-${league.id}`}>{league.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid={`badge-league-slug-${league.id}`}>{league.slug}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setViewingLeagueId(league.id);
                          }}
                          data-testid={`button-view-members-${league.id}`}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Members
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLeagueForMember(league.id);
                            setAddMemberDialogOpen(true);
                          }}
                          data-testid={`button-add-member-${league.id}`}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add Member
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No leagues yet. Create your first league to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {viewingLeagueId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              League Members
              {allLeagues && (
                <Badge variant="outline" className="ml-2">
                  {allLeagues.find(l => l.id === viewingLeagueId)?.name}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Manage members and their roles in this league
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingLeagueId(null)}
              >
                Close
              </Button>
            </div>
            {loadingMembers ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : leagueMembers && leagueMembers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leagueMembers.map((member) => (
                    <TableRow key={member.userId} data-testid={`row-member-${member.userId}`}>
                      <TableCell className="font-medium">
                        {member.user?.email || member.userId}
                      </TableCell>
                      <TableCell>
                        {member.user?.firstName || ""} {member.user?.lastName || ""}
                      </TableCell>
                      <TableCell>
                        {member.teamName || "-"}
                      </TableCell>
                      <TableCell>
                        {member.role === "commissioner" ? (
                          <Badge variant="default">
                            <Crown className="h-3 w-3 mr-1" />
                            Commissioner
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Owner</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {member.role === "commissioner" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateMemberRole.mutate({
                                leagueId: viewingLeagueId,
                                userId: member.userId,
                                role: "owner"
                              })}
                              disabled={updateMemberRole.isPending}
                              data-testid={`button-demote-${member.userId}`}
                            >
                              Demote to Owner
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateMemberRole.mutate({
                                leagueId: viewingLeagueId,
                                userId: member.userId,
                                role: "commissioner"
                              })}
                              disabled={updateMemberRole.isPending}
                              data-testid={`button-promote-${member.userId}`}
                            >
                              <Crown className="h-3 w-3 mr-1" />
                              Make Commissioner
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingMember(member);
                              setEditTeamName(member.teamName || "");
                              setEditTeamAbbreviation(member.teamAbbreviation || "");
                              setEditMemberDialogOpen(true);
                            }}
                            data-testid={`button-edit-member-${member.userId}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPasswordMember(member);
                              setNewPassword("");
                              setSetPasswordDialogOpen(true);
                            }}
                            data-testid={`button-set-password-${member.userId}`}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLeagueMember.mutate({
                              leagueId: viewingLeagueId,
                              userId: member.userId
                            })}
                            disabled={removeLeagueMember.isPending}
                            data-testid={`button-remove-member-${member.userId}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No members in this league yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-mlb-player-database">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Globe className="h-5 w-5" />
              MLB Player Database
            </CardTitle>
            <CardDescription>
              Sync affiliated pro players from the MLB API by season (MLB, AAA, AA, High-A, Single-A, Rookie excl. DSL). Two-way = 20+ IP and 10+ PA.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <MlbPlayerSync />
        </CardContent>
      </Card>

      {allLeagues && allLeagues.length > 0 && (
        <Card data-testid="card-roster-data-transfer">
          <CardHeader>
            <CardTitle>Roster Data Transfer</CardTitle>
            <CardDescription>
              Export roster assignments from one environment and import them into another. The exported file includes player IDs, team names, contract details, and minor league status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RosterDataTransfer leagues={allLeagues} />
          </CardContent>
        </Card>
      )}

      <Dialog open={createLeagueDialogOpen} onOpenChange={setCreateLeagueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New League</DialogTitle>
            <DialogDescription>
              Enter details for the new league.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="league-name">League Name</Label>
              <Input
                id="league-name"
                placeholder="e.g., CBL Fantasy League"
                value={newLeagueName}
                onChange={(e) => {
                  setNewLeagueName(e.target.value);
                  setNewLeagueSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                }}
                data-testid="input-league-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="league-slug">Slug</Label>
              <Input
                id="league-slug"
                placeholder="cbl-fantasy-league"
                value={newLeagueSlug}
                onChange={(e) => setNewLeagueSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                data-testid="input-league-slug"
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier for the league
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateLeagueDialogOpen(false);
                setNewLeagueName("");
                setNewLeagueSlug("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createLeague.mutate({ name: newLeagueName, slug: newLeagueSlug })}
              disabled={!newLeagueName.trim() || !newLeagueSlug.trim() || createLeague.isPending}
              data-testid="button-confirm-create-league"
            >
              {createLeague.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create League"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add League Member</DialogTitle>
            <DialogDescription>
              Add an existing user to this league.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="member-email">User Email</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="user@example.com"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                data-testid="input-member-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-role">Role</Label>
              <Select value={memberRole} onValueChange={(v: "owner" | "commissioner") => setMemberRole(v)}>
                <SelectTrigger data-testid="select-member-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="commissioner">Commissioner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-team-name">Team Name (for this league)</Label>
              <Input
                id="member-team-name"
                placeholder="e.g., Springfield Isotopes"
                value={memberTeamName}
                onChange={(e) => setMemberTeamName(e.target.value)}
                data-testid="input-member-team-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-team-abbr">Team Abbreviation</Label>
              <Input
                id="member-team-abbr"
                placeholder="e.g., SPR"
                maxLength={3}
                value={memberTeamAbbreviation}
                onChange={(e) => setMemberTeamAbbreviation(e.target.value.toUpperCase())}
                data-testid="input-member-team-abbr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddMemberDialogOpen(false);
                setMemberEmail("");
                setMemberRole("owner");
                setMemberTeamName("");
                setMemberTeamAbbreviation("");
                setSelectedLeagueForMember(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedLeagueForMember) {
                  addLeagueMember.mutate({
                    leagueId: selectedLeagueForMember,
                    email: memberEmail,
                    role: memberRole,
                    teamName: memberTeamName || undefined,
                    teamAbbreviation: memberTeamAbbreviation || undefined
                  });
                }
              }}
              disabled={!memberEmail.trim() || !selectedLeagueForMember || addLeagueMember.isPending}
              data-testid="button-confirm-add-member"
            >
              {addLeagueMember.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Member"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editMemberDialogOpen} onOpenChange={setEditMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Info</DialogTitle>
            <DialogDescription>
              Update team name and abbreviation for {editingMember?.user?.firstName || "this member"} in this league.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Team Name</Label>
              <Input
                id="edit-team-name"
                placeholder="e.g., Springfield Isotopes"
                value={editTeamName}
                onChange={(e) => setEditTeamName(e.target.value)}
                data-testid="input-edit-team-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-abbr">Team Abbreviation</Label>
              <Input
                id="edit-team-abbr"
                placeholder="e.g., SPR"
                maxLength={3}
                value={editTeamAbbreviation}
                onChange={(e) => setEditTeamAbbreviation(e.target.value.toUpperCase())}
                data-testid="input-edit-team-abbr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditMemberDialogOpen(false);
                setEditingMember(null);
                setEditTeamName("");
                setEditTeamAbbreviation("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (viewingLeagueId && editingMember) {
                  updateMemberTeam.mutate({
                    leagueId: viewingLeagueId,
                    userId: editingMember.userId,
                    teamName: editTeamName,
                    teamAbbreviation: editTeamAbbreviation
                  });
                }
              }}
              disabled={updateMemberTeam.isPending}
              data-testid="button-confirm-edit-member"
            >
              {updateMemberTeam.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={setPasswordDialogOpen} onOpenChange={setSetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Password</DialogTitle>
            <DialogDescription>
              Set a new password for {passwordMember?.user?.firstName || passwordMember?.user?.email || "this user"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="text"
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSetPasswordDialogOpen(false);
                setPasswordMember(null);
                setNewPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (passwordMember) {
                  setUserPassword.mutate({
                    userId: passwordMember.userId,
                    password: newPassword
                  });
                }
              }}
              disabled={newPassword.length < 6 || setUserPassword.isPending}
              data-testid="button-confirm-set-password"
            >
              {setUserPassword.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting...
                </>
              ) : (
                "Set Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
