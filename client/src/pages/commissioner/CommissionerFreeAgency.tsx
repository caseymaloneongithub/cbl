import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Auction } from "@shared/schema";
import { Settings, Loader2, FileSpreadsheet, Trash2, Plus, Trophy, RotateCcw, Play, Edit2, Check, X, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CommissionerFreeAgency() {
  const { user } = useAuth();
  const { selectedLeagueId } = useLeague();
  const { toast } = useToast();

  const [createAuctionDialogOpen, setCreateAuctionDialogOpen] = useState(false);
  const [newAuctionName, setNewAuctionName] = useState("");
  const [deleteAuctionId, setDeleteAuctionId] = useState<number | null>(null);
  const [resetAuctionId, setResetAuctionId] = useState<number | null>(null);
  const [passwordForAction, setPasswordForAction] = useState("");
  const [editingAuctionId, setEditingAuctionId] = useState<number | null>(null);
  const [editingAuctionName, setEditingAuctionName] = useState("");

  const [exportingResults, setExportingResults] = useState(false);
  const [exportingRosters, setExportingRosters] = useState(false);
  const [selectedAuctionForExport, setSelectedAuctionForExport] = useState<string>("");

  const { data: allAuctions, isLoading: loadingAuctions } = useQuery<Auction[]>({
    queryKey: ["/api/auctions", selectedLeagueId],
    queryFn: async () => {
      const url = selectedLeagueId
        ? `/api/auctions?leagueId=${selectedLeagueId}`
        : "/api/auctions";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch auctions");
      return res.json();
    },
    enabled: !!selectedLeagueId,
  });

  const createAuction = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/auctions", { name, leagueId: selectedLeagueId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Auction Created", description: "New auction has been created." });
      setCreateAuctionDialogOpen(false);
      setNewAuctionName("");
      queryClient.invalidateQueries({ queryKey: ["/api/auctions", selectedLeagueId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateAuction = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name?: string; status?: string } }) => {
      const res = await apiRequest("PATCH", `/api/auctions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Auction Updated" });
      setEditingAuctionId(null);
      setEditingAuctionName("");
      queryClient.invalidateQueries({ queryKey: ["/api/auctions", selectedLeagueId] });
      queryClient.invalidateQueries({ queryKey: ["/api/auctions/active"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteAuction = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await apiRequest("DELETE", `/api/auctions/${id}`, { password });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Auction Deleted", description: "The auction has been permanently deleted." });
      setDeleteAuctionId(null);
      setPasswordForAction("");
      queryClient.invalidateQueries({ queryKey: ["/api/auctions", selectedLeagueId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetAuction = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await apiRequest("POST", `/api/auctions/${id}/reset`, { password });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Auction Reset", description: "All bids have been cleared and players reactivated." });
      setResetAuctionId(null);
      setPasswordForAction("");
      queryClient.invalidateQueries({ queryKey: ["/api/auctions", selectedLeagueId] });
      queryClient.invalidateQueries({ queryKey: ["/api/free-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleExportResults = useCallback(async () => {
    setExportingResults(true);
    try {
      const url = selectedAuctionForExport && selectedAuctionForExport !== "all"
        ? `/api/exports/auction-results.csv?auctionId=${selectedAuctionForExport}`
        : "/api/exports/auction-results.csv";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to export");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const auctionName = selectedAuctionForExport && selectedAuctionForExport !== "all"
        ? allAuctions?.find(au => String(au.id) === selectedAuctionForExport)?.name || "auction"
        : "all-auctions";
      a.download = `auction-results-${auctionName.toLowerCase().replace(/\s+/g, "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      toast({ title: "Export Complete", description: "Auction results have been downloaded." });
    } catch {
      toast({ title: "Export Failed", description: "Could not export auction results.", variant: "destructive" });
    } finally {
      setExportingResults(false);
    }
  }, [selectedAuctionForExport, allAuctions, toast]);

  const handleExportRosters = useCallback(async () => {
    setExportingRosters(true);
    try {
      const url = selectedAuctionForExport && selectedAuctionForExport !== "all"
        ? `/api/exports/final-rosters.csv?auctionId=${selectedAuctionForExport}`
        : "/api/exports/final-rosters.csv";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to export");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const auctionName = selectedAuctionForExport && selectedAuctionForExport !== "all"
        ? allAuctions?.find(au => String(au.id) === selectedAuctionForExport)?.name || "auction"
        : "all-auctions";
      a.download = `final-rosters-${auctionName.toLowerCase().replace(/\s+/g, "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      toast({ title: "Export Complete", description: "Final rosters have been downloaded." });
    } catch {
      toast({ title: "Export Failed", description: "Could not export final rosters.", variant: "destructive" });
    } finally {
      setExportingRosters(false);
    }
  }, [selectedAuctionForExport, allAuctions, toast]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-commissioner-title">
          <Trophy className="h-6 w-6" />
          Auction Management
        </h1>
        <p className="text-muted-foreground">
          Create, manage, and switch between different auctions. Click "Manage" on any auction to configure its settings, teams, and free agents.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Auctions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <Dialog open={createAuctionDialogOpen} onOpenChange={setCreateAuctionDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-auction">
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Auction
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Auction</DialogTitle>
                    <DialogDescription>
                      Enter a name for your new auction. All teams will be enrolled automatically.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="auction-name">Auction Name</Label>
                      <Input
                        id="auction-name"
                        placeholder="e.g., 2025 Free Agent Auction"
                        value={newAuctionName}
                        onChange={(e) => setNewAuctionName(e.target.value)}
                        data-testid="input-auction-name"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setCreateAuctionDialogOpen(false); setNewAuctionName(""); }}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => createAuction.mutate(newAuctionName)}
                      disabled={!newAuctionName.trim() || createAuction.isPending}
                      data-testid="button-confirm-create-auction"
                    >
                      {createAuction.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Auction"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {loadingAuctions ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : allAuctions && allAuctions.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Bid Increment</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allAuctions.map((auction) => (
                      <TableRow key={auction.id} data-testid={`row-auction-${auction.id}`}>
                        <TableCell>
                          {editingAuctionId === auction.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editingAuctionName}
                                onChange={(e) => setEditingAuctionName(e.target.value)}
                                className="h-8 max-w-[200px]"
                                data-testid={`input-edit-auction-name-${auction.id}`}
                              />
                              <Button size="icon" variant="ghost" onClick={() => updateAuction.mutate({ id: auction.id, data: { name: editingAuctionName } })} disabled={updateAuction.isPending}>
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => { setEditingAuctionId(null); setEditingAuctionName(""); }}>
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{auction.name}</span>
                              <Button size="icon" variant="ghost" onClick={() => { setEditingAuctionId(auction.id); setEditingAuctionName(auction.name); }}>
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={auction.status === "active" ? "default" : auction.status === "completed" ? "secondary" : "outline"}>
                            {auction.status === "active" && <Play className="h-3 w-3 mr-1" />}
                            {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {Math.round((auction.bidIncrement ?? 0.10) * 100)}%
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {auction.createdAt ? new Date(auction.createdAt).toLocaleDateString() : "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/commissioner/auctions/${auction.id}`}>
                              <Button size="sm" variant="default" data-testid={`button-manage-auction-${auction.id}`}>
                                <Settings className="h-3 w-3 mr-1" />
                                Manage
                              </Button>
                            </Link>
                            {auction.status !== "active" && (
                              <Button size="sm" variant="outline" onClick={() => updateAuction.mutate({ id: auction.id, data: { status: "active" } })} disabled={updateAuction.isPending} data-testid={`button-activate-auction-${auction.id}`}>
                                <Play className="h-3 w-3 mr-1" />
                                Activate
                              </Button>
                            )}
                            <Dialog open={resetAuctionId === auction.id} onOpenChange={(open) => { if (!open) { setResetAuctionId(null); setPasswordForAction(""); } }}>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => setResetAuctionId(auction.id)} data-testid={`button-reset-auction-${auction.id}`}>
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Reset
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reset Auction</DialogTitle>
                                  <DialogDescription>This will clear ALL bids and reactivate all players in "{auction.name}". This action cannot be undone. Enter your password to confirm.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="reset-password">Password</Label>
                                    <Input id="reset-password" type="password" value={passwordForAction} onChange={(e) => setPasswordForAction(e.target.value)} placeholder="Enter your password" data-testid="input-reset-password" />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => { setResetAuctionId(null); setPasswordForAction(""); }}>Cancel</Button>
                                  <Button variant="destructive" onClick={() => resetAuction.mutate({ id: auction.id, password: passwordForAction })} disabled={!passwordForAction || resetAuction.isPending} data-testid="button-confirm-reset">
                                    {resetAuction.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting...</> : "Reset Auction"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Dialog open={deleteAuctionId === auction.id} onOpenChange={(open) => { if (!open) { setDeleteAuctionId(null); setPasswordForAction(""); } }}>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="destructive" onClick={() => setDeleteAuctionId(auction.id)} data-testid={`button-delete-auction-${auction.id}`}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Delete Auction</DialogTitle>
                                  <DialogDescription>This will permanently delete "{auction.name}" including all players and bids. This action cannot be undone. Enter your password to confirm.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="delete-password">Password</Label>
                                    <Input id="delete-password" type="password" value={passwordForAction} onChange={(e) => setPasswordForAction(e.target.value)} placeholder="Enter your password" data-testid="input-delete-password" />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => { setDeleteAuctionId(null); setPasswordForAction(""); }}>Cancel</Button>
                                  <Button variant="destructive" onClick={() => deleteAuction.mutate({ id: auction.id, password: passwordForAction })} disabled={!passwordForAction || deleteAuction.isPending} data-testid="button-confirm-delete">
                                    {deleteAuction.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : "Delete Auction"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No auctions yet. Create your first auction to get started.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Data Export
          </CardTitle>
          <CardDescription>Export auction data as CSV files for reporting and analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <Label className="text-sm font-medium whitespace-nowrap">Filter by Auction:</Label>
            <Select value={selectedAuctionForExport} onValueChange={setSelectedAuctionForExport}>
              <SelectTrigger className="flex-1" data-testid="select-export-auction">
                <SelectValue placeholder="All Auctions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Auctions</SelectItem>
                {allAuctions && allAuctions.map((auction) => (
                  <SelectItem key={auction.id} value={String(auction.id)}>
                    {auction.name} {auction.status === "active" && "(Active)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAuctionForExport && selectedAuctionForExport !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedAuctionForExport("")} data-testid="button-clear-export-filter">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Button variant="outline" className="justify-start" onClick={handleExportResults} disabled={exportingResults} data-testid="button-export-results">
              {exportingResults ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Export Auction Results
            </Button>
            <Button variant="outline" className="justify-start" onClick={handleExportRosters} disabled={exportingRosters} data-testid="button-export-rosters">
              {exportingRosters ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Export Final Rosters
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Exports include only completed auctions with winning bids.
            {selectedAuctionForExport && selectedAuctionForExport !== "all" && (
              <span className="font-medium"> Filtering by: {allAuctions?.find(a => String(a.id) === selectedAuctionForExport)?.name}</span>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
