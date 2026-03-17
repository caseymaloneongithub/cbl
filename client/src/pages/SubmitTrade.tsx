import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeftRight, Send, Search, Plus, X, Trash2 } from "lucide-react";
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

interface TradeItem {
  mlbPlayerId: number;
  rosterType: string;
  player: MlbPlayer;
}

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function PlayerSearchSelector({
  label,
  roster,
  selectedItems,
  onAdd,
  onRemove,
  testIdPrefix,
}: {
  label: string;
  roster: RosterAssignment[];
  selectedItems: TradeItem[];
  onAdd: (item: TradeItem) => void;
  onRemove: (mlbPlayerId: number) => void;
  testIdPrefix: string;
}) {
  const [mlbSearch, setMlbSearch] = useState("");
  const [milbSearch, setMilbSearch] = useState("");

  const selectedIds = new Set(selectedItems.map(i => i.mlbPlayerId));

  const mlbPlayers = useMemo(() => roster.filter(a => a.rosterType === "mlb"), [roster]);
  const milbPlayers = useMemo(() => roster.filter(a => a.rosterType === "milb"), [roster]);

  const mlbCandidates = useMemo(() => {
    const needle = stripAccents(mlbSearch.trim().toLowerCase());
    if (!needle || needle.length < 2) return [];
    return mlbPlayers
      .filter(a => !selectedIds.has(a.mlbPlayerId))
      .filter(a => stripAccents(a.player.fullName?.toLowerCase() || "").includes(needle))
      .slice(0, 10);
  }, [mlbPlayers, mlbSearch, selectedIds]);

  const milbCandidates = useMemo(() => {
    const needle = stripAccents(milbSearch.trim().toLowerCase());
    if (!needle || needle.length < 2) return [];
    return milbPlayers
      .filter(a => !selectedIds.has(a.mlbPlayerId))
      .filter(a => stripAccents(a.player.fullName?.toLowerCase() || "").includes(needle))
      .slice(0, 10);
  }, [milbPlayers, milbSearch, selectedIds]);

  const mlbSelected = selectedItems.filter(i => i.rosterType === "mlb");
  const milbSelected = selectedItems.filter(i => i.rosterType === "milb");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{label}</CardTitle>
        <div className="text-xs text-muted-foreground">
          {mlbPlayers.length} MLB, {milbPlayers.length} MiLB on roster
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs shrink-0">MLB</Badge>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={mlbSearch}
                onChange={e => setMlbSearch(e.target.value)}
                placeholder="Search MLB roster..."
                className="pl-8 h-9 text-sm"
                data-testid={`${testIdPrefix}-mlb-search`}
              />
            </div>
          </div>
          {mlbSearch.trim().length >= 2 && (
            <div className="border rounded-md p-1.5 space-y-1 max-h-48 overflow-y-auto">
              {mlbCandidates.length === 0 ? (
                <div className="px-2 py-1 text-xs text-muted-foreground">No matching MLB players.</div>
              ) : (
                mlbCandidates.map(a => (
                  <div
                    key={a.mlbPlayerId}
                    className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                    data-testid={`${testIdPrefix}-mlb-candidate-${a.mlbPlayerId}`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.player.fullName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.player.primaryPosition} — {a.player.currentTeamName || "-"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onAdd({ mlbPlayerId: a.mlbPlayerId, rosterType: "mlb", player: a.player });
                        setMlbSearch("");
                      }}
                      data-testid={`${testIdPrefix}-mlb-add-${a.mlbPlayerId}`}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
          {mlbSelected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {mlbSelected.map(item => (
                <Badge key={item.mlbPlayerId} variant="outline" className="text-sm gap-1 pr-1">
                  {item.player.fullName}
                  <span className="text-xs text-muted-foreground">({item.player.primaryPosition})</span>
                  <button
                    onClick={() => onRemove(item.mlbPlayerId)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                    data-testid={`${testIdPrefix}-mlb-remove-${item.mlbPlayerId}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs shrink-0">MiLB</Badge>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={milbSearch}
                onChange={e => setMilbSearch(e.target.value)}
                placeholder="Search MiLB roster..."
                className="pl-8 h-9 text-sm"
                data-testid={`${testIdPrefix}-milb-search`}
              />
            </div>
          </div>
          {milbSearch.trim().length >= 2 && (
            <div className="border rounded-md p-1.5 space-y-1 max-h-48 overflow-y-auto">
              {milbCandidates.length === 0 ? (
                <div className="px-2 py-1 text-xs text-muted-foreground">No matching MiLB players.</div>
              ) : (
                milbCandidates.map(a => (
                  <div
                    key={a.mlbPlayerId}
                    className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                    data-testid={`${testIdPrefix}-milb-candidate-${a.mlbPlayerId}`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.player.fullName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.player.primaryPosition} — {a.player.currentTeamName || "-"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onAdd({ mlbPlayerId: a.mlbPlayerId, rosterType: "milb", player: a.player });
                        setMilbSearch("");
                      }}
                      data-testid={`${testIdPrefix}-milb-add-${a.mlbPlayerId}`}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
          {milbSelected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {milbSelected.map(item => (
                <Badge key={item.mlbPlayerId} variant="outline" className="text-sm gap-1 pr-1">
                  {item.player.fullName}
                  <span className="text-xs text-muted-foreground">({item.player.primaryPosition})</span>
                  <button
                    onClick={() => onRemove(item.mlbPlayerId)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                    data-testid={`${testIdPrefix}-milb-remove-${item.mlbPlayerId}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {selectedItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Search above to add players to the trade.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function SubmitTrade() {
  const { user } = useAuth();
  const { currentLeague, selectedLeagueId } = useLeague();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [partnerUserId, setPartnerUserId] = useState<string>("");
  const [myItems, setMyItems] = useState<TradeItem[]>([]);
  const [partnerItems, setPartnerItems] = useState<TradeItem[]>([]);
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

  const handleSubmit = () => {
    if (!partnerUserId) {
      toast({ title: "Error", description: "Select a trade partner", variant: "destructive" });
      return;
    }
    if (myItems.length === 0 && partnerItems.length === 0) {
      toast({ title: "Error", description: "Add at least one player to the trade", variant: "destructive" });
      return;
    }

    const items: any[] = [
      ...myItems.map(i => ({ fromUserId: user!.id, mlbPlayerId: i.mlbPlayerId, rosterType: i.rosterType })),
      ...partnerItems.map(i => ({ fromUserId: partnerUserId, mlbPlayerId: i.mlbPlayerId, rosterType: i.rosterType })),
    ];

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
            <Select value={partnerUserId} onValueChange={(val) => { setPartnerUserId(val); setPartnerItems([]); }}>
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
        <PlayerSearchSelector
          label="Your Players"
          roster={myRoster}
          selectedItems={myItems}
          onAdd={(item) => setMyItems(prev => [...prev, item])}
          onRemove={(id) => setMyItems(prev => prev.filter(i => i.mlbPlayerId !== id))}
          testIdPrefix="my"
        />

        {partnerUserId ? (
          partnerRosterQuery.isLoading ? (
            <Card>
              <CardHeader><CardTitle className="text-lg">{partnerDisplayName ? `${partnerDisplayName}'s Players` : "Partner's Players"}</CardTitle></CardHeader>
              <CardContent><Skeleton className="h-40 w-full" /></CardContent>
            </Card>
          ) : (
            <PlayerSearchSelector
              label={partnerDisplayName ? `${partnerDisplayName}'s Players` : "Partner's Players"}
              roster={partnerRoster}
              selectedItems={partnerItems}
              onAdd={(item) => setPartnerItems(prev => [...prev, item])}
              onRemove={(id) => setPartnerItems(prev => prev.filter(i => i.mlbPlayerId !== id))}
              testIdPrefix="partner"
            />
          )
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-lg">Partner's Players</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm text-center py-4">Select a trade partner first.</p>
            </CardContent>
          </Card>
        )}
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

      {(myItems.length > 0 || partnerItems.length > 0) && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Trade Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myItems.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">You send:</p>
                <div className="flex flex-wrap gap-2">
                  {myItems.map(item => (
                    <Badge key={item.mlbPlayerId} variant="outline" className="text-sm gap-1 pr-1">
                      {item.player.fullName}
                      <span className="ml-1 text-xs text-muted-foreground">({item.rosterType.toUpperCase()})</span>
                      <button
                        onClick={() => setMyItems(prev => prev.filter(i => i.mlbPlayerId !== item.mlbPlayerId))}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {partnerItems.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">You receive:</p>
                <div className="flex flex-wrap gap-2">
                  {partnerItems.map(item => (
                    <Badge key={item.mlbPlayerId} variant="outline" className="text-sm gap-1 pr-1">
                      {item.player.fullName}
                      <span className="ml-1 text-xs text-muted-foreground">({item.rosterType.toUpperCase()})</span>
                      <button
                        onClick={() => setPartnerItems(prev => prev.filter(i => i.mlbPlayerId !== item.mlbPlayerId))}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
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
          disabled={submitTradeMutation.isPending || (!myItems.length && !partnerItems.length) || !partnerUserId}
          data-testid="button-submit-trade"
        >
          <Send className="h-4 w-4 mr-2" />
          {submitTradeMutation.isPending ? "Submitting..." : "Submit Trade Proposal"}
        </Button>
      </div>
    </div>
  );
}
