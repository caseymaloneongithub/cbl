import { useQuery, useMutation } from "@tanstack/react-query";
import { useLeague } from "@/hooks/useLeague";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, ChevronLeft, ChevronRight, UserPlus, Download } from "lucide-react";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import type { MlbPlayer, MlbPlayerStat, LeagueMember } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

type PlayerWithStats = MlbPlayer & { stats: MlbPlayerStat | null };
import { getMlbAffiliationAbbreviation } from "@/lib/teamDisplay";

interface RosterAssignment {
  id: number;
  leagueId: number;
  userId: string;
  mlbPlayerId: number;
  rosterType: string;
  season: number;
  contractStatus?: string | null;
  salary2026?: number | null;
  minorLeagueStatus?: string | null;
  minorLeagueYears?: number | null;
  acquired?: string | null;
  rosterSlot?: string | null;
  player: MlbPlayer;
}

type HitterSortKey = "name" | "pos" | "team" | "ab" | "pa" | "bb" | "1b" | "2b" | "3b" | "hr" | "avg" | "obp" | "slg" | "ops" | "leagueTeam";
type PitcherSortKey = "name" | "pos" | "team" | "g" | "gs" | "ip" | "k" | "bb" | "h" | "hr" | "era" | "leagueTeam";

type SortDir = "asc" | "desc";

const fmtRate = (v: number | null | undefined) => (v == null ? "-" : Number(v).toFixed(3));

function formatLevelWithYear(sportLevel: string, lastActiveSeason?: number | null, lastActiveLevel?: string | null): string {
  const cardYear = new Date().getFullYear() - 1;
  if (lastActiveSeason && lastActiveSeason < cardYear) {
    const displayLevel = lastActiveLevel || sportLevel;
    return `${displayLevel} (${lastActiveSeason})`;
  }
  return lastActiveLevel || sportLevel;
}
const fmtEra = (v: number | null | undefined) => (v == null ? "-" : Number(v).toFixed(2));
const fmt1 = (v: number | null | undefined) => (v == null ? "-" : Number(v).toFixed(1));

function teamAbbrForPlayer(p: MlbPlayer): string {
  return (
    getMlbAffiliationAbbreviation(p.currentTeamName || null) ||
    getMlbAffiliationAbbreviation(p.parentOrgName || null) ||
    "-"
  );
}

function NameWithHover({ p }: { p: MlbPlayer }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-medium cursor-default">{p.fullName}</span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <div>Age: {p.age ?? "-"}</div>
          <div>B/T: {p.batSide || "-"}/{p.throwHand || "-"}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default function Players({ level }: { level: "mlb" | "milb" }) {
  const { selectedLeagueId, currentLeague } = useLeague();
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [mlbTeamFilter, setMlbTeamFilter] = useState("all");
  const [leagueTeamFilter, setLeagueTeamFilter] = useState("all");
  const [pageSize, setPageSize] = useState(100);
  const [hitterPage, setHitterPage] = useState(0);
  const [pitcherPage, setPitcherPage] = useState(0);
  const [activeTab, setActiveTab] = useState<"hitters" | "pitchers">("hitters");
  const [hitterSort, setHitterSort] = useState<{ key: HitterSortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const [pitcherSort, setPitcherSort] = useState<{ key: PitcherSortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const [seasonOverride, setSeasonOverride] = useState<number | null>(null);

  const { data: availableSeasons } = useQuery<number[]>({
    queryKey: ["/api/mlb-players/seasons"],
    queryFn: async () => {
      const res = await fetch("/api/mlb-players/seasons", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch seasons");
      return res.json();
    },
  });

  const effectiveSeason = seasonOverride ?? availableSeasons?.[0] ?? null;

  const sportLevel = level === "mlb" ? "MLB" : "minors";
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setHitterPage(0);
    setPitcherPage(0);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  }, []);

  const { data: teamsData } = useQuery<string[]>({
    queryKey: ["/api/mlb-players/teams", effectiveSeason, sportLevel],
    queryFn: async () => {
      const params = new URLSearchParams({ season: String(effectiveSeason), sportLevel });
      const res = await fetch(`/api/mlb-players/teams?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch teams");
      return res.json();
    },
    enabled: effectiveSeason != null,
  });

  const { data: playersData, isLoading } = useQuery<{ players: PlayerWithStats[]; total: number }>({
    queryKey: ["/api/mlb-players", debouncedSearch, sportLevel, mlbTeamFilter, effectiveSeason, level, leagueTeamFilter, selectedLeagueId, "full-pool"],
    queryFn: async () => {
      const params = new URLSearchParams({
        season: String(effectiveSeason),
        sportLevel,
        limit: "20000",
        offset: "0",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (mlbTeamFilter !== "all") {
        if (level === "milb") params.set("parentOrgName", mlbTeamFilter);
        else params.set("currentTeamName", mlbTeamFilter);
      }
      if (level === "mlb") {
        params.set("statsLevelFilter", "MLB");
      }
      if (leagueTeamFilter === "unassigned" && selectedLeagueId) {
        params.set("leagueIdForFreeAgents", String(selectedLeagueId));
      }
      const res = await fetch(`/api/mlb-players?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch players");
      return res.json();
    },
    enabled: effectiveSeason != null,
  });

  const { data: membersData } = useQuery<(LeagueMember & { user: any })[]>({
    queryKey: ["/api/leagues", selectedLeagueId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${selectedLeagueId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedLeagueId,
  });

  const { data: rosterData } = useQuery<{ assignments: RosterAssignment[] }>({
    queryKey: ["/api/leagues", selectedLeagueId, "roster-assignments", "all-for-players", level],
    queryFn: async () => {
      const params = new URLSearchParams({ rosterType: level });
      const res = await fetch(`/api/leagues/${selectedLeagueId}/roster-assignments?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch roster assignments");
      return res.json();
    },
    enabled: !!selectedLeagueId,
  });

  const rosterMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const a of rosterData?.assignments || []) map[a.mlbPlayerId] = a.userId;
    return map;
  }, [rosterData?.assignments]);

  const assignmentByPlayer = useMemo(() => {
    const map: Record<number, RosterAssignment> = {};
    for (const a of rosterData?.assignments || []) map[a.mlbPlayerId] = a;
    return map;
  }, [rosterData?.assignments]);

  const memberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of membersData || []) map[m.userId] = m.teamName || m.teamAbbreviation || m.userId;
    return map;
  }, [membersData]);

  const claimMutation = useMutation({
    mutationFn: async (mlbPlayerId: number) => {
      const res = await apiRequest("POST", `/api/leagues/${selectedLeagueId}/roster-assignments/claim`, { mlbPlayerId });
      return res.json();
    },
    onSuccess: (_data, mlbPlayerId) => {
      const player = playersData?.players.find(p => p.id === mlbPlayerId);
      toast({ title: "Player Claimed", description: `${player?.fullName || "Player"} added to your roster` });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", selectedLeagueId, "roster-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mlb-players"] });
    },
    onError: (error: Error) => {
      toast({ title: "Claim Failed", description: error.message, variant: "destructive" });
    },
  });

  const activeMembers = useMemo(() => {
    return (membersData || [])
      .filter((m) => !(m as any).isArchived)
      .slice()
      .sort((a, b) => {
        const aKey = (a.teamName || a.teamAbbreviation || a.userId).toLowerCase();
        const bKey = (b.teamName || b.teamAbbreviation || b.userId).toLowerCase();
        return aKey.localeCompare(bKey);
      });
  }, [membersData]);

  const filteredPlayers = useMemo(() => {
    const all = playersData?.players || [];
    if (leagueTeamFilter === "all") return all;
    if (leagueTeamFilter === "unassigned") return all.filter((p) => !rosterMap[p.id]);
    return all.filter((p) => rosterMap[p.id] === leagueTeamFilter);
  }, [playersData?.players, leagueTeamFilter, rosterMap]);

  const downloadCsv = useCallback(() => {
    if (!filteredPlayers.length) return;

    const csvEscape = (val: string | number | null | undefined) => {
      if (val == null || val === "") return "";
      const s = String(val);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const isMLB = level === "mlb";
    const headers = [
      "MLB ID",
      "Last Name",
      "First Name",
      "Position",
      "MLB Team",
      "CBL Team",
      ...(isMLB
        ? ["Contract Status", "Salary 2026", "Roster Slot", "Acquired"]
        : ["MH/MC", "Years", "Acquired"]),
    ];

    const rows = filteredPlayers.map((p) => {
      const assignment = assignmentByPlayer[p.id];
      const cblTeam = rosterMap[p.id] ? (memberMap[rosterMap[p.id]] || "") : "";
      const mlbTeam = isMLB
        ? (getMlbAffiliationAbbreviation(p.currentTeamName || null) || p.currentTeamName || "")
        : (getMlbAffiliationAbbreviation(p.parentOrgName || null) || p.parentOrgName || "");

      const base = [
        csvEscape(p.mlbId),
        csvEscape(p.lastName),
        csvEscape(p.firstName),
        csvEscape(p.primaryPosition),
        csvEscape(mlbTeam),
        csvEscape(cblTeam),
      ];

      if (isMLB) {
        base.push(
          csvEscape(assignment?.contractStatus),
          csvEscape(assignment?.salary2026),
          csvEscape(assignment?.rosterSlot),
          csvEscape(assignment?.acquired),
        );
      } else {
        base.push(
          csvEscape(assignment?.minorLeagueStatus),
          csvEscape(assignment?.minorLeagueYears),
          csvEscape(assignment?.acquired),
        );
      }

      return base.join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${level}_players_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredPlayers, level, assignmentByPlayer, rosterMap, memberMap]);

  const baseHitters = useMemo(
    () => filteredPlayers.filter((p) => p.stats?.isTwoWayQualified || p.positionType !== "Pitcher"),
    [filteredPlayers],
  );
  const basePitchers = useMemo(
    () => filteredPlayers.filter((p) => p.stats?.isTwoWayQualified || p.positionType === "Pitcher"),
    [filteredPlayers],
  );

  const sortedHitters = useMemo(() => {
    const rows = [...baseHitters];
    rows.sort((a, b) => {
      const teamA = rosterMap[a.id] ? (memberMap[rosterMap[a.id]] || "") : "";
      const teamB = rosterMap[b.id] ? (memberMap[rosterMap[b.id]] || "") : "";
      const n = (x: number | null | undefined) => x ?? 0;
      const s = (x: string | null | undefined) => (x || "").toLowerCase();
      let cmp = 0;
      switch (hitterSort.key) {
        case "name": cmp = s(a.fullName).localeCompare(s(b.fullName)); break;
        case "pos": cmp = s(a.primaryPosition).localeCompare(s(b.primaryPosition)); break;
        case "team": cmp = s(teamAbbrForPlayer(a)).localeCompare(s(teamAbbrForPlayer(b))); break;
        case "ab": cmp = n(a.stats?.hittingAtBats) - n(b.stats?.hittingAtBats); break;
        case "pa": cmp = n(a.stats?.hittingPlateAppearances) - n(b.stats?.hittingPlateAppearances); break;
        case "bb": cmp = n(a.stats?.hittingWalks) - n(b.stats?.hittingWalks); break;
        case "1b": cmp = n(a.stats?.hittingSingles) - n(b.stats?.hittingSingles); break;
        case "2b": cmp = n(a.stats?.hittingDoubles) - n(b.stats?.hittingDoubles); break;
        case "3b": cmp = n(a.stats?.hittingTriples) - n(b.stats?.hittingTriples); break;
        case "hr": cmp = n(a.stats?.hittingHomeRuns) - n(b.stats?.hittingHomeRuns); break;
        case "avg": cmp = n(a.stats?.hittingAvg) - n(b.stats?.hittingAvg); break;
        case "obp": cmp = n(a.stats?.hittingObp) - n(b.stats?.hittingObp); break;
        case "slg": cmp = n(a.stats?.hittingSlg) - n(b.stats?.hittingSlg); break;
        case "ops": cmp = n(a.stats?.hittingOps) - n(b.stats?.hittingOps); break;
        case "wrc+": cmp = n(a.stats?.hittingWrcPlus) - n(b.stats?.hittingWrcPlus); break;
        case "leagueTeam": cmp = teamA.localeCompare(teamB); break;
      }
      return hitterSort.dir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [baseHitters, hitterSort, rosterMap, memberMap]);

  const sortedPitchers = useMemo(() => {
    const rows = [...basePitchers];
    rows.sort((a, b) => {
      const teamA = rosterMap[a.id] ? (memberMap[rosterMap[a.id]] || "") : "";
      const teamB = rosterMap[b.id] ? (memberMap[rosterMap[b.id]] || "") : "";
      const n = (x: number | null | undefined) => x ?? 0;
      const s = (x: string | null | undefined) => (x || "").toLowerCase();
      let cmp = 0;
      switch (pitcherSort.key) {
        case "name": cmp = s(a.fullName).localeCompare(s(b.fullName)); break;
        case "pos": cmp = s(a.primaryPosition).localeCompare(s(b.primaryPosition)); break;
        case "team": cmp = s(teamAbbrForPlayer(a)).localeCompare(s(teamAbbrForPlayer(b))); break;
        case "g": cmp = n(a.stats?.pitchingGames) - n(b.stats?.pitchingGames); break;
        case "gs": cmp = n(a.stats?.pitchingGamesStarted) - n(b.stats?.pitchingGamesStarted); break;
        case "ip": cmp = n(a.stats?.pitchingInningsPitched) - n(b.stats?.pitchingInningsPitched); break;
        case "k": cmp = n(a.stats?.pitchingStrikeouts) - n(b.stats?.pitchingStrikeouts); break;
        case "bb": cmp = n(a.stats?.pitchingWalks) - n(b.stats?.pitchingWalks); break;
        case "h": cmp = n(a.stats?.pitchingHits) - n(b.stats?.pitchingHits); break;
        case "hr": cmp = n(a.stats?.pitchingHomeRuns) - n(b.stats?.pitchingHomeRuns); break;
        case "era": cmp = n(a.stats?.pitchingEra) - n(b.stats?.pitchingEra); break;
        case "leagueTeam": cmp = teamA.localeCompare(teamB); break;
      }
      return pitcherSort.dir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [basePitchers, pitcherSort, rosterMap, memberMap]);

  const hitterTotalPages = Math.max(1, Math.ceil(sortedHitters.length / pageSize));
  const pitcherTotalPages = Math.max(1, Math.ceil(sortedPitchers.length / pageSize));
  const hitterRows = sortedHitters.slice(hitterPage * pageSize, (hitterPage + 1) * pageSize);
  const pitcherRows = sortedPitchers.slice(pitcherPage * pageSize, (pitcherPage + 1) * pageSize);

  useEffect(() => {
    setHitterPage(0);
    setPitcherPage(0);
  }, [pageSize, debouncedSearch, mlbTeamFilter, leagueTeamFilter]);

  const toggleHitterSort = (key: HitterSortKey) => {
    setHitterSort((prev) => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));
    setHitterPage(0);
  };
  const togglePitcherSort = (key: PitcherSortKey) => {
    setPitcherSort((prev) => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));
    setPitcherPage(0);
  };

  const hs = (key: HitterSortKey) => (hitterSort.key === key ? (hitterSort.dir === "asc" ? " ▲" : " ▼") : "");
  const ps = (key: PitcherSortKey) => (pitcherSort.key === key ? (pitcherSort.dir === "asc" ? " ▲" : " ▼") : "");

  const title = level === "mlb" ? "MLB Players" : "MiLB Players";
  const showMilbLevel = level === "milb";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-players-title">{title}</h1>
        <p className="text-sm text-muted-foreground">{filteredPlayers.length.toLocaleString()} players in result pool</p>
      </div>

      <Card>
        <CardHeader className="space-y-0 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name..." value={search} onChange={(e) => handleSearchChange(e.target.value)} className="pl-8" data-testid="input-players-search" />
            </div>
            <div className="w-48">
              <Select value={mlbTeamFilter} onValueChange={(v) => setMlbTeamFilter(v)}>
                <SelectTrigger data-testid="select-mlb-team-filter"><SelectValue placeholder="MLB Team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All MLB Teams</SelectItem>
                  {(teamsData || []).map((team) => <SelectItem key={team} value={team}>{team}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedLeagueId && (
              <div className="w-56">
                <Select value={leagueTeamFilter} onValueChange={(v) => setLeagueTeamFilter(v)}>
                  <SelectTrigger data-testid="select-league-team-filter"><SelectValue placeholder="League Team" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All League Teams</SelectItem>
                    <SelectItem value="unassigned">Unassigned (Free Agents)</SelectItem>
                    {activeMembers.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.teamName || m.teamAbbreviation || m.userId}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="w-36">
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger data-testid="select-page-size"><SelectValue placeholder="Rows" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 / page</SelectItem>
                  <SelectItem value="200">200 / page</SelectItem>
                  <SelectItem value="500">500 / page</SelectItem>
                  <SelectItem value="1000">1000 / page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCsv}
              disabled={!filteredPlayers.length}
              data-testid="button-download-csv"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Download CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No players found</div>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "hitters" | "pitchers")}> 
              <TabsList>
                <TabsTrigger value="hitters">Hitters ({sortedHitters.length})</TabsTrigger>
                <TabsTrigger value="pitchers">Pitchers ({sortedPitchers.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="hitters">
                <div className="overflow-x-auto rounded-md border">
                  <Table className="text-[12px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="cursor-pointer" onClick={() => toggleHitterSort("name")}>Name{hs("name")}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => toggleHitterSort("pos")}>Pos{hs("pos")}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => toggleHitterSort("team")}>Team{hs("team")}</TableHead>
                        {showMilbLevel && <TableHead>Level</TableHead>}
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHitterSort("ab")}>AB{hs("ab")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHitterSort("pa")}>PA{hs("pa")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHitterSort("bb")}>BB{hs("bb")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHitterSort("1b")}>1B{hs("1b")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHitterSort("2b")}>2B{hs("2b")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHitterSort("3b")}>3B{hs("3b")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHitterSort("hr")}>HR{hs("hr")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHitterSort("avg")}>AVG{hs("avg")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHitterSort("obp")}>OBP{hs("obp")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHitterSort("slg")}>SLG{hs("slg")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHitterSort("ops")}>OPS{hs("ops")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHitterSort("wrc+")}>wRC+{hs("wrc+")}</TableHead>
                        {selectedLeagueId && <TableHead className="cursor-pointer" onClick={() => toggleHitterSort("leagueTeam")}>League Team{hs("leagueTeam")}</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hitterRows.map((p) => {
                        const leagueTeam = rosterMap[p.id] ? memberMap[rosterMap[p.id]] : null;
                        return (
                          <TableRow key={`h-${p.id}`} className={`odd:bg-muted/20 ${(currentLeague as any)?.showInnocuous && p.stats?.innocuous ? "bg-green-50 dark:bg-green-950/30 odd:bg-green-50 dark:odd:bg-green-950/30" : ""}`}>
                            <TableCell><NameWithHover p={p} /></TableCell>
                            <TableCell className="font-mono text-[11px]">{p.primaryPosition || "-"}</TableCell>
                            <TableCell>{teamAbbrForPlayer(p)}</TableCell>
                            {showMilbLevel && <TableCell>{formatLevelWithYear(p.sportLevel, p.lastPlayedSeason, p.lastPlayedLevel)}</TableCell>}
                            <TableCell className="text-right font-mono">{p.stats?.hadHittingStats ? (p.stats.hittingAtBats ?? 0) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadHittingStats ? (p.stats.hittingPlateAppearances ?? 0) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadHittingStats ? (p.stats.hittingWalks ?? 0) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadHittingStats ? (p.stats.hittingSingles ?? 0) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadHittingStats ? (p.stats.hittingDoubles ?? 0) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadHittingStats ? (p.stats.hittingTriples ?? 0) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadHittingStats ? (p.stats.hittingHomeRuns ?? 0) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadHittingStats ? fmtRate(p.stats.hittingAvg) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadHittingStats ? fmtRate(p.stats.hittingObp) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadHittingStats ? fmtRate(p.stats.hittingSlg) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadHittingStats ? fmtRate(p.stats.hittingOps) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadHittingStats && p.stats.hittingWrcPlus != null ? Math.round(p.stats.hittingWrcPlus) : ""}</TableCell>
                            {selectedLeagueId && (
                              <TableCell>
                                {leagueTeam ? (
                                  leagueTeam
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground">Free Agent</span>
                                    {user && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => claimMutation.mutate(p.id)}
                                        disabled={claimMutation.isPending}
                                        data-testid={`button-claim-hitter-${p.id}`}
                                      >
                                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                                        Claim
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between gap-4 mt-3">
                  <p className="text-xs text-muted-foreground font-mono">Showing {hitterPage * pageSize + 1}-{Math.min((hitterPage + 1) * pageSize, sortedHitters.length)} of {sortedHitters.length}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={hitterPage === 0} onClick={() => setHitterPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-sm">Page {hitterPage + 1} of {hitterTotalPages}</span>
                    <Button variant="outline" size="sm" disabled={hitterPage >= hitterTotalPages - 1} onClick={() => setHitterPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pitchers">
                <div className="overflow-x-auto rounded-md border">
                  <Table className="text-[12px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="cursor-pointer" onClick={() => togglePitcherSort("name")}>Name{ps("name")}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => togglePitcherSort("pos")}>Pos{ps("pos")}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => togglePitcherSort("team")}>Team{ps("team")}</TableHead>
                        {showMilbLevel && <TableHead>Level</TableHead>}
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePitcherSort("g")}>G{ps("g")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePitcherSort("gs")}>GS{ps("gs")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePitcherSort("ip")}>IP{ps("ip")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePitcherSort("k")}>K{ps("k")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePitcherSort("bb")}>BB{ps("bb")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePitcherSort("h")}>H{ps("h")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePitcherSort("hr")}>HR{ps("hr")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePitcherSort("era")}>ERA{ps("era")}</TableHead>
                        {selectedLeagueId && <TableHead className="cursor-pointer" onClick={() => togglePitcherSort("leagueTeam")}>League Team{ps("leagueTeam")}</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pitcherRows.map((p) => {
                        const leagueTeam = rosterMap[p.id] ? memberMap[rosterMap[p.id]] : null;
                        return (
                          <TableRow key={`p-${p.id}`} className={`odd:bg-muted/20 ${(currentLeague as any)?.showInnocuous && p.stats?.innocuous ? "bg-green-50 dark:bg-green-950/30 odd:bg-green-50 dark:odd:bg-green-950/30" : ""}`}>
                            <TableCell><NameWithHover p={p} /></TableCell>
                            <TableCell className="font-mono text-[11px]">{p.primaryPosition || "-"}</TableCell>
                            <TableCell>{teamAbbrForPlayer(p)}</TableCell>
                            {showMilbLevel && <TableCell>{formatLevelWithYear(p.sportLevel, p.lastPlayedSeason, p.lastPlayedLevel)}</TableCell>}
                            <TableCell className="text-right font-mono">{p.stats?.hadPitchingStats ? (p.stats.pitchingGames ?? 0) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadPitchingStats ? (p.stats.pitchingGamesStarted ?? 0) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadPitchingStats ? fmt1(p.stats.pitchingInningsPitched) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadPitchingStats ? (p.stats.pitchingStrikeouts ?? 0) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadPitchingStats ? (p.stats.pitchingWalks ?? 0) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadPitchingStats ? (p.stats.pitchingHits ?? 0) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadPitchingStats ? (p.stats.pitchingHomeRuns ?? 0) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{p.stats?.hadPitchingStats ? fmtEra(p.stats.pitchingEra) : ""}</TableCell>
                            {selectedLeagueId && (
                              <TableCell>
                                {leagueTeam ? (
                                  leagueTeam
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground">Free Agent</span>
                                    {user && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => claimMutation.mutate(p.id)}
                                        disabled={claimMutation.isPending}
                                        data-testid={`button-claim-pitcher-${p.id}`}
                                      >
                                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                                        Claim
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between gap-4 mt-3">
                  <p className="text-xs text-muted-foreground font-mono">Showing {pitcherPage * pageSize + 1}-{Math.min((pitcherPage + 1) * pageSize, sortedPitchers.length)} of {sortedPitchers.length}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={pitcherPage === 0} onClick={() => setPitcherPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-sm">Page {pitcherPage + 1} of {pitcherTotalPages}</span>
                    <Button variant="outline" size="sm" disabled={pitcherPage >= pitcherTotalPages - 1} onClick={() => setPitcherPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
