import { useQuery, useMutation } from "@tanstack/react-query";
import { stripAccents } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ClipboardList, Scissors } from "lucide-react";
import { useState, useMemo } from "react";
import type { MlbPlayer, MlbPlayerStat } from "@shared/schema";
import { getMlbAffiliationAbbreviation } from "@/lib/teamDisplay";
import { isUncardedOnMlbRoster } from "@/lib/playerCarding";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface RosterAssignment {
  id: number;
  leagueId: number;
  userId: string;
  mlbPlayerId: number;
  rosterType: string;
  season: number;
  contractStatus: string | null;
  salary2026: string | null;
  minorLeagueStatus: string | null;
  minorLeagueYears: number | null;
  acquired: string | null;
  rosterSlot: string | null;
  player: MlbPlayer;
  stats: MlbPlayerStat | null;
}

type HitterSortKey = "name" | "pos" | "team" | "ab" | "pa" | "bb" | "1b" | "2b" | "3b" | "hr" | "avg" | "obp" | "slg" | "ops";
type PitcherSortKey = "name" | "pos" | "team" | "g" | "gs" | "ip" | "k" | "bb" | "h" | "hr" | "era";

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
const fmtSalary = (v: string | null | undefined) => {
  if (!v) return "-";
  const n = parseFloat(v);
  return isNaN(n) ? v : n.toFixed(2);
};
const isMinorLeagueStats = (stats: RosterAssignment["stats"]) =>
  stats?.sportLevel != null && stats.sportLevel !== "MLB";
const statCellClass = (stats: RosterAssignment["stats"]) =>
  `text-right font-mono${isMinorLeagueStats(stats) ? " italic" : ""}`;

function formatAcquired(acquired: string | null): string {
  if (!acquired) return "-";
  return acquired;
}

function teamAbbrForPlayer(p: MlbPlayer): string {
  return (
    getMlbAffiliationAbbreviation(p.currentTeamName || null) ||
    getMlbAffiliationAbbreviation(p.parentOrgName || null) ||
    "-"
  );
}

function StatLevelBadge({ stats }: { stats: RosterAssignment["stats"] }) {
  if (!stats?.sportLevel || stats.sportLevel === "MLB") return null;
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal opacity-70">
      {stats.sportLevel} stats
    </Badge>
  );
}

function NameWithHover({ a }: { a: RosterAssignment }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-medium cursor-default flex items-center gap-1.5">
          {a.player.fullName}
          {isUncardedOnMlbRoster(a.player, a.rosterType, a.stats) ? " (uncarded)" : ""}
          {a.rosterSlot === "60" && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">60-day IL</Badge>
          )}
          <StatLevelBadge stats={a.stats} />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <div>Age: {a.player.age ?? "-"}</div>
          <div>B/T: {a.player.batSide || "-"}/{a.player.throwHand || "-"}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface LeagueMember {
  userId: string;
  teamName: string | null;
  teamAbbreviation: string | null;
  isArchived: boolean;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export default function MyRoster({ level }: { level: "mlb" | "milb" }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedLeagueId, currentLeague, leagueMembers } = useLeague();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"hitters" | "pitchers">("hitters");
  const [hSort, setHSort] = useState<{ key: HitterSortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const [pSort, setPSort] = useState<{ key: PitcherSortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const [cutPlayer, setCutPlayer] = useState<RosterAssignment | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [posFilter, setPosFilter] = useState("all");

  const viewingUserId = selectedUserId || user?.id || "";
  const isOwnRoster = viewingUserId === user?.id;

  const sortedMembers = useMemo(() => {
    if (!leagueMembers) return [];
    return [...leagueMembers]
      .filter((m: LeagueMember) => !m.isArchived)
      .sort((a: LeagueMember, b: LeagueMember) => {
        const nameA = (a.teamName || `${a.user.firstName} ${a.user.lastName}`).toLowerCase();
        const nameB = (b.teamName || `${b.user.firstName} ${b.user.lastName}`).toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [leagueMembers]);

  const viewingMember = sortedMembers.find((m: LeagueMember) => m.userId === viewingUserId);
  const viewingTeamName = viewingMember?.teamName || (viewingMember ? `${viewingMember.user.firstName} ${viewingMember.user.lastName}` : "");

  const cutMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      const res = await apiRequest("DELETE", `/api/leagues/${selectedLeagueId}/roster-assignments/${assignmentId}/cut`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Player Cut", description: `${data.playerName} has been removed from your roster.` });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", selectedLeagueId, "roster-assignments"] });
      setCutPlayer(null);
    },
    onError: (error: Error) => {
      toast({ title: "Cut Failed", description: error.message, variant: "destructive" });
    },
  });
  const { data, isLoading } = useQuery<{ assignments: RosterAssignment[]; counts: any[] }>({
    queryKey: ["/api/leagues", selectedLeagueId, "roster-assignments", viewingUserId, level],
    queryFn: async () => {
      const params = new URLSearchParams({ userId: viewingUserId, rosterType: level });
      const res = await fetch(`/api/leagues/${selectedLeagueId}/roster-assignments?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch roster");
      return res.json();
    },
    enabled: !!selectedLeagueId && !!viewingUserId,
  });

  const filtered = useMemo(() => {
    let result = [...(data?.assignments || [])];
    if (search) {
      const s = stripAccents(search.toLowerCase());
      result = result.filter((a) =>
        stripAccents(a.player.fullName.toLowerCase()).includes(s)
      );
    }
    if (posFilter !== "all" && level === "mlb") {
      result = result.filter((a) => {
        const positions = a.stats?.positions || a.player.primaryPosition || "";
        return positions.split("/").some((p: string) => p === posFilter);
      });
    }
    return result;
  }, [data?.assignments, search, posFilter, level]);

  const hittersBase = useMemo(
    () => filtered.filter((a) => {
      const st = a.stats;
      const ip = st?.pitchingInningsPitched ?? 0;
      const pa = st?.hittingPlateAppearances ?? 0;
      const isTwoWay = ip >= 20 && pa >= 100;
      if (isTwoWay) return true;
      const hasAnyStats = st?.hadHittingStats || st?.hadPitchingStats;
      if (!hasAnyStats) return a.player.positionType !== "Pitcher";
      return st?.hadHittingStats || !st?.hadPitchingStats;
    }),
    [filtered],
  );
  const pitchersBase = useMemo(
    () => filtered.filter((a) => {
      const st = a.stats;
      const ip = st?.pitchingInningsPitched ?? 0;
      const pa = st?.hittingPlateAppearances ?? 0;
      const isTwoWay = ip >= 20 && pa >= 100;
      if (isTwoWay) return true;
      const hasAnyStats = st?.hadHittingStats || st?.hadPitchingStats;
      if (!hasAnyStats) return a.player.positionType === "Pitcher";
      return st?.hadPitchingStats && !st?.hadHittingStats;
    }),
    [filtered],
  );

  const hitters = useMemo(() => {
    const rows = [...hittersBase];
    const n = (x: number | null | undefined) => x ?? 0;
    const s = (x: string | null | undefined) => (x || "").toLowerCase();
    rows.sort((a, b) => {
      let cmp = 0;
      switch (hSort.key) {
        case "name": cmp = s(a.player.fullName).localeCompare(s(b.player.fullName)); break;
        case "pos": cmp = s(a.player.primaryPosition).localeCompare(s(b.player.primaryPosition)); break;
        case "team": cmp = s(teamAbbrForPlayer(a.player)).localeCompare(s(teamAbbrForPlayer(b.player))); break;
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
      }
      return hSort.dir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [hittersBase, hSort]);

  const pitchers = useMemo(() => {
    const rows = [...pitchersBase];
    const n = (x: number | null | undefined) => x ?? 0;
    const s = (x: string | null | undefined) => (x || "").toLowerCase();
    rows.sort((a, b) => {
      let cmp = 0;
      switch (pSort.key) {
        case "name": cmp = s(a.player.fullName).localeCompare(s(b.player.fullName)); break;
        case "pos": cmp = s(a.player.primaryPosition).localeCompare(s(b.player.primaryPosition)); break;
        case "team": cmp = s(teamAbbrForPlayer(a.player)).localeCompare(s(teamAbbrForPlayer(b.player))); break;
        case "g": cmp = n(a.stats?.pitchingGames) - n(b.stats?.pitchingGames); break;
        case "gs": cmp = n(a.stats?.pitchingGamesStarted) - n(b.stats?.pitchingGamesStarted); break;
        case "ip": cmp = n(a.stats?.pitchingInningsPitched) - n(b.stats?.pitchingInningsPitched); break;
        case "k": cmp = n(a.stats?.pitchingStrikeouts) - n(b.stats?.pitchingStrikeouts); break;
        case "bb": cmp = n(a.stats?.pitchingWalks) - n(b.stats?.pitchingWalks); break;
        case "h": cmp = n(a.stats?.pitchingHits) - n(b.stats?.pitchingHits); break;
        case "hr": cmp = n(a.stats?.pitchingHomeRuns) - n(b.stats?.pitchingHomeRuns); break;
        case "era": cmp = n(a.stats?.pitchingEra) - n(b.stats?.pitchingEra); break;
      }
      return pSort.dir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [pitchersBase, pSort]);

  const hitterTotals = useMemo(() => {
    let ab = 0, pa = 0, bb = 0, s1 = 0, s2 = 0, s3 = 0, hr = 0;
    let wAvg = 0, wObp = 0, wSlg = 0, wOps = 0;
    for (const a of hitters) {
      const st = a.stats;
      if (!st?.hadHittingStats) continue;
      const p = st.hittingPlateAppearances ?? 0;
      ab += st.hittingAtBats ?? 0;
      pa += p;
      bb += st.hittingWalks ?? 0;
      s1 += st.hittingSingles ?? 0;
      s2 += st.hittingDoubles ?? 0;
      s3 += st.hittingTriples ?? 0;
      hr += st.hittingHomeRuns ?? 0;
      if (p > 0) {
        wAvg += (st.hittingAvg ?? 0) * p;
        wObp += (st.hittingObp ?? 0) * p;
        wSlg += (st.hittingSlg ?? 0) * p;
        wOps += (st.hittingOps ?? 0) * p;
      }
    }
    return {
      ab, pa, bb, s1, s2, s3, hr,
      avg: pa > 0 ? wAvg / pa : null,
      obp: pa > 0 ? wObp / pa : null,
      slg: pa > 0 ? wSlg / pa : null,
      ops: pa > 0 ? wOps / pa : null,
    };
  }, [hitters]);

  const pitcherTotals = useMemo(() => {
    let g = 0, gs = 0, ip = 0, k = 0, bb = 0, h = 0, hr = 0;
    let wEra = 0;
    for (const a of pitchers) {
      const st = a.stats;
      if (!st?.hadPitchingStats) continue;
      const innings = st.pitchingInningsPitched ?? 0;
      g += st.pitchingGames ?? 0;
      gs += st.pitchingGamesStarted ?? 0;
      ip += innings;
      k += st.pitchingStrikeouts ?? 0;
      bb += st.pitchingWalks ?? 0;
      h += st.pitchingHits ?? 0;
      hr += st.pitchingHomeRuns ?? 0;
      if (innings > 0) {
        wEra += (st.pitchingEra ?? 0) * innings;
      }
    }
    return {
      g, gs, ip, k, bb, h, hr,
      era: ip > 0 ? wEra / ip : null,
    };
  }, [pitchers]);

  const hs = (k: HitterSortKey) => (hSort.key === k ? (hSort.dir === "asc" ? " ▲" : " ▼") : "");
  const ps = (k: PitcherSortKey) => (pSort.key === k ? (pSort.dir === "asc" ? " ▲" : " ▼") : "");

  const title = level === "mlb" ? "MLB Roster" : "MiLB Roster";
  const limit = level === "mlb" ? (currentLeague as any)?.mlRosterLimit || 40 : (currentLeague as any)?.milbRosterLimit || 150;
  const il60Count = level === "mlb" ? filtered.filter(a => a.rosterSlot === "60").length : 0;
  const activeCount = filtered.length - il60Count;
  const showMilbLevel = level === "milb";
  const canCut = isOwnRoster;

  if (!selectedLeagueId) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <p className="text-muted-foreground">No league selected</p>
      </div>
    );
  }

  const toggleHSort = (key: HitterSortKey) => setHSort((prev) => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));
  const togglePSort = (key: PitcherSortKey) => setPSort((prev) => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-roster-title">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {viewingTeamName || "Your team"} — {activeCount} players / {limit}
            {il60Count > 0 && ` (${il60Count} on 60-day IL)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={viewingUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-[220px]" data-testid="select-roster-team">
              <SelectValue placeholder="Select team..." />
            </SelectTrigger>
            <SelectContent>
              {sortedMembers.map((m: LeagueMember) => (
                <SelectItem key={m.userId} value={m.userId} data-testid={`option-team-${m.userId}`}>
                  {m.teamName || `${m.user.firstName} ${m.user.lastName}`}
                  {m.teamAbbreviation ? ` (${m.teamAbbreviation})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant={activeCount > limit ? "destructive" : "secondary"} data-testid="badge-roster-count">{activeCount} / {limit}{il60Count > 0 ? ` + ${il60Count} IL` : ""}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium"><ClipboardList className="h-4 w-4 inline mr-1" />{title}</CardTitle>
          <div className="flex items-center gap-2">
            {level === "mlb" && (
              <Select value={posFilter} onValueChange={setPosFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-pos-filter"><SelectValue placeholder="Position" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Positions</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="1B">1B</SelectItem>
                  <SelectItem value="2B">2B</SelectItem>
                  <SelectItem value="3B">3B</SelectItem>
                  <SelectItem value="SS">SS</SelectItem>
                  <SelectItem value="LF">LF</SelectItem>
                  <SelectItem value="CF">CF</SelectItem>
                  <SelectItem value="RF">RF</SelectItem>
                  <SelectItem value="OF">OF</SelectItem>
                  <SelectItem value="P">P</SelectItem>
                </SelectContent>
              </Select>
            )}
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search players..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" data-testid="input-roster-search" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">{search ? "No players match your search" : "No players on this roster yet"}</div>
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as "hitters" | "pitchers")}> 
              <TabsList>
                <TabsTrigger value="hitters">Hitters ({hitters.length})</TabsTrigger>
                <TabsTrigger value="pitchers">Pitchers ({pitchers.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="hitters">
                <div className="overflow-x-auto rounded-md border">
                  <Table className="text-[12px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="cursor-pointer" onClick={() => toggleHSort("name")}>Name{hs("name")}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => toggleHSort("pos")}>Pos{hs("pos")}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => toggleHSort("team")}>Team{hs("team")}</TableHead>
                        {showMilbLevel && <TableHead>Level</TableHead>}
                        <TableHead>Acquired</TableHead>
                        {level === "mlb" && <TableHead>Status</TableHead>}
                        {level === "mlb" && <TableHead className="text-right">Salary</TableHead>}
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHSort("ab")}>AB{hs("ab")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHSort("pa")}>PA{hs("pa")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHSort("bb")}>BB{hs("bb")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHSort("1b")}>1B{hs("1b")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHSort("2b")}>2B{hs("2b")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHSort("3b")}>3B{hs("3b")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHSort("hr")}>HR{hs("hr")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHSort("avg")}>AVG{hs("avg")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHSort("obp")}>OBP{hs("obp")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHSort("slg")}>SLG{hs("slg")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleHSort("ops")}>OPS{hs("ops")}</TableHead>
                        {level === "milb" && canCut && <TableHead className="w-[50px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hitters.map((a) => (
                        <TableRow key={`h-${a.id}`} className={`odd:bg-muted/20 ${(currentLeague as any)?.showInnocuous && a.stats?.innocuous ? "bg-green-50 dark:bg-green-950/30 odd:bg-green-50 dark:odd:bg-green-950/30" : ""}`}>
                          <TableCell><NameWithHover a={a} /></TableCell>
                          <TableCell className="font-mono text-[11px]">{a.stats?.positions || a.player.primaryPosition || "-"}</TableCell>
                          <TableCell>{teamAbbrForPlayer(a.player)}</TableCell>
                          {showMilbLevel && <TableCell>{formatLevelWithYear(a.player.sportLevel, (a.player as any).lastActiveSeason, (a.player as any).lastActiveLevel)}</TableCell>}
                          <TableCell className="text-[11px]">{formatAcquired(a.acquired)}</TableCell>
                          {level === "mlb" && <TableCell className="text-[11px]">{a.contractStatus || "-"}</TableCell>}
                          {level === "mlb" && <TableCell className="text-right text-[11px]">{fmtSalary(a.salary2026)}</TableCell>}
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadHittingStats ? (a.stats.hittingAtBats ?? 0) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadHittingStats ? (a.stats.hittingPlateAppearances ?? 0) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadHittingStats ? (a.stats.hittingWalks ?? 0) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadHittingStats ? (a.stats.hittingSingles ?? 0) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadHittingStats ? (a.stats.hittingDoubles ?? 0) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadHittingStats ? (a.stats.hittingTriples ?? 0) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadHittingStats ? (a.stats.hittingHomeRuns ?? 0) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadHittingStats ? fmtRate(a.stats.hittingAvg) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadHittingStats ? fmtRate(a.stats.hittingObp) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadHittingStats ? fmtRate(a.stats.hittingSlg) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadHittingStats ? fmtRate(a.stats.hittingOps) : ""}</TableCell>
                          {level === "milb" && canCut && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => setCutPlayer(a)}
                                data-testid={`button-cut-${a.id}`}
                              >
                                <Scissors className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {hitters.length > 0 && (
                        <TableRow className="bg-muted/50 font-semibold border-t-2" data-testid="row-hitter-totals">
                          <TableCell>Total</TableCell>
                          <TableCell />
                          <TableCell />
                          {showMilbLevel && <TableCell />}
                          <TableCell />
                          {level === "mlb" && <TableCell />}
                          {level === "mlb" && <TableCell />}
                          <TableCell className="text-right font-mono">{hitterTotals.ab}</TableCell>
                          <TableCell className="text-right font-mono">{hitterTotals.pa}</TableCell>
                          <TableCell className="text-right font-mono">{hitterTotals.bb}</TableCell>
                          <TableCell className="text-right font-mono">{hitterTotals.s1}</TableCell>
                          <TableCell className="text-right font-mono">{hitterTotals.s2}</TableCell>
                          <TableCell className="text-right font-mono">{hitterTotals.s3}</TableCell>
                          <TableCell className="text-right font-mono">{hitterTotals.hr}</TableCell>
                          <TableCell className="text-right font-mono">{hitterTotals.avg != null ? fmtRate(hitterTotals.avg) : ""}</TableCell>
                          <TableCell className="text-right font-mono">{hitterTotals.obp != null ? fmtRate(hitterTotals.obp) : ""}</TableCell>
                          <TableCell className="text-right font-mono">{hitterTotals.slg != null ? fmtRate(hitterTotals.slg) : ""}</TableCell>
                          <TableCell className="text-right font-mono">{hitterTotals.ops != null ? fmtRate(hitterTotals.ops) : ""}</TableCell>
                          {level === "milb" && canCut && <TableCell />}
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="pitchers">
                <div className="overflow-x-auto rounded-md border">
                  <Table className="text-[12px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="cursor-pointer" onClick={() => togglePSort("name")}>Name{ps("name")}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => togglePSort("pos")}>Pos{ps("pos")}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => togglePSort("team")}>Team{ps("team")}</TableHead>
                        {showMilbLevel && <TableHead>Level</TableHead>}
                        <TableHead>Acquired</TableHead>
                        {level === "mlb" && <TableHead>Status</TableHead>}
                        {level === "mlb" && <TableHead className="text-right">Salary</TableHead>}
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("g")}>G{ps("g")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("gs")}>GS{ps("gs")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("ip")}>IP{ps("ip")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("k")}>K{ps("k")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("bb")}>BB{ps("bb")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("h")}>H{ps("h")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("hr")}>HR{ps("hr")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("era")}>ERA{ps("era")}</TableHead>
                        {level === "milb" && canCut && <TableHead className="w-[50px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pitchers.map((a) => (
                        <TableRow key={`p-${a.id}`} className={`odd:bg-muted/20 ${(currentLeague as any)?.showInnocuous && a.stats?.innocuous ? "bg-green-50 dark:bg-green-950/30 odd:bg-green-50 dark:odd:bg-green-950/30" : ""}`}>
                          <TableCell><NameWithHover a={a} /></TableCell>
                          <TableCell className="font-mono text-[11px]">{a.stats?.positions || a.player.primaryPosition || "-"}</TableCell>
                          <TableCell>{teamAbbrForPlayer(a.player)}</TableCell>
                          {showMilbLevel && <TableCell>{formatLevelWithYear(a.player.sportLevel, (a.player as any).lastActiveSeason, (a.player as any).lastActiveLevel)}</TableCell>}
                          <TableCell className="text-[11px]">{formatAcquired(a.acquired)}</TableCell>
                          {level === "mlb" && <TableCell className="text-[11px]">{a.contractStatus || "-"}</TableCell>}
                          {level === "mlb" && <TableCell className="text-right text-[11px]">{fmtSalary(a.salary2026)}</TableCell>}
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadPitchingStats ? (a.stats.pitchingGames ?? 0) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadPitchingStats ? (a.stats.pitchingGamesStarted ?? 0) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadPitchingStats ? fmt1(a.stats.pitchingInningsPitched) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadPitchingStats ? (a.stats.pitchingStrikeouts ?? 0) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadPitchingStats ? (a.stats.pitchingWalks ?? 0) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadPitchingStats ? (a.stats.pitchingHits ?? 0) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadPitchingStats ? (a.stats.pitchingHomeRuns ?? 0) : ""}</TableCell>
                          <TableCell className={statCellClass(a.stats)}>{a.stats?.hadPitchingStats ? fmtEra(a.stats.pitchingEra) : ""}</TableCell>
                          {level === "milb" && canCut && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => setCutPlayer(a)}
                                data-testid={`button-cut-${a.id}`}
                              >
                                <Scissors className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {pitchers.length > 0 && (
                        <TableRow className="bg-muted/50 font-semibold border-t-2" data-testid="row-pitcher-totals">
                          <TableCell>Total</TableCell>
                          <TableCell />
                          <TableCell />
                          {showMilbLevel && <TableCell />}
                          <TableCell />
                          {level === "mlb" && <TableCell />}
                          {level === "mlb" && <TableCell />}
                          <TableCell className="text-right font-mono">{pitcherTotals.g}</TableCell>
                          <TableCell className="text-right font-mono">{pitcherTotals.gs}</TableCell>
                          <TableCell className="text-right font-mono">{fmt1(pitcherTotals.ip)}</TableCell>
                          <TableCell className="text-right font-mono">{pitcherTotals.k}</TableCell>
                          <TableCell className="text-right font-mono">{pitcherTotals.bb}</TableCell>
                          <TableCell className="text-right font-mono">{pitcherTotals.h}</TableCell>
                          <TableCell className="text-right font-mono">{pitcherTotals.hr}</TableCell>
                          <TableCell className="text-right font-mono">{pitcherTotals.era != null ? fmtEra(pitcherTotals.era) : ""}</TableCell>
                          {level === "milb" && canCut && <TableCell />}
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!cutPlayer} onOpenChange={(open) => { if (!open) setCutPlayer(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cut {cutPlayer?.player.fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {cutPlayer?.player.fullName} ({cutPlayer?.player.primaryPosition}) from your MiLB roster. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cutMutation.isPending} data-testid="button-cut-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cutPlayer && cutMutation.mutate(cutPlayer.id)}
              disabled={cutMutation.isPending}
              data-testid="button-cut-confirm"
            >
              {cutMutation.isPending ? "Cutting..." : "Cut Player"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
