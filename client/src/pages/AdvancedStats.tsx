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
  player?: {
    id: number;
    name: string;
    position: string;
    team: string;
    mlbId: number;
  };
  cblTeam?: string | null;
  cblRosterType?: string | null;
}

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

export default function AdvancedStats() {
  const { user } = useAuth();
  const { currentLeague } = useLeague();
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"hitters" | "pitchers">("hitters");

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

  const matchesSearch = (s: AdvancedStat) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.player?.name?.toLowerCase().includes(q) ||
      s.player?.team?.toLowerCase().includes(q) ||
      s.cblTeam?.toLowerCase().includes(q);
  };

  const hitters = useMemo(() => {
    if (!stats) return [];
    return stats
      .filter(s => s.hittingWar != null || s.hittingWrcPlus != null || s.hittingXba != null)
      .filter(matchesSearch)
      .sort((a, b) => (b.hittingWar ?? -999) - (a.hittingWar ?? -999));
  }, [stats, search]);

  const pitchers = useMemo(() => {
    if (!stats) return [];
    return stats
      .filter(s => s.pitchingWar != null || s.pitchingXera != null || s.pitchingXk9 != null)
      .filter(matchesSearch)
      .sort((a, b) => (b.pitchingWar ?? -999) - (a.pitchingWar ?? -999));
  }, [stats, search]);

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
        <div className="flex items-center gap-3">
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
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Player</TableHead>
                      <TableHead className="text-center min-w-[50px]">Pos</TableHead>
                      <TableHead className="text-center min-w-[60px]">Team</TableHead>
                      {leagueId && <TableHead className="min-w-[120px]">CBL Team</TableHead>}
                      <TableHead className="text-right min-w-[50px]">WAR</TableHead>
                      <TableHead className="text-right min-w-[55px]">wRC+</TableHead>
                      <TableHead className="text-right min-w-[65px]">wRC+ vR</TableHead>
                      <TableHead className="text-right min-w-[65px]">wRC+ vL</TableHead>
                      <TableHead className="text-right min-w-[55px]">xBA</TableHead>
                      <TableHead className="text-right min-w-[65px]">xBA vR</TableHead>
                      <TableHead className="text-right min-w-[65px]">xBA vL</TableHead>
                      <TableHead className="text-right min-w-[55px]">xOBP</TableHead>
                      <TableHead className="text-right min-w-[65px]">xOBP vR</TableHead>
                      <TableHead className="text-right min-w-[65px]">xOBP vL</TableHead>
                      <TableHead className="text-right min-w-[55px]">xSLG</TableHead>
                      <TableHead className="text-right min-w-[65px]">xSLG vR</TableHead>
                      <TableHead className="text-right min-w-[65px]">xSLG vL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hitters.map((s) => (
                      <TableRow key={s.id} data-testid={`row-hitter-${s.id}`}>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">{s.player?.name ?? `Player #${s.mlbPlayerId}`}</TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">{s.player?.position ?? "—"}</TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">{s.player?.team ?? "—"}</TableCell>
                        {leagueId && <TableCell className="text-xs">{s.cblTeam ? <Badge variant="outline">{s.cblTeam}</Badge> : <span className="text-muted-foreground">FA</span>}</TableCell>}
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
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Player</TableHead>
                      <TableHead className="text-center min-w-[50px]">Pos</TableHead>
                      <TableHead className="text-center min-w-[60px]">Team</TableHead>
                      {leagueId && <TableHead className="min-w-[120px]">CBL Team</TableHead>}
                      <TableHead className="text-right min-w-[50px]">WAR</TableHead>
                      <TableHead className="text-right min-w-[55px]">xERA</TableHead>
                      <TableHead className="text-right min-w-[70px]">xERA vR</TableHead>
                      <TableHead className="text-right min-w-[70px]">xERA vL</TableHead>
                      <TableHead className="text-right min-w-[55px]">xK/9</TableHead>
                      <TableHead className="text-right min-w-[70px]">xK/9 vR</TableHead>
                      <TableHead className="text-right min-w-[70px]">xK/9 vL</TableHead>
                      <TableHead className="text-right min-w-[60px]">xBB/9</TableHead>
                      <TableHead className="text-right min-w-[70px]">xBB/9 vR</TableHead>
                      <TableHead className="text-right min-w-[70px]">xBB/9 vL</TableHead>
                      <TableHead className="text-right min-w-[60px]">xWHIP</TableHead>
                      <TableHead className="text-right min-w-[70px]">xWHIP vR</TableHead>
                      <TableHead className="text-right min-w-[70px]">xWHIP vL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pitchers.map((s) => (
                      <TableRow key={s.id} data-testid={`row-pitcher-${s.id}`}>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">{s.player?.name ?? `Player #${s.mlbPlayerId}`}</TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">{s.player?.position ?? "—"}</TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">{s.player?.team ?? "—"}</TableCell>
                        {leagueId && <TableCell className="text-xs">{s.cblTeam ? <Badge variant="outline">{s.cblTeam}</Badge> : <span className="text-muted-foreground">FA</span>}</TableCell>}
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
