import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
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
import type { League, LeagueMember, User } from "@shared/schema";
import { Plus, Users, Globe, Loader2, Crown, Trash2, UserPlus, Pencil, Key, Database, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function MlbPlayerSync() {
  const { toast } = useToast();
  const [syncSeason, setSyncSeason] = useState(new Date().getFullYear());
  
  const { data: status, isLoading: loadingStatus } = useQuery<{
    total: number;
    byLevel: { MLB: number; AAA: number; AA: number; Rookie: number };
  }>({
    queryKey: ["/api/admin/mlb-players/status"],
  });

  const syncMutation = useMutation({
    mutationFn: async (season: number) => {
      const res = await apiRequest("POST", "/api/admin/mlb-players/sync", { season });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync Complete",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mlb-players/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const currentYear = new Date().getFullYear();
  const seasonOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <Select
          value={syncSeason.toString()}
          onValueChange={(v) => setSyncSeason(parseInt(v))}
        >
          <SelectTrigger className="w-32" data-testid="select-mlb-season">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {seasonOptions.map((yr) => (
              <SelectItem key={yr} value={yr.toString()}>
                {yr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => syncMutation.mutate(syncSeason)}
          disabled={syncMutation.isPending}
          data-testid="button-sync-mlb-players"
        >
          {syncMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync {syncSeason} Players
            </>
          )}
        </Button>
      </div>

      {loadingStatus ? (
        <Skeleton className="h-20 w-full" />
      ) : status && status.total > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="text-center p-3 rounded-md bg-muted/50">
            <div className="text-2xl font-bold" data-testid="text-mlb-total">{status.total.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Players</div>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/50">
            <div className="text-lg font-semibold" data-testid="text-mlb-mlb">{status.byLevel.MLB.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">MLB</div>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/50">
            <div className="text-lg font-semibold" data-testid="text-mlb-aaa">{status.byLevel.AAA.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">AAA</div>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/50">
            <div className="text-lg font-semibold" data-testid="text-mlb-aa">{status.byLevel.AA.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">AA</div>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/50">
            <div className="text-lg font-semibold" data-testid="text-mlb-rookie">{status.byLevel.Rookie.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Rookie</div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          <Database className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No players synced yet. Click the sync button to populate the database.</p>
        </div>
      )}
    </div>
  );
}

export default function SuperAdmin() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [createLeagueDialogOpen, setCreateLeagueDialogOpen] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [newLeagueSlug, setNewLeagueSlug] = useState("");
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [selectedLeagueForMember, setSelectedLeagueForMember] = useState<number | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"owner" | "commissioner">("owner");
  const [memberTeamName, setMemberTeamName] = useState("");
  const [memberTeamAbbreviation, setMemberTeamAbbreviation] = useState("");
  const [viewingLeagueId, setViewingLeagueId] = useState<number | null>(null);
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<(LeagueMember & { user?: User }) | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamAbbreviation, setEditTeamAbbreviation] = useState("");
  const [setPasswordDialogOpen, setSetPasswordDialogOpen] = useState(false);
  const [passwordMember, setPasswordMember] = useState<(LeagueMember & { user?: User }) | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: allLeagues, isLoading: loadingLeagues } = useQuery<League[]>({
    queryKey: ["/api/leagues"],
    queryFn: async () => {
      const res = await fetch("/api/leagues", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leagues");
      return res.json();
    },
    enabled: isAuthenticated && user?.isSuperAdmin,
  });

  const { data: leagueMembers, isLoading: loadingMembers } = useQuery<(LeagueMember & { user?: User })[]>({
    queryKey: ["/api/leagues", viewingLeagueId, "members"],
    queryFn: async () => {
      if (!viewingLeagueId) return [];
      const res = await fetch(`/api/leagues/${viewingLeagueId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: isAuthenticated && user?.isSuperAdmin && !!viewingLeagueId,
  });

  const createLeague = useMutation({
    mutationFn: async (data: { name: string; slug: string }) => {
      const res = await apiRequest("POST", "/api/leagues", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "League Created", description: "New league has been created." });
      setCreateLeagueDialogOpen(false);
      setNewLeagueName("");
      setNewLeagueSlug("");
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addLeagueMember = useMutation({
    mutationFn: async (data: { leagueId: number; email: string; role: "owner" | "commissioner"; teamName?: string; teamAbbreviation?: string }) => {
      const res = await apiRequest("POST", `/api/leagues/${data.leagueId}/members`, { 
        email: data.email, 
        role: data.role,
        teamName: data.teamName,
        teamAbbreviation: data.teamAbbreviation
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Member Added", description: "User has been added to the league." });
      setAddMemberDialogOpen(false);
      setMemberEmail("");
      setMemberRole("owner");
      setMemberTeamName("");
      setMemberTeamAbbreviation("");
      setSelectedLeagueForMember(null);
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", viewingLeagueId, "members"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: async (data: { leagueId: number; userId: string; role: "owner" | "commissioner" }) => {
      const res = await apiRequest("PATCH", `/api/leagues/${data.leagueId}/members/${data.userId}`, { 
        role: data.role 
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Role Updated", description: "Member role has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", viewingLeagueId, "members"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMemberTeam = useMutation({
    mutationFn: async (data: { leagueId: number; userId: string; teamName: string; teamAbbreviation: string }) => {
      const res = await apiRequest("PATCH", `/api/leagues/${data.leagueId}/members/${data.userId}`, { 
        teamName: data.teamName,
        teamAbbreviation: data.teamAbbreviation
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Team Updated", description: "Team name and abbreviation have been updated." });
      setEditMemberDialogOpen(false);
      setEditingMember(null);
      setEditTeamName("");
      setEditTeamAbbreviation("");
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", viewingLeagueId, "members"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const setUserPassword = useMutation({
    mutationFn: async (data: { userId: string; password: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${data.userId}/set-password`, { 
        password: data.password
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password Set", description: "User password has been updated." });
      setSetPasswordDialogOpen(false);
      setPasswordMember(null);
      setNewPassword("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeLeagueMember = useMutation({
    mutationFn: async (data: { leagueId: number; userId: string }) => {
      const res = await fetch(`/api/leagues/${data.leagueId}/members/${data.userId}`, { 
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to remove member");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Member Removed", description: "User has been removed from the league." });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", viewingLeagueId, "members"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAuthenticated || !user?.isSuperAdmin) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Super Admin Access Required</h2>
            <p className="text-muted-foreground">
              Only super admins can access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Globe className="h-8 w-8" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-super-admin-title">Super Admin</h1>
          <p className="text-muted-foreground">Manage leagues and platform-wide settings</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            League Management
          </CardTitle>
          <CardDescription>
            Create and manage leagues across the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setCreateLeagueDialogOpen(true)}
              data-testid="button-create-league"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create League
            </Button>
          </div>

          {loadingLeagues ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : allLeagues && allLeagues.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allLeagues.map((league) => (
                  <TableRow key={league.id} data-testid={`row-league-${league.id}`}>
                    <TableCell className="font-medium" data-testid={`text-league-name-${league.id}`}>{league.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid={`badge-league-slug-${league.id}`}>{league.slug}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setViewingLeagueId(league.id);
                          }}
                          data-testid={`button-view-members-${league.id}`}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Members
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLeagueForMember(league.id);
                            setAddMemberDialogOpen(true);
                          }}
                          data-testid={`button-add-member-${league.id}`}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add Member
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No leagues yet. Create your first league to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {viewingLeagueId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              League Members
              {allLeagues && (
                <Badge variant="outline" className="ml-2">
                  {allLeagues.find(l => l.id === viewingLeagueId)?.name}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Manage members and their roles in this league
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingLeagueId(null)}
              >
                Close
              </Button>
            </div>
            {loadingMembers ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : leagueMembers && leagueMembers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leagueMembers.map((member) => (
                    <TableRow key={member.userId} data-testid={`row-member-${member.userId}`}>
                      <TableCell className="font-medium">
                        {member.user?.email || member.userId}
                      </TableCell>
                      <TableCell>
                        {member.user?.firstName || ""} {member.user?.lastName || ""}
                      </TableCell>
                      <TableCell>
                        {member.teamName || "-"}
                      </TableCell>
                      <TableCell>
                        {member.role === "commissioner" ? (
                          <Badge variant="default">
                            <Crown className="h-3 w-3 mr-1" />
                            Commissioner
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Owner</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {member.role === "commissioner" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateMemberRole.mutate({
                                leagueId: viewingLeagueId,
                                userId: member.userId,
                                role: "owner"
                              })}
                              disabled={updateMemberRole.isPending}
                              data-testid={`button-demote-${member.userId}`}
                            >
                              Demote to Owner
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateMemberRole.mutate({
                                leagueId: viewingLeagueId,
                                userId: member.userId,
                                role: "commissioner"
                              })}
                              disabled={updateMemberRole.isPending}
                              data-testid={`button-promote-${member.userId}`}
                            >
                              <Crown className="h-3 w-3 mr-1" />
                              Make Commissioner
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingMember(member);
                              setEditTeamName(member.teamName || "");
                              setEditTeamAbbreviation(member.teamAbbreviation || "");
                              setEditMemberDialogOpen(true);
                            }}
                            data-testid={`button-edit-member-${member.userId}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPasswordMember(member);
                              setNewPassword("");
                              setSetPasswordDialogOpen(true);
                            }}
                            data-testid={`button-set-password-${member.userId}`}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLeagueMember.mutate({
                              leagueId: viewingLeagueId,
                              userId: member.userId
                            })}
                            disabled={removeLeagueMember.isPending}
                            data-testid={`button-remove-member-${member.userId}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No members in this league yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-mlb-player-database">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Globe className="h-5 w-5" />
              MLB Player Database
            </CardTitle>
            <CardDescription>
              Sync affiliated baseball players from the MLB API (MLB, AAA, AA, Rookie excl. DSL)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <MlbPlayerSync />
        </CardContent>
      </Card>

      <Dialog open={createLeagueDialogOpen} onOpenChange={setCreateLeagueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New League</DialogTitle>
            <DialogDescription>
              Enter details for the new league.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="league-name">League Name</Label>
              <Input
                id="league-name"
                placeholder="e.g., CBL Fantasy League"
                value={newLeagueName}
                onChange={(e) => {
                  setNewLeagueName(e.target.value);
                  setNewLeagueSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                }}
                data-testid="input-league-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="league-slug">Slug</Label>
              <Input
                id="league-slug"
                placeholder="cbl-fantasy-league"
                value={newLeagueSlug}
                onChange={(e) => setNewLeagueSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                data-testid="input-league-slug"
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier for the league
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateLeagueDialogOpen(false);
                setNewLeagueName("");
                setNewLeagueSlug("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createLeague.mutate({ name: newLeagueName, slug: newLeagueSlug })}
              disabled={!newLeagueName.trim() || !newLeagueSlug.trim() || createLeague.isPending}
              data-testid="button-confirm-create-league"
            >
              {createLeague.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create League"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add League Member</DialogTitle>
            <DialogDescription>
              Add an existing user to this league.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="member-email">User Email</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="user@example.com"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                data-testid="input-member-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-role">Role</Label>
              <Select value={memberRole} onValueChange={(v: "owner" | "commissioner") => setMemberRole(v)}>
                <SelectTrigger data-testid="select-member-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="commissioner">Commissioner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-team-name">Team Name (for this league)</Label>
              <Input
                id="member-team-name"
                placeholder="e.g., Springfield Isotopes"
                value={memberTeamName}
                onChange={(e) => setMemberTeamName(e.target.value)}
                data-testid="input-member-team-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-team-abbr">Team Abbreviation</Label>
              <Input
                id="member-team-abbr"
                placeholder="e.g., SPR"
                maxLength={3}
                value={memberTeamAbbreviation}
                onChange={(e) => setMemberTeamAbbreviation(e.target.value.toUpperCase())}
                data-testid="input-member-team-abbr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddMemberDialogOpen(false);
                setMemberEmail("");
                setMemberRole("owner");
                setMemberTeamName("");
                setMemberTeamAbbreviation("");
                setSelectedLeagueForMember(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedLeagueForMember) {
                  addLeagueMember.mutate({
                    leagueId: selectedLeagueForMember,
                    email: memberEmail,
                    role: memberRole,
                    teamName: memberTeamName || undefined,
                    teamAbbreviation: memberTeamAbbreviation || undefined
                  });
                }
              }}
              disabled={!memberEmail.trim() || !selectedLeagueForMember || addLeagueMember.isPending}
              data-testid="button-confirm-add-member"
            >
              {addLeagueMember.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Member"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editMemberDialogOpen} onOpenChange={setEditMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Info</DialogTitle>
            <DialogDescription>
              Update team name and abbreviation for {editingMember?.user?.firstName || "this member"} in this league.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Team Name</Label>
              <Input
                id="edit-team-name"
                placeholder="e.g., Springfield Isotopes"
                value={editTeamName}
                onChange={(e) => setEditTeamName(e.target.value)}
                data-testid="input-edit-team-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-abbr">Team Abbreviation</Label>
              <Input
                id="edit-team-abbr"
                placeholder="e.g., SPR"
                maxLength={3}
                value={editTeamAbbreviation}
                onChange={(e) => setEditTeamAbbreviation(e.target.value.toUpperCase())}
                data-testid="input-edit-team-abbr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditMemberDialogOpen(false);
                setEditingMember(null);
                setEditTeamName("");
                setEditTeamAbbreviation("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (viewingLeagueId && editingMember) {
                  updateMemberTeam.mutate({
                    leagueId: viewingLeagueId,
                    userId: editingMember.userId,
                    teamName: editTeamName,
                    teamAbbreviation: editTeamAbbreviation
                  });
                }
              }}
              disabled={updateMemberTeam.isPending}
              data-testid="button-confirm-edit-member"
            >
              {updateMemberTeam.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={setPasswordDialogOpen} onOpenChange={setSetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Password</DialogTitle>
            <DialogDescription>
              Set a new password for {passwordMember?.user?.firstName || passwordMember?.user?.email || "this user"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="text"
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSetPasswordDialogOpen(false);
                setPasswordMember(null);
                setNewPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (passwordMember) {
                  setUserPassword.mutate({
                    userId: passwordMember.userId,
                    password: newPassword
                  });
                }
              }}
              disabled={newPassword.length < 6 || setUserPassword.isPending}
              data-testid="button-confirm-set-password"
            >
              {setUserPassword.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting...
                </>
              ) : (
                "Set Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
