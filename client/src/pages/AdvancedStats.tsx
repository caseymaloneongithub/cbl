import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Lock, Search, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AdvancedStat {
  id: number;
  mlbPlayerId: number;
  season: number;
  hittingWar: number | null;
  hittingWrcPlus: number | null;
  hittingXba: number | null;
  hittingXbaVsRhp: number | null;
  hittingXbaVsLhp: number | null;
  hittingXobp: number | null;
  hittingXobpVsRhp: number | null;
  hittingXobpVsLhp: number | null;
  hittingXslg: number | null;
  hittingXslgVsRhp: number | null;
  hittingXslgVsLhp: number | null;
  pitchingWar: number | null;
  pitchingXera: number | null;
  pitchingXeraVsRhb: number | null;
  pitchingXeraVsLhb: number | null;
  pitchingXk9: number | null;
  pitchingXk9VsRhb: number | null;
  pitchingXk9VsLhb: number | null;
  pitchingXbb9: number | null;
  pitchingXbb9VsRhb: number | null;
  pitchingXbb9VsLhb: number | null;
  pitchingXwhip: number | null;
  pitchingXwhipVsRhb: number | null;
  pitchingXwhipVsLhb: number | null;
  hittingWrcPlusVsRhp: number | null;
  hittingWrcPlusVsLhp: number | null;
  player?: {
    id: number;
    fullName: string;
    primaryPosition: string;
    currentTeamName: string;
    mlbId: number;
  };
  pa?: number | null;
  gs?: number | null;
  ip?: number | null;
  cblTeam?: string | null;
  cblTeamAbbreviation?: string | null;
  cblRosterType?: string | null;
}

const MLB_TEAM_ABBR: Record<string, string> = {
  "Arizona Diamondbacks": "ARI", "Atlanta Braves": "ATL", "Baltimore Orioles": "BAL",
  "Boston Red Sox": "BOS", "Chicago Cubs": "CHC", "Chicago White Sox": "CWS",
  "Cincinnati Reds": "CIN", "Cleveland Guardians": "CLE", "Colorado Rockies": "COL",
  "Detroit Tigers": "DET", "Houston Astros": "HOU", "Kansas City Royals": "KC",
  "Los Angeles Angels": "LAA", "Los Angeles Dodgers": "LAD", "Miami Marlins": "MIA",
  "Milwaukee Brewers": "MIL", "Minnesota Twins": "MIN", "New York Mets": "NYM",
  "New York Yankees": "NYY", "Oakland Athletics": "OAK", "Philadelphia Phillies": "PHI",
  "Pittsburgh Pirates": "PIT", "San Diego Padres": "SD", "San Francisco Giants": "SF",
  "Seattle Mariners": "SEA", "St. Louis Cardinals": "STL", "Tampa Bay Rays": "TB",
  "Texas Rangers": "TEX", "Toronto Blue Jays": "TOR", "Washington Nationals": "WSH",
};

function mlbAbbr(teamName: string | undefined): string {
  if (!teamName) return "—";
  return MLB_TEAM_ABBR[teamName] || teamName;
}

type SortDir = "asc" | "desc";

type HitterSortKey = "name" | "pos" | "team" | "cbl" | "pa" | "war" | "wrc+" | "wrc+vR" | "wrc+vL" |
  "xba" | "xbaVR" | "xbaVL" | "xobp" | "xobpVR" | "xobpVL" | "xslg" | "xslgVR" | "xslgVL";

type PitcherSortKey = "name" | "pos" | "team" | "cbl" | "gs" | "ip" | "war" |
  "xera" | "xeraVR" | "xeraVL" | "xk9" | "xk9VR" | "xk9VL" |
  "xbb9" | "xbb9VR" | "xbb9VL" | "xwhip" | "xwhipVR" | "xwhipVL";

function fmt(val: number | null | undefined, decimals = 3): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

function fmtWar(val: number | null | undefined): string {
  if (val == null) return "—";
  return val.toFixed(1);
}

function fmtInt(val: number | null | undefined): string {
  if (val == null) return "—";
  return Math.round(val).toString();
}

function numCompare(a: number | null | undefined, b: number | null | undefined, dir: SortDir): number {
  const av = a ?? -Infinity;
  const bv = b ?? -Infinity;
  return dir === "asc" ? av - bv : bv - av;
}

function strCompare(a: string | null | undefined, b: string | null | undefined, dir: SortDir): number {
  const av = (a ?? "").toLowerCase();
  const bv = (b ?? "").toLowerCase();
  return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
}

const ALL_TEAMS = "__all__";

export default function AdvancedStats() {
  const { user } = useAuth();
  const { currentLeague, leagueMembers } = useLeague();
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"hitters" | "pitchers">("hitters");
  const [cblTeamFilter, setCblTeamFilter] = useState<string>(ALL_TEAMS);
  const [hSort, setHSort] = useState<{ key: HitterSortKey; dir: SortDir }>({ key: "war", dir: "desc" });
  const [pSort, setPSort] = useState<{ key: PitcherSortKey; dir: SortDir }>({ key: "war", dir: "desc" });

  const hasPremium = user?.isSuperAdmin || user?.hasPremiumAccess;

  const { data: seasons, isLoading: loadingSeasons } = useQuery<number[]>({
    queryKey: ["/api/premium/advanced-stats/seasons"],
    enabled: !!hasPremium,
  });

  const activeSeason = selectedSeason || (seasons && seasons.length > 0 ? String(seasons[0]) : "");

  const leagueId = currentLeague?.id;

  const { data: stats, isLoading: loadingStats } = useQuery<AdvancedStat[]>({
    queryKey: ["/api/premium/advanced-stats", { season: activeSeason, leagueId }],
    queryFn: async () => {
      let url = `/api/premium/advanced-stats?season=${activeSeason}`;
      if (leagueId) url += `&leagueId=${leagueId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!hasPremium && !!activeSeason,
  });

  const cblTeamNames = useMemo(() => {
    if (!stats || !leagueId) return [];
    const teams = new Set<string>();
    for (const s of stats) {
      if (s.cblTeam) teams.add(s.cblTeam);
    }
    return Array.from(teams).sort();
  }, [stats, leagueId]);

  const matchesSearch = (s: AdvancedStat) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.player?.fullName?.toLowerCase().includes(q) ||
      s.player?.currentTeamName?.toLowerCase().includes(q) ||
      s.cblTeam?.toLowerCase().includes(q);
  };

  const matchesCblTeam = (s: AdvancedStat) => {
    if (cblTeamFilter === ALL_TEAMS) return true;
    if (cblTeamFilter === "__fa__") return !s.cblTeam;
    return s.cblTeam === cblTeamFilter;
  };

  function sortHitters(a: AdvancedStat, b: AdvancedStat): number {
    const { key, dir } = hSort;
    switch (key) {
      case "name": return strCompare(a.player?.fullName, b.player?.fullName, dir);
      case "pos": return strCompare(a.player?.primaryPosition, b.player?.primaryPosition, dir);
      case "team": return strCompare(a.player?.currentTeamName, b.player?.currentTeamName, dir);
      case "cbl": return strCompare(a.cblTeam, b.cblTeam, dir);
      case "pa": return numCompare(a.pa, b.pa, dir);
      case "war": return numCompare(a.hittingWar, b.hittingWar, dir);
      case "wrc+": return numCompare(a.hittingWrcPlus, b.hittingWrcPlus, dir);
      case "wrc+vR": return numCompare(a.hittingWrcPlusVsRhp, b.hittingWrcPlusVsRhp, dir);
      case "wrc+vL": return numCompare(a.hittingWrcPlusVsLhp, b.hittingWrcPlusVsLhp, dir);
      case "xba": return numCompare(a.hittingXba, b.hittingXba, dir);
      case "xbaVR": return numCompare(a.hittingXbaVsRhp, b.hittingXbaVsRhp, dir);
      case "xbaVL": return numCompare(a.hittingXbaVsLhp, b.hittingXbaVsLhp, dir);
      case "xobp": return numCompare(a.hittingXobp, b.hittingXobp, dir);
      case "xobpVR": return numCompare(a.hittingXobpVsRhp, b.hittingXobpVsRhp, dir);
      case "xobpVL": return numCompare(a.hittingXobpVsLhp, b.hittingXobpVsLhp, dir);
      case "xslg": return numCompare(a.hittingXslg, b.hittingXslg, dir);
      case "xslgVR": return numCompare(a.hittingXslgVsRhp, b.hittingXslgVsRhp, dir);
      case "xslgVL": return numCompare(a.hittingXslgVsLhp, b.hittingXslgVsLhp, dir);
      default: return 0;
    }
  }

  function sortPitchers(a: AdvancedStat, b: AdvancedStat): number {
    const { key, dir } = pSort;
    switch (key) {
      case "name": return strCompare(a.player?.fullName, b.player?.fullName, dir);
      case "pos": return strCompare(a.player?.primaryPosition, b.player?.primaryPosition, dir);
      case "team": return strCompare(a.player?.currentTeamName, b.player?.currentTeamName, dir);
      case "cbl": return strCompare(a.cblTeam, b.cblTeam, dir);
      case "gs": return numCompare(a.gs, b.gs, dir);
      case "ip": return numCompare(a.ip, b.ip, dir);
      case "war": return numCompare(a.pitchingWar, b.pitchingWar, dir);
      case "xera": return numCompare(a.pitchingXera, b.pitchingXera, dir);
      case "xeraVR": return numCompare(a.pitchingXeraVsRhb, b.pitchingXeraVsRhb, dir);
      case "xeraVL": return numCompare(a.pitchingXeraVsLhb, b.pitchingXeraVsLhb, dir);
      case "xk9": return numCompare(a.pitchingXk9, b.pitchingXk9, dir);
      case "xk9VR": return numCompare(a.pitchingXk9VsRhb, b.pitchingXk9VsRhb, dir);
      case "xk9VL": return numCompare(a.pitchingXk9VsLhb, b.pitchingXk9VsLhb, dir);
      case "xbb9": return numCompare(a.pitchingXbb9, b.pitchingXbb9, dir);
      case "xbb9VR": return numCompare(a.pitchingXbb9VsRhb, b.pitchingXbb9VsRhb, dir);
      case "xbb9VL": return numCompare(a.pitchingXbb9VsLhb, b.pitchingXbb9VsLhb, dir);
      case "xwhip": return numCompare(a.pitchingXwhip, b.pitchingXwhip, dir);
      case "xwhipVR": return numCompare(a.pitchingXwhipVsRhb, b.pitchingXwhipVsRhb, dir);
      case "xwhipVL": return numCompare(a.pitchingXwhipVsLhb, b.pitchingXwhipVsLhb, dir);
      default: return 0;
    }
  }

  const hitters = useMemo(() => {
    if (!stats) return [];
    return stats
      .filter(s => s.hittingWar != null || s.hittingWrcPlus != null || s.hittingXba != null)
      .filter(matchesSearch)
      .filter(matchesCblTeam)
      .sort(sortHitters);
  }, [stats, search, cblTeamFilter, hSort]);

  const pitchers = useMemo(() => {
    if (!stats) return [];
    return stats
      .filter(s => s.pitchingWar != null || s.pitchingXera != null || s.pitchingXk9 != null)
      .filter(matchesSearch)
      .filter(matchesCblTeam)
      .sort(sortPitchers);
  }, [stats, search, cblTeamFilter, pSort]);

  const toggleHSort = (key: HitterSortKey) =>
    setHSort(prev => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));
  const togglePSort = (key: PitcherSortKey) =>
    setPSort(prev => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));

  const hs = (k: HitterSortKey) => (hSort.key === k ? (hSort.dir === "asc" ? " ▲" : " ▼") : "");
  const ps = (k: PitcherSortKey) => (pSort.key === k ? (pSort.dir === "asc" ? " ▲" : " ▼") : "");

  if (!hasPremium) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Premium Access Required</h2>
            <p className="text-muted-foreground">
              Advanced player statistics are available to premium members. Contact your league administrator for access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-advanced-stats-title">Advanced Stats</h1>
            <p className="text-sm text-muted-foreground">
              Expected statistics and WAR{currentLeague ? ` — ${currentLeague.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {seasons && seasons.length > 0 && (
            <Select value={activeSeason} onValueChange={setSelectedSeason}>
              <SelectTrigger className="w-[120px]" data-testid="select-season">
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map(s => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {leagueId && cblTeamNames.length > 0 && (
            <Select value={cblTeamFilter} onValueChange={setCblTeamFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-cbl-team-filter">
                <SelectValue placeholder="All CBL Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TEAMS}>All CBL Teams</SelectItem>
                <SelectItem value="__fa__">Free Agents</SelectItem>
                {cblTeamNames.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[200px]"
              data-testid="input-search-stats"
            />
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "hitters" | "pitchers")}>
        <TabsList>
          <TabsTrigger value="hitters" data-testid="tab-hitters">
            Hitters {hitters.length > 0 && <Badge variant="secondary" className="ml-2">{hitters.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="pitchers" data-testid="tab-pitchers">
            Pitchers {pitchers.length > 0 && <Badge variant="secondary" className="ml-2">{pitchers.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hitters">
          {loadingSeasons || loadingStats ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent></Card>
          ) : !activeSeason ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No advanced stats seasons available yet.</CardContent></Card>
          ) : hitters.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No hitter stats found{search ? ` matching "${search}"` : ""}.</CardContent></Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[180px] cursor-pointer" onClick={() => toggleHSort("name")}>Player{hs("name")}</TableHead>
                      <TableHead className="text-center min-w-[50px] cursor-pointer" onClick={() => toggleHSort("pos")}>Pos{hs("pos")}</TableHead>
                      <TableHead className="text-center min-w-[60px] cursor-pointer" onClick={() => toggleHSort("team")}>Team{hs("team")}</TableHead>
                      {leagueId && <TableHead className="min-w-[120px] cursor-pointer" onClick={() => toggleHSort("cbl")}>CBL Team{hs("cbl")}</TableHead>}
                      <TableHead className="text-right min-w-[45px] cursor-pointer" onClick={() => toggleHSort("pa")}>PA{hs("pa")}</TableHead>
                      <TableHead className="text-right min-w-[50px] cursor-pointer" onClick={() => toggleHSort("war")}>WAR{hs("war")}</TableHead>
                      <TableHead className="text-right min-w-[55px] cursor-pointer" onClick={() => toggleHSort("wrc+")}>wRC+{hs("wrc+")}</TableHead>
                      <TableHead className="text-right min-w-[65px] cursor-pointer" onClick={() => toggleHSort("wrc+vR")}>wRC+ vR{hs("wrc+vR")}</TableHead>
                      <TableHead className="text-right min-w-[65px] cursor-pointer" onClick={() => toggleHSort("wrc+vL")}>wRC+ vL{hs("wrc+vL")}</TableHead>
                      <TableHead className="text-right min-w-[55px] cursor-pointer" onClick={() => toggleHSort("xba")}>xBA{hs("xba")}</TableHead>
                      <TableHead className="text-right min-w-[65px] cursor-pointer" onClick={() => toggleHSort("xbaVR")}>xBA vR{hs("xbaVR")}</TableHead>
                      <TableHead className="text-right min-w-[65px] cursor-pointer" onClick={() => toggleHSort("xbaVL")}>xBA vL{hs("xbaVL")}</TableHead>
                      <TableHead className="text-right min-w-[55px] cursor-pointer" onClick={() => toggleHSort("xobp")}>xOBP{hs("xobp")}</TableHead>
                      <TableHead className="text-right min-w-[65px] cursor-pointer" onClick={() => toggleHSort("xobpVR")}>xOBP vR{hs("xobpVR")}</TableHead>
                      <TableHead className="text-right min-w-[65px] cursor-pointer" onClick={() => toggleHSort("xobpVL")}>xOBP vL{hs("xobpVL")}</TableHead>
                      <TableHead className="text-right min-w-[55px] cursor-pointer" onClick={() => toggleHSort("xslg")}>xSLG{hs("xslg")}</TableHead>
                      <TableHead className="text-right min-w-[65px] cursor-pointer" onClick={() => toggleHSort("xslgVR")}>xSLG vR{hs("xslgVR")}</TableHead>
                      <TableHead className="text-right min-w-[65px] cursor-pointer" onClick={() => toggleHSort("xslgVL")}>xSLG vL{hs("xslgVL")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hitters.map((s) => (
                      <TableRow key={s.id} data-testid={`row-hitter-${s.id}`}>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">{s.player?.fullName ?? `Player #${s.mlbPlayerId}`}</TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">{s.player?.primaryPosition ?? "—"}</TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">{mlbAbbr(s.player?.currentTeamName)}</TableCell>
                        {leagueId && <TableCell className="text-xs">{s.cblTeamAbbreviation ? <Badge variant="outline">{s.cblTeamAbbreviation}</Badge> : s.cblTeam ? <Badge variant="outline">{s.cblTeam}</Badge> : <span className="text-muted-foreground">FA</span>}</TableCell>}
                        <TableCell className="text-right font-mono text-muted-foreground">{s.pa ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono">{fmtWar(s.hittingWar)}</TableCell>
                        <TableCell className="text-right font-mono">{fmtInt(s.hittingWrcPlus)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmtInt(s.hittingWrcPlusVsRhp)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmtInt(s.hittingWrcPlusVsLhp)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(s.hittingXba)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmt(s.hittingXbaVsRhp)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmt(s.hittingXbaVsLhp)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(s.hittingXobp)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmt(s.hittingXobpVsRhp)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmt(s.hittingXobpVsLhp)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(s.hittingXslg)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmt(s.hittingXslgVsRhp)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmt(s.hittingXslgVsLhp)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pitchers">
          {loadingSeasons || loadingStats ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent></Card>
          ) : !activeSeason ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No advanced stats seasons available yet.</CardContent></Card>
          ) : pitchers.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No pitcher stats found{search ? ` matching "${search}"` : ""}.</CardContent></Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[180px] cursor-pointer" onClick={() => togglePSort("name")}>Player{ps("name")}</TableHead>
                      <TableHead className="text-center min-w-[50px] cursor-pointer" onClick={() => togglePSort("pos")}>Pos{ps("pos")}</TableHead>
                      <TableHead className="text-center min-w-[60px] cursor-pointer" onClick={() => togglePSort("team")}>Team{ps("team")}</TableHead>
                      {leagueId && <TableHead className="min-w-[120px] cursor-pointer" onClick={() => togglePSort("cbl")}>CBL Team{ps("cbl")}</TableHead>}
                      <TableHead className="text-right min-w-[40px] cursor-pointer" onClick={() => togglePSort("gs")}>GS{ps("gs")}</TableHead>
                      <TableHead className="text-right min-w-[45px] cursor-pointer" onClick={() => togglePSort("ip")}>IP{ps("ip")}</TableHead>
                      <TableHead className="text-right min-w-[50px] cursor-pointer" onClick={() => togglePSort("war")}>WAR{ps("war")}</TableHead>
                      <TableHead className="text-right min-w-[55px] cursor-pointer" onClick={() => togglePSort("xera")}>xERA{ps("xera")}</TableHead>
                      <TableHead className="text-right min-w-[70px] cursor-pointer" onClick={() => togglePSort("xeraVR")}>xERA vR{ps("xeraVR")}</TableHead>
                      <TableHead className="text-right min-w-[70px] cursor-pointer" onClick={() => togglePSort("xeraVL")}>xERA vL{ps("xeraVL")}</TableHead>
                      <TableHead className="text-right min-w-[55px] cursor-pointer" onClick={() => togglePSort("xk9")}>xK/9{ps("xk9")}</TableHead>
                      <TableHead className="text-right min-w-[70px] cursor-pointer" onClick={() => togglePSort("xk9VR")}>xK/9 vR{ps("xk9VR")}</TableHead>
                      <TableHead className="text-right min-w-[70px] cursor-pointer" onClick={() => togglePSort("xk9VL")}>xK/9 vL{ps("xk9VL")}</TableHead>
                      <TableHead className="text-right min-w-[60px] cursor-pointer" onClick={() => togglePSort("xbb9")}>xBB/9{ps("xbb9")}</TableHead>
                      <TableHead className="text-right min-w-[70px] cursor-pointer" onClick={() => togglePSort("xbb9VR")}>xBB/9 vR{ps("xbb9VR")}</TableHead>
                      <TableHead className="text-right min-w-[70px] cursor-pointer" onClick={() => togglePSort("xbb9VL")}>xBB/9 vL{ps("xbb9VL")}</TableHead>
                      <TableHead className="text-right min-w-[60px] cursor-pointer" onClick={() => togglePSort("xwhip")}>xWHIP{ps("xwhip")}</TableHead>
                      <TableHead className="text-right min-w-[70px] cursor-pointer" onClick={() => togglePSort("xwhipVR")}>xWHIP vR{ps("xwhipVR")}</TableHead>
                      <TableHead className="text-right min-w-[70px] cursor-pointer" onClick={() => togglePSort("xwhipVL")}>xWHIP vL{ps("xwhipVL")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pitchers.map((s) => (
                      <TableRow key={s.id} data-testid={`row-pitcher-${s.id}`}>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">{s.player?.fullName ?? `Player #${s.mlbPlayerId}`}</TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">{s.player?.primaryPosition ?? "—"}</TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">{mlbAbbr(s.player?.currentTeamName)}</TableCell>
                        {leagueId && <TableCell className="text-xs">{s.cblTeamAbbreviation ? <Badge variant="outline">{s.cblTeamAbbreviation}</Badge> : s.cblTeam ? <Badge variant="outline">{s.cblTeam}</Badge> : <span className="text-muted-foreground">FA</span>}</TableCell>}
                        <TableCell className="text-right font-mono text-muted-foreground">{s.gs ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{s.ip != null ? s.ip.toFixed(1) : "—"}</TableCell>
                        <TableCell className="text-right font-mono">{fmtWar(s.pitchingWar)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(s.pitchingXera, 2)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmt(s.pitchingXeraVsRhb, 2)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmt(s.pitchingXeraVsLhb, 2)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(s.pitchingXk9, 2)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmt(s.pitchingXk9VsRhb, 2)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmt(s.pitchingXk9VsLhb, 2)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(s.pitchingXbb9, 2)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmt(s.pitchingXbb9VsRhb, 2)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmt(s.pitchingXbb9VsLhb, 2)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(s.pitchingXwhip, 3)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmt(s.pitchingXwhipVsRhb, 3)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{fmt(s.pitchingXwhipVsLhb, 3)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
