import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { isUnauthorizedError } from "@/lib/authUtils";
import type { User, LeagueMember } from "@shared/schema";
import { Upload, Users, Loader2, Trash2, Crown, Download, Edit2, Archive, ArchiveRestore, MailPlus, Copy, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ParsedUser {
  email: string;
  firstName?: string;
  lastName?: string;
  teamName?: string;
  teamAbbreviation?: string;
  password?: string;
}

interface TeamOwnershipInvite {
  id: number;
  leagueId: number;
  teamUserId: string;
  invitedEmail: string;
  token: string;
  invitedByUserId: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expiresAt: string;
  acceptedByUserId: string | null;
  acceptedAt: string | null;
  createdAt: string;
  teamName?: string | null;
  teamAbbreviation?: string | null;
}

export default function CommissionerTeams() {
  const { user } = useAuth();
  const { selectedLeagueId } = useLeague();
  const { toast } = useToast();

  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [usersDragActive, setUsersDragActive] = useState(false);
  const [uploadedCredentials, setUploadedCredentials] = useState<{ email: string; password: string }[]>([]);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const [deletingTeamName, setDeletingTeamName] = useState("");
  const [editingTeam, setEditingTeam] = useState<User | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamAbbreviation, setEditTeamAbbreviation] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteTargetUserId, setInviteTargetUserId] = useState("");
  const [inviteTargetTeamName, setInviteTargetTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [latestInviteUrl, setLatestInviteUrl] = useState("");

  const { data: owners, isLoading: loadingOwners } = useQuery<User[]>({
    queryKey: ["/api/owners", selectedLeagueId],
    queryFn: async () => {
      const url = selectedLeagueId ? `/api/owners?leagueId=${selectedLeagueId}` : "/api/owners";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch owners");
      return res.json();
    },
    enabled: !!selectedLeagueId,
  });

  const { data: leagueMembers } = useQuery<(LeagueMember & { user: User })[]>({
    queryKey: ["/api/leagues", selectedLeagueId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${selectedLeagueId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch league members");
      return res.json();
    },
    enabled: !!selectedLeagueId,
  });

  const { data: league } = useQuery<any>({
    queryKey: ["/api/leagues", selectedLeagueId],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${selectedLeagueId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch league");
      return res.json();
    },
    enabled: !!selectedLeagueId,
  });

  const { data: teamInvites } = useQuery<TeamOwnershipInvite[]>({
    queryKey: ["/api/leagues", selectedLeagueId, "team-invites"],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${selectedLeagueId}/team-invites`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch team invites");
      return res.json();
    },
    enabled: !!selectedLeagueId,
  });

  const isLeagueCommissionerForUser = useCallback((userId: string): boolean => {
    if (!leagueMembers) return false;
    const member = leagueMembers.find(m => m.userId === userId);
    return member?.role === 'commissioner';
  }, [leagueMembers]);

  const uploadUsers = useMutation({
    mutationFn: async (users: ParsedUser[]) => {
      const res = await apiRequest("POST", "/api/users/bulk", { users, leagueId: selectedLeagueId });
      return res.json();
    },
    onSuccess: (data) => {
      const successCount = data.results.filter((r: any) => r.success).length;
      const credentials = data.results
        .filter((r: any) => r.success && r.password)
        .map((r: any) => ({ email: r.email, password: r.password }));
      setUploadedCredentials(credentials);
      toast({ title: "Users Created", description: `${successCount} users have been created. Download credentials below.` });
      setParsedUsers([]);
      queryClient.invalidateQueries({ queryKey: ["/api/owners", selectedLeagueId] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/"; }, 500);
        return;
      }
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteTeam = useMutation({
    mutationFn: async (userId: string) => {
      const url = selectedLeagueId ? `/api/owners/${userId}?leagueId=${selectedLeagueId}` : `/api/owners/${userId}`;
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) { const data = await res.json(); throw new Error(data.message || "Failed to delete team"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Team Deleted", description: "The team has been removed." });
      setDeleteTeamId(null);
      setDeletingTeamName("");
      queryClient.invalidateQueries({ queryKey: ["/api/owners", selectedLeagueId] });
    },
    onError: (error: Error) => {
      toast({ title: "Cannot Delete", description: error.message, variant: "destructive" });
      setDeleteTeamId(null);
      setDeletingTeamName("");
    },
  });

  const archiveTeam = useMutation({
    mutationFn: async ({ userId, isArchived }: { userId: string; isArchived: boolean }) => {
      const url = selectedLeagueId ? `/api/owners/${userId}/archive?leagueId=${selectedLeagueId}` : `/api/owners/${userId}/archive`;
      const res = await fetch(url, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isArchived }) });
      if (!res.ok) { const data = await res.json(); throw new Error(data.message || "Failed to update team"); }
      return res.json();
    },
    onSuccess: (_, { isArchived }) => {
      toast({ title: isArchived ? "Team Archived" : "Team Restored", description: isArchived ? "The team has been moved to the archive." : "The team has been restored to active." });
      queryClient.invalidateQueries({ queryKey: ["/api/owners", selectedLeagueId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const setCommissioner = useMutation({
    mutationFn: async ({ userId, isCommissioner }: { userId: string; isCommissioner: boolean }) => {
      if (!selectedLeagueId) throw new Error("No league selected");
      const res = await apiRequest("PATCH", `/api/leagues/${selectedLeagueId}/members/${userId}`, { role: isCommissioner ? 'commissioner' : 'owner' });
      return res.json();
    },
    onSuccess: (_, { isCommissioner }) => {
      toast({ title: isCommissioner ? "Commissioner Assigned" : "Commissioner Removed", description: isCommissioner ? "The team has been granted commissioner access for this league." : "Commissioner access has been revoked for this league." });
      queryClient.invalidateQueries({ queryKey: ["/api/owners", selectedLeagueId] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", selectedLeagueId, "members"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTeamDetails = useMutation({
    mutationFn: async ({ userId, details }: { userId: string; details: { email?: string; firstName?: string; lastName?: string; teamName?: string; teamAbbreviation?: string } }) => {
      const qs = selectedLeagueId ? `?leagueId=${selectedLeagueId}` : "";
      const res = await apiRequest("PATCH", `/api/users/${userId}${qs}`, details);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Team Updated", description: "Team details have been saved." });
      setEditingTeam(null);
      queryClient.invalidateQueries({ queryKey: ["/api/owners", selectedLeagueId] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", selectedLeagueId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createTeamInvite = useMutation({
    mutationFn: async ({ teamUserId, email }: { teamUserId: string; email: string }) => {
      if (!selectedLeagueId) throw new Error("No league selected");
      const res = await apiRequest("POST", `/api/leagues/${selectedLeagueId}/team-invites`, { teamUserId, email });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Invite Created", description: "Share the invite link with the incoming owner." });
      setLatestInviteUrl(data.inviteUrl || "");
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", selectedLeagueId, "team-invites"] });
    },
    onError: (error: Error) => {
      toast({ title: "Invite Failed", description: error.message, variant: "destructive" });
    },
  });

  const cancelTeamInvite = useMutation({
    mutationFn: async (inviteId: number) => {
      if (!selectedLeagueId) throw new Error("No league selected");
      await apiRequest("DELETE", `/api/leagues/${selectedLeagueId}/team-invites/${inviteId}`);
    },
    onSuccess: () => {
      toast({ title: "Invite Cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", selectedLeagueId, "team-invites"] });
    },
    onError: (error: Error) => {
      toast({ title: "Cancel Failed", description: error.message, variant: "destructive" });
    },
  });

  const parseUserCSV = useCallback((text: string) => {
    const lines = text.trim().split("\n");
    const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
    const emailIdx = headers.findIndex(h => h === "email");
    const firstNameIdx = headers.findIndex(h => h === "first_name" || h === "firstname");
    const lastNameIdx = headers.findIndex(h => h === "last_name" || h === "lastname");
    const teamNameIdx = headers.findIndex(h => h === "team_name" || h === "teamname" || h === "team");
    const abbreviationIdx = headers.findIndex(h => h === "abbreviation" || h === "abbr" || h === "team_abbreviation" || h === "team_abbr");
    const passwordIdx = headers.findIndex(h => h === "password" || h === "pass" || h === "pwd");

    if (emailIdx === -1) {
      toast({ title: "Invalid CSV", description: "CSV must have 'email' column", variant: "destructive" });
      return;
    }

    const users: ParsedUser[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      if (values[emailIdx]) {
        const abbr = abbreviationIdx !== -1 ? values[abbreviationIdx]?.toUpperCase().slice(0, 3) : undefined;
        const password = passwordIdx !== -1 ? values[passwordIdx] : undefined;
        users.push({
          email: values[emailIdx],
          firstName: firstNameIdx !== -1 ? values[firstNameIdx] : undefined,
          lastName: lastNameIdx !== -1 ? values[lastNameIdx] : undefined,
          teamName: teamNameIdx !== -1 ? values[teamNameIdx] : undefined,
          teamAbbreviation: abbr || undefined,
          password: password || undefined,
        });
      }
    }
    setParsedUsers(users);
  }, [toast]);

  const handleUserDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setUsersDragActive(true);
    else if (e.type === "dragleave") setUsersDragActive(false);
  }, []);

  const handleUserDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUsersDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "text/csv") {
      const reader = new FileReader();
      reader.onload = (event) => parseUserCSV(event.target?.result as string);
      reader.readAsText(file);
    }
  }, [parseUserCSV]);

  const handleUserFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => parseUserCSV(event.target?.result as string);
      reader.readAsText(file);
    }
  }, [parseUserCSV]);

  const downloadCredentials = useCallback(() => {
    if (uploadedCredentials.length === 0) return;
    const csv = "Email,Temporary Password\n" + uploadedCredentials.map(c => `${c.email},${c.password}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user-credentials.csv";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast({ title: "Credentials Downloaded", description: "Share these credentials securely with your team owners." });
    setUploadedCredentials([]);
  }, [uploadedCredentials, toast]);

  const onboardingProgress = useMemo(() => {
    const status = String(league?.rosterOnboardingStatus || "pending");
    const processed = Number(league?.rosterOnboardingLastProcessed || 0);
    const unresolved = Number(league?.rosterOnboardingLastUnresolved || 0);
    const errors = Number(league?.rosterOnboardingLastErrors || 0);
    const remaining = Math.max(0, unresolved + errors);
    const resolved = Math.max(0, processed - remaining);
    const isComplete = status === "completed";
    const isPending = status === "pending" && processed === 0;
    const percent = isComplete ? 100 : (processed > 0 ? Math.round((resolved / processed) * 100) : 0);
    return { status, processed, unresolved, errors, remaining, resolved, percent, isComplete, isPending };
  }, [league]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-teams-title">
          <Users className="h-6 w-6" />
          Team Management
        </h1>
        <p className="text-muted-foreground">
          Create team accounts, manage roles, and organize your league members.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Initial Roster Reconciliation</CardTitle>
            <CardDescription>
              One-time onboarding: every rostered player must resolve to an MLB API ID before reconciliation is complete.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Status:</span>
              <Badge
                variant={onboardingProgress.isComplete ? "default" : "secondary"}
                data-testid="badge-roster-onboarding-status"
              >
                {onboardingProgress.isComplete ? "Complete" : onboardingProgress.isPending ? "Not Started" : "In Progress"}
              </Badge>
              {onboardingProgress.remaining > 0 && (
                <Link href="/commissioner/reconciliation">
                  <span className="cursor-pointer text-amber-700 underline underline-offset-2" data-testid="text-roster-onboarding-unresolved">
                    {onboardingProgress.remaining} onboarding items remain
                  </span>
                </Link>
              )}
              {onboardingProgress.unresolved > 0 && (
                <span className="text-amber-700" data-testid="text-roster-onboarding-unresolved-breakdown">
                  {onboardingProgress.unresolved} unresolved matches
                </span>
              )}
              {onboardingProgress.errors > 0 && (
                <span className="text-destructive" data-testid="text-roster-onboarding-errors">
                  {onboardingProgress.errors} CSV row errors
                </span>
              )}
            </div>
            <div className="rounded-md border bg-muted/20 p-3 space-y-2" data-testid="roster-onboarding-progress">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Onboarding Progress</div>
                <div className="text-sm font-semibold" data-testid="text-roster-onboarding-percent">
                  {onboardingProgress.isPending ? "N/A" : `${onboardingProgress.percent}%`}
                </div>
              </div>
              <Progress value={onboardingProgress.isPending ? 0 : onboardingProgress.percent} className="h-3" />
              <div className="text-xs text-muted-foreground">
                {onboardingProgress.processed > 0
                  ? `${onboardingProgress.resolved} of ${onboardingProgress.processed} rows resolved`
                  : "Not started. Run the initial reconciliation upload to begin tracking."}
              </div>
              {onboardingProgress.processed > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline">Resolved: {onboardingProgress.resolved}</Badge>
                  <Badge variant="outline">Remaining: {onboardingProgress.remaining}</Badge>
                </div>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Workflow:
              <span> 1) Run reconciliation upload once for initial seeding.</span>
              <span> 2) Resolve all unmatched rows and CSV errors until status is Complete.</span>
              <span> 3) After completion, stop re-uploading and manage moves directly on-site.</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href="/commissioner/reconciliation">
                <Button variant="outline" data-testid="button-open-roster-reconciliation">Open MLB/MiLB Reconciliation</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Team Owners
            </CardTitle>
            <CardDescription>
              Upload a CSV file to create team accounts. Required: email. Optional: first_name, last_name, team_name
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadedCredentials.length > 0 && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 space-y-3">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  {uploadedCredentials.length} users created successfully!
                </p>
                <Button onClick={downloadCredentials} variant="outline" className="w-full" data-testid="button-download-credentials">
                  <Download className="mr-2 h-4 w-4" />
                  Download Credentials CSV
                </Button>
                <p className="text-xs text-muted-foreground">Share these temporary passwords securely with your team owners.</p>
              </div>
            )}

            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${usersDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}`}
              onDragEnter={handleUserDrag}
              onDragLeave={handleUserDrag}
              onDragOver={handleUserDrag}
              onDrop={handleUserDrop}
            >
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Drag and drop a CSV file here, or click to select</p>
              <input type="file" accept=".csv" onChange={handleUserFileSelect} className="hidden" id="user-csv-upload" data-testid="input-user-csv-upload" />
              <Button variant="outline" size="sm" asChild>
                <label htmlFor="user-csv-upload" className="cursor-pointer">Select CSV File</label>
              </Button>
            </div>

            {parsedUsers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Preview ({parsedUsers.length} users)</h4>
                  <Button variant="ghost" size="sm" onClick={() => setParsedUsers([])}>
                    <Trash2 className="h-4 w-4 mr-1" />Clear
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Abbr</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedUsers.slice(0, 10).map((u, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{u.email}</TableCell>
                          <TableCell>{u.firstName || ""} {u.lastName || ""}</TableCell>
                          <TableCell>{u.teamName || "-"}</TableCell>
                          <TableCell>{u.teamAbbreviation || "-"}</TableCell>
                        </TableRow>
                      ))}
                      {parsedUsers.length > 10 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">... and {parsedUsers.length - 10} more users</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" data-testid="button-upload-users">
                      <Upload className="h-4 w-4 mr-2" />Create {parsedUsers.length} Users
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm User Creation</AlertDialogTitle>
                      <AlertDialogDescription>This will create {parsedUsers.length} new user accounts with auto-generated passwords. You will be able to download a CSV with their login credentials.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => uploadUsers.mutate(parsedUsers)} disabled={uploadUsers.isPending}>
                        {uploadUsers.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Users"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Teams
            </CardTitle>
            <CardDescription>View and manage team accounts. Teams enrolled in auctions can be archived instead of deleted.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingOwners ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Tabs defaultValue="active" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="active" data-testid="tab-active-teams">Active ({owners?.filter(o => !o.isArchived).length || 0})</TabsTrigger>
                  <TabsTrigger value="archived" data-testid="tab-archived-teams">Archived ({owners?.filter(o => o.isArchived).length || 0})</TabsTrigger>
                </TabsList>
                <TabsContent value="active">
                  {owners && owners.filter(o => !o.isArchived).length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead>Abbr</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {owners.filter(o => !o.isArchived).map((owner) => (
                            <TableRow key={owner.id}>
                              <TableCell className="font-medium">{owner.email}</TableCell>
                              <TableCell>{owner.firstName || ""} {owner.lastName || ""}</TableCell>
                              <TableCell>{owner.teamName || "-"}</TableCell>
                              <TableCell>{owner.teamAbbreviation || "-"}</TableCell>
                              <TableCell>
                                {owner.isSuperAdmin ? (
                                  <Badge variant="default" className="bg-purple-600">Super Admin</Badge>
                                ) : isLeagueCommissionerForUser(owner.id) ? (
                                  <Badge variant="default" className="bg-amber-600">Commissioner</Badge>
                                ) : (
                                  <span className="text-muted-foreground text-sm">Owner</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingTeam(owner); setEditEmail(owner.email); setEditFirstName(owner.firstName || ""); setEditLastName(owner.lastName || ""); setEditTeamName(owner.teamName || ""); setEditTeamAbbreviation(owner.teamAbbreviation || ""); }} title="Edit team details" data-testid={`button-edit-team-${owner.id}`}>
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setInviteTargetUserId(owner.id);
                                      setInviteTargetTeamName(owner.teamName || owner.email);
                                      setInviteEmail("");
                                      setLatestInviteUrl("");
                                      setInviteDialogOpen(true);
                                    }}
                                    title="Invite new owner for this team"
                                    data-testid={`button-invite-transfer-${owner.id}`}
                                  >
                                    <MailPlus className="h-4 w-4" />
                                  </Button>
                                  {user?.isSuperAdmin && !owner.isSuperAdmin && (
                                    isLeagueCommissionerForUser(owner.id) ? (
                                      <Button size="sm" variant="ghost" onClick={() => setCommissioner.mutate({ userId: owner.id, isCommissioner: false })} disabled={setCommissioner.isPending} title="Revoke Commissioner for this league" data-testid={`button-revoke-commissioner-${owner.id}`}>
                                        <Crown className="h-4 w-4 text-amber-600" />
                                      </Button>
                                    ) : (
                                      <Button size="sm" variant="ghost" onClick={() => setCommissioner.mutate({ userId: owner.id, isCommissioner: true })} disabled={setCommissioner.isPending} title="Make Commissioner for this league" data-testid={`button-make-commissioner-${owner.id}`}>
                                        <Crown className="h-4 w-4" />
                                      </Button>
                                    )
                                  )}
                                  <Button size="sm" variant="ghost" onClick={() => archiveTeam.mutate({ userId: owner.id, isArchived: true })} disabled={archiveTeam.isPending} title="Archive team" data-testid={`button-archive-team-${owner.id}`}>
                                    <Archive className="h-4 w-4" />
                                  </Button>
                                  <Dialog open={deleteTeamId === owner.id} onOpenChange={(open) => { if (!open) { setDeleteTeamId(null); setDeletingTeamName(""); } }}>
                                    <Button size="sm" variant="ghost" onClick={() => { setDeleteTeamId(owner.id); setDeletingTeamName(owner.teamName || owner.email); }} data-testid={`button-delete-team-${owner.id}`}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                    {deleteTeamId === owner.id && (
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle>Delete Team</DialogTitle>
                                          <DialogDescription>Are you sure you want to delete "{deletingTeamName}"? This action cannot be undone. Teams that are enrolled in auctions or have bid history cannot be deleted - consider archiving instead.</DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                          <Button variant="outline" onClick={() => { setDeleteTeamId(null); setDeletingTeamName(""); }}>Cancel</Button>
                                          <Button variant="destructive" onClick={() => deleteTeam.mutate(owner.id)} disabled={deleteTeam.isPending} data-testid="button-confirm-delete-team">
                                            {deleteTeam.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : "Delete Team"}
                                          </Button>
                                        </DialogFooter>
                                      </DialogContent>
                                    )}
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
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No active teams. Upload a CSV file above to create team accounts.</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="archived">
                  {owners && owners.filter(o => o.isArchived).length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead>Abbr</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {owners.filter(o => o.isArchived).map((owner) => (
                            <TableRow key={owner.id}>
                              <TableCell className="font-medium">{owner.email}</TableCell>
                              <TableCell>{owner.firstName || ""} {owner.lastName || ""}</TableCell>
                              <TableCell>{owner.teamName || "-"}</TableCell>
                              <TableCell>{owner.teamAbbreviation || "-"}</TableCell>
                              <TableCell>
                                {owner.isSuperAdmin ? (
                                  <Badge variant="default" className="bg-purple-600">Super Admin</Badge>
                                ) : isLeagueCommissionerForUser(owner.id) ? (
                                  <Badge variant="default" className="bg-amber-600">Commissioner</Badge>
                                ) : (
                                  <span className="text-muted-foreground text-sm">Owner</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="ghost" onClick={() => archiveTeam.mutate({ userId: owner.id, isArchived: false })} disabled={archiveTeam.isPending} title="Restore team" data-testid={`button-restore-team-${owner.id}`}>
                                  <ArchiveRestore className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No archived teams.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
            <div className="mt-6 space-y-2">
              <h4 className="text-sm font-medium">Ownership Transfer Invites</h4>
              {!teamInvites || teamInvites.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invites yet.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamInvites.slice(0, 20).map((invite) => (
                        <TableRow key={invite.id}>
                          <TableCell>{invite.teamName || invite.teamAbbreviation || invite.teamUserId}</TableCell>
                          <TableCell>{invite.invitedEmail}</TableCell>
                          <TableCell>
                            <Badge variant={invite.status === "pending" ? "secondary" : "outline"}>{invite.status}</Badge>
                          </TableCell>
                          <TableCell>{new Date(invite.expiresAt).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {invite.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => cancelTeamInvite.mutate(invite.id)}
                                  data-testid={`button-cancel-team-invite-${invite.id}`}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New Team Owner</DialogTitle>
            <DialogDescription>
              Send an invite for <span className="font-medium">{inviteTargetTeamName}</span>. Existing users can sign in and accept. New users can register and accept.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Invite Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="newowner@example.com"
                data-testid="input-team-invite-email"
              />
            </div>
            {latestInviteUrl && (
              <div className="rounded-md border bg-muted/20 p-2 space-y-2">
                <p className="text-xs font-medium">Invite Link</p>
                <p className="text-xs break-all">{latestInviteUrl}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(latestInviteUrl);
                    toast({ title: "Invite link copied" });
                  }}
                  data-testid="button-copy-team-invite-link"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Close</Button>
            <Button
              onClick={() => createTeamInvite.mutate({ teamUserId: inviteTargetUserId, email: inviteEmail })}
              disabled={createTeamInvite.isPending || !inviteTargetUserId || !inviteEmail.trim()}
              data-testid="button-send-team-invite"
            >
              {createTeamInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTeam} onOpenChange={(open) => !open && setEditingTeam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Details</DialogTitle>
            <DialogDescription>Update the team's email, name, team name, and abbreviation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} data-testid="input-edit-email" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-first-name">First Name</Label>
                <Input id="edit-first-name" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} data-testid="input-edit-first-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-last-name">Last Name</Label>
                <Input id="edit-last-name" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} data-testid="input-edit-last-name" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-team-name">Team Name</Label>
                <Input id="edit-team-name" value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} data-testid="input-edit-team-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-team-abbreviation">Abbr</Label>
                <Input id="edit-team-abbreviation" value={editTeamAbbreviation} onChange={(e) => setEditTeamAbbreviation(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} data-testid="input-edit-team-abbreviation" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTeam(null)}>Cancel</Button>
            <Button
              onClick={() => { if (editingTeam) { updateTeamDetails.mutate({ userId: editingTeam.id, details: { email: editEmail, firstName: editFirstName, lastName: editLastName, teamName: editTeamName, teamAbbreviation: editTeamAbbreviation } }); } }}
              disabled={updateTeamDetails.isPending || !editEmail}
              data-testid="button-save-team"
            >
              {updateTeamDetails.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
