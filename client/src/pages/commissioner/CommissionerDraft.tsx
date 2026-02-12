import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLeague } from "@/hooks/useLeague";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DraftWithDetails, DraftPlayerWithDetails, DraftPickWithDetails, DraftOrder, User, LeagueMember } from "@shared/schema";
import { Plus, Loader2, Trash2, Play, CheckCircle, Settings, ChevronUp, ChevronDown, Upload, Users, ListOrdered } from "lucide-react";

export default function CommissionerDraft() {
  const { selectedLeagueId } = useLeague();
  const { toast } = useToast();

  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSeason, setNewSeason] = useState(2025);
  const [newRounds, setNewRounds] = useState(5);
  const [newSnake, setNewSnake] = useState(true);
  const [playerIdsText, setPlayerIdsText] = useState("");
  const [editName, setEditName] = useState("");
  const [editRounds, setEditRounds] = useState(5);
  const [editSnake, setEditSnake] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const { data: drafts, isLoading: loadingDrafts } = useQuery<DraftWithDetails[]>({
    queryKey: ["/api/drafts", selectedLeagueId],
    queryFn: async () => {
      const res = await fetch(`/api/drafts?leagueId=${selectedLeagueId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch drafts");
      return res.json();
    },
    enabled: !!selectedLeagueId,
  });

  const selectedDraft = drafts?.find(d => d.id === selectedDraftId);

  const { data: draftPlayers, isLoading: loadingPlayers } = useQuery<DraftPlayerWithDetails[]>({
    queryKey: ["/api/drafts", selectedDraftId, "players"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${selectedDraftId}/players`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch players");
      return res.json();
    },
    enabled: !!selectedDraftId,
  });

  const { data: draftOrderData } = useQuery<(DraftOrder & { user: User })[]>({
    queryKey: ["/api/drafts", selectedDraftId, "order"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${selectedDraftId}/order`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch order");
      return res.json();
    },
    enabled: !!selectedDraftId && selectedDraft?.status === "setup",
  });

  const { data: draftPicks } = useQuery<DraftPickWithDetails[]>({
    queryKey: ["/api/drafts", selectedDraftId, "picks"],
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${selectedDraftId}/picks`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch picks");
      return res.json();
    },
    enabled: !!selectedDraftId && selectedDraft?.status !== "setup",
  });

  const { data: leagueMembers } = useQuery<(LeagueMember & { user: User })[]>({
    queryKey: ["/api/leagues", selectedLeagueId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${selectedLeagueId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: !!selectedLeagueId && !!selectedDraftId && selectedDraft?.status === "setup",
  });

  const createDraft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/drafts", {
        name: newName, leagueId: selectedLeagueId, season: newSeason, rounds: newRounds, snake: newSnake,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Draft Created" });
      setCreateDialogOpen(false);
      setNewName("");
      setNewSeason(2025);
      setNewRounds(5);
      setNewSnake(true);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateDraft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/drafts/${selectedDraftId}`, {
        name: editName, rounds: editRounds, snake: editSnake,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Draft Updated" });
      setShowSettings(false);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteDraft = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/drafts/${selectedDraftId}`);
    },
    onSuccess: () => {
      toast({ title: "Draft Deleted" });
      setSelectedDraftId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const uploadPlayers = useMutation({
    mutationFn: async (mlbIds: number[]) => {
      const res = await apiRequest("POST", `/api/drafts/${selectedDraftId}/players/upload`, { mlbIds });
      return res.json();
    },
    onSuccess: (data) => {
      const parts = [`${data.added} added`];
      if (data.alreadyInPool > 0) parts.push(`${data.alreadyInPool} already in pool`);
      if (data.notFound?.length > 0) parts.push(`${data.notFound.length} not found`);
      toast({ title: "Upload Complete", description: parts.join(", ") });
      setPlayerIdsText("");
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedDraftId, "players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const clearPlayers = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/drafts/${selectedDraftId}/players`);
    },
    onSuccess: () => {
      toast({ title: "Player Pool Cleared" });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedDraftId, "players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveOrder = useMutation({
    mutationFn: async (order: { userId: string; orderIndex: number }[]) => {
      const res = await apiRequest("POST", `/api/drafts/${selectedDraftId}/order`, { order });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Draft Order Saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedDraftId, "order"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startDraft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/drafts/${selectedDraftId}/start`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Draft Started" });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const completeDraft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/drafts/${selectedDraftId}/complete`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Draft Completed" });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts", selectedLeagueId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleUploadPlayers = () => {
    const ids = playerIdsText
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(s => /^\d+$/.test(s))
      .map(Number);
    if (ids.length === 0) {
      toast({ title: "No valid IDs", description: "Enter numeric MLB player IDs separated by commas or newlines.", variant: "destructive" });
      return;
    }
    uploadPlayers.mutate(ids);
  };

  const [localOrder, setLocalOrder] = useState<{ userId: string; user: User }[]>([]);
  const [orderInitialized, setOrderInitialized] = useState(false);

  if (selectedDraft?.status === "setup" && draftOrderData && !orderInitialized) {
    if (draftOrderData.length > 0) {
      setLocalOrder(draftOrderData.sort((a, b) => a.orderIndex - b.orderIndex).map(o => ({ userId: o.userId, user: o.user })));
    } else if (leagueMembers) {
      setLocalOrder(leagueMembers.filter(m => !m.isArchived).map(m => ({ userId: m.userId, user: m.user })));
    }
    setOrderInitialized(true);
  }

  const moveOrder = (index: number, direction: "up" | "down") => {
    const newOrder = [...localOrder];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[index], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[index]];
    setLocalOrder(newOrder);
  };

  const handleSaveOrder = () => {
    saveOrder.mutate(localOrder.map((item, idx) => ({ userId: item.userId, orderIndex: idx + 1 })));
  };

  const handleSelectDraft = (draftId: number) => {
    if (selectedDraftId === draftId) {
      setSelectedDraftId(null);
      setOrderInitialized(false);
      return;
    }
    setSelectedDraftId(draftId);
    setOrderInitialized(false);
    setShowSettings(false);
    setPlayerIdsText("");
    const draft = drafts?.find(d => d.id === draftId);
    if (draft) {
      setEditName(draft.name);
      setEditRounds(draft.rounds);
      setEditSnake(draft.snake);
    }
  };

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

      <Card className="mb-6">
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
                  <Label htmlFor="draft-name">Name</Label>
                  <Input id="draft-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., 2025 MiLB Draft" data-testid="input-draft-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="draft-season">Season</Label>
                  <Input id="draft-season" type="number" value={newSeason} onChange={e => setNewSeason(Number(e.target.value))} data-testid="input-draft-season" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="draft-rounds">Rounds</Label>
                  <Input id="draft-rounds" type="number" value={newRounds} onChange={e => setNewRounds(Number(e.target.value))} min={1} max={50} data-testid="input-draft-rounds" />
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="draft-snake" checked={newSnake} onCheckedChange={setNewSnake} data-testid="switch-draft-snake" />
                  <Label htmlFor="draft-snake">Snake draft</Label>
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
                  className={`cursor-pointer hover-elevate ${selectedDraftId === draft.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => handleSelectDraft(draft.id)}
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

      {selectedDraft && selectedDraft.status === "setup" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Upload Player IDs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste MLB API player IDs, one per line or comma-separated (e.g., 660271, 665742)"
                value={playerIdsText}
                onChange={e => setPlayerIdsText(e.target.value)}
                rows={5}
                data-testid="textarea-player-ids"
              />
              <Button onClick={handleUploadPlayers} disabled={uploadPlayers.isPending || !playerIdsText.trim()} data-testid="button-upload-players">
                {uploadPlayers.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : <><Upload className="mr-2 h-4 w-4" />Upload Players</>}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Player Pool ({draftPlayers?.length ?? 0})</CardTitle>
              {draftPlayers && draftPlayers.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" data-testid="button-clear-players"><Trash2 className="h-4 w-4 mr-1" />Clear All</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear Player Pool</AlertDialogTitle>
                      <AlertDialogDescription>Remove all players from the draft pool? This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => clearPlayers.mutate()} data-testid="button-confirm-clear-players">Clear All</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardHeader>
            <CardContent>
              {loadingPlayers ? (
                <Skeleton className="h-32 w-full" />
              ) : draftPlayers && draftPlayers.length > 0 ? (
                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftPlayers.map(dp => (
                        <TableRow key={dp.id} data-testid={`row-player-${dp.id}`}>
                          <TableCell className="font-medium">{dp.player.fullName}</TableCell>
                          <TableCell>{dp.player.primaryPosition || "-"}</TableCell>
                          <TableCell>{dp.player.currentTeamName || dp.player.parentOrgName || "-"}</TableCell>
                          <TableCell><Badge variant={dp.status === "available" ? "outline" : "secondary"}>{dp.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No players in the pool yet. Upload MLB player IDs above.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ListOrdered className="h-5 w-5" />Draft Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {localOrder.length > 0 ? (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead className="text-right w-24">Move</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {localOrder.map((item, idx) => (
                          <TableRow key={item.userId} data-testid={`row-order-${item.userId}`}>
                            <TableCell className="font-medium">{idx + 1}</TableCell>
                            <TableCell>{item.user.teamName || `${item.user.firstName || ""} ${item.user.lastName || ""}`.trim() || item.user.email}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" disabled={idx === 0} onClick={e => { e.stopPropagation(); moveOrder(idx, "up"); }} data-testid={`button-move-up-${item.userId}`}>
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" disabled={idx === localOrder.length - 1} onClick={e => { e.stopPropagation(); moveOrder(idx, "down"); }} data-testid={`button-move-down-${item.userId}`}>
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button onClick={handleSaveOrder} disabled={saveOrder.isPending} data-testid="button-save-order">
                    {saveOrder.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Order"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No league members available for draft order.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Draft Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {showSettings ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} data-testid="input-edit-draft-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-rounds">Rounds</Label>
                    <Input id="edit-rounds" type="number" value={editRounds} onChange={e => setEditRounds(Number(e.target.value))} min={1} max={50} data-testid="input-edit-draft-rounds" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch id="edit-snake" checked={editSnake} onCheckedChange={setEditSnake} data-testid="switch-edit-draft-snake" />
                    <Label htmlFor="edit-snake">Snake draft</Label>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button onClick={() => updateDraft.mutate()} disabled={updateDraft.isPending} data-testid="button-save-settings">
                      {updateDraft.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Settings"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm"><span className="text-muted-foreground">Name:</span> {selectedDraft.name}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Rounds:</span> {selectedDraft.rounds}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Snake:</span> {selectedDraft.snake ? "Yes" : "No"}</p>
                  <Button variant="outline" onClick={() => setShowSettings(true)} data-testid="button-edit-settings">
                    <Settings className="h-4 w-4 mr-2" />Edit Settings
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 flex-wrap">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button data-testid="button-start-draft"><Play className="h-4 w-4 mr-2" />Start Draft</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start Draft</AlertDialogTitle>
                  <AlertDialogDescription>Once started, the draft setup cannot be changed. Are you ready to begin?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => startDraft.mutate()} data-testid="button-confirm-start-draft">
                    {startDraft.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting...</> : "Start Draft"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" data-testid="button-delete-draft"><Trash2 className="h-4 w-4 mr-2" />Delete Draft</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Draft</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete "{selectedDraft.name}" and all associated data. This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteDraft.mutate()} data-testid="button-confirm-delete-draft">
                    {deleteDraft.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : "Delete Draft"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {selectedDraft && selectedDraft.status === "active" && (
        <Card>
          <CardContent className="py-6 space-y-4">
            <div className="flex items-center gap-3">
              <Play className="h-5 w-5 text-green-600" />
              <span className="font-medium text-lg">Draft is Active</span>
              {statusBadge("active")}
            </div>
            <p className="text-sm text-muted-foreground">
              Round {selectedDraft.currentRound} &middot; Pick {selectedDraft.currentPickIndex + 1} &middot; {draftPicks?.length ?? 0} picks made
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="outline" onClick={() => window.open(`/draft/${selectedDraft.id}`, "_blank")} data-testid="button-view-draft-board">
                View Draft Board
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button data-testid="button-complete-draft"><CheckCircle className="h-4 w-4 mr-2" />Complete Draft</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Complete Draft</AlertDialogTitle>
                    <AlertDialogDescription>Mark this draft as completed? No more picks can be made after this.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => completeDraft.mutate()} data-testid="button-confirm-complete-draft">Complete Draft</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedDraft && selectedDraft.status === "completed" && (
        <Card>
          <CardContent className="py-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-lg">Draft Completed</span>
              {statusBadge("completed")}
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>{selectedDraft.rounds} rounds &middot; {selectedDraft.snake ? "Snake" : "Linear"} format</p>
              <p>{selectedDraft.playerCount} players in pool &middot; {selectedDraft.pickCount} picks made &middot; {selectedDraft.teamCount} teams</p>
            </div>
            {draftPicks && draftPicks.length > 0 && (
              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Pick</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Roster</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftPicks.map(pick => (
                      <TableRow key={pick.id} data-testid={`row-pick-${pick.id}`}>
                        <TableCell className="font-medium">{pick.round}.{pick.pickNumber}</TableCell>
                        <TableCell>{pick.player.fullName}</TableCell>
                        <TableCell>{pick.user.teamName || `${pick.user.firstName || ""} ${pick.user.lastName || ""}`.trim()}</TableCell>
                        <TableCell><Badge variant="outline">{pick.rosterType.toUpperCase()}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
