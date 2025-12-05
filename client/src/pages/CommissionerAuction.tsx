import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import type { Auction, User } from "@shared/schema";
import { 
  Settings, Users, Loader2, FileSpreadsheet, Trash2, DollarSign, Plus, UserPlus, 
  Upload, ArrowLeft, Save, Check, X 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Link } from "wouter";

const settingsSchema = z.object({
  yearFactor1: z.number().min(0.1).max(10),
  yearFactor2: z.number().min(0.1).max(10),
  yearFactor3: z.number().min(0.1).max(10),
  yearFactor4: z.number().min(0.1).max(10),
  yearFactor5: z.number().min(0.1).max(10),
  enforceBudget: z.boolean(),
  bidIncrement: z.number().min(0.01).max(100),
});

const addPlayerSchema = z.object({
  name: z.string().min(1, "Player name is required"),
  playerType: z.enum(["hitter", "pitcher"]),
  team: z.string().optional(),
  minimumBid: z.number().min(1, "Minimum bid must be at least $1"),
  minimumYears: z.number().min(1).max(5, "Minimum years must be 1-5"),
  auctionEndTime: z.string().min(1, "Auction end time is required"),
});

type SettingsFormData = z.infer<typeof settingsSchema>;
type AddPlayerFormData = z.infer<typeof addPlayerSchema>;

interface ParsedPlayer {
  name: string;
  playerType: "hitter" | "pitcher";
  team: string;
  minimumBid: number;
  minimumYears: number;
  auctionEndTime: string;
  avg?: number;
  hr?: number;
  rbi?: number;
  runs?: number;
  sb?: number;
  ops?: number;
  pa?: number;
  wins?: number;
  losses?: number;
  era?: number;
  whip?: number;
  strikeouts?: number;
  ip?: number;
}

interface AuctionTeam {
  auctionId: number;
  odataId: string;
  budget: number;
  rosterLimit: number | null;
  ipLimit: number | null;
  paLimit: number | null;
  user: User;
}

export default function CommissionerAuction() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const numericAuctionId = auctionId ? parseInt(auctionId) : null;

  // State
  const [parsedPlayers, setParsedPlayers] = useState<ParsedPlayer[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedTeamsToEnroll, setSelectedTeamsToEnroll] = useState<string[]>([]);
  const [enrollBudget, setEnrollBudget] = useState<number>(260);
  const [enrollRosterLimit, setEnrollRosterLimit] = useState<string>("");
  const [enrollIpLimit, setEnrollIpLimit] = useState<string>("");
  const [enrollPaLimit, setEnrollPaLimit] = useState<string>("");
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const [deletingTeamName, setDeletingTeamName] = useState("");
  const [editingLimitsUserId, setEditingLimitsUserId] = useState<string | null>(null);
  const [editingLimits, setEditingLimits] = useState({ rosterLimit: "", ipLimit: "", paLimit: "", budget: "" });

  // Fetch auction details
  const { data: auction, isLoading: auctionLoading } = useQuery<Auction>({
    queryKey: ['/api/auctions', numericAuctionId],
    enabled: !!numericAuctionId,
  });

  // Fetch auction teams
  const { data: auctionTeams, isLoading: teamsLoading } = useQuery<AuctionTeam[]>({
    queryKey: ['/api/auctions', numericAuctionId, 'teams'],
    enabled: !!numericAuctionId,
  });

  // Fetch available teams (not enrolled)
  const { data: availableTeams, isLoading: loadingAvailableTeams } = useQuery<User[]>({
    queryKey: ['/api/auctions', numericAuctionId, 'available-teams'],
    enabled: !!numericAuctionId && enrollDialogOpen,
  });

  // Settings form
  const settingsForm = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      yearFactor1: 1.0,
      yearFactor2: 1.25,
      yearFactor3: 1.33,
      yearFactor4: 1.43,
      yearFactor5: 1.55,
      enforceBudget: true,
      bidIncrement: 1,
    },
  });

  // Add player form
  const addPlayerForm = useForm<AddPlayerFormData>({
    resolver: zodResolver(addPlayerSchema),
    defaultValues: {
      name: "",
      playerType: "hitter",
      team: "",
      minimumBid: 1,
      minimumYears: 1,
      auctionEndTime: "",
    },
  });

  // Update settings form when auction loads
  useEffect(() => {
    if (auction) {
      settingsForm.reset({
        yearFactor1: Number(auction.yearFactor1) || 1.0,
        yearFactor2: Number(auction.yearFactor2) || 1.25,
        yearFactor3: Number(auction.yearFactor3) || 1.33,
        yearFactor4: Number(auction.yearFactor4) || 1.43,
        yearFactor5: Number(auction.yearFactor5) || 1.55,
        enforceBudget: auction.enforceBudget ?? true,
        bidIncrement: auction.bidIncrement || 1,
      });
    }
  }, [auction, settingsForm]);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Authentication required",
        description: "Please log in to access the commissioner tools.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate, toast]);

  // Check permissions
  useEffect(() => {
    if (!authLoading && isAuthenticated && user && !user.isCommissioner && !user.isSuperAdmin) {
      toast({
        title: "Access denied",
        description: "You don't have permission to access commissioner tools.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [authLoading, isAuthenticated, user, navigate, toast]);

  // Update auction settings mutation
  const updateSettings = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      const response = await apiRequest("PATCH", `/api/auctions/${numericAuctionId}/settings`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auctions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId] });
      toast({
        title: "Settings updated",
        description: "Auction settings have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings.",
        variant: "destructive",
      });
    },
  });

  // Enroll teams mutation
  const enrollTeams = useMutation({
    mutationFn: async (data: { userIds: string[]; budget: number; rosterLimit?: number; ipLimit?: number; paLimit?: number }) => {
      const response = await apiRequest("POST", `/api/auctions/${numericAuctionId}/teams/enroll`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'teams'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'available-teams'] });
      setEnrollDialogOpen(false);
      setSelectedTeamsToEnroll([]);
      setEnrollRosterLimit("");
      setEnrollIpLimit("");
      setEnrollPaLimit("");
      toast({
        title: "Teams enrolled",
        description: "Selected teams have been enrolled in the auction.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to enroll teams.",
        variant: "destructive",
      });
    },
  });

  // Remove team from auction mutation
  const removeTeamFromAuction = useMutation({
    mutationFn: async ({ auctionId, odataId }: { auctionId: number; odataId: string }) => {
      const response = await apiRequest("DELETE", `/api/auctions/${auctionId}/teams/${odataId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'teams'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'available-teams'] });
      setDeleteTeamId(null);
      setDeletingTeamName("");
      toast({
        title: "Team removed",
        description: "Team has been removed from this auction.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove team.",
        variant: "destructive",
      });
    },
  });

  // Update team limits mutation
  const updateTeamLimits = useMutation({
    mutationFn: async ({ odataId, limits }: { odataId: string; limits: { rosterLimit?: number | null; ipLimit?: number | null; paLimit?: number | null; budget?: number } }) => {
      const response = await apiRequest("PATCH", `/api/auctions/${numericAuctionId}/teams/${odataId}/limits`, limits);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'teams'] });
      setEditingLimitsUserId(null);
      toast({
        title: "Limits updated",
        description: "Team limits have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update limits.",
        variant: "destructive",
      });
    },
  });

  // Add player mutation
  const addPlayer = useMutation({
    mutationFn: async (data: AddPlayerFormData) => {
      const response = await apiRequest("POST", "/api/free-agents", {
        ...data,
        auctionId: numericAuctionId,
      });
      return response.json();
    },
    onSuccess: () => {
      addPlayerForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/free-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'free-agents'] });
      toast({
        title: "Player added",
        description: "Free agent has been added to the auction.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add player.",
        variant: "destructive",
      });
    },
  });

  // Upload players mutation
  const uploadPlayers = useMutation({
    mutationFn: async (data: { players: ParsedPlayer[] }) => {
      const response = await apiRequest("POST", "/api/free-agents/bulk", {
        players: data.players,
        auctionId: numericAuctionId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setParsedPlayers([]);
      queryClient.invalidateQueries({ queryKey: ['/api/free-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'free-agents'] });
      toast({
        title: "Upload successful",
        description: `${data.length} players have been added to the auction.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload players.",
        variant: "destructive",
      });
    },
  });

  // CSV parsing
  const parseCSV = useCallback((text: string) => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length < 2) {
      toast({
        title: "Invalid CSV",
        description: "CSV must have a header row and at least one data row.",
        variant: "destructive",
      });
      return;
    }

    const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
    
    const nameIdx = headers.findIndex(h => h === "name" || h === "player");
    const firstNameIdx = headers.findIndex(h => h === "firstname" || h === "first_name");
    const lastNameIdx = headers.findIndex(h => h === "lastname" || h === "last_name");
    const typeIdx = headers.findIndex(h => h === "type" || h === "playertype" || h === "position" || h === "h" || h === "p");
    const teamIdx = headers.findIndex(h => h === "team" || h === "mlbteam");
    const minBidIdx = headers.findIndex(h => h === "minimum_bid" || h === "minbid" || h === "bidmindollars");
    const minYearsIdx = headers.findIndex(h => h === "minimum_years" || h === "minyears" || h === "bidminyears");
    const endTimeIdx = headers.findIndex(h => h === "end_time" || h === "endtime" || h === "enddatetime" || h === "auction_end_time");

    const avgIdx = headers.findIndex(h => h === "avg" || h === "average");
    const hrIdx = headers.findIndex(h => h === "hr" || h === "homeruns");
    const rbiIdx = headers.findIndex(h => h === "rbi");
    const runsIdx = headers.findIndex(h => h === "runs" || h === "r");
    const sbIdx = headers.findIndex(h => h === "sb" || h === "stolenbases");
    const opsIdx = headers.findIndex(h => h === "ops");
    const paIdx = headers.findIndex(h => h === "pa" || h === "plateappearances");
    const winsIdx = headers.findIndex(h => h === "wins" || h === "w");
    const lossesIdx = headers.findIndex(h => h === "losses" || h === "l");
    const eraIdx = headers.findIndex(h => h === "era");
    const whipIdx = headers.findIndex(h => h === "whip");
    const strikeoutsIdx = headers.findIndex(h => h === "strikeouts" || h === "k" || h === "so");
    const ipIdx = headers.findIndex(h => h === "ip" || h === "inningspitched");

    if (nameIdx === -1 && (firstNameIdx === -1 || lastNameIdx === -1)) {
      toast({
        title: "Missing name column",
        description: "CSV must have a 'name' column or 'firstName' and 'lastName' columns.",
        variant: "destructive",
      });
      return;
    }

    const players: ParsedPlayer[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      
      let name = "";
      if (nameIdx !== -1 && values[nameIdx]) {
        name = values[nameIdx];
      } else if (firstNameIdx !== -1 && lastNameIdx !== -1) {
        name = `${values[firstNameIdx] || ""} ${values[lastNameIdx] || ""}`.trim();
      }
      
      if (!name) continue;

      let playerType: "hitter" | "pitcher" = "hitter";
      if (typeIdx !== -1) {
        const typeVal = (values[typeIdx] || "").toLowerCase();
        if (typeVal === "pitcher" || typeVal === "p") {
          playerType = "pitcher";
        }
      }

      const parseNum = (val: string | undefined): number | undefined => {
        if (!val) return undefined;
        const num = parseFloat(val);
        return isNaN(num) ? undefined : num;
      };

      players.push({
        name,
        playerType,
        team: teamIdx !== -1 ? values[teamIdx] || "" : "",
        minimumBid: minBidIdx !== -1 ? parseInt(values[minBidIdx]) || 1 : 1,
        minimumYears: minYearsIdx !== -1 ? parseInt(values[minYearsIdx]) || 1 : 1,
        auctionEndTime: endTimeIdx !== -1 ? values[endTimeIdx] || "" : "",
        avg: parseNum(values[avgIdx]),
        hr: parseNum(values[hrIdx]),
        rbi: parseNum(values[rbiIdx]),
        runs: parseNum(values[runsIdx]),
        sb: parseNum(values[sbIdx]),
        ops: parseNum(values[opsIdx]),
        pa: parseNum(values[paIdx]),
        wins: parseNum(values[winsIdx]),
        losses: parseNum(values[lossesIdx]),
        era: parseNum(values[eraIdx]),
        whip: parseNum(values[whipIdx]),
        strikeouts: parseNum(values[strikeoutsIdx]),
        ip: parseNum(values[ipIdx]),
      });
    }

    if (players.length === 0) {
      toast({
        title: "No valid players",
        description: "Could not parse any valid player data from the CSV.",
        variant: "destructive",
      });
      return;
    }

    setParsedPlayers(players);
    toast({
      title: "CSV parsed",
      description: `Found ${players.length} players. Review and confirm upload.`,
    });
  }, [toast]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === "text/csv") {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseCSV(text);
      };
      reader.readAsText(file);
    }
  }, [parseCSV]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseCSV(text);
      };
      reader.readAsText(file);
    }
  }, [parseCSV]);

  // Loading state
  if (authLoading || auctionLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Auction not found</p>
            <Button asChild variant="outline">
              <Link href="/commissioner">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Commissioner Hub
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with breadcrumb */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/commissioner">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{auction.name}</h1>
              <Badge variant={auction.status === "active" ? "default" : "secondary"}>
                {auction.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Commissioner Hub / Auction Settings
            </p>
          </div>
        </div>
      </div>

      {/* Auction Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Auction Settings
          </CardTitle>
          <CardDescription>
            Configure year multipliers, budget settings, and bid increment for this auction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...settingsForm}>
            <form onSubmit={settingsForm.handleSubmit((data) => updateSettings.mutate(data))} className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {([1, 2, 3, 4, 5] as const).map((year) => (
                  <FormField
                    key={year}
                    control={settingsForm.control}
                    name={`yearFactor${year}` as "yearFactor1" | "yearFactor2" | "yearFactor3" | "yearFactor4" | "yearFactor5"}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{year} Year Factor</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.1"
                            max="10"
                            value={field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            data-testid={`input-year-factor-${year}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={settingsForm.control}
                  name="bidIncrement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bid Increment</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          data-testid="input-bid-increment"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={settingsForm.control}
                  name="enforceBudget"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Enforce Budget</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-enforce-budget"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={updateSettings.isPending} data-testid="button-save-settings">
                {updateSettings.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Enrolled Teams */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Enrolled Teams
            </CardTitle>
            <CardDescription>
              Manage team budgets and limits for this auction. Leave blank for unlimited.
            </CardDescription>
          </div>
          <Button onClick={() => setEnrollDialogOpen(true)} data-testid="button-enroll-teams">
            <Plus className="mr-2 h-4 w-4" />
            Enroll Teams
          </Button>
        </CardHeader>
        <CardContent>
          {teamsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : auctionTeams && auctionTeams.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Roster Limit</TableHead>
                    <TableHead className="text-right">IP Limit</TableHead>
                    <TableHead className="text-right">PA Limit</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auctionTeams.map((team) => (
                    <TableRow key={team.odataId}>
                      <TableCell className="font-medium">
                        {team.user.teamName || `${team.user.firstName || ""} ${team.user.lastName || ""}`.trim() || "Unknown"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{team.user.email}</TableCell>
                      {editingLimitsUserId === team.odataId ? (
                        <>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="w-20 ml-auto"
                              value={editingLimits.budget}
                              onChange={(e) => setEditingLimits({ ...editingLimits, budget: e.target.value })}
                              data-testid={`input-edit-budget-${team.odataId}`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="w-20 ml-auto"
                              placeholder="None"
                              value={editingLimits.rosterLimit}
                              onChange={(e) => setEditingLimits({ ...editingLimits, rosterLimit: e.target.value })}
                              data-testid={`input-edit-roster-${team.odataId}`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="w-20 ml-auto"
                              placeholder="None"
                              value={editingLimits.ipLimit}
                              onChange={(e) => setEditingLimits({ ...editingLimits, ipLimit: e.target.value })}
                              data-testid={`input-edit-ip-${team.odataId}`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="w-20 ml-auto"
                              placeholder="None"
                              value={editingLimits.paLimit}
                              onChange={(e) => setEditingLimits({ ...editingLimits, paLimit: e.target.value })}
                              data-testid={`input-edit-pa-${team.odataId}`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  updateTeamLimits.mutate({
                                    odataId: team.odataId,
                                    limits: {
                                      budget: editingLimits.budget ? parseInt(editingLimits.budget) : team.budget,
                                      rosterLimit: editingLimits.rosterLimit ? parseInt(editingLimits.rosterLimit) : null,
                                      ipLimit: editingLimits.ipLimit ? parseInt(editingLimits.ipLimit) : null,
                                      paLimit: editingLimits.paLimit ? parseInt(editingLimits.paLimit) : null,
                                    },
                                  });
                                }}
                                disabled={updateTeamLimits.isPending}
                                data-testid={`button-save-limits-${team.odataId}`}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingLimitsUserId(null)}
                                data-testid={`button-cancel-limits-${team.odataId}`}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right">${team.budget}</TableCell>
                          <TableCell className="text-right">{team.rosterLimit ?? "None"}</TableCell>
                          <TableCell className="text-right">{team.ipLimit ?? "None"}</TableCell>
                          <TableCell className="text-right">{team.paLimit ?? "None"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingLimitsUserId(team.odataId);
                                  setEditingLimits({
                                    budget: String(team.budget),
                                    rosterLimit: team.rosterLimit ? String(team.rosterLimit) : "",
                                    ipLimit: team.ipLimit ? String(team.ipLimit) : "",
                                    paLimit: team.paLimit ? String(team.paLimit) : "",
                                  });
                                }}
                                title="Edit limits"
                                data-testid={`button-edit-limits-${team.odataId}`}
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                              {!team.user.isCommissioner && !team.user.isSuperAdmin && (
                                <Dialog open={deleteTeamId === team.odataId} onOpenChange={(open) => {
                                  if (!open) {
                                    setDeleteTeamId(null);
                                    setDeletingTeamName("");
                                  }
                                }}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setDeleteTeamId(team.odataId);
                                      setDeletingTeamName(`${team.user.firstName || ""} ${team.user.lastName || ""}`.trim() || team.user.email);
                                    }}
                                    title="Remove from Auction"
                                    data-testid={`button-remove-team-${team.odataId}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                  {deleteTeamId === team.odataId && (
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Remove Team from Auction</DialogTitle>
                                        <DialogDescription>
                                          Are you sure you want to remove "{deletingTeamName}" from this auction? 
                                          They can be re-enrolled later.
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
                                          onClick={() => {
                                            removeTeamFromAuction.mutate({
                                              auctionId: numericAuctionId!,
                                              odataId: team.odataId,
                                            });
                                          }}
                                          disabled={removeTeamFromAuction.isPending}
                                          data-testid="button-confirm-remove-team"
                                        >
                                          {removeTeamFromAuction.isPending ? (
                                            <>
                                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                              Removing...
                                            </>
                                          ) : (
                                            "Remove from Auction"
                                          )}
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  )}
                                </Dialog>
                              )}
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No teams enrolled in this auction yet.</p>
              <p className="text-sm">Click "Enroll Teams" to add teams.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Single Free Agent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Single Free Agent
          </CardTitle>
          <CardDescription>
            Quickly add an individual player to this auction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...addPlayerForm}>
            <form onSubmit={addPlayerForm.handleSubmit((data) => addPlayer.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={addPlayerForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Player Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Mike Trout" {...field} data-testid="input-add-player-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addPlayerForm.control}
                  name="playerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Player Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-add-player-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hitter">Hitter</SelectItem>
                          <SelectItem value="pitcher">Pitcher</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addPlayerForm.control}
                  name="team"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="LAA" {...field} data-testid="input-add-player-team" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addPlayerForm.control}
                  name="minimumBid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Bid ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                          data-testid="input-add-player-minbid"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addPlayerForm.control}
                  name="minimumYears"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Years</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="5"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          data-testid="input-add-player-minyears"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addPlayerForm.control}
                  name="auctionEndTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Auction End Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          data-testid="input-add-player-endtime"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={addPlayer.isPending} data-testid="button-add-player">
                {addPlayer.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Free Agent
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* CSV Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Free Agents (CSV)
          </CardTitle>
          <CardDescription>
            Upload a CSV file with player data for this auction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Drag and drop a CSV file here, or click to select
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload-auction"
              data-testid="input-csv-upload"
            />
            <Button variant="outline" asChild>
              <label htmlFor="csv-upload-auction" className="cursor-pointer">
                Select CSV File
              </label>
            </Button>
          </div>

          {/* Preview Table */}
          {parsedPlayers.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Preview ({parsedPlayers.length} players)
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setParsedPlayers([])}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Min Bid</TableHead>
                      <TableHead>Min Yrs</TableHead>
                      <TableHead>End Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedPlayers.slice(0, 10).map((player, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{player.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{player.playerType === "pitcher" ? "Pitcher" : "Hitter"}</Badge>
                        </TableCell>
                        <TableCell>{player.team || "-"}</TableCell>
                        <TableCell>${player.minimumBid}</TableCell>
                        <TableCell>{player.minimumYears}yr</TableCell>
                        <TableCell className="text-muted-foreground">
                          {player.auctionEndTime || "Default"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {parsedPlayers.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          ... and {parsedPlayers.length - 10} more players
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full" data-testid="button-upload-players">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {parsedPlayers.length} Free Agents
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Upload</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will add {parsedPlayers.length} new free agents to "{auction.name}".
                      Players without an end time will be set to expire in 7 days.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => uploadPlayers.mutate({ players: parsedPlayers })}
                      disabled={uploadPlayers.isPending}
                    >
                      {uploadPlayers.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        "Upload"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Enrollment Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={(open) => {
        setEnrollDialogOpen(open);
        if (!open) {
          setSelectedTeamsToEnroll([]);
          setEnrollRosterLimit("");
          setEnrollIpLimit("");
          setEnrollPaLimit("");
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enroll Teams in Auction</DialogTitle>
            <DialogDescription>
              Select teams to enroll in "{auction.name}". Set their starting budget and optional limits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Team Selection */}
            <div className="space-y-2">
              <Label>Select Teams</Label>
              {loadingAvailableTeams ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : availableTeams && availableTeams.length > 0 ? (
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {availableTeams.map((team) => (
                    <label
                      key={team.id}
                      className="flex items-center gap-2 p-2 rounded hover-elevate cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedTeamsToEnroll.includes(team.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTeamsToEnroll([...selectedTeamsToEnroll, team.id]);
                          } else {
                            setSelectedTeamsToEnroll(selectedTeamsToEnroll.filter(id => id !== team.id));
                          }
                        }}
                        data-testid={`checkbox-enroll-${team.id}`}
                      />
                      <span className="flex-1">
                        {team.teamName || `${team.firstName || ""} ${team.lastName || ""}`.trim() || team.email}
                      </span>
                      <span className="text-sm text-muted-foreground">{team.email}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  All teams are already enrolled in this auction.
                </p>
              )}
            </div>

            {/* Budget */}
            <div className="space-y-2">
              <Label htmlFor="enroll-budget">Starting Budget ($)</Label>
              <Input
                id="enroll-budget"
                type="number"
                min="1"
                value={enrollBudget}
                onChange={(e) => setEnrollBudget(parseInt(e.target.value) || 260)}
                data-testid="input-enroll-budget"
              />
            </div>

            {/* Limits */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="enroll-roster-limit">Roster Limit</Label>
                <Input
                  id="enroll-roster-limit"
                  type="number"
                  placeholder="None"
                  value={enrollRosterLimit}
                  onChange={(e) => setEnrollRosterLimit(e.target.value)}
                  data-testid="input-enroll-roster-limit"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enroll-ip-limit">IP Limit</Label>
                <Input
                  id="enroll-ip-limit"
                  type="number"
                  placeholder="None"
                  value={enrollIpLimit}
                  onChange={(e) => setEnrollIpLimit(e.target.value)}
                  data-testid="input-enroll-ip-limit"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enroll-pa-limit">PA Limit</Label>
                <Input
                  id="enroll-pa-limit"
                  type="number"
                  placeholder="None"
                  value={enrollPaLimit}
                  onChange={(e) => setEnrollPaLimit(e.target.value)}
                  data-testid="input-enroll-pa-limit"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                enrollTeams.mutate({
                  userIds: selectedTeamsToEnroll,
                  budget: enrollBudget,
                  rosterLimit: enrollRosterLimit ? parseInt(enrollRosterLimit) : undefined,
                  ipLimit: enrollIpLimit ? parseInt(enrollIpLimit) : undefined,
                  paLimit: enrollPaLimit ? parseInt(enrollPaLimit) : undefined,
                });
              }}
              disabled={enrollTeams.isPending || selectedTeamsToEnroll.length === 0}
              data-testid="button-confirm-enroll"
            >
              {enrollTeams.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enrolling...
                </>
              ) : (
                `Enroll ${selectedTeamsToEnroll.length} Team${selectedTeamsToEnroll.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
