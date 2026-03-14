import { useQuery } from "@tanstack/react-query";
import { stripAccents } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Search, ClipboardList } from "lucide-react";
import { useState, useMemo } from "react";
import type { MlbPlayer } from "@shared/schema";
import { getMlbAffiliationAbbreviation } from "@/lib/teamDisplay";
import { isUncardedOnMlbRoster } from "@/lib/playerCarding";

interface RosterAssignment {
  id: number;
  leagueId: number;
  userId: string;
  mlbPlayerId: number;
  rosterType: string;
  season: number;
  player: MlbPlayer;
}

type HitterSortKey = "name" | "pos" | "team" | "ab" | "pa" | "bb" | "1b" | "2b" | "3b" | "hr" | "avg" | "obp" | "slg" | "ops";
type PitcherSortKey = "name" | "pos" | "team" | "g" | "gs" | "ip" | "k" | "bb" | "h" | "hr" | "era";

type SortDir = "asc" | "desc";

const fmtRate = (v: number | null | undefined) => (v == null ? "-" : Number(v).toFixed(3));
const fmtEra = (v: number | null | undefined) => (v == null ? "-" : Number(v).toFixed(2));
const fmt1 = (v: number | null | undefined) => (v == null ? "-" : Number(v).toFixed(1));

function teamAbbrForPlayer(p: MlbPlayer): string {
  return (
    getMlbAffiliationAbbreviation(p.currentTeamName || null) ||
    getMlbAffiliationAbbreviation(p.parentOrgName || null) ||
    "-"
  );
}

function NameWithHover({ a }: { a: RosterAssignment }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-medium cursor-default">
          {a.player.fullName}
          {isUncardedOnMlbRoster(a.player, a.rosterType) ? " (uncarded)" : ""}
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

export default function MyRoster({ level }: { level: "mlb" | "milb" }) {
  const { user } = useAuth();
  const { selectedLeagueId, currentLeague } = useLeague();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"hitters" | "pitchers">("hitters");
  const [hSort, setHSort] = useState<{ key: HitterSortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const [pSort, setPSort] = useState<{ key: PitcherSortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const { data, isLoading } = useQuery<{ assignments: RosterAssignment[]; counts: any[] }>({
    queryKey: ["/api/leagues", selectedLeagueId, "roster-assignments", user?.id, level],
    queryFn: async () => {
      const params = new URLSearchParams({ userId: user!.id, rosterType: level });
      const res = await fetch(`/api/leagues/${selectedLeagueId}/roster-assignments?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch roster");
      return res.json();
    },
    enabled: !!selectedLeagueId && !!user?.id,
  });

  const filtered = useMemo(() => {
    let result = [...(data?.assignments || [])];
    if (search) {
      const s = stripAccents(search.toLowerCase());
      result = result.filter((a) =>
        stripAccents(a.player.fullName.toLowerCase()).includes(s)
      );
    }
    return result;
  }, [data?.assignments, search]);

  const hittersBase = useMemo(
    () => filtered.filter((a) => {
      const ip = a.player.pitchingInningsPitched ?? 0;
      const pa = a.player.hittingPlateAppearances ?? 0;
      const isTwoWay = ip >= 20 && pa >= 100;
      if (isTwoWay) return true;
      return a.player.hadHittingStats || !a.player.hadPitchingStats;
    }),
    [filtered],
  );
  const pitchersBase = useMemo(
    () => filtered.filter((a) => {
      const ip = a.player.pitchingInningsPitched ?? 0;
      const pa = a.player.hittingPlateAppearances ?? 0;
      const isTwoWay = ip >= 20 && pa >= 100;
      if (isTwoWay) return true;
      return a.player.hadPitchingStats && !a.player.hadHittingStats;
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
        case "ab": cmp = n(a.player.hittingAtBats) - n(b.player.hittingAtBats); break;
        case "pa": cmp = n(a.player.hittingPlateAppearances) - n(b.player.hittingPlateAppearances); break;
        case "bb": cmp = n(a.player.hittingWalks) - n(b.player.hittingWalks); break;
        case "1b": cmp = n(a.player.hittingSingles) - n(b.player.hittingSingles); break;
        case "2b": cmp = n(a.player.hittingDoubles) - n(b.player.hittingDoubles); break;
        case "3b": cmp = n(a.player.hittingTriples) - n(b.player.hittingTriples); break;
        case "hr": cmp = n(a.player.hittingHomeRuns) - n(b.player.hittingHomeRuns); break;
        case "avg": cmp = n(a.player.hittingAvg) - n(b.player.hittingAvg); break;
        case "obp": cmp = n(a.player.hittingObp) - n(b.player.hittingObp); break;
        case "slg": cmp = n(a.player.hittingSlg) - n(b.player.hittingSlg); break;
        case "ops": cmp = n(a.player.hittingOps) - n(b.player.hittingOps); break;
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
        case "g": cmp = n(a.player.pitchingGames) - n(b.player.pitchingGames); break;
        case "gs": cmp = n(a.player.pitchingGamesStarted) - n(b.player.pitchingGamesStarted); break;
        case "ip": cmp = n(a.player.pitchingInningsPitched) - n(b.player.pitchingInningsPitched); break;
        case "k": cmp = n(a.player.pitchingStrikeouts) - n(b.player.pitchingStrikeouts); break;
        case "bb": cmp = n(a.player.pitchingWalks) - n(b.player.pitchingWalks); break;
        case "h": cmp = n(a.player.pitchingHits) - n(b.player.pitchingHits); break;
        case "hr": cmp = n(a.player.pitchingHomeRuns) - n(b.player.pitchingHomeRuns); break;
        case "era": cmp = n(a.player.pitchingEra) - n(b.player.pitchingEra); break;
      }
      return pSort.dir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [pitchersBase, pSort]);

  const hs = (k: HitterSortKey) => (hSort.key === k ? (hSort.dir === "asc" ? " ▲" : " ▼") : "");
  const ps = (k: PitcherSortKey) => (pSort.key === k ? (pSort.dir === "asc" ? " ▲" : " ▼") : "");

  const title = level === "mlb" ? "MLB Roster" : "MiLB Roster";
  const limit = level === "mlb" ? (currentLeague as any)?.mlRosterLimit || 40 : (currentLeague as any)?.milbRosterLimit || 150;
  const showMilbLevel = level === "milb";

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
          <p className="text-sm text-muted-foreground">{currentLeague?.teamName || "Your team"} - {filtered.length} players / {limit}</p>
        </div>
        <Badge variant={filtered.length > limit ? "destructive" : "secondary"} data-testid="badge-roster-count">{filtered.length} / {limit}</Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium"><ClipboardList className="h-4 w-4 inline mr-1" />{title}</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search players..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" data-testid="input-roster-search" />
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
                        {showMilbLevel && <TableHead>Level (2025)</TableHead>}
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hitters.map((a) => (
                        <TableRow key={`h-${a.id}`} className="odd:bg-muted/20">
                          <TableCell><NameWithHover a={a} /></TableCell>
                          <TableCell className="font-mono text-[11px]">{a.player.primaryPosition || "-"}</TableCell>
                          <TableCell>{teamAbbrForPlayer(a.player)}</TableCell>
                          {showMilbLevel && <TableCell>{a.player.sportLevel || "-"}</TableCell>}
                          <TableCell className="text-right font-mono">{a.player.hittingAtBats ?? 0}</TableCell>
                          <TableCell className="text-right font-mono">{a.player.hittingPlateAppearances ?? 0}</TableCell>
                          <TableCell className="text-right font-mono">{a.player.hittingWalks ?? 0}</TableCell>
                          <TableCell className="text-right font-mono">{a.player.hittingSingles ?? 0}</TableCell>
                          <TableCell className="text-right font-mono">{a.player.hittingDoubles ?? 0}</TableCell>
                          <TableCell className="text-right font-mono">{a.player.hittingTriples ?? 0}</TableCell>
                          <TableCell className="text-right font-mono">{a.player.hittingHomeRuns ?? 0}</TableCell>
                          <TableCell className="text-right font-mono">{fmtRate(a.player.hittingAvg)}</TableCell>
                          <TableCell className="text-right font-mono">{fmtRate(a.player.hittingObp)}</TableCell>
                          <TableCell className="text-right font-mono">{fmtRate(a.player.hittingSlg)}</TableCell>
                          <TableCell className="text-right font-mono">{fmtRate(a.player.hittingOps)}</TableCell>
                        </TableRow>
                      ))}
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
                        {showMilbLevel && <TableHead>Level (2025)</TableHead>}
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("g")}>G{ps("g")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("gs")}>GS{ps("gs")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("ip")}>IP{ps("ip")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("k")}>K{ps("k")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("bb")}>BB{ps("bb")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("h")}>H{ps("h")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("hr")}>HR{ps("hr")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => togglePSort("era")}>ERA{ps("era")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pitchers.map((a) => (
                        <TableRow key={`p-${a.id}`} className="odd:bg-muted/20">
                          <TableCell><NameWithHover a={a} /></TableCell>
                          <TableCell className="font-mono text-[11px]">{a.player.primaryPosition || "-"}</TableCell>
                          <TableCell>{teamAbbrForPlayer(a.player)}</TableCell>
                          {showMilbLevel && <TableCell>{a.player.sportLevel || "-"}</TableCell>}
                          <TableCell className="text-right font-mono">{a.player.pitchingGames ?? 0}</TableCell>
                          <TableCell className="text-right font-mono">{a.player.pitchingGamesStarted ?? 0}</TableCell>
                          <TableCell className="text-right font-mono">{fmt1(a.player.pitchingInningsPitched)}</TableCell>
                          <TableCell className="text-right font-mono">{a.player.pitchingStrikeouts ?? 0}</TableCell>
                          <TableCell className="text-right font-mono">{a.player.pitchingWalks ?? 0}</TableCell>
                          <TableCell className="text-right font-mono">{a.player.pitchingHits ?? 0}</TableCell>
                          <TableCell className="text-right font-mono">{a.player.pitchingHomeRuns ?? 0}</TableCell>
                          <TableCell className="text-right font-mono">{fmtEra(a.player.pitchingEra)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
