import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Lock, Trophy } from "lucide-react";
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
  pitchingWar: number | null;
  cblTeam?: string | null;
  cblRosterType?: string | null;
  player?: {
    id: number;
    fullName: string;
    primaryPosition: string;
  };
}

interface TeamWarRow {
  teamName: string;
  totalWar: number;
  hitterWar: number;
  pitcherWar: number;
  hitterCount: number;
  pitcherCount: number;
  totalPlayers: number;
}

function fmtWar(val: number): string {
  const prefix = val >= 0 ? "" : "";
  return prefix + val.toFixed(1);
}

export default function WarRankings() {
  const { user } = useAuth();
  const { selectedLeagueId, leagues } = useLeague();
  const leagueId = selectedLeagueId;
  const currentLeague = leagues?.find((l: any) => l.id === leagueId);
  const hasPremium = user?.hasPremiumAccess || user?.isSuperAdmin;

  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [excludeNegative, setExcludeNegative] = useState(false);
  const [activeTab, setActiveTab] = useState("total");

  const { data: seasons } = useQuery<number[]>({
    queryKey: ["/api/premium/advanced-stats/seasons"],
    enabled: !!hasPremium,
  });

  const activeSeason = selectedSeason || (seasons && seasons.length > 0 ? String(seasons[0]) : "");

  const { data: stats, isLoading } = useQuery<AdvancedStat[]>({
    queryKey: ["/api/premium/advanced-stats", { season: activeSeason, leagueId }],
    queryFn: async () => {
      let url = `/api/premium/advanced-stats?season=${activeSeason}`;
      if (leagueId) url += `&leagueId=${leagueId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!hasPremium && !!activeSeason && !!leagueId,
  });

  const teamRankings = useMemo(() => {
    if (!stats) return [];
    const teamMap = new Map<string, TeamWarRow>();

    for (const s of stats) {
      const team = s.cblTeam;
      if (!team) continue;

      if (!teamMap.has(team)) {
        teamMap.set(team, {
          teamName: team,
          totalWar: 0,
          hitterWar: 0,
          pitcherWar: 0,
          hitterCount: 0,
          pitcherCount: 0,
          totalPlayers: 0,
        });
      }

      const row = teamMap.get(team)!;

      if (s.hittingWar != null) {
        const war = s.hittingWar;
        if (!excludeNegative || war >= 0) {
          row.hitterWar += war;
          row.totalWar += war;
        }
        row.hitterCount++;
        row.totalPlayers++;
      }
      if (s.pitchingWar != null) {
        const war = s.pitchingWar;
        if (!excludeNegative || war >= 0) {
          row.pitcherWar += war;
          row.totalWar += war;
        }
        row.pitcherCount++;
        if (s.hittingWar == null) {
          row.totalPlayers++;
        }
      }
    }

    return Array.from(teamMap.values());
  }, [stats, excludeNegative]);

  const sortedByTotal = useMemo(() =>
    [...teamRankings].sort((a, b) => b.totalWar - a.totalWar),
    [teamRankings]
  );

  const sortedByHitters = useMemo(() =>
    [...teamRankings].sort((a, b) => b.hitterWar - a.hitterWar),
    [teamRankings]
  );

  const sortedByPitchers = useMemo(() =>
    [...teamRankings].sort((a, b) => b.pitcherWar - a.pitcherWar),
    [teamRankings]
  );

  if (!hasPremium) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Premium Access Required</h2>
            <p className="text-muted-foreground">
              WAR Rankings are available to premium members. Contact your league administrator for access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!leagueId) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Select a League</h2>
            <p className="text-muted-foreground">
              Choose a league from the top navigation to view WAR rankings by team.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const maxTotal = sortedByTotal.length > 0 ? sortedByTotal[0].totalWar : 1;
  const maxHitter = sortedByHitters.length > 0 ? sortedByHitters[0].hitterWar : 1;
  const maxPitcher = sortedByPitchers.length > 0 ? sortedByPitchers[0].pitcherWar : 1;

  function RankingTable({ data, warKey, maxVal, countLabel }: {
    data: TeamWarRow[];
    warKey: "totalWar" | "hitterWar" | "pitcherWar";
    maxVal: number;
    countLabel: "totalPlayers" | "hitterCount" | "pitcherCount";
  }) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px] text-center">#</TableHead>
            <TableHead className="min-w-[150px]">Team</TableHead>
            <TableHead className="text-right min-w-[70px]">WAR</TableHead>
            <TableHead className="min-w-[200px]"></TableHead>
            <TableHead className="text-right min-w-[70px]">Players</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => {
            const war = row[warKey];
            const barPct = maxVal > 0 ? Math.max(0, (war / maxVal) * 100) : 0;
            return (
              <TableRow key={row.teamName} data-testid={`row-war-team-${idx}`}>
                <TableCell className="text-center font-bold text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="font-medium">{row.teamName}</TableCell>
                <TableCell className={`text-right font-mono font-bold ${war < 0 ? "text-red-500" : ""}`}>
                  {fmtWar(war)}
                </TableCell>
                <TableCell>
                  <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.max(barPct, 0)}%` }}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{row[countLabel]}</TableCell>
              </TableRow>
            );
          })}
          {data.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No data available for this season
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-war-rankings-title">WAR Rankings</h1>
            <p className="text-sm text-muted-foreground">
              Team rankings by WAR{currentLeague ? ` — ${currentLeague.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {seasons && seasons.length > 0 && (
            <Select value={activeSeason} onValueChange={setSelectedSeason}>
              <SelectTrigger className="w-[120px]" data-testid="select-war-season">
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map(s => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-2">
            <Switch
              id="exclude-negative"
              checked={excludeNegative}
              onCheckedChange={setExcludeNegative}
              data-testid="switch-exclude-negative"
            />
            <Label htmlFor="exclude-negative" className="text-sm cursor-pointer">
              Exclude negative WAR
            </Label>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="px-4 pt-4">
              <TabsList data-testid="tabs-war-type">
                <TabsTrigger value="total" data-testid="tab-total">Total</TabsTrigger>
                <TabsTrigger value="hitters" data-testid="tab-hitters">Hitters</TabsTrigger>
                <TabsTrigger value="pitchers" data-testid="tab-pitchers">Pitchers</TabsTrigger>
              </TabsList>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <TabsContent value="total" className="m-0">
                  <RankingTable
                    data={sortedByTotal}
                    warKey="totalWar"
                    maxVal={maxTotal}
                    countLabel="totalPlayers"
                  />
                </TabsContent>
                <TabsContent value="hitters" className="m-0">
                  <RankingTable
                    data={sortedByHitters}
                    warKey="hitterWar"
                    maxVal={maxHitter}
                    countLabel="hitterCount"
                  />
                </TabsContent>
                <TabsContent value="pitchers" className="m-0">
                  <RankingTable
                    data={sortedByPitchers}
                    warKey="pitcherWar"
                    maxVal={maxPitcher}
                    countLabel="pitcherCount"
                  />
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
