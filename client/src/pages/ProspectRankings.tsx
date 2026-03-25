import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Lock, Search, Star } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProspectRankingEntry {
  id: number;
  mlbPlayerId: number;
  season: number;
  rank: number;
  futureValue: number | null;
  eta: string | null;
  player?: {
    id: number;
    fullName: string;
    primaryPosition: string;
    currentTeamName: string;
    mlbId: number;
  };
  cblTeam?: string | null;
  cblTeamAbbreviation?: string | null;
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
type SortKey = "rank" | "name" | "pos" | "team" | "cbl" | "fv" | "eta";

const ALL_TEAMS = "__all__";

export default function ProspectRankings() {
  const { user } = useAuth();
  const { currentLeague, leagueMembers } = useLeague();
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [search, setSearch] = useState("");
  const [cblTeamFilter, setCblTeamFilter] = useState<string>("");
  const [defaultApplied, setDefaultApplied] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "rank", dir: "asc" });

  const hasPremium = user?.isSuperAdmin || user?.hasPremiumAccess;

  useEffect(() => {
    if (defaultApplied || !user || !leagueMembers || leagueMembers.length === 0) return;
    const myMember = leagueMembers.find(m => m.userId === user.id);
    if (myMember?.teamName) {
      setCblTeamFilter(myMember.teamName);
    } else {
      setCblTeamFilter(ALL_TEAMS);
    }
    setDefaultApplied(true);
  }, [user, leagueMembers, defaultApplied]);

  const { data: seasons, isLoading: loadingSeasons } = useQuery<number[]>({
    queryKey: ["/api/premium/prospect-rankings/seasons"],
    enabled: !!hasPremium,
  });

  const activeSeason = selectedSeason || (seasons && seasons.length > 0 ? String(seasons[0]) : "");
  const leagueId = currentLeague?.id;

  const { data: rankings, isLoading: loadingRankings } = useQuery<ProspectRankingEntry[]>({
    queryKey: ["/api/premium/prospect-rankings", { season: activeSeason, leagueId }],
    queryFn: async () => {
      let url = `/api/premium/prospect-rankings?season=${activeSeason}`;
      if (leagueId) url += `&leagueId=${leagueId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!hasPremium && !!activeSeason,
  });

  const cblTeamNames = useMemo(() => {
    if (!rankings || !leagueId) return [];
    const teams = new Set<string>();
    for (const r of rankings) {
      if (r.cblTeam) teams.add(r.cblTeam);
    }
    return Array.from(teams).sort();
  }, [rankings, leagueId]);

  const matchesSearch = (r: ProspectRankingEntry) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.player?.fullName?.toLowerCase().includes(q) ||
      r.player?.currentTeamName?.toLowerCase().includes(q) ||
      r.cblTeam?.toLowerCase().includes(q);
  };

  const matchesCblTeam = (r: ProspectRankingEntry) => {
    if (!cblTeamFilter || cblTeamFilter === ALL_TEAMS) return true;
    if (cblTeamFilter === "__fa__") return !r.cblTeam;
    return r.cblTeam === cblTeamFilter;
  };

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

  const filtered = useMemo(() => {
    if (!rankings) return [];
    return rankings
      .filter(matchesSearch)
      .filter(matchesCblTeam)
      .sort((a, b) => {
        const { key, dir } = sort;
        switch (key) {
          case "rank": return numCompare(a.rank, b.rank, dir);
          case "name": return strCompare(a.player?.fullName, b.player?.fullName, dir);
          case "pos": return strCompare(a.player?.primaryPosition, b.player?.primaryPosition, dir);
          case "team": return strCompare(a.player?.currentTeamName, b.player?.currentTeamName, dir);
          case "cbl": return strCompare(a.cblTeam, b.cblTeam, dir);
          case "fv": return numCompare(a.futureValue, b.futureValue, dir);
          case "eta": return strCompare(a.eta, b.eta, dir);
          default: return 0;
        }
      });
  }, [rankings, search, cblTeamFilter, sort]);

  const toggleSort = (key: SortKey) =>
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));

  const si = (k: SortKey) => (sort.key === k ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  if (!hasPremium) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Premium Access Required</h2>
            <p className="text-muted-foreground">
              Prospect rankings are available to premium members. Contact your league administrator for access.
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
          <Star className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-prospect-rankings-title">Prospect Rankings</h1>
            <p className="text-sm text-muted-foreground">
              Top prospects by rank, FV, and ETA{currentLeague ? ` — ${currentLeague.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {seasons && seasons.length > 0 && (
            <Select value={activeSeason} onValueChange={setSelectedSeason}>
              <SelectTrigger className="w-[120px]" data-testid="select-prospect-season">
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
              <SelectTrigger className="w-[200px]" data-testid="select-prospect-cbl-team">
                <SelectValue placeholder="All CBL Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TEAMS}>All CBL Teams</SelectItem>
                <SelectItem value="__fa__">Unowned</SelectItem>
                {cblTeamNames.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search prospects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[200px]"
              data-testid="input-search-prospects"
            />
          </div>
        </div>
      </div>

      {loadingSeasons || loadingRankings ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent></Card>
      ) : !activeSeason ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No prospect ranking seasons available yet.</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No prospects found{search ? ` matching "${search}"` : ""}.</CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right min-w-[50px] cursor-pointer" onClick={() => toggleSort("rank")}>Rank{si("rank")}</TableHead>
                  <TableHead className="min-w-[180px] cursor-pointer" onClick={() => toggleSort("name")}>Player{si("name")}</TableHead>
                  <TableHead className="text-center min-w-[50px] cursor-pointer" onClick={() => toggleSort("pos")}>Pos{si("pos")}</TableHead>
                  <TableHead className="text-center min-w-[60px] cursor-pointer" onClick={() => toggleSort("team")}>Team{si("team")}</TableHead>
                  {leagueId && <TableHead className="min-w-[120px] cursor-pointer" onClick={() => toggleSort("cbl")}>CBL Team{si("cbl")}</TableHead>}
                  <TableHead className="text-right min-w-[50px] cursor-pointer" onClick={() => toggleSort("fv")}>FV{si("fv")}</TableHead>
                  <TableHead className="text-center min-w-[60px] cursor-pointer" onClick={() => toggleSort("eta")}>ETA{si("eta")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} data-testid={`row-prospect-${r.id}`}>
                    <TableCell className="text-right font-mono font-semibold">{r.rank}</TableCell>
                    <TableCell className="font-medium">{r.player?.fullName ?? `Player #${r.mlbPlayerId}`}</TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs">{r.player?.primaryPosition ?? "—"}</TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs">{mlbAbbr(r.player?.currentTeamName)}</TableCell>
                    {leagueId && (
                      <TableCell className="text-xs">
                        {r.cblTeamAbbreviation ? (
                          <Badge variant="outline">{r.cblTeamAbbreviation}</Badge>
                        ) : r.cblTeam ? (
                          <Badge variant="outline">{r.cblTeam}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-mono">{r.futureValue ?? "—"}</TableCell>
                    <TableCell className="text-center">{r.eta ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-2 text-sm text-muted-foreground border-t">
            {filtered.length} prospect{filtered.length !== 1 ? "s" : ""}
          </div>
        </Card>
      )}
    </div>
  );
}
