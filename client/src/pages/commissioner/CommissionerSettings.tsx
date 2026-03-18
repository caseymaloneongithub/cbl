import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { User } from "@shared/schema";
import { Settings, Loader2, Upload, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface ParsedRosterPlayer {
  playerName: string;
  teamAbbreviation: string;
  playerType: "hitter" | "pitcher";
  ip?: number;
  pa?: number;
  salary: number;
  contractYears?: number;
}

interface RosterUsageData {
  caps: { budgetCap: number | null; ipCap: number | null; paCap: number | null };
  teams: { userId: string; user: User; salaryUsed: number; ipUsed: number; paUsed: number; playerCount: number }[];
}

export default function CommissionerSettings() {
  const { user } = useAuth();
  const { selectedLeagueId, currentLeague } = useLeague();
  const { toast } = useToast();

  const [editingLeagueCaps, setEditingLeagueCaps] = useState(false);
  const [capsForm, setCapsForm] = useState({ budgetCap: "", ipCap: "", paCap: "", mlRosterLimit: "", milbRosterLimit: "", showInnocuous: false });
  const [rosterDragActive, setRosterDragActive] = useState(false);
  const [rosterUploadLoading, setRosterUploadLoading] = useState(false);
  const [parsedRosterPlayers, setParsedRosterPlayers] = useState<ParsedRosterPlayer[]>([]);

  const { data: rosterUsage, isLoading: loadingRosterUsage } = useQuery<RosterUsageData>({
    queryKey: ["/api/leagues", selectedLeagueId, "roster-usage"],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${selectedLeagueId}/roster-usage`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch roster usage");
      return res.json();
    },
    enabled: !!selectedLeagueId,
  });

  const uploadRoster = useMutation({
    mutationFn: async ({ players, replaceExisting }: { players: ParsedRosterPlayer[]; replaceExisting: boolean }) => {
      const res = await apiRequest("POST", `/api/leagues/${selectedLeagueId}/roster/upload`, { players, replaceExisting });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Roster Uploaded", description: data.message });
      setParsedRosterPlayers([]);
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", selectedLeagueId, "roster-usage"] });
    },
    onError: (error: Error) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });

  const updateLeagueCaps = useMutation({
    mutationFn: async (caps: { budgetCap?: number | null; ipCap?: number | null; paCap?: number | null; mlRosterLimit?: number; milbRosterLimit?: number; showInnocuous?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/leagues/${selectedLeagueId}/caps`, caps);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "League Settings Updated", description: "League caps and roster limits have been saved." });
      setEditingLeagueCaps(false);
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", selectedLeagueId, "roster-usage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const clearRoster = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/leagues/${selectedLeagueId}/roster`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Roster Cleared", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", selectedLeagueId, "roster-usage"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const parseRosterCSV = useCallback((text: string) => {
    const lines = text.trim().split("\n").filter(line => line.trim());
    if (lines.length < 2) {
      toast({ title: "Invalid CSV", description: "CSV must have a header row and at least one data row.", variant: "destructive" });
      return;
    }
    const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
    const nameIdx = headers.findIndex(h => h === "name" || h === "player" || h === "playername" || h === "player_name");
    const teamIdx = headers.findIndex(h => h === "team" || h === "abbreviation" || h === "abbrev" || h === "teamabbreviation");
    const typeIdx = headers.findIndex(h => h === "type" || h === "playertype" || h === "player_type" || h === "position" || h === "h/p");
    const ipIdx = headers.findIndex(h => h === "ip" || h === "inningspitched" || h === "innings");
    const paIdx = headers.findIndex(h => h === "pa" || h === "plateappearances");
    const salaryIdx = headers.findIndex(h => h === "salary" || h === "contract" || h === "value" || h === "dollar" || h === "dollars");
    const yearsIdx = headers.findIndex(h => h === "years" || h === "contractyears" || h === "contract_years");

    if (nameIdx === -1) { toast({ title: "Missing name column", description: "CSV must have a 'name' or 'player' column.", variant: "destructive" }); return; }
    if (teamIdx === -1) { toast({ title: "Missing team column", description: "CSV must have a 'team' or 'abbreviation' column.", variant: "destructive" }); return; }

    const players: ParsedRosterPlayer[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      const playerName = values[nameIdx];
      if (!playerName) continue;
      const teamAbbreviation = (values[teamIdx] || "").toUpperCase();
      if (!teamAbbreviation) continue;
      let playerType: "hitter" | "pitcher" = "hitter";
      if (typeIdx !== -1) {
        const typeVal = (values[typeIdx] || "").toLowerCase();
        if (typeVal === "pitcher" || typeVal === "p") playerType = "pitcher";
      }
      const ip = ipIdx !== -1 ? parseFloat(values[ipIdx]) || undefined : undefined;
      const pa = paIdx !== -1 ? parseInt(values[paIdx]) || undefined : undefined;
      const salary = salaryIdx !== -1 ? parseFloat(values[salaryIdx]) || 0 : 0;
      const contractYears = yearsIdx !== -1 ? parseInt(values[yearsIdx]) || 1 : 1;
      players.push({ playerName, teamAbbreviation, playerType, ip, pa, salary, contractYears });
    }
    setParsedRosterPlayers(players);
    toast({ title: "CSV Parsed", description: `Found ${players.length} roster players.` });
  }, [toast]);

  const handleRosterDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setRosterDragActive(true);
    else if (e.type === "dragleave") setRosterDragActive(false);
  }, []);

  const handleRosterDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRosterDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
      const reader = new FileReader();
      reader.onload = (event) => parseRosterCSV(event.target?.result as string);
      reader.readAsText(file);
    }
  }, [parseRosterCSV]);

  const handleRosterFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => parseRosterCSV(event.target?.result as string);
      reader.readAsText(file);
    }
  }, [parseRosterCSV]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-settings-title">
          <Settings className="h-6 w-6" />
          League Settings
        </h1>
        <p className="text-muted-foreground">
          Manage league caps, roster usage, and contract tracking.
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Roster Management
              </CardTitle>
              <CardDescription className="mt-1">
                Track existing player contracts and calculate available budgets for auctions
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingLeagueCaps(true);
                setCapsForm({
                  budgetCap: rosterUsage?.caps.budgetCap?.toString() || "",
                  ipCap: rosterUsage?.caps.ipCap?.toString() || "",
                  paCap: rosterUsage?.caps.paCap?.toString() || "",
                  mlRosterLimit: ((currentLeague as any)?.mlRosterLimit ?? 40).toString(),
                  milbRosterLimit: ((currentLeague as any)?.milbRosterLimit ?? 150).toString(),
                  showInnocuous: !!(currentLeague as any)?.showInnocuous,
                });
              }}
              data-testid="button-edit-league-caps"
            >
              <Settings className="h-4 w-4 mr-2" />
              League Caps
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {rosterUsage && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Budget Cap</div>
                <div className="text-lg font-semibold">{rosterUsage.caps.budgetCap !== null ? `$${rosterUsage.caps.budgetCap}` : "Not Set"}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">IP Cap</div>
                <div className="text-lg font-semibold">{rosterUsage.caps.ipCap !== null ? rosterUsage.caps.ipCap.toLocaleString() : "Not Set"}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">PA Cap</div>
                <div className="text-lg font-semibold">{rosterUsage.caps.paCap !== null ? rosterUsage.caps.paCap.toLocaleString() : "Not Set"}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">ML Roster Limit</div>
                <div className="text-lg font-semibold">{(currentLeague as any)?.mlRosterLimit ?? 40}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">MiLB Roster Limit</div>
                <div className="text-lg font-semibold">{(currentLeague as any)?.milbRosterLimit ?? 150}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Innocuous Highlighting</div>
                <div className="text-lg font-semibold">{(currentLeague as any)?.showInnocuous ? "On" : "Off"}</div>
              </div>
            </div>
          )}

          {loadingRosterUsage ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rosterUsage && rosterUsage.teams.length > 0 ? (
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Current Roster Usage by Team</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Players</TableHead>
                    <TableHead className="text-right">Salary Used</TableHead>
                    <TableHead className="text-right">IP Used</TableHead>
                    <TableHead className="text-right">PA Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rosterUsage.teams.map((team) => (
                    <TableRow key={team.userId}>
                      <TableCell>
                        <div className="font-medium">{team.user.teamName || `${team.user.firstName || ""} ${team.user.lastName || ""}`.trim() || "Unknown"}</div>
                        {team.user.teamAbbreviation && <div className="text-xs text-muted-foreground">{team.user.teamAbbreviation}</div>}
                      </TableCell>
                      <TableCell className="text-right">{team.playerCount}</TableCell>
                      <TableCell className="text-right">${team.salaryUsed.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{team.ipUsed.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{team.paUsed.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">No roster data yet. Upload a CSV to track existing player contracts.</div>
          )}

          <div className="space-y-4">
            <h4 className="font-medium text-sm">Upload Roster CSV</h4>
            <p className="text-sm text-muted-foreground">
              Upload a CSV with columns: name, team (abbreviation), type (hitter/pitcher), ip, pa, salary, years
            </p>

            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${rosterDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}
              onDragEnter={handleRosterDrag}
              onDragLeave={handleRosterDrag}
              onDragOver={handleRosterDrag}
              onDrop={handleRosterDrop}
            >
              {rosterUploadLoading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm font-medium">Uploading roster...</span>
                  </div>
                </div>
              )}
              <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm mb-2">
                Drag and drop a CSV file here, or{" "}
                <label className="text-primary cursor-pointer hover:underline">
                  browse
                  <input type="file" accept=".csv" className="hidden" onChange={handleRosterFileSelect} data-testid="input-roster-file" />
                </label>
              </p>
            </div>

            {parsedRosterPlayers.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium">{parsedRosterPlayers.length} players ready to upload</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setParsedRosterPlayers([])} data-testid="button-clear-roster">Clear</Button>
                    <Button size="sm" onClick={() => { setRosterUploadLoading(true); uploadRoster.mutate({ players: parsedRosterPlayers, replaceExisting: false }, { onSettled: () => setRosterUploadLoading(false) }); }} disabled={uploadRoster.isPending} data-testid="button-upload-roster-merge">
                      {uploadRoster.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Merge with Existing
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { setRosterUploadLoading(true); uploadRoster.mutate({ players: parsedRosterPlayers, replaceExisting: true }, { onSettled: () => setRosterUploadLoading(false) }); }} disabled={uploadRoster.isPending} data-testid="button-upload-roster-replace">Replace All</Button>
                  </div>
                </div>
                <div className="max-h-64 overflow-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">IP</TableHead>
                        <TableHead className="text-right">PA</TableHead>
                        <TableHead className="text-right">Salary</TableHead>
                        <TableHead className="text-right">Years</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRosterPlayers.slice(0, 10).map((player, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{player.playerName}</TableCell>
                          <TableCell>{player.teamAbbreviation}</TableCell>
                          <TableCell className="capitalize">{player.playerType}</TableCell>
                          <TableCell className="text-right">{player.ip ?? "-"}</TableCell>
                          <TableCell className="text-right">{player.pa ?? "-"}</TableCell>
                          <TableCell className="text-right">${player.salary}</TableCell>
                          <TableCell className="text-right">{player.contractYears}</TableCell>
                        </TableRow>
                      ))}
                      {parsedRosterPlayers.length > 10 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">... and {parsedRosterPlayers.length - 10} more players</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {rosterUsage && rosterUsage.teams.length > 0 && (
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => { if (confirm("Are you sure you want to clear all roster data for this league? This cannot be undone.")) clearRoster.mutate(); }}
                  disabled={clearRoster.isPending}
                  data-testid="button-clear-all-roster"
                >
                  {clearRoster.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Clear All Roster Data
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={editingLeagueCaps} onOpenChange={setEditingLeagueCaps}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit League Settings</DialogTitle>
            <DialogDescription>Set maximum budget, IP, and PA limits for the league, and configure roster size limits per team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="budgetCap">Budget Cap ($)</Label>
              <Input id="budgetCap" type="number" value={capsForm.budgetCap} onChange={(e) => setCapsForm({ ...capsForm, budgetCap: e.target.value })} placeholder="e.g., 260" data-testid="input-budget-cap" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ipCap">IP Cap (Innings Pitched)</Label>
              <Input id="ipCap" type="number" value={capsForm.ipCap} onChange={(e) => setCapsForm({ ...capsForm, ipCap: e.target.value })} placeholder="e.g., 1500" data-testid="input-ip-cap" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paCap">PA Cap (Plate Appearances)</Label>
              <Input id="paCap" type="number" value={capsForm.paCap} onChange={(e) => setCapsForm({ ...capsForm, paCap: e.target.value })} placeholder="e.g., 6000" data-testid="input-pa-cap" />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mlRosterLimit">ML Roster Limit</Label>
                <Input id="mlRosterLimit" type="number" value={capsForm.mlRosterLimit} onChange={(e) => setCapsForm({ ...capsForm, mlRosterLimit: e.target.value })} placeholder="40" data-testid="input-ml-roster-limit" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="milbRosterLimit">MiLB Roster Limit</Label>
                <Input id="milbRosterLimit" type="number" value={capsForm.milbRosterLimit} onChange={(e) => setCapsForm({ ...capsForm, milbRosterLimit: e.target.value })} placeholder="150" data-testid="input-milb-roster-limit" />
              </div>
            </div>
            <Separator />
            <label className="flex items-center gap-3 cursor-pointer" data-testid="toggle-show-innocuous">
              <input
                type="checkbox"
                checked={capsForm.showInnocuous}
                onChange={(e) => setCapsForm({ ...capsForm, showInnocuous: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <div>
                <div className="text-sm font-medium">Show Innocuous Highlighting</div>
                <div className="text-xs text-muted-foreground">Highlight innocuous players with a green background in player tables</div>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLeagueCaps(false)}>Cancel</Button>
            <Button
              onClick={() => updateLeagueCaps.mutate({
                budgetCap: capsForm.budgetCap ? parseFloat(capsForm.budgetCap) : null,
                ipCap: capsForm.ipCap ? parseInt(capsForm.ipCap) : null,
                paCap: capsForm.paCap ? parseInt(capsForm.paCap) : null,
                mlRosterLimit: capsForm.mlRosterLimit ? parseInt(capsForm.mlRosterLimit) : 40,
                milbRosterLimit: capsForm.milbRosterLimit ? parseInt(capsForm.milbRosterLimit) : 150,
                showInnocuous: capsForm.showInnocuous,
              })}
              disabled={updateLeagueCaps.isPending}
              data-testid="button-save-caps"
            >
              {updateLeagueCaps.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
