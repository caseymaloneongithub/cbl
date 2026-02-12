import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MlbPlayer, LeagueMember, League } from "@shared/schema";
import { Search, UserPlus, Trash2, ArrowRightLeft, Loader2, Users, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

interface RosterAssignment {
  id: number;
  leagueId: number;
  userId: string;
  mlbPlayerId: number;
  rosterType: string;
  season: number;
  createdAt: string;
  player: MlbPlayer;
}

interface RosterCount {
  userId: string;
  rosterType: string;
  count: number;
}

interface RosterManagementProps {
  leagueId: number;
  league: League;
  members: LeagueMember[];
  isCommissioner: boolean;
}

export default function RosterManagement({ leagueId, league, members, isCommissioner }: RosterManagementProps) {
  const { toast } = useToast();
  const [season] = useState(2025);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");
  const [selectedRosterType, setSelectedRosterType] = useState<string>("all");
  const [rosterSearch, setRosterSearch] = useState("");
  const [faSearch, setFaSearch] = useState("");
  const [faLevel, setFaLevel] = useState<string>("all");
  const [faPage, setFaPage] = useState(0);
  const FA_PAGE_SIZE = 50;

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignPlayer, setAssignPlayer] = useState<MlbPlayer | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRosterType, setAssignRosterType] = useState("mlb");

  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveAssignment, setMoveAssignment] = useState<RosterAssignment | null>(null);
  const [moveRosterType, setMoveRosterType] = useState("");
  const [moveUserId, setMoveUserId] = useState("");

  const activeMembers = members.filter(m => !m.isArchived);

  const { data: rosterData, isLoading: loadingRoster } = useQuery<{
    assignments: RosterAssignment[];
    counts: RosterCount[];
  }>({
    queryKey: ["/api/leagues", leagueId, "roster-assignments", season, selectedTeamId, selectedRosterType],
    queryFn: async () => {
      const params = new URLSearchParams({ season: String(season) });
      if (selectedTeamId !== "all") params.set("userId", selectedTeamId);
      if (selectedRosterType !== "all") params.set("rosterType", selectedRosterType);
      const res = await fetch(`/api/leagues/${leagueId}/roster-assignments?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: faData, isLoading: loadingFA } = useQuery<{
    players: MlbPlayer[];
    total: number;
  }>({
    queryKey: ["/api/leagues", leagueId, "unassigned-players", season, faSearch, faLevel, faPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        season: String(season),
        limit: String(FA_PAGE_SIZE),
        offset: String(faPage * FA_PAGE_SIZE),
      });
      if (faSearch) params.set("search", faSearch);
      if (faLevel !== "all") params.set("sportLevel", faLevel);
      const res = await fetch(`/api/leagues/${leagueId}/unassigned-players?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (data: { mlbPlayerId: number; assignToUserId: string; rosterType: string; season: number }) => {
      return apiRequest("POST", `/api/leagues/${leagueId}/roster-assignments`, data);
    },
    onSuccess: () => {
      toast({ title: "Player assigned to roster" });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "roster-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "unassigned-players"] });
      setAssignDialogOpen(false);
      setAssignPlayer(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to assign", description: error.message, variant: "destructive" });
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (data: { id: number; rosterType?: string; userId?: string }) => {
      const { id, ...body } = data;
      return apiRequest("PATCH", `/api/leagues/${leagueId}/roster-assignments/${id}`, body);
    },
    onSuccess: () => {
      toast({ title: "Player moved" });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "roster-assignments"] });
      setMoveDialogOpen(false);
      setMoveAssignment(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to move", description: error.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      return apiRequest("DELETE", `/api/leagues/${leagueId}/roster-assignments/${assignmentId}`);
    },
    onSuccess: () => {
      toast({ title: "Player removed from roster" });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "roster-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "unassigned-players"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/leagues/${leagueId}/roster-assignments?season=${season}`);
    },
    onSuccess: () => {
      toast({ title: "All roster assignments cleared" });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "roster-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "unassigned-players"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to clear", description: error.message, variant: "destructive" });
    },
  });

  const filteredAssignments = useMemo(() => {
    if (!rosterData?.assignments) return [];
    if (!rosterSearch) return rosterData.assignments;
    const q = rosterSearch.toLowerCase();
    return rosterData.assignments.filter(a => a.player.fullName.toLowerCase().includes(q));
  }, [rosterData?.assignments, rosterSearch]);

  const teamCountMap = useMemo(() => {
    const map: Record<string, { mlb: number; milb: number; draft: number }> = {};
    if (!rosterData?.counts) return map;
    for (const c of rosterData.counts) {
      if (!map[c.userId]) map[c.userId] = { mlb: 0, milb: 0, draft: 0 };
      if (c.rosterType === 'mlb') map[c.userId].mlb = c.count;
      else if (c.rosterType === 'milb') map[c.userId].milb = c.count;
      else if (c.rosterType === 'draft') map[c.userId].draft = c.count;
    }
    return map;
  }, [rosterData?.counts]);

  const totalAssigned = useMemo(() => {
    return Object.values(teamCountMap).reduce((sum, c) => sum + c.mlb + c.milb + c.draft, 0);
  }, [teamCountMap]);

  const getMemberName = (userId: string) => {
    const m = members.find(m => m.userId === userId);
    return m?.teamName || m?.teamAbbreviation || userId;
  };

  const getRosterTypeBadge = (type: string) => {
    switch (type) {
      case 'mlb': return <Badge variant="default" data-testid={`badge-roster-mlb`}>ML</Badge>;
      case 'milb': return <Badge variant="secondary" data-testid={`badge-roster-milb`}>MiLB</Badge>;
      case 'draft': return <Badge variant="outline" data-testid={`badge-roster-draft`}>Draft</Badge>;
      default: return <Badge>{type}</Badge>;
    }
  };

  const openAssignDialog = (player: MlbPlayer) => {
    setAssignPlayer(player);
    setAssignUserId(activeMembers[0]?.userId || "");
    setAssignRosterType("mlb");
    setAssignDialogOpen(true);
  };

  const openMoveDialog = (assignment: RosterAssignment) => {
    setMoveAssignment(assignment);
    setMoveRosterType(assignment.rosterType);
    setMoveUserId(assignment.userId);
    setMoveDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-assigned">{totalAssigned}</div>
            <p className="text-xs text-muted-foreground">across {Object.keys(teamCountMap).length} teams</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-unassigned">{faData?.total ?? "..."}</div>
            <p className="text-xs text-muted-foreground">free agents + draft eligible</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Roster Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm" data-testid="text-roster-limits">
              <span className="font-medium">ML:</span> {league.mlRosterLimit || 40} per team
              <span className="mx-2">|</span>
              <span className="font-medium">MiLB:</span> {league.milbRosterLimit || 125} per team
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Team Roster Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRoster ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-center">ML ({league.mlRosterLimit || 40})</TableHead>
                  <TableHead className="text-center">MiLB ({league.milbRosterLimit || 125})</TableHead>
                  <TableHead className="text-center">Draft</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeMembers.map(m => {
                  const counts = teamCountMap[m.userId] || { mlb: 0, milb: 0, draft: 0 };
                  const mlbLimit = league.mlRosterLimit || 40;
                  const milbLimit = league.milbRosterLimit || 125;
                  return (
                    <TableRow key={m.userId} data-testid={`row-team-summary-${m.userId}`}>
                      <TableCell className="font-medium">{m.teamName || m.teamAbbreviation || m.userId}</TableCell>
                      <TableCell className="text-center">
                        <span className={counts.mlb > mlbLimit ? "text-destructive font-bold" : ""}>
                          {counts.mlb}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={counts.milb > milbLimit ? "text-destructive font-bold" : ""}>
                          {counts.milb}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{counts.draft}</TableCell>
                      <TableCell className="text-center font-medium">{counts.mlb + counts.milb + counts.draft}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 flex-wrap">
          <CardTitle>Roster Assignments</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={rosterSearch}
                onChange={e => setRosterSearch(e.target.value)}
                className="pl-8 w-48"
                data-testid="input-roster-search"
              />
            </div>
            <Select value={selectedTeamId} onValueChange={v => setSelectedTeamId(v)}>
              <SelectTrigger className="w-40" data-testid="select-roster-team">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {activeMembers.map(m => (
                  <SelectItem key={m.userId} value={m.userId}>{m.teamName || m.teamAbbreviation || m.userId}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedRosterType} onValueChange={v => setSelectedRosterType(v)}>
              <SelectTrigger className="w-32" data-testid="select-roster-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="mlb">ML Roster</SelectItem>
                <SelectItem value="milb">MiLB System</SelectItem>
                <SelectItem value="draft">Draft List</SelectItem>
              </SelectContent>
            </Select>
            {isCommissioner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" data-testid="button-clear-all-assignments">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Roster Assignments?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all {totalAssigned} roster assignments for the {season} season. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearAllMutation.mutate()} data-testid="button-confirm-clear-all">
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingRoster ? (
            <Skeleton className="h-48 w-full" />
          ) : filteredAssignments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-assignments">
              No roster assignments found. Assign players from the Free Agent Pool below.
            </p>
          ) : (
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Roster</TableHead>
                    <TableHead>MLB Team</TableHead>
                    {isCommissioner && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map(a => (
                    <TableRow key={a.id} data-testid={`row-assignment-${a.id}`}>
                      <TableCell className="font-medium">{a.player.fullName}</TableCell>
                      <TableCell>{a.player.primaryPosition || "-"}</TableCell>
                      <TableCell>{a.player.sportLevel}</TableCell>
                      <TableCell>{getMemberName(a.userId)}</TableCell>
                      <TableCell>{getRosterTypeBadge(a.rosterType)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.player.currentTeamName || "-"}</TableCell>
                      {isCommissioner && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openMoveDialog(a)}
                              data-testid={`button-move-${a.id}`}
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeMutation.mutate(a.id)}
                              disabled={removeMutation.isPending}
                              data-testid={`button-remove-${a.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 flex-wrap">
          <CardTitle>Free Agent Pool</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search free agents..."
                value={faSearch}
                onChange={e => { setFaSearch(e.target.value); setFaPage(0); }}
                className="pl-8 w-48"
                data-testid="input-fa-search"
              />
            </div>
            <Select value={faLevel} onValueChange={v => { setFaLevel(v); setFaPage(0); }}>
              <SelectTrigger className="w-40" data-testid="select-fa-level">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="MLB">MLB Free Agents</SelectItem>
                <SelectItem value="MiLB">MiLB Free Agents</SelectItem>
                <SelectItem value="AAA">AAA</SelectItem>
                <SelectItem value="AA">AA</SelectItem>
                <SelectItem value="High-A">High-A</SelectItem>
                <SelectItem value="Single-A">Single-A</SelectItem>
                <SelectItem value="Rookie">Rookie</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loadingFA ? (
            <Skeleton className="h-48 w-full" />
          ) : !faData?.players?.length ? (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-fa">
              No unassigned players found. All players have been assigned to rosters.
            </p>
          ) : (
            <>
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>MLB Team</TableHead>
                      <TableHead>B/T</TableHead>
                      {isCommissioner && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faData.players.map(p => (
                      <TableRow key={p.id} data-testid={`row-fa-${p.id}`}>
                        <TableCell className="font-medium">{p.fullName}</TableCell>
                        <TableCell>{p.primaryPosition || "-"}</TableCell>
                        <TableCell>
                          {p.hadHittingStats && p.hadPitchingStats ? (
                            <Badge variant="outline">Two-Way</Badge>
                          ) : p.hadPitchingStats ? (
                            <Badge variant="secondary">Pitcher</Badge>
                          ) : (
                            <Badge variant="default">Hitter</Badge>
                          )}
                        </TableCell>
                        <TableCell>{p.sportLevel}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.currentTeamName || "-"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.batSide || "-"}/{p.throwHand || "-"}</TableCell>
                        {isCommissioner && (
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAssignDialog(p)}
                              data-testid={`button-assign-${p.id}`}
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              Assign
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground" data-testid="text-fa-count">
                  Showing {faPage * FA_PAGE_SIZE + 1}-{Math.min((faPage + 1) * FA_PAGE_SIZE, faData.total)} of {faData.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={faPage === 0}
                    onClick={() => setFaPage(p => p - 1)}
                    data-testid="button-fa-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={(faPage + 1) * FA_PAGE_SIZE >= faData.total}
                    onClick={() => setFaPage(p => p + 1)}
                    data-testid="button-fa-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Player to Roster</DialogTitle>
          </DialogHeader>
          {assignPlayer && (
            <div className="space-y-4">
              <div>
                <p className="font-medium">{assignPlayer.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {assignPlayer.primaryPosition} | {assignPlayer.sportLevel} | {assignPlayer.currentTeamName || "No team"}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign to Team</label>
                <Select value={assignUserId} onValueChange={setAssignUserId}>
                  <SelectTrigger data-testid="select-assign-team">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMembers.map(m => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.teamName || m.teamAbbreviation || m.userId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Roster Type</label>
                <Select value={assignRosterType} onValueChange={setAssignRosterType}>
                  <SelectTrigger data-testid="select-assign-roster-type">
                    <SelectValue placeholder="Select roster" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mlb">Major League Roster</SelectItem>
                    <SelectItem value="milb">Minor League System</SelectItem>
                    <SelectItem value="draft">Draft List</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {assignUserId && (() => {
                const counts = teamCountMap[assignUserId] || { mlb: 0, milb: 0, draft: 0 };
                const mlbLimit = league.mlRosterLimit || 40;
                const milbLimit = league.milbRosterLimit || 125;
                const wouldExceed =
                  (assignRosterType === 'mlb' && counts.mlb >= mlbLimit) ||
                  (assignRosterType === 'milb' && counts.milb >= milbLimit);
                if (!wouldExceed) return null;
                const limitLabel = assignRosterType === 'mlb' ? `ML limit of ${mlbLimit}` : `MiLB limit of ${milbLimit}`;
                const currentCount = assignRosterType === 'mlb' ? counts.mlb : counts.milb;
                return (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3" data-testid="warning-roster-limit">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">
                      This team already has {currentCount} players on this roster, which meets or exceeds the {limitLabel}. You can still assign, but the team will be over the limit.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (assignPlayer && assignUserId) {
                  assignMutation.mutate({
                    mlbPlayerId: assignPlayer.id,
                    assignToUserId: assignUserId,
                    rosterType: assignRosterType,
                    season,
                  });
                }
              }}
              disabled={assignMutation.isPending || !assignUserId}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Assign Player
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Player</DialogTitle>
          </DialogHeader>
          {moveAssignment && (
            <div className="space-y-4">
              <div>
                <p className="font-medium">{moveAssignment.player.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  Currently: {getMemberName(moveAssignment.userId)} - {moveAssignment.rosterType.toUpperCase()}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Move to Team</label>
                <Select value={moveUserId} onValueChange={setMoveUserId}>
                  <SelectTrigger data-testid="select-move-team">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMembers.map(m => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.teamName || m.teamAbbreviation || m.userId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Roster Type</label>
                <Select value={moveRosterType} onValueChange={setMoveRosterType}>
                  <SelectTrigger data-testid="select-move-roster-type">
                    <SelectValue placeholder="Select roster" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mlb">Major League Roster</SelectItem>
                    <SelectItem value="milb">Minor League System</SelectItem>
                    <SelectItem value="draft">Draft List</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (moveAssignment) {
                  const updates: any = {};
                  if (moveRosterType !== moveAssignment.rosterType) updates.rosterType = moveRosterType;
                  if (moveUserId !== moveAssignment.userId) updates.userId = moveUserId;
                  moveMutation.mutate({ id: moveAssignment.id, ...updates });
                }
              }}
              disabled={moveMutation.isPending}
              data-testid="button-confirm-move"
            >
              {moveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Move Player
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
