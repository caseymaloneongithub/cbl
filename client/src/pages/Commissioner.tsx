import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
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
import type { LeagueSettings, User, Auction } from "@shared/schema";
import { Upload, Settings, Users, Loader2, FileSpreadsheet, Trash2, Crown, Download, DollarSign, Plus, Trophy, RotateCcw, Play, Eye, Edit2, Check, X, Archive, ArchiveRestore } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const settingsSchema = z.object({
  yearFactor1: z.number().min(0.1).max(10),
  yearFactor2: z.number().min(0.1).max(10),
  yearFactor3: z.number().min(0.1).max(10),
  yearFactor4: z.number().min(0.1).max(10),
  yearFactor5: z.number().min(0.1).max(10),
  defaultBudget: z.number().min(1).max(10000),
  enforceBudget: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface ParsedUser {
  email: string;
  firstName?: string;
  lastName?: string;
  teamName?: string;
  teamAbbreviation?: string;
  password?: string;
}

export default function Commissioner() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedLeagueId, currentLeague, isLeagueCommissioner, isLoadingLeagues } = useLeague();
  const { toast } = useToast();
  
  // Export state
  const [exportingResults, setExportingResults] = useState(false);
  const [exportingRosters, setExportingRosters] = useState(false);
  const [selectedAuctionForExport, setSelectedAuctionForExport] = useState<string>("");
  
  // User upload state
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [usersDragActive, setUsersDragActive] = useState(false);
  const [uploadedCredentials, setUploadedCredentials] = useState<{ email: string; password: string }[]>([]);
  
  // Auction management state
  const [createAuctionDialogOpen, setCreateAuctionDialogOpen] = useState(false);
  const [newAuctionName, setNewAuctionName] = useState("");
  const [deleteAuctionId, setDeleteAuctionId] = useState<number | null>(null);
  const [resetAuctionId, setResetAuctionId] = useState<number | null>(null);
  const [passwordForAction, setPasswordForAction] = useState("");
  const [editingAuctionId, setEditingAuctionId] = useState<number | null>(null);
  const [editingAuctionName, setEditingAuctionName] = useState("");
  
  // Team deletion state
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const [deletingTeamName, setDeletingTeamName] = useState("");
  
  // Team editing state
  const [editingTeam, setEditingTeam] = useState<User | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamAbbreviation, setEditTeamAbbreviation] = useState("");
  

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: settings, isLoading: loadingSettings } = useQuery<LeagueSettings>({
    queryKey: ["/api/settings"],
    enabled: isAuthenticated && (user?.isCommissioner || user?.isSuperAdmin),
  });

  const { data: owners, isLoading: loadingOwners } = useQuery<User[]>({
    queryKey: ["/api/owners", selectedLeagueId],
    queryFn: async () => {
      const url = selectedLeagueId 
        ? `/api/owners?leagueId=${selectedLeagueId}` 
        : "/api/owners";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch owners");
      return res.json();
    },
    enabled: isAuthenticated && (user?.isCommissioner || user?.isSuperAdmin) && !!selectedLeagueId,
  });

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
    enabled: isAuthenticated && (user?.isCommissioner || user?.isSuperAdmin) && !!selectedLeagueId,
  });


  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      yearFactor1: 1.0,
      yearFactor2: 1.25,
      yearFactor3: 1.33,
      yearFactor4: 1.43,
      yearFactor5: 1.55,
      defaultBudget: 260,
      enforceBudget: true,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        yearFactor1: settings.yearFactor1,
        yearFactor2: settings.yearFactor2,
        yearFactor3: settings.yearFactor3,
        yearFactor4: settings.yearFactor4,
        yearFactor5: settings.yearFactor5,
        defaultBudget: settings.defaultBudget,
        enforceBudget: settings.enforceBudget,
      });
    }
  }, [settings, form]);

  const updateSettings = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      await apiRequest("PATCH", "/api/settings", data);
    },
    onSuccess: () => {
      toast({ title: "Settings Updated", description: "Year factors have been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const makeCommissioner = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("PATCH", `/api/owners/${userId}/commissioner`, { isCommissioner: true });
    },
    onSuccess: () => {
      toast({ title: "Commissioner Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/owners", selectedLeagueId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const uploadUsers = useMutation({
    mutationFn: async (users: ParsedUser[]) => {
      const res = await apiRequest("POST", "/api/users/bulk", { users });
      return res.json();
    },
    onSuccess: (data) => {
      const successCount = data.results.filter((r: any) => r.success).length;
      const credentials = data.results
        .filter((r: any) => r.success && r.password)
        .map((r: any) => ({ email: r.email, password: r.password }));
      
      setUploadedCredentials(credentials);
      
      toast({
        title: "Users Created",
        description: `${successCount} users have been created. Download credentials below.`,
      });
      setParsedUsers([]);
      queryClient.invalidateQueries({ queryKey: ["/api/owners", selectedLeagueId] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });

  // Auction mutations
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

  // Team deletion mutation
  const deleteTeam = useMutation({
    mutationFn: async (userId: string) => {
      const url = selectedLeagueId 
        ? `/api/owners/${userId}?leagueId=${selectedLeagueId}` 
        : `/api/owners/${userId}`;
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete team");
      }
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

  // Team archive/unarchive mutation
  const archiveTeam = useMutation({
    mutationFn: async ({ userId, isArchived }: { userId: string; isArchived: boolean }) => {
      const url = selectedLeagueId 
        ? `/api/owners/${userId}/archive?leagueId=${selectedLeagueId}` 
        : `/api/owners/${userId}/archive`;
      const res = await fetch(url, { 
        method: "PATCH", 
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to update team");
      }
      return res.json();
    },
    onSuccess: (_, { isArchived }) => {
      toast({ 
        title: isArchived ? "Team Archived" : "Team Restored", 
        description: isArchived ? "The team has been moved to the archive." : "The team has been restored to active."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/owners", selectedLeagueId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const setCommissioner = useMutation({
    mutationFn: async ({ userId, isCommissioner }: { userId: string; isCommissioner: boolean }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/commissioner`, { isCommissioner });
      return res.json();
    },
    onSuccess: (_, { isCommissioner }) => {
      toast({ 
        title: isCommissioner ? "Commissioner Assigned" : "Commissioner Removed", 
        description: isCommissioner ? "The team has been granted commissioner access." : "Commissioner access has been revoked."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/owners", selectedLeagueId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTeamDetails = useMutation({
    mutationFn: async ({ userId, details }: { userId: string; details: { email?: string; firstName?: string; lastName?: string; teamName?: string; teamAbbreviation?: string } }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}`, details);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Team Updated", description: "Team details have been saved." });
      setEditingTeam(null);
      queryClient.invalidateQueries({ queryKey: ["/api/owners", selectedLeagueId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      toast({
        title: "Invalid CSV",
        description: "CSV must have 'email' column",
        variant: "destructive",
      });
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
    if (e.type === "dragenter" || e.type === "dragover") {
      setUsersDragActive(true);
    } else if (e.type === "dragleave") {
      setUsersDragActive(false);
    }
  }, []);

  const handleUserDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUsersDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === "text/csv") {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseUserCSV(text);
      };
      reader.readAsText(file);
    }
  }, [parseUserCSV]);

  const handleUserFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseUserCSV(text);
      };
      reader.readAsText(file);
    }
  }, [parseUserCSV]);

  const downloadCredentials = useCallback(() => {
    if (uploadedCredentials.length === 0) return;
    
    const csv = "Email,Temporary Password\n" + 
      uploadedCredentials.map(c => `${c.email},${c.password}`).join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user-credentials.csv";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast({
      title: "Credentials Downloaded",
      description: "Share these credentials securely with your team owners.",
    });
    setUploadedCredentials([]);
  }, [uploadedCredentials, toast]);

  const handleExportResults = async () => {
    setExportingResults(true);
    try {
      const url = selectedAuctionForExport && selectedAuctionForExport !== "all"
        ? `/api/exports/auction-results.csv?auctionId=${selectedAuctionForExport}`
        : "/api/exports/auction-results.csv";
      const response = await fetch(url, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to export");
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const auctionName = selectedAuctionForExport && selectedAuctionForExport !== "all"
        ? allAuctions?.find(a => String(a.id) === selectedAuctionForExport)?.name || "auction"
        : "all-auctions";
      a.download = `auction-results-${auctionName.toLowerCase().replace(/\s+/g, "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      
      toast({
        title: "Export Complete",
        description: "Auction results have been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not export auction results.",
        variant: "destructive",
      });
    } finally {
      setExportingResults(false);
    }
  };

  const handleExportRosters = async () => {
    setExportingRosters(true);
    try {
      const url = selectedAuctionForExport && selectedAuctionForExport !== "all"
        ? `/api/exports/final-rosters.csv?auctionId=${selectedAuctionForExport}`
        : "/api/exports/final-rosters.csv";
      const response = await fetch(url, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to export");
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const auctionName = selectedAuctionForExport && selectedAuctionForExport !== "all"
        ? allAuctions?.find(a => String(a.id) === selectedAuctionForExport)?.name || "auction"
        : "all-auctions";
      a.download = `final-rosters-${auctionName.toLowerCase().replace(/\s+/g, "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      
      toast({
        title: "Export Complete",
        description: "Final rosters have been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not export final rosters.",
        variant: "destructive",
      });
    } finally {
      setExportingRosters(false);
    }
  };

  if (authLoading || isLoadingLeagues) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-64 mb-8" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!user?.isCommissioner && !user?.isSuperAdmin) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Commissioner Access Required</h3>
            <p className="text-muted-foreground">
              Only the league commissioner or super admin can access these settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          CBL Auctions
        </h1>
        <p className="text-muted-foreground">
          Manage league auctions and team accounts. Click "Manage" on any auction to configure its settings, teams, and free agents.
        </p>
      </div>

      {/* Auction Management - Full Width */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Auction Management
          </CardTitle>
          <CardDescription>
            Create, manage, and switch between different auctions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Create Auction Button and Dialog */}
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
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCreateAuctionDialogOpen(false);
                        setNewAuctionName("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => createAuction.mutate(newAuctionName)}
                      disabled={!newAuctionName.trim() || createAuction.isPending}
                      data-testid="button-confirm-create-auction"
                    >
                      {createAuction.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Auction"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Auctions List */}
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
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  updateAuction.mutate({ id: auction.id, data: { name: editingAuctionName } });
                                }}
                                disabled={updateAuction.isPending}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingAuctionId(null);
                                  setEditingAuctionName("");
                                }}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{auction.name}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingAuctionId(auction.id);
                                  setEditingAuctionName(auction.name);
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              auction.status === "active"
                                ? "default"
                                : auction.status === "completed"
                                ? "secondary"
                                : "outline"
                            }
                          >
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
                            {/* Manage Button - Links to per-auction page */}
                            <Link href={`/commissioner/auctions/${auction.id}`}>
                              <Button
                                size="sm"
                                variant="default"
                                data-testid={`button-manage-auction-${auction.id}`}
                              >
                                <Settings className="h-3 w-3 mr-1" />
                                Manage
                              </Button>
                            </Link>
                            
                            {auction.status !== "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAuction.mutate({ id: auction.id, data: { status: "active" } })}
                                disabled={updateAuction.isPending}
                                data-testid={`button-activate-auction-${auction.id}`}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Activate
                              </Button>
                            )}
                            {/* Reset Button */}
                            <Dialog open={resetAuctionId === auction.id} onOpenChange={(open) => {
                              if (!open) {
                                setResetAuctionId(null);
                                setPasswordForAction("");
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setResetAuctionId(auction.id)}
                                  data-testid={`button-reset-auction-${auction.id}`}
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Reset
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reset Auction</DialogTitle>
                                  <DialogDescription>
                                    This will clear ALL bids and reactivate all players in "{auction.name}".
                                    This action cannot be undone. Enter your password to confirm.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="reset-password">Password</Label>
                                    <Input
                                      id="reset-password"
                                      type="password"
                                      value={passwordForAction}
                                      onChange={(e) => setPasswordForAction(e.target.value)}
                                      placeholder="Enter your password"
                                      data-testid="input-reset-password"
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setResetAuctionId(null);
                                      setPasswordForAction("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={() => resetAuction.mutate({ id: auction.id, password: passwordForAction })}
                                    disabled={!passwordForAction || resetAuction.isPending}
                                    data-testid="button-confirm-reset"
                                  >
                                    {resetAuction.isPending ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Resetting...
                                      </>
                                    ) : (
                                      "Reset Auction"
                                    )}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            {/* Delete Button */}
                            <Dialog open={deleteAuctionId === auction.id} onOpenChange={(open) => {
                              if (!open) {
                                setDeleteAuctionId(null);
                                setPasswordForAction("");
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setDeleteAuctionId(auction.id)}
                                  data-testid={`button-delete-auction-${auction.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Delete Auction</DialogTitle>
                                  <DialogDescription>
                                    This will permanently delete "{auction.name}" including all players and bids.
                                    This action cannot be undone. Enter your password to confirm.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="delete-password">Password</Label>
                                    <Input
                                      id="delete-password"
                                      type="password"
                                      value={passwordForAction}
                                      onChange={(e) => setPasswordForAction(e.target.value)}
                                      placeholder="Enter your password"
                                      data-testid="input-delete-password"
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setDeleteAuctionId(null);
                                      setPasswordForAction("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={() => deleteAuction.mutate({ id: auction.id, password: passwordForAction })}
                                    disabled={!passwordForAction || deleteAuction.isPending}
                                    data-testid="button-confirm-delete"
                                  >
                                    {deleteAuction.isPending ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Deleting...
                                      </>
                                    ) : (
                                      "Delete Auction"
                                    )}
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

      <div className="grid gap-6 lg:grid-cols-1">
        {/* User Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Upload Team Owners
            </CardTitle>
            <CardDescription>
              Upload a CSV file to create team accounts. Required: email. Optional: first_name, last_name, team_name
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Credentials Download */}
            {uploadedCredentials.length > 0 && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 space-y-3">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  {uploadedCredentials.length} users created successfully!
                </p>
                <Button onClick={downloadCredentials} variant="outline" className="w-full" data-testid="button-download-credentials">
                  <Download className="mr-2 h-4 w-4" />
                  Download Credentials CSV
                </Button>
                <p className="text-xs text-muted-foreground">
                  Share these temporary passwords securely with your team owners.
                </p>
              </div>
            )}
            
            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                usersDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragEnter={handleUserDrag}
              onDragLeave={handleUserDrag}
              onDragOver={handleUserDrag}
              onDrop={handleUserDrop}
            >
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">
                Drag and drop a CSV file here, or click to select
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleUserFileSelect}
                className="hidden"
                id="user-csv-upload"
                data-testid="input-user-csv-upload"
              />
              <Button variant="outline" size="sm" asChild>
                <label htmlFor="user-csv-upload" className="cursor-pointer">
                  Select CSV File
                </label>
              </Button>
            </div>

            {/* Preview Table */}
            {parsedUsers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    Preview ({parsedUsers.length} users)
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setParsedUsers([])}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear
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
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            ... and {parsedUsers.length - 10} more users
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" data-testid="button-upload-users">
                      <Upload className="h-4 w-4 mr-2" />
                      Create {parsedUsers.length} Users
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm User Creation</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will create {parsedUsers.length} new user accounts with auto-generated passwords.
                        You will be able to download a CSV with their login credentials.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => uploadUsers.mutate(parsedUsers)}
                        disabled={uploadUsers.isPending}
                      >
                        {uploadUsers.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Users"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Teams Card with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Teams
            </CardTitle>
            <CardDescription>
              View and manage team accounts. Teams enrolled in auctions can be archived instead of deleted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingOwners ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Tabs defaultValue="active" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="active" data-testid="tab-active-teams">
                    Active ({owners?.filter(o => !o.isArchived).length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="archived" data-testid="tab-archived-teams">
                    Archived ({owners?.filter(o => o.isArchived).length || 0})
                  </TabsTrigger>
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
                          {owners
                            .filter(o => !o.isArchived)
                            .map((owner) => (
                              <TableRow key={owner.id}>
                                <TableCell className="font-medium">{owner.email}</TableCell>
                                <TableCell>{owner.firstName || ""} {owner.lastName || ""}</TableCell>
                                <TableCell>{owner.teamName || "-"}</TableCell>
                                <TableCell>{owner.teamAbbreviation || "-"}</TableCell>
                                <TableCell>
                                  {owner.isSuperAdmin ? (
                                    <Badge variant="default" className="bg-purple-600">Super Admin</Badge>
                                  ) : owner.isCommissioner ? (
                                    <Badge variant="default" className="bg-amber-600">Commissioner</Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">Owner</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingTeam(owner);
                                        setEditEmail(owner.email);
                                        setEditFirstName(owner.firstName || "");
                                        setEditLastName(owner.lastName || "");
                                        setEditTeamName(owner.teamName || "");
                                        setEditTeamAbbreviation(owner.teamAbbreviation || "");
                                      }}
                                      title="Edit team details"
                                      data-testid={`button-edit-team-${owner.id}`}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    {user?.isSuperAdmin && !owner.isSuperAdmin && (
                                      owner.isCommissioner ? (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setCommissioner.mutate({ userId: owner.id, isCommissioner: false })}
                                          disabled={setCommissioner.isPending}
                                          title="Revoke Commissioner"
                                          data-testid={`button-revoke-commissioner-${owner.id}`}
                                        >
                                          <Crown className="h-4 w-4 text-amber-600" />
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setCommissioner.mutate({ userId: owner.id, isCommissioner: true })}
                                          disabled={setCommissioner.isPending}
                                          title="Make Commissioner"
                                          data-testid={`button-make-commissioner-${owner.id}`}
                                        >
                                          <Crown className="h-4 w-4" />
                                        </Button>
                                      )
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => archiveTeam.mutate({ userId: owner.id, isArchived: true })}
                                      disabled={archiveTeam.isPending}
                                      title="Archive team"
                                      data-testid={`button-archive-team-${owner.id}`}
                                    >
                                      <Archive className="h-4 w-4" />
                                    </Button>
                                    <Dialog open={deleteTeamId === owner.id} onOpenChange={(open) => {
                                      if (!open) {
                                        setDeleteTeamId(null);
                                        setDeletingTeamName("");
                                      }
                                    }}>
                                      <DialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setDeleteTeamId(owner.id);
                                            setDeletingTeamName(owner.teamName || owner.email);
                                          }}
                                          data-testid={`button-delete-team-${owner.id}`}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle>Delete Team</DialogTitle>
                                          <DialogDescription>
                                            Are you sure you want to delete "{deletingTeamName}"? This action cannot be undone.
                                            Teams that are enrolled in auctions or have bid history cannot be deleted - consider archiving instead.
                                          </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                          <Button
                                            variant="outline"
                                            onClick={() => {
                                              setDeleteTeamId(null);
                                              setDeletingTeamName("");
                                            }}
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            variant="destructive"
                                            onClick={() => deleteTeam.mutate(owner.id)}
                                            disabled={deleteTeam.isPending}
                                            data-testid="button-confirm-delete-team"
                                          >
                                            {deleteTeam.isPending ? (
                                              <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Deleting...
                                              </>
                                            ) : (
                                              "Delete Team"
                                            )}
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
                          {owners
                            .filter(o => o.isArchived)
                            .map((owner) => (
                              <TableRow key={owner.id}>
                                <TableCell className="font-medium">{owner.email}</TableCell>
                                <TableCell>{owner.firstName || ""} {owner.lastName || ""}</TableCell>
                                <TableCell>{owner.teamName || "-"}</TableCell>
                                <TableCell>{owner.teamAbbreviation || "-"}</TableCell>
                                <TableCell>
                                  {owner.isSuperAdmin ? (
                                    <Badge variant="default" className="bg-purple-600">Super Admin</Badge>
                                  ) : owner.isCommissioner ? (
                                    <Badge variant="default" className="bg-amber-600">Commissioner</Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">Owner</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => archiveTeam.mutate({ userId: owner.id, isArchived: false })}
                                    disabled={archiveTeam.isPending}
                                    title="Restore team"
                                    data-testid={`button-restore-team-${owner.id}`}
                                  >
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
          </CardContent>
        </Card>

        {/* Edit Team Dialog */}
        <Dialog open={!!editingTeam} onOpenChange={(open) => !open && setEditingTeam(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Team Details</DialogTitle>
              <DialogDescription>
                Update the team's email, name, team name, and abbreviation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  data-testid="input-edit-email"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-first-name">First Name</Label>
                  <Input
                    id="edit-first-name"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    data-testid="input-edit-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-last-name">Last Name</Label>
                  <Input
                    id="edit-last-name"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    data-testid="input-edit-last-name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-team-name">Team Name</Label>
                  <Input
                    id="edit-team-name"
                    value={editTeamName}
                    onChange={(e) => setEditTeamName(e.target.value)}
                    data-testid="input-edit-team-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-team-abbreviation">Abbr</Label>
                  <Input
                    id="edit-team-abbreviation"
                    value={editTeamAbbreviation}
                    onChange={(e) => setEditTeamAbbreviation(e.target.value.toUpperCase().slice(0, 3))}
                    maxLength={3}
                    data-testid="input-edit-team-abbreviation"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTeam(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingTeam) {
                    updateTeamDetails.mutate({
                      userId: editingTeam.id,
                      details: {
                        email: editEmail,
                        firstName: editFirstName,
                        lastName: editLastName,
                        teamName: editTeamName,
                        teamAbbreviation: editTeamAbbreviation,
                      },
                    });
                  }
                }}
                disabled={updateTeamDetails.isPending || !editEmail}
                data-testid="button-save-team"
              >
                {updateTeamDetails.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Separator className="my-8" />

      {/* Data Export Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Data Export
          </CardTitle>
          <CardDescription>
            Export auction data as CSV files for reporting and analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <Label className="text-sm font-medium whitespace-nowrap">Filter by Auction:</Label>
            <Select
              value={selectedAuctionForExport}
              onValueChange={setSelectedAuctionForExport}
            >
              <SelectTrigger className="flex-1" data-testid="select-export-auction">
                <SelectValue placeholder="All Auctions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Auctions</SelectItem>
                {allAuctions && allAuctions.length > 0 && (
                  allAuctions.map((auction) => (
                    <SelectItem key={auction.id} value={String(auction.id)}>
                      {auction.name} {auction.status === "active" && "(Active)"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedAuctionForExport && selectedAuctionForExport !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAuctionForExport("")}
                data-testid="button-clear-export-filter"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Button
              variant="outline"
              className="justify-start"
              onClick={handleExportResults}
              disabled={exportingResults}
              data-testid="button-export-results"
            >
              {exportingResults ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Export Auction Results
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={handleExportRosters}
              disabled={exportingRosters}
              data-testid="button-export-rosters"
            >
              {exportingRosters ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
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
