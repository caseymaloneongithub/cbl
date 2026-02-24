import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLeague } from "@/hooks/useLeague";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DraftWithDetails } from "@shared/schema";
import { Plus, Loader2, ListOrdered } from "lucide-react";

export default function CommissionerDraft() {
  const { selectedLeagueId } = useLeague();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPickDuration, setNewPickDuration] = useState(30);
  const [newTeamDraftRound, setNewTeamDraftRound] = useState("");

  const { data: drafts, isLoading: loadingDrafts } = useQuery<DraftWithDetails[]>({
    queryKey: ["/api/drafts", selectedLeagueId],
    queryFn: async () => {
      const res = await fetch(`/api/drafts?leagueId=${selectedLeagueId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch drafts");
      return res.json();
    },
    enabled: !!selectedLeagueId,
    staleTime: 5_000,
  });

  const createDraft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/drafts", {
        name: newName,
        leagueId: selectedLeagueId,
        season: new Date().getFullYear(),
        pickDurationMinutes: newPickDuration,
        teamDraftRound: newTeamDraftRound ? Number(newTeamDraftRound) : null,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Draft Created" });
      setCreateDialogOpen(false);
      setNewName("");
      setNewPickDuration(30);
      setNewTeamDraftRound("");
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
      navigate(`/commissioner/drafts/${data.id}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusBadge = (status: string) => {
    const variant = status === "active" ? "default" : status === "completed" ? "secondary" : "outline";
    return <Badge variant={variant} data-testid={`badge-status-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-draft-title">
          <ListOrdered className="h-6 w-6" />
          Draft Management
        </h1>
        <p className="text-muted-foreground">Create and manage drafts for your league.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5" />
            Drafts
          </CardTitle>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-draft"><Plus className="h-4 w-4 mr-2" />Create Draft</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Draft</DialogTitle>
                <DialogDescription>Set up a new draft for your league.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="draft-name">Draft Name</Label>
                  <Input id="draft-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., 2025 MiLB Draft" data-testid="input-draft-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="draft-pick-duration">Pick Duration (minutes)</Label>
                  <Input id="draft-pick-duration" type="number" value={newPickDuration} onChange={e => setNewPickDuration(Number(e.target.value))} min={1} max={1440} data-testid="input-draft-pick-duration" />
                  <p className="text-xs text-muted-foreground">How long each owner has to make their pick.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="draft-team-round">Team Draft Round (optional)</Label>
                  <Input id="draft-team-round" type="number" value={newTeamDraftRound} onChange={e => setNewTeamDraftRound(e.target.value)} min={1} placeholder="Leave blank for none" data-testid="input-draft-team-round" />
                  <p className="text-xs text-muted-foreground">Which round is the team draft (drafts entire affiliated player pool).</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => createDraft.mutate()} disabled={!newName.trim() || createDraft.isPending} data-testid="button-confirm-create-draft">
                  {createDraft.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Draft"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loadingDrafts ? (
            <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
          ) : drafts && drafts.length > 0 ? (
            <div className="space-y-3">
              {drafts.map(draft => (
                <Card
                  key={draft.id}
                  className="cursor-pointer hover-elevate"
                  onClick={() => navigate(`/commissioner/drafts/${draft.id}`)}
                  data-testid={`card-draft-${draft.id}`}
                >
                  <CardContent className="flex items-center justify-between gap-4 flex-wrap py-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-medium" data-testid={`text-draft-name-${draft.id}`}>{draft.name}</span>
                      {statusBadge(draft.status)}
                      <span className="text-sm text-muted-foreground">Season {draft.season}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span data-testid={`text-player-count-${draft.id}`}>{draft.playerCount} players</span>
                      <span data-testid={`text-pick-count-${draft.id}`}>{draft.pickCount} picks</span>
                      <span data-testid={`text-team-count-${draft.id}`}>{draft.teamCount} teams</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ListOrdered className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No drafts yet. Create your first draft to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
