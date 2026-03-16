import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeftRight, Send } from "lucide-react";
import { useState, useMemo } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
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

interface LeagueMember {
  userId: string;
  leagueId: number;
  teamName: string | null;
  teamAbbreviation: string | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    teamName: string | null;
  };
}

export default function SubmitTrade() {
  const { user } = useAuth();
  const { currentLeague, selectedLeagueId } = useLeague();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [partnerUserId, setPartnerUserId] = useState<string>("");
  const [mySelectedPlayers, setMySelectedPlayers] = useState<Set<number>>(new Set());
  const [partnerSelectedPlayers, setPartnerSelectedPlayers] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");

  const leagueId = selectedLeagueId;

  const membersQuery = useQuery<LeagueMember[]>({
    queryKey: ["/api/leagues", leagueId, "members"],
    queryFn: () => fetch(`/api/leagues/${leagueId}/members`).then(r => r.json()),
    enabled: !!leagueId,
  });

  const myRosterQuery = useQuery<{ assignments: RosterAssignment[] }>({
    queryKey: ["/api/leagues", leagueId, "roster-assignments", { userId: user?.id }],
    queryFn: () => fetch(`/api/leagues/${leagueId}/roster-assignments?userId=${user?.id}`).then(r => r.json()),
    enabled: !!leagueId && !!user?.id,
  });

  const partnerRosterQuery = useQuery<{ assignments: RosterAssignment[] }>({
    queryKey: ["/api/leagues", leagueId, "roster-assignments", { userId: partnerUserId }],
    queryFn: () => fetch(`/api/leagues/${leagueId}/roster-assignments?userId=${partnerUserId}`).then(r => r.json()),
    enabled: !!leagueId && !!partnerUserId,
  });

  const submitTradeMutation = useMutation({
    mutationFn: async (data: { partnerUserId: string; items: any[]; notes: string }) => {
      const res = await apiRequest("POST", `/api/leagues/${leagueId}/trades`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Trade proposal sent", description: "Your trade partner has been notified by email." });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "trades"] });
      navigate("/trades");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to submit trade", variant: "destructive" });
    },
  });

  const otherMembers = useMemo(() => {
    if (!membersQuery.data || !user) return [];
    return membersQuery.data.filter(m => m.userId !== user.id);
  }, [membersQuery.data, user]);

  const myRoster = useMemo(() => {
    const assignments = myRosterQuery.data?.assignments;
    if (!assignments) return [];
    return assignments.filter(a => a.rosterType === "mlb" || a.rosterType === "milb");
  }, [myRosterQuery.data]);

  const partnerRoster = useMemo(() => {
    const assignments = partnerRosterQuery.data?.assignments;
    if (!assignments) return [];
    return assignments.filter(a => a.rosterType === "mlb" || a.rosterType === "milb");
  }, [partnerRosterQuery.data]);

  const toggleMyPlayer = (mlbPlayerId: number) => {
    setMySelectedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(mlbPlayerId)) next.delete(mlbPlayerId);
      else next.add(mlbPlayerId);
      return next;
    });
  };

  const togglePartnerPlayer = (mlbPlayerId: number) => {
    setPartnerSelectedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(mlbPlayerId)) next.delete(mlbPlayerId);
      else next.add(mlbPlayerId);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!partnerUserId) {
      toast({ title: "Error", description: "Select a trade partner", variant: "destructive" });
      return;
    }
    if (mySelectedPlayers.size === 0 && partnerSelectedPlayers.size === 0) {
      toast({ title: "Error", description: "Select at least one player to trade", variant: "destructive" });
      return;
    }

    const items: any[] = [];
    for (const mlbPlayerId of mySelectedPlayers) {
      const assignment = myRoster.find(a => a.mlbPlayerId === mlbPlayerId);
      if (assignment) {
        items.push({ fromUserId: user!.id, mlbPlayerId, rosterType: assignment.rosterType });
      }
    }
    for (const mlbPlayerId of partnerSelectedPlayers) {
      const assignment = partnerRoster.find(a => a.mlbPlayerId === mlbPlayerId);
      if (assignment) {
        items.push({ fromUserId: partnerUserId, mlbPlayerId, rosterType: assignment.rosterType });
      }
    }

    submitTradeMutation.mutate({ partnerUserId, items, notes });
  };

  if (!currentLeague) {
    return (
      <div className="container mx-auto p-4">
        <Card><CardContent className="py-8 text-center text-muted-foreground">No active league selected.</CardContent></Card>
      </div>
    );
  }

  const selectedPartner = otherMembers.find(m => m.userId === partnerUserId);
  const partnerDisplayName = selectedPartner
    ? selectedPartner.teamName || `${selectedPartner.user.firstName} ${selectedPartner.user.lastName}`
    : null;

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <ArrowLeftRight className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="page-title">Submit Trade</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trade Partner</CardTitle>
        </CardHeader>
        <CardContent>
          {membersQuery.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={partnerUserId} onValueChange={(val) => { setPartnerUserId(val); setPartnerSelectedPlayers(new Set()); }}>
              <SelectTrigger data-testid="select-trade-partner">
                <SelectValue placeholder="Select a team to trade with" />
              </SelectTrigger>
              <SelectContent>
                {otherMembers.map(m => (
                  <SelectItem key={m.userId} value={m.userId} data-testid={`partner-option-${m.userId}`}>
                    {m.teamName || `${m.user.firstName} ${m.user.lastName}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Players</CardTitle>
          </CardHeader>
          <CardContent>
            {myRosterQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : myRoster.length === 0 ? (
              <p className="text-muted-foreground text-sm">No players on your roster.</p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Pos</TableHead>
                      <TableHead>Roster</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myRoster.map(a => (
                      <TableRow
                        key={a.mlbPlayerId}
                        className={mySelectedPlayers.has(a.mlbPlayerId) ? "bg-primary/10" : "cursor-pointer hover:bg-muted/50"}
                        onClick={() => toggleMyPlayer(a.mlbPlayerId)}
                        data-testid={`my-player-row-${a.mlbPlayerId}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={mySelectedPlayers.has(a.mlbPlayerId)}
                            onCheckedChange={() => toggleMyPlayer(a.mlbPlayerId)}
                            data-testid={`my-player-check-${a.mlbPlayerId}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{a.player.name}</TableCell>
                        <TableCell className="text-muted-foreground">{a.player.position || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={a.rosterType === "mlb" ? "default" : "secondary"} className="text-xs">
                            {a.rosterType.toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {mySelectedPlayers.size > 0 && (
              <p className="text-sm text-muted-foreground mt-2">{mySelectedPlayers.size} player{mySelectedPlayers.size !== 1 ? "s" : ""} selected</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{partnerDisplayName ? `${partnerDisplayName}'s Players` : "Partner's Players"}</CardTitle>
          </CardHeader>
          <CardContent>
            {!partnerUserId ? (
              <p className="text-muted-foreground text-sm">Select a trade partner first.</p>
            ) : partnerRosterQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : partnerRoster.length === 0 ? (
              <p className="text-muted-foreground text-sm">No players on partner's roster.</p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Pos</TableHead>
                      <TableHead>Roster</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnerRoster.map(a => (
                      <TableRow
                        key={a.mlbPlayerId}
                        className={partnerSelectedPlayers.has(a.mlbPlayerId) ? "bg-primary/10" : "cursor-pointer hover:bg-muted/50"}
                        onClick={() => togglePartnerPlayer(a.mlbPlayerId)}
                        data-testid={`partner-player-row-${a.mlbPlayerId}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={partnerSelectedPlayers.has(a.mlbPlayerId)}
                            onCheckedChange={() => togglePartnerPlayer(a.mlbPlayerId)}
                            data-testid={`partner-player-check-${a.mlbPlayerId}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{a.player.name}</TableCell>
                        <TableCell className="text-muted-foreground">{a.player.position || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={a.rosterType === "mlb" ? "default" : "secondary"} className="text-xs">
                            {a.rosterType.toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {partnerSelectedPlayers.size > 0 && (
              <p className="text-sm text-muted-foreground mt-2">{partnerSelectedPlayers.size} player{partnerSelectedPlayers.size !== 1 ? "s" : ""} selected</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add any notes about this trade (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            data-testid="trade-notes"
          />
        </CardContent>
      </Card>

      {(mySelectedPlayers.size > 0 || partnerSelectedPlayers.size > 0) && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Trade Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mySelectedPlayers.size > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">You send:</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(mySelectedPlayers).map(id => {
                    const a = myRoster.find(r => r.mlbPlayerId === id);
                    return a ? (
                      <Badge key={id} variant="outline" className="text-sm">
                        {a.player.name}
                        <span className="ml-1 text-xs text-muted-foreground">({a.rosterType.toUpperCase()})</span>
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}
            {partnerSelectedPlayers.size > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">You receive:</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(partnerSelectedPlayers).map(id => {
                    const a = partnerRoster.find(r => r.mlbPlayerId === id);
                    return a ? (
                      <Badge key={id} variant="outline" className="text-sm">
                        {a.player.name}
                        <span className="ml-1 text-xs text-muted-foreground">({a.rosterType.toUpperCase()})</span>
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={submitTradeMutation.isPending || (!mySelectedPlayers.size && !partnerSelectedPlayers.size) || !partnerUserId}
          data-testid="button-submit-trade"
        >
          <Send className="h-4 w-4 mr-2" />
          {submitTradeMutation.isPending ? "Submitting..." : "Submit Trade Proposal"}
        </Button>
      </div>
    </div>
  );
}
