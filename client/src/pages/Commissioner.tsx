import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
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
import { Upload, Settings, Users, Loader2, FileSpreadsheet, Trash2, Crown, Download, DollarSign, Plus, UserPlus, Trophy, RotateCcw, Play, Eye, Edit2, Check, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const settingsSchema = z.object({
  yearFactor1: z.number().min(0.1).max(10),
  yearFactor2: z.number().min(0.1).max(10),
  yearFactor3: z.number().min(0.1).max(10),
  yearFactor4: z.number().min(0.1).max(10),
  yearFactor5: z.number().min(0.1).max(10),
  defaultBudget: z.number().min(1).max(10000),
  enforceBudget: z.boolean(),
});

const oldSettingsSchema = z.object({
  yearFactor1: z.number().min(0.1).max(10),
  yearFactor2: z.number().min(0.1).max(10),
  yearFactor3: z.number().min(0.1).max(10),
  yearFactor4: z.number().min(0.1).max(10),
  yearFactor5: z.number().min(0.1).max(10),
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
  // Hitter stats
  avg?: number;
  hr?: number;
  rbi?: number;
  runs?: number;
  sb?: number;
  ops?: number;
  pa?: number;
  // Pitcher stats
  wins?: number;
  losses?: number;
  era?: number;
  whip?: number;
  strikeouts?: number;
  ip?: number;
}

interface ParsedUser {
  email: string;
  firstName?: string;
  lastName?: string;
  teamName?: string;
  budget?: number;
}

export default function Commissioner() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [parsedPlayers, setParsedPlayers] = useState<ParsedPlayer[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [exportingResults, setExportingResults] = useState(false);
  const [exportingRosters, setExportingRosters] = useState(false);
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
  
  // Team management state
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const [deletingTeamName, setDeletingTeamName] = useState("");

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
    queryKey: ["/api/owners"],
    enabled: isAuthenticated && (user?.isCommissioner || user?.isSuperAdmin),
  });

  const { data: allAuctions, isLoading: loadingAuctions } = useQuery<Auction[]>({
    queryKey: ["/api/auctions"],
    enabled: isAuthenticated && (user?.isCommissioner || user?.isSuperAdmin),
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

  const uploadPlayers = useMutation({
    mutationFn: async (players: ParsedPlayer[]) => {
      await apiRequest("POST", "/api/free-agents/bulk", { players });
    },
    onSuccess: () => {
      toast({
        title: "Players Uploaded",
        description: `${parsedPlayers.length} free agents have been added.`,
      });
      setParsedPlayers([]);
      queryClient.invalidateQueries({ queryKey: ["/api/free-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
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

  const addPlayer = useMutation({
    mutationFn: async (data: AddPlayerFormData) => {
      await apiRequest("POST", "/api/free-agents", {
        name: data.name,
        playerType: data.playerType,
        team: data.team || null,
        minimumBid: data.minimumBid,
        minimumYears: data.minimumYears,
        auctionEndTime: data.auctionEndTime,
      });
    },
    onSuccess: () => {
      toast({
        title: "Player Added",
        description: "Free agent has been added to the auction.",
      });
      addPlayerForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/free-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
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
      toast({ title: "Add Failed", description: error.message, variant: "destructive" });
    },
  });

  const makeCommissioner = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("PATCH", `/api/owners/${userId}/commissioner`, { isCommissioner: true });
    },
    onSuccess: () => {
      toast({ title: "Commissioner Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/owners"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateUserLimits = useMutation({
    mutationFn: async ({ userId, limits }: { userId: string; limits: { rosterLimit?: number | null; ipLimit?: number | null; paLimit?: number | null } }) => {
      await apiRequest("PATCH", `/api/users/${userId}/limits`, limits);
    },
    onSuccess: () => {
      toast({ title: "Limits Updated", description: "Team limits have been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/owners"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/owners"] });
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
      const res = await apiRequest("POST", "/api/auctions", { name });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Auction Created", description: "New auction has been created." });
      setCreateAuctionDialogOpen(false);
      setNewAuctionName("");
      queryClient.invalidateQueries({ queryKey: ["/api/auctions"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/auctions"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/auctions"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/auctions"] });
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
      const res = await apiRequest("DELETE", `/api/owners/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Team Deleted", description: "The team has been removed." });
      setDeleteTeamId(null);
      setDeletingTeamName("");
      queryClient.invalidateQueries({ queryKey: ["/api/owners"] });
    },
    onError: (error: Error) => {
      toast({ title: "Cannot Delete", description: error.message, variant: "destructive" });
      setDeleteTeamId(null);
      setDeletingTeamName("");
    },
  });

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split("\n");
    const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
    
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    const nameIdx = headers.findIndex(h => h === "name" || h === "player");
    const firstNameIdx = headers.findIndex(h => h === "firstname");
    const lastNameIdx = headers.findIndex(h => h === "lastname");
    const typeIdx = headers.findIndex(h => h === "type" || h === "playertype" || h === "player_type" || h === "h/p");
    const teamIdx = headers.findIndex(h => h === "team" || h === "mlbteam");
    const minBidIdx = headers.findIndex(h => h === "minimum_bid" || h === "min_bid" || h === "minbid" || h === "min" || h === "bidmindollars");
    const minYearsIdx = headers.findIndex(h => h === "minimum_years" || h === "min_years" || h === "minyears" || h === "bidminyears");
    const endTimeIdx = headers.findIndex(h => h === "end" || h === "endtime" || h === "auction_end" || h === "end_time" || h === "enddatetime");
    
    const abIdx = headers.findIndex(h => h === "ab" || h === "at_bats");
    const avgIdx = headers.findIndex(h => h === "avg" || h === "average" || h === "ba");
    const hrIdx = headers.findIndex(h => h === "hr" || h === "home_runs" || h === "homers");
    const rbiIdx = headers.findIndex(h => h === "rbi" || h === "rbis");
    const runsIdx = headers.findIndex(h => h === "runs" || h === "r");
    const sbIdx = headers.findIndex(h => h === "sb" || h === "stolen_bases" || h === "steals");
    const opsIdx = headers.findIndex(h => h === "ops");
    const paIdx = headers.findIndex(h => h === "pa" || h === "plate_appearances");
    
    const winsIdx = headers.findIndex(h => h === "wins" || h === "w");
    const lossesIdx = headers.findIndex(h => h === "losses" || h === "l");
    const eraIdx = headers.findIndex(h => h === "era");
    const whipIdx = headers.findIndex(h => h === "whip");
    const strikeoutsIdx = headers.findIndex(h => h === "strikeouts" || h === "k" || h === "so");
    const ipIdx = headers.findIndex(h => h === "ip" || h === "innings" || h === "innings_pitched");

    const hasNameColumn = nameIdx !== -1;
    const hasFirstLastName = firstNameIdx !== -1 && lastNameIdx !== -1;
    const hasTypeColumn = typeIdx !== -1;

    if (!hasNameColumn && !hasFirstLastName) {
      toast({
        title: "Invalid CSV",
        description: "CSV must have 'name' column OR 'firstName' and 'lastName' columns",
        variant: "destructive",
      });
      return;
    }

    if (!hasTypeColumn) {
      toast({
        title: "Invalid CSV",
        description: "CSV must have 'type' or 'playerType' column (values: hitter or pitcher)",
        variant: "destructive",
      });
      return;
    }

    const parseNum = (val: string | undefined): number | undefined => {
      if (!val || val === "") return undefined;
      const cleaned = val.replace(/,/g, "").replace(/"/g, "");
      const num = parseFloat(cleaned);
      return isNaN(num) ? undefined : num;
    };

    const mapPlayerType = (type: string): "hitter" | "pitcher" => {
      const lower = type.toLowerCase().trim();
      if (lower === "pitcher" || lower === "p") return "pitcher";
      return "hitter";
    };

    const players: ParsedPlayer[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      let playerName = "";
      if (hasNameColumn) {
        playerName = values[nameIdx] || "";
      } else if (hasFirstLastName) {
        const firstName = values[firstNameIdx] || "";
        const lastName = values[lastNameIdx] || "";
        playerName = `${firstName} ${lastName}`.trim();
      }
      
      if (playerName) {
        const minYearsVal = minYearsIdx !== -1 ? parseInt(values[minYearsIdx]) : 1;
        const rawType = values[typeIdx] || "hitter";
        const playerType = mapPlayerType(rawType);
        
        const minBidRaw = minBidIdx !== -1 ? values[minBidIdx] : "";
        const minBidCleaned = minBidRaw.replace(/,/g, "").replace(/"/g, "");
        const minBidVal = parseFloat(minBidCleaned) || 1;
        
        const abValue = parseNum(values[abIdx]);
        const paValue = parseNum(values[paIdx]);
        
        players.push({
          name: playerName,
          playerType: playerType,
          team: teamIdx !== -1 ? values[teamIdx] || "" : "",
          minimumBid: minBidVal,
          minimumYears: isNaN(minYearsVal) || minYearsVal < 1 || minYearsVal > 5 ? 1 : minYearsVal,
          auctionEndTime: endTimeIdx !== -1 ? values[endTimeIdx] : "",
          avg: parseNum(values[avgIdx]),
          hr: parseNum(values[hrIdx]),
          rbi: parseNum(values[rbiIdx]),
          runs: parseNum(values[runsIdx]),
          sb: parseNum(values[sbIdx]),
          ops: parseNum(values[opsIdx]),
          pa: paValue !== undefined ? paValue : abValue,
          wins: parseNum(values[winsIdx]),
          losses: parseNum(values[lossesIdx]),
          era: parseNum(values[eraIdx]),
          whip: parseNum(values[whipIdx]),
          strikeouts: parseNum(values[strikeoutsIdx]),
          ip: parseNum(values[ipIdx]),
        });
      }
    }

    setParsedPlayers(players);
  }, [toast]);

  const parseUserCSV = useCallback((text: string) => {
    const lines = text.trim().split("\n");
    const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
    
    const emailIdx = headers.findIndex(h => h === "email");
    const firstNameIdx = headers.findIndex(h => h === "first_name" || h === "firstname");
    const lastNameIdx = headers.findIndex(h => h === "last_name" || h === "lastname");
    const teamNameIdx = headers.findIndex(h => h === "team_name" || h === "teamname" || h === "team");
    const budgetIdx = headers.findIndex(h => h === "budget");

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
        users.push({
          email: values[emailIdx],
          firstName: firstNameIdx !== -1 ? values[firstNameIdx] : undefined,
          lastName: lastNameIdx !== -1 ? values[lastNameIdx] : undefined,
          teamName: teamNameIdx !== -1 ? values[teamNameIdx] : undefined,
          budget: budgetIdx !== -1 && values[budgetIdx] ? parseFloat(values[budgetIdx]) : undefined,
        });
      }
    }

    setParsedUsers(users);
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
      const response = await fetch("/api/exports/auction-results.csv", {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to export");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "auction-results.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
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
      const response = await fetch("/api/exports/final-rosters.csv", {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to export");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "final-rosters.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
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

  if (authLoading) {
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
          Commissioner Dashboard
        </h1>
        <p className="text-muted-foreground">Manage league settings and free agents</p>
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
                        <TableCell className="text-muted-foreground">
                          {new Date(auction.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Year Factor Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Year Multipliers
            </CardTitle>
            <CardDescription>
              Set the multiplier factors for contract years to calculate total value
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSettings ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => updateSettings.mutate(data))} className="space-y-4">
                  <div className="grid gap-4 grid-cols-5">
                    {[1, 2, 3, 4, 5].map((year) => (
                      <FormField
                        key={year}
                        control={form.control}
                        name={`yearFactor${year}` as keyof SettingsFormData}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-center block">{year}yr</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="font-mono text-center"
                                data-testid={`input-factor-${year}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormDescription>
                    Total Value = Annual Salary × Year Factor
                  </FormDescription>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Budget Settings
                    </h4>
                    
                    <FormField
                      control={form.control}
                      name="defaultBudget"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Budget ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="1"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 260)}
                              data-testid="input-default-budget"
                            />
                          </FormControl>
                          <FormDescription>
                            Starting budget for all team owners
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="enforceBudget"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Enforce Budget Limits</FormLabel>
                            <FormDescription>
                              Prevent bids that exceed available budget
                            </FormDescription>
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
                  
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={updateSettings.isPending}
                    data-testid="button-save-settings"
                  >
                    {updateSettings.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Settings"
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        {/* League Owners */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              League Owners & Team Limits
            </CardTitle>
            <CardDescription>
              View and manage team owners, budgets, and team limits. Leave blank for unlimited.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingOwners ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !owners || owners.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No owners have joined yet.
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Owner</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Roster Limit</TableHead>
                      <TableHead className="text-right">IP Limit</TableHead>
                      <TableHead className="text-right">PA Limit</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {owners.map((owner) => (
                      <TableRow key={owner.id} data-testid={`owner-row-${owner.id}`}>
                        <TableCell>
                          <div>
                            <span className="font-medium">
                              {owner.firstName} {owner.lastName}
                            </span>
                            {owner.isCommissioner && (
                              <Badge variant="secondary" className="ml-2">
                                <Crown className="h-3 w-3 mr-1" />
                                Comm
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground">{owner.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{owner.teamName || "-"}</TableCell>
                        <TableCell className="text-right">${owner.budget}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            className="w-20 h-8 text-right"
                            placeholder="--"
                            defaultValue={owner.rosterLimit ?? ""}
                            onBlur={(e) => {
                              const val = e.target.value === "" ? null : parseInt(e.target.value);
                              if (val !== owner.rosterLimit) {
                                updateUserLimits.mutate({ userId: owner.id, limits: { rosterLimit: val } });
                              }
                            }}
                            data-testid={`input-roster-limit-${owner.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            className="w-20 h-8 text-right"
                            placeholder="--"
                            defaultValue={owner.ipLimit ?? ""}
                            onBlur={(e) => {
                              const val = e.target.value === "" ? null : parseFloat(e.target.value);
                              if (val !== owner.ipLimit) {
                                updateUserLimits.mutate({ userId: owner.id, limits: { ipLimit: val } });
                              }
                            }}
                            data-testid={`input-ip-limit-${owner.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            className="w-20 h-8 text-right"
                            placeholder="--"
                            defaultValue={owner.paLimit ?? ""}
                            onBlur={(e) => {
                              const val = e.target.value === "" ? null : parseInt(e.target.value);
                              if (val !== owner.paLimit) {
                                updateUserLimits.mutate({ userId: owner.id, limits: { paLimit: val } });
                              }
                            }}
                            data-testid={`input-pa-limit-${owner.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {user?.isSuperAdmin && !owner.isCommissioner && !owner.isSuperAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => makeCommissioner.mutate(owner.id)}
                                title="Make Commissioner"
                                data-testid={`button-make-commissioner-${owner.id}`}
                              >
                                <Crown className="h-4 w-4" />
                              </Button>
                            )}
                            {!owner.isCommissioner && !owner.isSuperAdmin && (
                              <Dialog open={deleteTeamId === owner.id} onOpenChange={(open) => {
                                if (!open) {
                                  setDeleteTeamId(null);
                                  setDeletingTeamName("");
                                }
                              }}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setDeleteTeamId(owner.id);
                                      setDeletingTeamName(`${owner.firstName || ""} ${owner.lastName || ""}`.trim() || owner.email);
                                    }}
                                    title="Delete Team"
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
                                      Teams can only be deleted if they have no bids or won players in any auction.
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
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Upload Team Owners
            </CardTitle>
            <CardDescription>
              Upload a CSV file to create user accounts. Required: email. Optional: first_name, last_name, team_name, budget
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
                        <TableHead>Budget</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedUsers.slice(0, 10).map((u, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{u.email}</TableCell>
                          <TableCell>{u.firstName || ""} {u.lastName || ""}</TableCell>
                          <TableCell>{u.teamName || "-"}</TableCell>
                          <TableCell>{u.budget ? `$${u.budget}` : "Default"}</TableCell>
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
        <CardContent>
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
          <p className="text-sm text-muted-foreground mt-4">
            Exports include only completed auctions with winning bids.
          </p>
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
            Quickly add an individual player to the auction
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
            Upload a CSV file with player data. Supports formats: (name/firstName+lastName), (position/h/p), (team/mlbTeam), (minimum_bid/bidMinDollars), (minimum_years/bidMinYears), (end_time/endDateTime)
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
              id="csv-upload"
              data-testid="input-csv-upload"
            />
            <Button variant="outline" asChild>
              <label htmlFor="csv-upload" className="cursor-pointer">
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
                      This will add {parsedPlayers.length} new free agents to the auction pool.
                      Players without an end time will be set to expire in 7 days.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => uploadPlayers.mutate(parsedPlayers)}
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
    </div>
  );
}
