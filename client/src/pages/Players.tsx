import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Search, Database, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import type { MlbPlayer, LeagueMember } from "@shared/schema";

interface RosterAssignment {
  id: number;
  leagueId: number;
  userId: string;
  mlbPlayerId: number;
  rosterType: string;
  season: number;
  player: MlbPlayer;
}

const PAGE_SIZE = 50;

export default function Players({ level }: { level: "mlb" | "milb" }) {
  const { user } = useAuth();
  const { selectedLeagueId, currentLeague } = useLeague();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [mlbTeamFilter, setMlbTeamFilter] = useState("all");
  const [leagueTeamFilter, setLeagueTeamFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const season = 2025;

  const sportLevel = level === "mlb" ? "MLB" : "minors";

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(0);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  }, []);

  const { data: teamsData } = useQuery<string[]>({
    queryKey: ["/api/mlb-players/teams", season, sportLevel],
    queryFn: async () => {
      const params = new URLSearchParams({ season: String(season), sportLevel });
      const res = await fetch(`/api/mlb-players/teams?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch teams");
      return res.json();
    },
  });

  const { data: playersData, isLoading } = useQuery<{ players: MlbPlayer[]; total: number }>({
    queryKey: ["/api/mlb-players", debouncedSearch, sportLevel, mlbTeamFilter, page, sortBy, sortDir, season],
    queryFn: async () => {
      const params = new URLSearchParams({
        season: String(season),
        sportLevel,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
        sortBy,
        sortDir,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (mlbTeamFilter && mlbTeamFilter !== "all") params.set("currentTeamName", mlbTeamFilter);
      const res = await fetch(`/api/mlb-players?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch players");
      return res.json();
    },
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
    queryKey: ["/api/leagues", selectedLeagueId, "roster-assignments", season, "all-for-players", level],
    queryFn: async () => {
      const params = new URLSearchParams({ season: String(season), rosterType: level });
      const res = await fetch(`/api/leagues/${selectedLeagueId}/roster-assignments?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch roster assignments");
      return res.json();
    },
    enabled: !!selectedLeagueId,
  });

  const rosterMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (!rosterData?.assignments) return map;
    for (const a of rosterData.assignments) {
      map[a.mlbPlayerId] = a.userId;
    }
    return map;
  }, [rosterData?.assignments]);

  const memberMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!membersData) return map;
    for (const m of membersData) {
      map[m.userId] = m.teamName || m.teamAbbreviation || m.userId;
    }
    return map;
  }, [membersData]);

  const activeMembers = useMemo(() => {
    if (!membersData) return [];
    return membersData.filter(m => !(m as any).isArchived);
  }, [membersData]);

  const filteredPlayers = useMemo(() => {
    if (!playersData?.players) return [];
    if (leagueTeamFilter === "all") return playersData.players;
    if (leagueTeamFilter === "unassigned") {
      return playersData.players.filter(p => !rosterMap[p.id]);
    }
    return playersData.players.filter(p => rosterMap[p.id] === leagueTeamFilter);
  }, [playersData?.players, leagueTeamFilter, rosterMap]);

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(0);
  };

  const sortIndicator = (col: string) => {
    if (sortBy !== col) return null;
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  };

  const serverTotal = playersData?.total || 0;
  const isLeagueFiltered = leagueTeamFilter !== "all";
  const displayTotal = isLeagueFiltered ? filteredPlayers.length : serverTotal;
  const totalPages = isLeagueFiltered ? 1 : Math.ceil(serverTotal / PAGE_SIZE);
  const title = level === "mlb" ? "Major League Players" : "Minor League Players";
  const mlbTeams = teamsData || [];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-players-title">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {displayTotal.toLocaleString()} player{displayTotal !== 1 ? "s" : ""}{isLeagueFiltered ? " (filtered)" : " total"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-0 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8"
                data-testid="input-players-search"
              />
            </div>
            <div className="w-48">
              <Select value={mlbTeamFilter} onValueChange={(v) => { setMlbTeamFilter(v); setPage(0); }}>
                <SelectTrigger data-testid="select-mlb-team-filter">
                  <SelectValue placeholder="MLB Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All MLB Teams</SelectItem>
                  {mlbTeams.map(team => (
                    <SelectItem key={team} value={team}>{team}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedLeagueId && (
              <div className="w-48">
                <Select value={leagueTeamFilter} onValueChange={(v) => { setLeagueTeamFilter(v); }}>
                  <SelectTrigger data-testid="select-league-team-filter">
                    <SelectValue placeholder="League Team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All League Teams</SelectItem>
                    <SelectItem value="unassigned">Unassigned (Free Agents)</SelectItem>
                    {activeMembers.map(m => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.teamName || m.teamAbbreviation || m.userId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No players found
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => toggleSort("name")}
                        data-testid="sort-name"
                      >
                        Name{sortIndicator("name")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => toggleSort("position")}
                        data-testid="sort-position"
                      >
                        Pos{sortIndicator("position")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => toggleSort("team")}
                        data-testid="sort-team"
                      >
                        MLB Team{sortIndicator("team")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => toggleSort("age")}
                        data-testid="sort-age"
                      >
                        Age{sortIndicator("age")}
                      </TableHead>
                      <TableHead>Bats</TableHead>
                      <TableHead>Throws</TableHead>
                      <TableHead>Type</TableHead>
                      {level === "milb" && <TableHead>Level</TableHead>}
                      {selectedLeagueId && <TableHead>League Team</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlayers.map((p) => {
                      const leagueTeam = rosterMap[p.id] ? memberMap[rosterMap[p.id]] : null;
                      return (
                        <TableRow key={p.id} data-testid={`row-player-${p.id}`}>
                          <TableCell className="font-medium">{p.fullName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{p.primaryPosition || "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{p.currentTeamName || "—"}</TableCell>
                          <TableCell>{p.age || "—"}</TableCell>
                          <TableCell>{p.batSide || "—"}</TableCell>
                          <TableCell>{p.throwHand || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {p.hadHittingStats && p.hadPitchingStats
                                ? "Two-Way"
                                : p.hadPitchingStats
                                ? "Pitcher"
                                : "Hitter"}
                            </Badge>
                          </TableCell>
                          {level === "milb" && (
                            <TableCell>
                              <span className="text-xs text-muted-foreground">{p.sportLevel}</span>
                            </TableCell>
                          )}
                          {selectedLeagueId && (
                            <TableCell>
                              {leagueTeam ? (
                                <Badge variant="outline">{leagueTeam}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Free Agent</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, serverTotal)} of {serverTotal.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage(p => p - 1)}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(p => p + 1)}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
