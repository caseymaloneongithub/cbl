import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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

interface RosterAssignment {
  id: number;
  leagueId: number;
  userId: string;
  mlbPlayerId: number;
  rosterType: string;
  season: number;
  player: MlbPlayer;
}

export default function MyRoster({ level }: { level: "mlb" | "milb" }) {
  const { user } = useAuth();
  const { selectedLeagueId, currentLeague } = useLeague();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const season = 2025;

  const { data, isLoading } = useQuery<{ assignments: RosterAssignment[]; counts: any[] }>({
    queryKey: ["/api/leagues", selectedLeagueId, "roster-assignments", season, user?.id, level],
    queryFn: async () => {
      const params = new URLSearchParams({
        season: String(season),
        userId: user!.id,
        rosterType: level,
      });
      const res = await fetch(`/api/leagues/${selectedLeagueId}/roster-assignments?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch roster");
      return res.json();
    },
    enabled: !!selectedLeagueId && !!user?.id,
  });

  const assignments = data?.assignments || [];

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const sortIndicator = (col: string) => {
    if (sortBy !== col) return null;
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  };

  const filtered = useMemo(() => {
    let result = [...assignments];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(a =>
        a.player.fullName.toLowerCase().includes(s) ||
        a.player.primaryPosition?.toLowerCase().includes(s) ||
        a.player.currentTeamName?.toLowerCase().includes(s)
      );
    }
    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortBy) {
        case "name":
          return dir * a.player.fullName.localeCompare(b.player.fullName);
        case "position":
          return dir * (a.player.primaryPosition || "").localeCompare(b.player.primaryPosition || "");
        case "team":
          return dir * (a.player.currentTeamName || "").localeCompare(b.player.currentTeamName || "");
        case "age":
          return dir * ((a.player.age || 0) - (b.player.age || 0));
        case "bats":
          return dir * (a.player.batSide || "").localeCompare(b.player.batSide || "");
        case "throws":
          return dir * (a.player.throwHand || "").localeCompare(b.player.throwHand || "");
        default:
          return 0;
      }
    });
    return result;
  }, [assignments, search, sortBy, sortDir]);

  const title = level === "mlb" ? "Major League Roster" : "Minor League Roster";
  const limit = level === "mlb"
    ? (currentLeague as any)?.mlRosterLimit || 40
    : (currentLeague as any)?.milbRosterLimit || 125;

  if (!selectedLeagueId) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <p className="text-muted-foreground">No league selected</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-roster-title">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {currentLeague?.teamName || "Your team"} - {filtered.length} player{filtered.length !== 1 ? "s" : ""}
            {" "}/ {limit} limit
          </p>
        </div>
        <Badge
          variant={filtered.length > limit ? "destructive" : "secondary"}
          data-testid="badge-roster-count"
        >
          {filtered.length} / {limit}
        </Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <ClipboardList className="h-4 w-4 inline mr-1" />
            {title}
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-testid="input-roster-search"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "No players match your search" : "No players on this roster yet"}
            </div>
          ) : (
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
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("bats")}
                      data-testid="sort-bats"
                    >
                      Bats{sortIndicator("bats")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("throws")}
                      data-testid="sort-throws"
                    >
                      Throws{sortIndicator("throws")}
                    </TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id} data-testid={`row-roster-player-${a.id}`}>
                      <TableCell className="font-medium">{a.player.fullName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{a.player.primaryPosition || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.player.currentTeamName || "—"}</TableCell>
                      <TableCell>{a.player.age || "—"}</TableCell>
                      <TableCell>{a.player.batSide || "—"}</TableCell>
                      <TableCell>{a.player.throwHand || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {a.player.hadHittingStats && a.player.hadPitchingStats
                            ? "Two-Way"
                            : a.player.hadPitchingStats
                            ? "Pitcher"
                            : "Hitter"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
