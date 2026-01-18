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
import { formatCurrency, formatNumberWithCommas } from "@/lib/utils";
import type { Auction, User, FreeAgentWithBids } from "@shared/schema";
import { 
  Settings, Users, Loader2, FileSpreadsheet, Trash2, DollarSign, Plus, UserPlus, 
  Upload, ArrowLeft, Save, Check, X, AlertCircle, RefreshCcw, Clock 
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Link } from "wouter";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

const settingsSchema = z.object({
  yearFactor1: z.number().min(0.1).max(10),
  yearFactor2: z.number().min(0.1).max(10),
  yearFactor3: z.number().min(0.1).max(10),
  yearFactor4: z.number().min(0.1).max(10),
  yearFactor5: z.number().min(0.1).max(10),
  enforceBudget: z.boolean(),
  bidIncrement: z.number().min(0.01).max(100),
  allowAutoBidding: z.boolean(),
  allowBundledBids: z.boolean(),
  extendAuctionOnBid: z.boolean(),
  emailNotifications: z.enum(["none", "commissioner", "bidders", "league"]),
});

const addPlayerSchema = z.object({
  name: z.string().min(1, "Player name is required"),
  playerType: z.enum(["hitter", "pitcher"]),
  team: z.string().optional(),
  minimumBid: z.number().min(1, "Minimum bid must be at least $1"),
  minimumYears: z.number().min(1).max(5, "Minimum years must be 1-5"),
  auctionStartTime: z.string().optional(),
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
  auctionStartTime?: string;
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
  cblTeam?: string;
}

interface AuctionTeam {
  auctionId: number;
  userId: string;
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
  
  interface ParsedTeamEnrollment {
    abbreviation: string;
    budget: number;
    rosterLimit: number | null;
    ipLimit: number | null;
    paLimit: number | null;
    matchedTeam?: User;
    error?: string;
  }
  const [parsedTeamEnrollments, setParsedTeamEnrollments] = useState<ParsedTeamEnrollment[]>([]);
  const [csvEnrollDragActive, setCsvEnrollDragActive] = useState(false);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const [deletingTeamName, setDeletingTeamName] = useState("");
  const [editingLimitsUserId, setEditingLimitsUserId] = useState<string | null>(null);
  const [editingLimits, setEditingLimits] = useState({ rosterLimit: "", ipLimit: "", paLimit: "", budget: "" });
  
  // Expired players relist state
  const [relistDialogOpen, setRelistDialogOpen] = useState(false);
  const [selectedExpiredPlayer, setSelectedExpiredPlayer] = useState<FreeAgentWithBids | null>(null);
  const [relistMinBid, setRelistMinBid] = useState(1);
  const [relistMinYears, setRelistMinYears] = useState(1);
  const [relistEndDate, setRelistEndDate] = useState<Date | undefined>(undefined);
  const [relistEndHour, setRelistEndHour] = useState("20");
  const [relistEndMinute, setRelistEndMinute] = useState("00");
  
  // Bulk relist state
  const [selectedExpiredPlayerIds, setSelectedExpiredPlayerIds] = useState<number[]>([]);
  const [bulkRelistDialogOpen, setBulkRelistDialogOpen] = useState(false);
  const [bulkRelistMinBid, setBulkRelistMinBid] = useState(1);
  const [bulkRelistMinYears, setBulkRelistMinYears] = useState(1);
  const [bulkRelistEndDate, setBulkRelistEndDate] = useState<Date | undefined>(undefined);
  const [bulkRelistEndHour, setBulkRelistEndHour] = useState("20");
  const [bulkRelistEndMinute, setBulkRelistEndMinute] = useState("00");
  
  // CSV stats update results state
  const [csvUpdateResults, setCsvUpdateResults] = useState<{
    updatedCount: number;
    notFoundCount: number;
    notFoundPlayers: string[];
  } | null>(null);
  const [csvUpdateResultsDialogOpen, setCsvUpdateResultsDialogOpen] = useState(false);
  
  // MLB API sync state
  const [mlbSyncDialogOpen, setMlbSyncDialogOpen] = useState(false);
  const [mlbSyncSeason, setMlbSyncSeason] = useState(new Date().getFullYear() - 1);
  const [mlbSyncResults, setMlbSyncResults] = useState<{
    season: number;
    totalPlayers: number;
    updatedCount: number;
    notFoundCount: number;
    notFoundPlayers: string[];
    updatedPlayers: { name: string; mlbName: string; stats: string }[];
  } | null>(null);
  const [mlbResultsDialogOpen, setMlbResultsDialogOpen] = useState(false);
  const [mlbSelectedStats, setMlbSelectedStats] = useState<string[]>([
    "pa", "hr", "rbi", "runs", "sb", "avg", "ops", // hitter stats
    "ip", "wins", "losses", "era", "whip", "strikeouts" // pitcher stats
  ]);

  // Bulk limits upload state
  const [bulkLimitsDialogOpen, setBulkLimitsDialogOpen] = useState(false);
  const [bulkLimitsDragActive, setBulkLimitsDragActive] = useState(false);
  
  // Commissioner bid form state
  const [commBidTeamId, setCommBidTeamId] = useState<string>("");
  const [commBidPlayerId, setCommBidPlayerId] = useState<string>("");
  const [commBidAmount, setCommBidAmount] = useState<string>("");
  const [commBidYears, setCommBidYears] = useState<string>("1");
  const [commBidType, setCommBidType] = useState<"single" | "auto">("single");
  const [commBidMaxAmount, setCommBidMaxAmount] = useState<string>("");
  const [playerSearchQuery, setPlayerSearchQuery] = useState<string>("");
  interface ParsedBulkLimit {
    teamAbbreviation: string;
    email: string;
    budget: string;
    rosterLimit: string;
    ipLimit: string;
    paLimit: string;
  }
  const [parsedBulkLimits, setParsedBulkLimits] = useState<ParsedBulkLimit[]>([]);
  const [bulkLimitsResults, setBulkLimitsResults] = useState<{
    updated: number;
    total: number;
    results: { team: string; success: boolean; message?: string }[];
  } | null>(null);
  const [bulkLimitsResultsDialogOpen, setBulkLimitsResultsDialogOpen] = useState(false);

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

  // Fetch expired players with no bids
  const { data: expiredNoBidPlayers, isLoading: expiredPlayersLoading } = useQuery<FreeAgentWithBids[]>({
    queryKey: ['/api/auctions', numericAuctionId, 'expired-no-bids'],
    enabled: !!numericAuctionId,
  });

  // Fetch all free agents for this auction (for commissioner bid form)
  const { data: auctionFreeAgents } = useQuery<FreeAgentWithBids[]>({
    queryKey: ['/api/auctions', numericAuctionId, 'free-agents'],
    enabled: !!numericAuctionId,
  });

  // Fetch budget info for selected team in commissioner bid form
  const { data: selectedTeamBudget } = useQuery<{
    budget: number;
    spent: number;
    available: number;
    rosterLimit?: number;
    currentRosterCount?: number;
    ipLimit?: number;
    currentIpUsage?: number;
    paLimit?: number;
    currentPaUsage?: number;
  }>({
    queryKey: ['/api/limits', { auctionId: numericAuctionId, userId: commBidTeamId }],
    queryFn: async () => {
      const res = await fetch(`/api/limits?auctionId=${numericAuctionId}&userId=${commBidTeamId}`);
      if (!res.ok) throw new Error('Failed to fetch team budget');
      return res.json();
    },
    enabled: !!numericAuctionId && !!commBidTeamId,
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
      auctionStartTime: "",
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
        allowAutoBidding: auction.allowAutoBidding ?? true,
        allowBundledBids: auction.allowBundledBids ?? true,
        extendAuctionOnBid: auction.extendAuctionOnBid ?? false,
        emailNotifications: (auction.emailNotifications as "none" | "commissioner" | "bidders" | "league") ?? "bidders",
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

  // Commissioner bid mutation
  const placeCommissionerBid = useMutation({
    mutationFn: async (data: { freeAgentId: number; targetUserId: string; amount: number; years: number }) => {
      const response = await apiRequest("POST", "/api/commissioner/bids", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'free-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/free-agents'] });
      setCommBidPlayerId("");
      setCommBidAmount("");
      setCommBidYears("1");
      setPlayerSearchQuery("");
      toast({
        title: "Bid placed",
        description: `Bid placed successfully for team.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to place bid.",
        variant: "destructive",
      });
    },
  });

  // Commissioner auto-bid mutation
  const placeCommissionerAutoBid = useMutation({
    mutationFn: async (data: { freeAgentId: number; targetUserId: string; maxAmount: number; years: number; isActive: boolean }) => {
      const response = await apiRequest("POST", "/api/commissioner/auto-bids", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'free-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/free-agents'] });
      setCommBidPlayerId("");
      setCommBidMaxAmount("");
      setCommBidYears("1");
      setPlayerSearchQuery("");
      toast({
        title: "Auto-bid created",
        description: `Auto-bid created successfully for team.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create auto-bid.",
        variant: "destructive",
      });
    },
  });

  // Sync limits from roster mutation
  const syncFromRoster = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/auctions/${numericAuctionId}/sync-from-roster`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'teams'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/limits'] });
      toast({
        title: "Limits Synced",
        description: data.message || "Team limits have been updated based on roster usage.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sync limits from roster.",
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

  const enrollTeamsBulk = useMutation({
    mutationFn: async (data: { teams: { userId: string; budget: number; rosterLimit: number | null; ipLimit: number | null; paLimit: number | null }[] }) => {
      const response = await apiRequest("POST", `/api/auctions/${numericAuctionId}/teams/enroll-bulk`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'teams'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'available-teams'] });
      setEnrollDialogOpen(false);
      setParsedTeamEnrollments([]);
      toast({
        title: "Teams enrolled",
        description: "Teams have been enrolled in the auction with their individual budgets and limits.",
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
    mutationFn: async ({ auctionId, userId }: { auctionId: number; userId: string }) => {
      const response = await apiRequest("DELETE", `/api/auctions/${auctionId}/teams/${userId}`);
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
    mutationFn: async ({ userId, limits }: { userId: string; limits: { rosterLimit?: number | null; ipLimit?: number | null; paLimit?: number | null; budget?: number } }) => {
      const response = await apiRequest("PATCH", `/api/auctions/${numericAuctionId}/teams/${userId}/limits`, limits);
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
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      
      // Show warnings if any (informational, not destructive)
      if (data.warnings && data.warnings.length > 0) {
        toast({
          title: "Data Import Warnings",
          description: data.warnings.join(" "),
          duration: 12000,
        });
      }
      
      toast({
        title: "Upload successful",
        description: `${data.count} players have been added to the auction.`,
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

  // Update stats mutation (for re-uploading CSV to update existing players)
  const updatePlayerStats = useMutation({
    mutationFn: async (data: { players: ParsedPlayer[] }) => {
      const response = await apiRequest("PATCH", "/api/free-agents/bulk-stats", {
        players: data.players,
        auctionId: numericAuctionId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setParsedPlayers([]);
      // Invalidate all queries that might use player stats (PA, IP, etc.)
      queryClient.invalidateQueries({ queryKey: ['/api/free-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'free-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/limits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/budget'] });
      queryClient.invalidateQueries({ queryKey: ['/api/results'] });
      
      // Show dialog if there are not found players
      if (data.notFoundCount > 0) {
        setCsvUpdateResults(data);
        setCsvUpdateResultsDialogOpen(true);
      } else {
        toast({
          title: "Stats Updated",
          description: `Updated stats for ${data.updatedCount} players.`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update stats.",
        variant: "destructive",
      });
    },
  });

  // MLB API sync mutation
  const syncMLBStats = useMutation({
    mutationFn: async (data: { season: number; selectedStats: string[] }) => {
      const response = await apiRequest("POST", "/api/free-agents/sync-mlb-stats", {
        auctionId: numericAuctionId,
        season: data.season,
        selectedStats: data.selectedStats,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setMlbSyncDialogOpen(false);
      // Invalidate all queries that might use player stats
      queryClient.invalidateQueries({ queryKey: ['/api/free-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'free-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/limits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/budget'] });
      queryClient.invalidateQueries({ queryKey: ['/api/results'] });
      
      // Store results for display
      setMlbSyncResults(data);
      setMlbResultsDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "MLB Sync Failed",
        description: error.message || "Failed to sync stats from MLB API.",
        variant: "destructive",
      });
    },
  });

  // Delete expired player mutation
  const deleteExpiredPlayer = useMutation({
    mutationFn: async (playerId: number) => {
      await apiRequest("DELETE", `/api/free-agents/${playerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'expired-no-bids'] });
      queryClient.invalidateQueries({ queryKey: ['/api/free-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/results'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Player removed",
        description: "The expired player has been removed from the auction.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove player.",
        variant: "destructive",
      });
    },
  });

  // Relist expired player mutation
  const relistExpiredPlayer = useMutation({
    mutationFn: async ({ agentId, minimumBid, minimumYears, auctionEndTime }: { agentId: number; minimumBid: number; minimumYears: number; auctionEndTime: string }) => {
      await apiRequest("POST", `/api/free-agents/${agentId}/relist`, {
        minimumBid,
        minimumYears,
        auctionEndTime,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'expired-no-bids'] });
      queryClient.invalidateQueries({ queryKey: ['/api/free-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/results'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Player relisted",
        description: `${selectedExpiredPlayer?.name} has been relisted for auction.`,
      });
      setRelistDialogOpen(false);
      setSelectedExpiredPlayer(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to relist player.",
        variant: "destructive",
      });
    },
  });

  // Bulk relist expired players mutation
  const bulkRelistExpiredPlayers = useMutation({
    mutationFn: async ({ playerIds, minimumBid, minimumYears, auctionEndTime }: { playerIds: number[]; minimumBid: number; minimumYears: number; auctionEndTime: string }) => {
      const response = await apiRequest("POST", `/api/free-agents/bulk-relist`, {
        playerIds,
        minimumBid,
        minimumYears,
        auctionEndTime,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'expired-no-bids'] });
      queryClient.invalidateQueries({ queryKey: ['/api/free-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/results'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Bulk Relist Complete",
        description: data.message,
      });
      setBulkRelistDialogOpen(false);
      setSelectedExpiredPlayerIds([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to bulk relist players.",
        variant: "destructive",
      });
    },
  });

  // Handle bulk relist submission
  const handleBulkRelistSubmit = () => {
    if (selectedExpiredPlayerIds.length === 0) {
      toast({
        title: "No Players Selected",
        description: "Please select at least one player to relist.",
        variant: "destructive",
      });
      return;
    }

    if (!bulkRelistMinBid || bulkRelistMinBid < 1) {
      toast({
        title: "Invalid Minimum Bid",
        description: "Minimum bid must be at least $1",
        variant: "destructive",
      });
      return;
    }

    if (!bulkRelistEndDate) {
      toast({
        title: "End Date Required",
        description: "Please select an auction end date",
        variant: "destructive",
      });
      return;
    }

    // Format as Eastern Time string (YYYY-MM-DDTHH:MM:SS) for server to parse
    const year = bulkRelistEndDate.getFullYear();
    const month = String(bulkRelistEndDate.getMonth() + 1).padStart(2, '0');
    const day = String(bulkRelistEndDate.getDate()).padStart(2, '0');
    const easternTimeString = `${year}-${month}-${day}T${bulkRelistEndHour}:${bulkRelistEndMinute}:00`;

    bulkRelistExpiredPlayers.mutate({
      playerIds: selectedExpiredPlayerIds,
      minimumBid: bulkRelistMinBid,
      minimumYears: bulkRelistMinYears,
      auctionEndTime: easternTimeString,
    });
  };

  // Toggle player selection for bulk relist
  const togglePlayerSelection = (playerId: number) => {
    setSelectedExpiredPlayerIds(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  // Select/deselect all expired players
  const toggleSelectAllExpired = () => {
    if (!expiredNoBidPlayers) return;
    if (selectedExpiredPlayerIds.length === expiredNoBidPlayers.length) {
      setSelectedExpiredPlayerIds([]);
    } else {
      setSelectedExpiredPlayerIds(expiredNoBidPlayers.map(p => p.id));
    }
  };

  // Handle relist submission
  const handleRelistSubmit = () => {
    if (!selectedExpiredPlayer) return;

    if (!relistMinBid || relistMinBid < 1) {
      toast({
        title: "Invalid Minimum Bid",
        description: "Minimum bid must be at least $1",
        variant: "destructive",
      });
      return;
    }

    if (!relistEndDate) {
      toast({
        title: "End Date Required",
        description: "Please select an auction end date",
        variant: "destructive",
      });
      return;
    }

    // Format as Eastern Time string (YYYY-MM-DDTHH:MM:SS) for server to parse
    const year = relistEndDate.getFullYear();
    const month = String(relistEndDate.getMonth() + 1).padStart(2, '0');
    const day = String(relistEndDate.getDate()).padStart(2, '0');
    const easternTimeString = `${year}-${month}-${day}T${relistEndHour}:${relistEndMinute}:00`;

    relistExpiredPlayer.mutate({
      agentId: selectedExpiredPlayer.id,
      minimumBid: relistMinBid,
      minimumYears: relistMinYears,
      auctionEndTime: easternTimeString,
    });
  };

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
    const typeIdx = headers.findIndex(h => h === "type" || h === "playertype" || h === "player_type" || h === "position" || h === "h/p" || h === "h" || h === "p");
    const teamIdx = headers.findIndex(h => h === "team" || h === "mlbteam");
    const minBidIdx = headers.findIndex(h => h === "minimum_bid" || h === "minbid" || h === "bidmindollars");
    const minYearsIdx = headers.findIndex(h => h === "minimum_years" || h === "minyears" || h === "bidminyears");
    const startTimeIdx = headers.findIndex(h => h === "start_time" || h === "starttime" || h === "startdatetime" || h === "auction_start_time");
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
    const cblTeamIdx = headers.findIndex(h => h === "cblteam" || h === "cbl_team" || h === "ownerteam" || h === "owner_team" || h === "biddingteam" || h === "bidding_team");

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
        auctionStartTime: startTimeIdx !== -1 ? values[startTimeIdx] || undefined : undefined,
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
        cblTeam: cblTeamIdx !== -1 ? values[cblTeamIdx]?.trim() || undefined : undefined,
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

  const parseTeamEnrollmentCSV = useCallback((text: string, teams: User[]) => {
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
    
    const abbrevIdx = headers.findIndex(h => h === "abbreviation" || h === "abbrev" || h === "team");
    const budgetIdx = headers.findIndex(h => h === "budget" || h === "budget_dollars" || h === "dollars");
    const rosterIdx = headers.findIndex(h => h === "roster_limit" || h === "rosterlimit" || h === "players" || h === "roster");
    const ipIdx = headers.findIndex(h => h === "ip_limit" || h === "iplimit" || h === "ip");
    const paIdx = headers.findIndex(h => h === "pa_limit" || h === "palimit" || h === "pa");

    if (abbrevIdx === -1) {
      toast({
        title: "Missing abbreviation column",
        description: "CSV must have an 'abbreviation' column to match teams.",
        variant: "destructive",
      });
      return;
    }

    if (budgetIdx === -1) {
      toast({
        title: "Missing budget column",
        description: "CSV must have a 'budget' column.",
        variant: "destructive",
      });
      return;
    }

    interface ParsedTeamEnrollment {
      abbreviation: string;
      budget: number;
      rosterLimit: number | null;
      ipLimit: number | null;
      paLimit: number | null;
      matchedTeam?: User;
      error?: string;
    }

    const enrollments: ParsedTeamEnrollment[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      
      const abbreviation = values[abbrevIdx]?.toUpperCase();
      if (!abbreviation) continue;

      const budget = parseFloat(values[budgetIdx]);
      if (isNaN(budget) || budget < 0) {
        enrollments.push({
          abbreviation,
          budget: 0,
          rosterLimit: null,
          ipLimit: null,
          paLimit: null,
          error: "Invalid budget value",
        });
        continue;
      }

      const parseOptionalNum = (val: string | undefined): number | null => {
        if (!val || val === "") return null;
        const num = parseFloat(val);
        return isNaN(num) ? null : num;
      };

      const matchedTeam = teams.find(t => 
        t.teamAbbreviation?.toUpperCase() === abbreviation
      );

      enrollments.push({
        abbreviation,
        budget,
        rosterLimit: rosterIdx !== -1 ? parseOptionalNum(values[rosterIdx]) : null,
        ipLimit: ipIdx !== -1 ? parseOptionalNum(values[ipIdx]) : null,
        paLimit: paIdx !== -1 ? parseOptionalNum(values[paIdx]) : null,
        matchedTeam,
        error: matchedTeam ? undefined : "No team found with this abbreviation",
      });
    }

    if (enrollments.length === 0) {
      toast({
        title: "No valid team data",
        description: "Could not parse any valid team enrollment data from the CSV.",
        variant: "destructive",
      });
      return;
    }

    setParsedTeamEnrollments(enrollments);
    const matched = enrollments.filter(e => e.matchedTeam).length;
    const unmatched = enrollments.length - matched;
    toast({
      title: "CSV parsed",
      description: `Found ${enrollments.length} teams. ${matched} matched, ${unmatched} unmatched.`,
    });
  }, [toast]);

  const handleEnrollmentCsvDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setCsvEnrollDragActive(true);
    } else if (e.type === "dragleave") {
      setCsvEnrollDragActive(false);
    }
  }, []);

  const handleEnrollmentCsvDrop = useCallback((e: React.DragEvent, teams: User[]) => {
    e.preventDefault();
    e.stopPropagation();
    setCsvEnrollDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseTeamEnrollmentCSV(text, teams);
      };
      reader.readAsText(file);
    }
  }, [parseTeamEnrollmentCSV]);

  const handleEnrollmentFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, teams: User[]) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseTeamEnrollmentCSV(text, teams);
      };
      reader.readAsText(file);
    }
  }, [parseTeamEnrollmentCSV]);

  // Bulk limits CSV parser (supports CSV and TSV)
  const parseBulkLimitsCSV = useCallback((csvText: string) => {
    // Remove BOM if present and normalize line endings
    let cleanText = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleanText.trim().split('\n');
    if (lines.length < 2) {
      toast({
        title: "Invalid CSV",
        description: "CSV must have a header row and at least one data row.",
        variant: "destructive",
      });
      return;
    }

    // Detect delimiter (tab or comma)
    const headerLine = lines[0];
    const delimiter = headerLine.includes('\t') ? '\t' : ',';
    
    // Parse a line with the detected delimiter
    const parseLine = (line: string): string[] => {
      if (delimiter === '\t') {
        return line.split('\t').map(v => v.trim().replace(/"/g, ''));
      }
      // For comma, handle quoted fields
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };
    
    // Parse and normalize headers
    const rawHeaders = parseLine(headerLine);
    const headers = rawHeaders.map(h => h.toLowerCase().replace(/\s+/g, ''));
    
    // Find column indices with flexible matching
    const teamIdx = headers.findIndex(h => 
      h === 'team' || h === 'abbr' || h === 'abbreviation' || 
      h === 'teamabbreviation' || h === 'teamabbr' || h.includes('team')
    );
    const emailIdx = headers.findIndex(h => h === 'email' || h.includes('email'));
    const budgetIdx = headers.findIndex(h => h === 'budget' || h.includes('budget'));
    const rosterIdx = headers.findIndex(h => h === 'roster' || h === 'rosterlimit' || h.includes('roster'));
    const ipIdx = headers.findIndex(h => h === 'ip' || h === 'iplimit');
    const paIdx = headers.findIndex(h => h === 'pa' || h === 'palimit');

    if (teamIdx === -1 && emailIdx === -1) {
      toast({
        title: "Missing required column",
        description: "CSV must have a 'Team' or 'Email' column to identify teams.",
        variant: "destructive",
      });
      return;
    }

    const parsed: ParsedBulkLimit[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Simple CSV parsing (handle quoted fields)
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      parsed.push({
        teamAbbreviation: teamIdx >= 0 ? values[teamIdx] || '' : '',
        email: emailIdx >= 0 ? values[emailIdx] || '' : '',
        budget: budgetIdx >= 0 ? values[budgetIdx]?.replace(/[,$]/g, '') || '' : '',
        rosterLimit: rosterIdx >= 0 ? values[rosterIdx] || '' : '',
        ipLimit: ipIdx >= 0 ? values[ipIdx] || '' : '',
        paLimit: paIdx >= 0 ? values[paIdx] || '' : '',
      });
    }

    if (parsed.length === 0) {
      toast({
        title: "No data found",
        description: "Could not parse any team data from the CSV.",
        variant: "destructive",
      });
      return;
    }

    setParsedBulkLimits(parsed);
    toast({
      title: "CSV parsed",
      description: `Found ${parsed.length} teams to update.`,
    });
  }, [toast]);

  const handleBulkLimitsDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setBulkLimitsDragActive(true);
    } else if (e.type === "dragleave") {
      setBulkLimitsDragActive(false);
    }
  }, []);

  const handleBulkLimitsDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBulkLimitsDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseBulkLimitsCSV(text);
      };
      reader.readAsText(file);
    }
  }, [parseBulkLimitsCSV]);

  const handleBulkLimitsFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseBulkLimitsCSV(text);
      };
      reader.readAsText(file);
    }
  }, [parseBulkLimitsCSV]);

  // Bulk update limits mutation
  const bulkUpdateLimits = useMutation({
    mutationFn: async (data: ParsedBulkLimit[]) => {
      return await apiRequest("POST", `/api/auctions/${numericAuctionId}/teams/bulk-limits`, {
        data: data.map(row => ({
          teamAbbreviation: row.teamAbbreviation,
          email: row.email,
          budget: row.budget,
          rosterLimit: row.rosterLimit,
          ipLimit: row.ipLimit,
          paLimit: row.paLimit,
        }))
      });
    },
    onSuccess: async (response) => {
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/auctions', numericAuctionId, 'teams'] });
      setBulkLimitsDialogOpen(false);
      setParsedBulkLimits([]);
      
      // Show results dialog if there are any failures, otherwise just toast
      const failedCount = result.results.filter((r: any) => !r.success).length;
      if (failedCount > 0) {
        setBulkLimitsResults(result);
        setBulkLimitsResultsDialogOpen(true);
      } else {
        toast({
          title: "Limits updated",
          description: `Successfully updated ${result.updated} teams.`,
        });
      }
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Please log in to continue.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update team limits.",
        variant: "destructive",
      });
    },
  });

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={settingsForm.control}
                  name="allowAutoBidding"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Allow Auto-Bidding</FormLabel>
                        <p className="text-xs text-muted-foreground">Users can set automatic bids</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-allow-auto-bidding"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={settingsForm.control}
                  name="allowBundledBids"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Allow Bundled Bids</FormLabel>
                        <p className="text-xs text-muted-foreground">Users can create bid bundles</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-allow-bundled-bids"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={settingsForm.control}
                  name="extendAuctionOnBid"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Extend on Late Bids</FormLabel>
                        <p className="text-xs text-muted-foreground">Extend end time 24h when bid placed within 24h</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-extend-auction-on-bid"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={settingsForm.control}
                name="emailNotifications"
                render={({ field }) => (
                  <FormItem className="rounded-lg border p-3">
                    <div className="flex flex-row items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <FormLabel>Email Notifications</FormLabel>
                        <p className="text-xs text-muted-foreground">Who receives hourly auction results summary emails</p>
                      </div>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-[180px]" data-testid="select-email-notifications">
                            <SelectValue placeholder="Select recipients" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No emails</SelectItem>
                            <SelectItem value="commissioner">Commissioner only</SelectItem>
                            <SelectItem value="bidders">Bidders only</SelectItem>
                            <SelectItem value="league">Entire league</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
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

      {/* Commissioner Bid Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Enter Bid for Team
          </CardTitle>
          <CardDescription>
            Place bids on behalf of any enrolled team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            {/* Team Selector */}
            <div className="space-y-2">
              <Label htmlFor="comm-bid-team">Team</Label>
              <Select value={commBidTeamId} onValueChange={setCommBidTeamId}>
                <SelectTrigger id="comm-bid-team" data-testid="select-comm-bid-team">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {auctionTeams?.sort((a, b) => {
                    const nameA = (a.user as any).leagueTeamName || a.user.teamName || a.user.email;
                    const nameB = (b.user as any).leagueTeamName || b.user.teamName || b.user.email;
                    return nameA.localeCompare(nameB);
                  }).map((team) => (
                    <SelectItem key={team.userId} value={team.userId}>
                      {(team.user as any).leagueTeamName || team.user.teamName || team.user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {commBidTeamId && selectedTeamBudget && (
                <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                  <div className="flex gap-3 flex-wrap">
                    <span>Budget: <span className="font-medium text-foreground">${formatNumberWithCommas(Math.floor(selectedTeamBudget.available))}</span> avail</span>
                    {selectedTeamBudget.rosterLimit !== undefined && (
                      <span>Roster: <span className="font-medium text-foreground">{selectedTeamBudget.currentRosterCount ?? 0}/{selectedTeamBudget.rosterLimit}</span></span>
                    )}
                    {selectedTeamBudget.ipLimit !== undefined && (
                      <span>IP: <span className="font-medium text-foreground">{formatNumberWithCommas(selectedTeamBudget.currentIpUsage ?? 0)}/{formatNumberWithCommas(selectedTeamBudget.ipLimit)}</span></span>
                    )}
                    {selectedTeamBudget.paLimit !== undefined && (
                      <span>PA: <span className="font-medium text-foreground">{formatNumberWithCommas(selectedTeamBudget.currentPaUsage ?? 0)}/{formatNumberWithCommas(selectedTeamBudget.paLimit)}</span></span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Player Search & Select */}
            <div className="space-y-2">
              <Label htmlFor="comm-bid-player">Player</Label>
              <Select value={commBidPlayerId} onValueChange={setCommBidPlayerId}>
                <SelectTrigger id="comm-bid-player" data-testid="select-comm-bid-player">
                  <SelectValue placeholder="Select player" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Search players..."
                      value={playerSearchQuery}
                      onChange={(e) => setPlayerSearchQuery(e.target.value)}
                      className="mb-2"
                      data-testid="input-player-search"
                    />
                  </div>
                  {auctionFreeAgents
                    ?.filter(p => {
                      const now = new Date();
                      const endTime = new Date(p.auctionEndTime);
                      const hasStarted = !p.auctionStartTime || new Date(p.auctionStartTime) <= now;
                      const notEnded = endTime > now;
                      const matchesSearch = !playerSearchQuery || p.name.toLowerCase().includes(playerSearchQuery.toLowerCase());
                      return hasStarted && notEnded && matchesSearch && !p.winnerId;
                    })
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .slice(0, 50)
                    .map((player) => (
                      <SelectItem key={player.id} value={String(player.id)}>
                        {player.name} ({player.playerType === 'hitter' ? 'H' : 'P'})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bid Type */}
            <div className="space-y-2">
              <Label>Bid Type</Label>
              <Select value={commBidType} onValueChange={(v) => setCommBidType(v as "single" | "auto")}>
                <SelectTrigger data-testid="select-comm-bid-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single Bid</SelectItem>
                  <SelectItem value="auto">Auto-Bid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="comm-bid-amount">{commBidType === 'auto' ? 'Max Amount' : 'Amount'}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="comm-bid-amount"
                  type="text"
                  inputMode="numeric"
                  className="pl-7"
                  placeholder="0"
                  value={commBidType === 'auto' ? commBidMaxAmount : commBidAmount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d]/g, '');
                    if (commBidType === 'auto') {
                      setCommBidMaxAmount(val);
                    } else {
                      setCommBidAmount(val);
                    }
                  }}
                  data-testid="input-comm-bid-amount"
                />
              </div>
            </div>

            {/* Years */}
            <div className="space-y-2">
              <Label>Years</Label>
              <Select value={commBidYears} onValueChange={setCommBidYears}>
                <SelectTrigger data-testid="select-comm-bid-years">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y} year{y > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit Button */}
            <Button
              onClick={() => {
                if (!commBidTeamId || !commBidPlayerId) {
                  toast({ title: "Error", description: "Please select a team and player", variant: "destructive" });
                  return;
                }
                const playerId = parseInt(commBidPlayerId);
                const years = parseInt(commBidYears);
                
                if (commBidType === 'single') {
                  const amount = parseInt(commBidAmount);
                  if (!amount || amount <= 0) {
                    toast({ title: "Error", description: "Please enter a valid bid amount", variant: "destructive" });
                    return;
                  }
                  placeCommissionerBid.mutate({
                    freeAgentId: playerId,
                    targetUserId: commBidTeamId,
                    amount,
                    years,
                  });
                } else {
                  const maxAmount = parseInt(commBidMaxAmount);
                  if (!maxAmount || maxAmount <= 0) {
                    toast({ title: "Error", description: "Please enter a valid max amount", variant: "destructive" });
                    return;
                  }
                  placeCommissionerAutoBid.mutate({
                    freeAgentId: playerId,
                    targetUserId: commBidTeamId,
                    maxAmount,
                    years,
                    isActive: true,
                  });
                }
              }}
              disabled={placeCommissionerBid.isPending || placeCommissionerAutoBid.isPending}
              data-testid="button-place-comm-bid"
            >
              {(placeCommissionerBid.isPending || placeCommissionerAutoBid.isPending) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DollarSign className="mr-2 h-4 w-4" />
              )}
              {commBidType === 'single' ? 'Place Bid' : 'Set Auto-Bid'}
            </Button>
          </div>
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
              {auction?.limitSource === "roster" && (
                <Badge variant="secondary" className="ml-2">Roster-Based Limits</Badge>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline"
              onClick={() => syncFromRoster.mutate()}
              disabled={syncFromRoster.isPending}
              data-testid="button-sync-from-roster"
            >
              {syncFromRoster.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Sync from Roster
            </Button>
            <Button 
              variant="outline"
              onClick={() => setBulkLimitsDialogOpen(true)} 
              data-testid="button-bulk-update-limits"
            >
              <Upload className="mr-2 h-4 w-4" />
              Bulk Update
            </Button>
            <Button onClick={() => setEnrollDialogOpen(true)} data-testid="button-enroll-teams">
              <Plus className="mr-2 h-4 w-4" />
              Enroll Teams
            </Button>
          </div>
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
                  {[...auctionTeams].sort((a, b) => {
                    const nameA = (a.user as any).leagueTeamName || `${a.user.firstName || ""} ${a.user.lastName || ""}`.trim() || a.user.email;
                    const nameB = (b.user as any).leagueTeamName || `${b.user.firstName || ""} ${b.user.lastName || ""}`.trim() || b.user.email;
                    return nameA.localeCompare(nameB);
                  }).map((team) => (
                    <TableRow key={team.userId}>
                      <TableCell className="font-medium">
                        {(team.user as any).leagueTeamName || `${team.user.firstName || ""} ${team.user.lastName || ""}`.trim() || "Unknown"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{team.user.email}</TableCell>
                      {editingLimitsUserId === team.userId ? (
                        <>
                          <TableCell className="text-right">
                            <Input
                              type="text"
                              inputMode="numeric"
                              className="w-28 ml-auto"
                              value={formatNumberWithCommas(editingLimits.budget)}
                              onChange={(e) => {
                                const numericOnly = e.target.value.replace(/[^\d]/g, '');
                                setEditingLimits({ ...editingLimits, budget: numericOnly });
                              }}
                              data-testid={`input-edit-budget-${team.userId}`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="w-20 ml-auto"
                              placeholder="None"
                              value={editingLimits.rosterLimit}
                              onChange={(e) => setEditingLimits({ ...editingLimits, rosterLimit: e.target.value })}
                              data-testid={`input-edit-roster-${team.userId}`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="w-20 ml-auto"
                              placeholder="None"
                              value={editingLimits.ipLimit}
                              onChange={(e) => setEditingLimits({ ...editingLimits, ipLimit: e.target.value })}
                              data-testid={`input-edit-ip-${team.userId}`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="w-20 ml-auto"
                              placeholder="None"
                              value={editingLimits.paLimit}
                              onChange={(e) => setEditingLimits({ ...editingLimits, paLimit: e.target.value })}
                              data-testid={`input-edit-pa-${team.userId}`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  updateTeamLimits.mutate({
                                    userId: team.userId,
                                    limits: {
                                      budget: editingLimits.budget ? parseInt(editingLimits.budget) : team.budget,
                                      rosterLimit: editingLimits.rosterLimit ? parseInt(editingLimits.rosterLimit) : null,
                                      ipLimit: editingLimits.ipLimit ? parseInt(editingLimits.ipLimit) : null,
                                      paLimit: editingLimits.paLimit ? parseInt(editingLimits.paLimit) : null,
                                    },
                                  });
                                }}
                                disabled={updateTeamLimits.isPending}
                                data-testid={`button-save-limits-${team.userId}`}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingLimitsUserId(null)}
                                data-testid={`button-cancel-limits-${team.userId}`}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right">{formatCurrency(team.budget)}</TableCell>
                          <TableCell className="text-right">{team.rosterLimit ?? "None"}</TableCell>
                          <TableCell className="text-right">{team.ipLimit ?? "None"}</TableCell>
                          <TableCell className="text-right">{team.paLimit ?? "None"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingLimitsUserId(team.userId);
                                  setEditingLimits({
                                    budget: String(team.budget),
                                    rosterLimit: team.rosterLimit ? String(team.rosterLimit) : "",
                                    ipLimit: team.ipLimit ? String(team.ipLimit) : "",
                                    paLimit: team.paLimit ? String(team.paLimit) : "",
                                  });
                                }}
                                title="Edit limits"
                                data-testid={`button-edit-limits-${team.userId}`}
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                              {!team.user.isCommissioner && !team.user.isSuperAdmin && (
                                <Dialog open={deleteTeamId === team.userId} onOpenChange={(open) => {
                                  if (!open) {
                                    setDeleteTeamId(null);
                                    setDeletingTeamName("");
                                  }
                                }}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setDeleteTeamId(team.userId);
                                      setDeletingTeamName(`${team.user.firstName || ""} ${team.user.lastName || ""}`.trim() || team.user.email);
                                    }}
                                    title="Remove from Auction"
                                    data-testid={`button-remove-team-${team.userId}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                  {deleteTeamId === team.userId && (
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
                                              userId: team.userId,
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
                          type="text"
                          inputMode="numeric"
                          value={formatNumberWithCommas(field.value)}
                          onChange={(e) => {
                            const numericOnly = e.target.value.replace(/[^\d]/g, '');
                            field.onChange(numericOnly === "" ? 0 : parseInt(numericOnly, 10));
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
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
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Free Agents (CSV)
              </CardTitle>
              <CardDescription>
                Upload a CSV file with player data, or sync stats from MLB
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setMlbSyncDialogOpen(true)}
              data-testid="button-mlb-sync"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Sync from MLB
            </Button>
          </div>
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
            <div className="space-y-4 relative">
              {/* Loading Overlay */}
              {(uploadPlayers.isPending || updatePlayerStats.isPending) && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">
                      {uploadPlayers.isPending ? "Uploading players..." : "Updating stats..."}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Preview ({parsedPlayers.length} players)
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setParsedPlayers([])}
                  disabled={uploadPlayers.isPending || updatePlayerStats.isPending}
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
                      <TableHead>Start Time</TableHead>
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
                        <TableCell>{formatCurrency(player.minimumBid)}</TableCell>
                        <TableCell>{player.minimumYears}yr</TableCell>
                        <TableCell className="text-muted-foreground">
                          {player.auctionStartTime || "Immediate"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {player.auctionEndTime || "Default"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {parsedPlayers.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          ... and {parsedPlayers.length - 10} more players
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="flex-1" data-testid="button-upload-players">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload {parsedPlayers.length} New Players
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
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="flex-1" data-testid="button-update-stats">
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Update Stats Only
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Update Player Stats</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will update stats (PA, IP, etc.) for existing players in "{auction.name}" that match by name.
                        Players not found in the auction will be skipped. No new players will be created.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => updatePlayerStats.mutate({ players: parsedPlayers })}
                        disabled={updatePlayerStats.isPending}
                      >
                        {updatePlayerStats.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          "Update Stats"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expired Players (No Bids) Section */}
      {(expiredNoBidPlayers && expiredNoBidPlayers.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Expired Players (No Bids)
                  <Badge variant="secondary">{expiredNoBidPlayers.length}</Badge>
                </CardTitle>
                <CardDescription>
                  These players' auctions have closed with no bids. You can remove them or adjust their minimum bid/years and relist them.
                </CardDescription>
              </div>
              {selectedExpiredPlayerIds.length > 0 && (
                <Button
                  onClick={() => {
                    setBulkRelistMinBid(400000);
                    setBulkRelistMinYears(1);
                    setBulkRelistEndDate(undefined);
                    setBulkRelistEndHour("20");
                    setBulkRelistEndMinute("00");
                    setBulkRelistDialogOpen(true);
                  }}
                  data-testid="button-bulk-relist"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Bulk Relist ({selectedExpiredPlayerIds.length})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={expiredNoBidPlayers.length > 0 && selectedExpiredPlayerIds.length === expiredNoBidPlayers.length}
                        onCheckedChange={toggleSelectAllExpired}
                        data-testid="checkbox-select-all-expired"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Min Bid</TableHead>
                    <TableHead className="text-right">Min Years</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiredNoBidPlayers.map((player) => (
                    <TableRow key={player.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedExpiredPlayerIds.includes(player.id)}
                          onCheckedChange={() => togglePlayerSelection(player.id)}
                          data-testid={`checkbox-expired-${player.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{player.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {player.playerType === "pitcher" ? "Pitcher" : "Hitter"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{player.team || "-"}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(player.minimumBid)}</TableCell>
                      <TableCell className="text-right">{player.minimumYears}yr</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedExpiredPlayer(player);
                              setRelistMinBid(player.minimumBid);
                              setRelistMinYears(player.minimumYears);
                              setRelistEndDate(undefined);
                              setRelistEndHour("20");
                              setRelistEndMinute("00");
                              setRelistDialogOpen(true);
                            }}
                            data-testid={`button-relist-expired-${player.id}`}
                          >
                            <RefreshCcw className="h-4 w-4 mr-1" />
                            Relist
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-delete-expired-${player.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Player</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {player.name} from this auction? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteExpiredPlayer.mutate(player.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deleteExpiredPlayer.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Removing...
                                    </>
                                  ) : (
                                    "Remove"
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Relist Expired Player Dialog */}
      <Dialog open={relistDialogOpen} onOpenChange={setRelistDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw className="h-5 w-5" />
              Relist Player
            </DialogTitle>
            <DialogDescription>
              Re-enter {selectedExpiredPlayer?.name} with a new minimum bid and auction end date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="expired-relist-min-bid">Minimum Bid ($)</Label>
              <Input
                id="expired-relist-min-bid"
                type="text"
                inputMode="numeric"
                value={formatNumberWithCommas(relistMinBid)}
                onChange={(e) => {
                  const numericOnly = e.target.value.replace(/[^\d]/g, '');
                  setRelistMinBid(numericOnly === "" ? 0 : parseInt(numericOnly, 10));
                }}
                data-testid="input-expired-relist-min-bid"
              />
            </div>

            <div className="space-y-2">
              <Label>Minimum Contract Years</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((year) => (
                  <Button
                    key={year}
                    type="button"
                    variant={relistMinYears === year ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setRelistMinYears(year)}
                    data-testid={`button-expired-relist-year-${year}`}
                  >
                    {year}yr
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Auction End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-expired-relist-date-picker"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {relistEndDate ? format(relistEndDate, "PPP") : "Select a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={relistEndDate}
                    onSelect={setRelistEndDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Auction End Time</Label>
              <div className="flex gap-2 items-center">
                <Select value={relistEndHour} onValueChange={setRelistEndHour}>
                  <SelectTrigger className="w-24" data-testid="select-expired-relist-hour">
                    <SelectValue placeholder="Hour" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                        {i.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">:</span>
                <Select value={relistEndMinute} onValueChange={setRelistEndMinute}>
                  <SelectTrigger className="w-24" data-testid="select-expired-relist-minute">
                    <SelectValue placeholder="Min" />
                  </SelectTrigger>
                  <SelectContent>
                    {["00", "10", "15", "20", "30", "45"].map((min) => (
                      <SelectItem key={min} value={min}>
                        {min}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground ml-2">(Eastern Time)</span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setRelistDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRelistSubmit}
                className="flex-1"
                disabled={relistExpiredPlayer.isPending}
                data-testid="button-confirm-expired-relist"
              >
                {relistExpiredPlayer.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Relisting...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Relist Player
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Relist Expired Players Dialog */}
      <Dialog open={bulkRelistDialogOpen} onOpenChange={setBulkRelistDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw className="h-5 w-5" />
              Bulk Relist Players
            </DialogTitle>
            <DialogDescription>
              Relist {selectedExpiredPlayerIds.length} selected player{selectedExpiredPlayerIds.length !== 1 ? "s" : ""} with the same minimum bid and auction end date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-relist-min-bid">Minimum Bid ($)</Label>
              <Input
                id="bulk-relist-min-bid"
                type="text"
                inputMode="numeric"
                value={formatNumberWithCommas(bulkRelistMinBid)}
                onChange={(e) => {
                  const numericOnly = e.target.value.replace(/[^\d]/g, '');
                  setBulkRelistMinBid(numericOnly === "" ? 0 : parseInt(numericOnly, 10));
                }}
                data-testid="input-bulk-relist-min-bid"
              />
            </div>

            <div className="space-y-2">
              <Label>Minimum Contract Years</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((year) => (
                  <Button
                    key={year}
                    type="button"
                    variant={bulkRelistMinYears === year ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setBulkRelistMinYears(year)}
                    data-testid={`button-bulk-relist-year-${year}`}
                  >
                    {year}yr
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Auction End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-bulk-relist-date-picker"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {bulkRelistEndDate ? format(bulkRelistEndDate, "PPP") : "Select a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={bulkRelistEndDate}
                    onSelect={setBulkRelistEndDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Auction End Time</Label>
              <div className="flex gap-2 items-center">
                <Select value={bulkRelistEndHour} onValueChange={setBulkRelistEndHour}>
                  <SelectTrigger className="w-24" data-testid="select-bulk-relist-hour">
                    <SelectValue placeholder="Hour" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                        {i.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">:</span>
                <Select value={bulkRelistEndMinute} onValueChange={setBulkRelistEndMinute}>
                  <SelectTrigger className="w-24" data-testid="select-bulk-relist-minute">
                    <SelectValue placeholder="Min" />
                  </SelectTrigger>
                  <SelectContent>
                    {["00", "10", "15", "20", "30", "45"].map((min) => (
                      <SelectItem key={min} value={min}>
                        {min}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground ml-2">(Eastern Time)</span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setBulkRelistDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkRelistSubmit}
                className="flex-1"
                disabled={bulkRelistExpiredPlayers.isPending}
                data-testid="button-confirm-bulk-relist"
              >
                {bulkRelistExpiredPlayers.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Relisting...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Relist {selectedExpiredPlayerIds.length} Players
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Team Enrollment Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={(open) => {
        setEnrollDialogOpen(open);
        if (!open) {
          setSelectedTeamsToEnroll([]);
          setEnrollRosterLimit("");
          setEnrollIpLimit("");
          setEnrollPaLimit("");
          setParsedTeamEnrollments([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enroll Teams in Auction</DialogTitle>
            <DialogDescription>
              Upload a CSV file with team abbreviations, budgets, and limits to enroll teams in "{auction.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {loadingAvailableTeams ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : parsedTeamEnrollments.length === 0 ? (
              <>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    csvEnrollDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                  }`}
                  onDragEnter={handleEnrollmentCsvDrag}
                  onDragLeave={handleEnrollmentCsvDrag}
                  onDragOver={handleEnrollmentCsvDrag}
                  onDrop={(e) => handleEnrollmentCsvDrop(e, availableTeams || [])}
                >
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop a CSV file here, or click to browse
                  </p>
                  <Input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    id="team-enroll-csv-upload"
                    onChange={(e) => handleEnrollmentFileSelect(e, availableTeams || [])}
                    data-testid="input-team-enroll-csv"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById("team-enroll-csv-upload")?.click()}
                    data-testid="button-browse-team-csv"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Browse Files
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium">Required CSV columns:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><code className="text-xs bg-muted px-1 rounded">abbreviation</code> - Team abbreviation (3 letters)</li>
                    <li><code className="text-xs bg-muted px-1 rounded">budget</code> - Budget amount in dollars</li>
                  </ul>
                  <p className="font-medium mt-2">Optional columns:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><code className="text-xs bg-muted px-1 rounded">roster_limit</code> - Max players</li>
                    <li><code className="text-xs bg-muted px-1 rounded">ip_limit</code> - IP limit for pitchers</li>
                    <li><code className="text-xs bg-muted px-1 rounded">pa_limit</code> - PA limit for hitters</li>
                  </ul>
                </div>
              </>
            ) : (
              <div className="space-y-4 relative">
                {/* Loading Overlay */}
                {enrollTeamsBulk.isPending && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-medium">Enrolling teams...</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {parsedTeamEnrollments.filter(e => e.matchedTeam && !e.error).length} teams ready to enroll
                    </p>
                    {parsedTeamEnrollments.filter(e => e.error).length > 0 && (
                      <p className="text-sm text-destructive">
                        {parsedTeamEnrollments.filter(e => e.error).length} teams with errors
                      </p>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setParsedTeamEnrollments([])}
                    disabled={enrollTeamsBulk.isPending}
                    data-testid="button-clear-team-csv"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Abbrev</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Budget</TableHead>
                        <TableHead>Roster</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>PA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedTeamEnrollments.map((enrollment, idx) => (
                        <TableRow key={idx} className={enrollment.error ? "bg-destructive/10" : ""}>
                          <TableCell>
                            {enrollment.error ? (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            ) : (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono">{enrollment.abbreviation}</TableCell>
                          <TableCell>
                            {enrollment.matchedTeam ? (
                              enrollment.matchedTeam.teamName || enrollment.matchedTeam.email
                            ) : (
                              <span className="text-muted-foreground text-sm">{enrollment.error}</span>
                            )}
                          </TableCell>
                          <TableCell>{formatCurrency(enrollment.budget)}</TableCell>
                          <TableCell>{enrollment.rosterLimit ?? "-"}</TableCell>
                          <TableCell>{enrollment.ipLimit ?? "-"}</TableCell>
                          <TableCell>{enrollment.paLimit ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>
              Cancel
            </Button>
            {parsedTeamEnrollments.length > 0 && (
              <Button
                onClick={() => {
                  const validEnrollments = parsedTeamEnrollments
                    .filter(e => e.matchedTeam && !e.error)
                    .map(e => ({
                      userId: e.matchedTeam!.id,
                      budget: e.budget,
                      rosterLimit: e.rosterLimit,
                      ipLimit: e.ipLimit,
                      paLimit: e.paLimit,
                    }));
                  enrollTeamsBulk.mutate({ teams: validEnrollments });
                }}
                disabled={enrollTeamsBulk.isPending || parsedTeamEnrollments.filter(e => e.matchedTeam && !e.error).length === 0}
                data-testid="button-confirm-enroll"
              >
                {enrollTeamsBulk.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enrolling...
                  </>
                ) : (
                  `Enroll ${parsedTeamEnrollments.filter(e => e.matchedTeam && !e.error).length} Teams`
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MLB Stats Sync Dialog */}
      <Dialog open={mlbSyncDialogOpen} onOpenChange={setMlbSyncDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sync Stats from MLB</DialogTitle>
            <DialogDescription>
              Fetch stats from MLB's official database for all players in this auction.
              Select which stats you want to update.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mlb-season">Season Year</Label>
              <Select 
                value={mlbSyncSeason.toString()} 
                onValueChange={(val) => setMlbSyncSeason(parseInt(val))}
              >
                <SelectTrigger data-testid="select-mlb-season">
                  <SelectValue placeholder="Select season" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3">
              <Label>Hitter Stats</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: "pa", label: "PA" },
                  { key: "hr", label: "HR" },
                  { key: "rbi", label: "RBI" },
                  { key: "runs", label: "Runs" },
                  { key: "sb", label: "SB" },
                  { key: "avg", label: "AVG" },
                  { key: "ops", label: "OPS" },
                ].map((stat) => (
                  <div key={stat.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`stat-${stat.key}`}
                      checked={mlbSelectedStats.includes(stat.key)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setMlbSelectedStats([...mlbSelectedStats, stat.key]);
                        } else {
                          setMlbSelectedStats(mlbSelectedStats.filter(s => s !== stat.key));
                        }
                      }}
                      data-testid={`checkbox-stat-${stat.key}`}
                    />
                    <Label htmlFor={`stat-${stat.key}`} className="text-sm cursor-pointer">
                      {stat.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              <Label>Pitcher Stats</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: "ip", label: "IP" },
                  { key: "wins", label: "W" },
                  { key: "losses", label: "L" },
                  { key: "era", label: "ERA" },
                  { key: "whip", label: "WHIP" },
                  { key: "strikeouts", label: "K" },
                ].map((stat) => (
                  <div key={stat.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`stat-${stat.key}`}
                      checked={mlbSelectedStats.includes(stat.key)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setMlbSelectedStats([...mlbSelectedStats, stat.key]);
                        } else {
                          setMlbSelectedStats(mlbSelectedStats.filter(s => s !== stat.key));
                        }
                      }}
                      data-testid={`checkbox-stat-${stat.key}`}
                    />
                    <Label htmlFor={`stat-${stat.key}`} className="text-sm cursor-pointer">
                      {stat.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMlbSelectedStats([
                  "pa", "hr", "rbi", "runs", "sb", "avg", "ops",
                  "ip", "wins", "losses", "era", "whip", "strikeouts"
                ])}
                data-testid="button-select-all-stats"
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMlbSelectedStats([])}
                data-testid="button-clear-stats"
              >
                Clear All
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMlbSyncDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => syncMLBStats.mutate({ season: mlbSyncSeason, selectedStats: mlbSelectedStats })}
              disabled={syncMLBStats.isPending || mlbSelectedStats.length === 0}
              data-testid="button-confirm-mlb-sync"
            >
              {syncMLBStats.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Sync {mlbSyncSeason} Stats
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MLB Sync Results Dialog */}
      <Dialog open={mlbResultsDialogOpen} onOpenChange={setMlbResultsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>MLB Stats Sync Complete</DialogTitle>
            <DialogDescription>
              {mlbSyncResults && (
                <>
                  Synced {mlbSyncResults.season} stats: Updated {mlbSyncResults.updatedCount} of {mlbSyncResults.totalPlayers} players.
                  {mlbSyncResults.notFoundCount > 0 && ` ${mlbSyncResults.notFoundCount} players not found in MLB database.`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {mlbSyncResults && (
            <div className="space-y-4 py-4">
              {mlbSyncResults.notFoundCount > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Players Not Found ({mlbSyncResults.notFoundCount})</span>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {mlbSyncResults.notFoundPlayers.map((name, i) => (
                        <Badge key={i} variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These players may need their stats updated manually via CSV upload.
                  </p>
                </div>
              )}
              
              {mlbSyncResults.updatedPlayers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
                    <Check className="h-4 w-4" />
                    <span className="font-medium">Successfully Updated ({mlbSyncResults.updatedCount})</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Player</TableHead>
                          <TableHead>MLB Name</TableHead>
                          <TableHead>Stats Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mlbSyncResults.updatedPlayers.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell className="text-muted-foreground">{p.mlbName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p.stats}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setMlbResultsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Stats Update Results Dialog */}
      <Dialog open={csvUpdateResultsDialogOpen} onOpenChange={setCsvUpdateResultsDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Stats Update Complete</DialogTitle>
            <DialogDescription>
              {csvUpdateResults && (
                <>
                  Updated stats for {csvUpdateResults.updatedCount} players.
                  {csvUpdateResults.notFoundCount > 0 && ` ${csvUpdateResults.notFoundCount} players were not found.`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {csvUpdateResults && csvUpdateResults.notFoundCount > 0 && (
            <div className="space-y-2 py-4">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Players Not Found ({csvUpdateResults.notFoundCount})</span>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 max-h-60 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {csvUpdateResults.notFoundPlayers.map((name, i) => (
                    <Badge key={i} variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                These players were not found in the auction. Check for name spelling differences.
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setCsvUpdateResultsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Limits Upload Dialog */}
      <Dialog open={bulkLimitsDialogOpen} onOpenChange={(open) => {
        setBulkLimitsDialogOpen(open);
        if (!open) {
          setParsedBulkLimits([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Update Team Limits</DialogTitle>
            <DialogDescription>
              Upload a CSV file to update budgets and limits for multiple teams at once.
            </DialogDescription>
          </DialogHeader>
          
          {parsedBulkLimits.length === 0 ? (
            <div className="space-y-4">
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  bulkLimitsDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
                onDragEnter={handleBulkLimitsDrag}
                onDragLeave={handleBulkLimitsDrag}
                onDragOver={handleBulkLimitsDrag}
                onDrop={handleBulkLimitsDrop}
              >
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Drag and drop a CSV file here, or click to select
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleBulkLimitsFileSelect}
                  className="hidden"
                  id="bulk-limits-file-input"
                  data-testid="input-bulk-limits-csv"
                />
                <Button variant="outline" asChild>
                  <label htmlFor="bulk-limits-file-input" className="cursor-pointer">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Select CSV File
                  </label>
                </Button>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">CSV Format</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Your CSV should include at least a <strong>Team</strong> (abbreviation) or <strong>Email</strong> column to identify teams.
                  Optional columns: <strong>Budget</strong>, <strong>Roster</strong>, <strong>IP</strong>, <strong>PA</strong>.
                </p>
                <pre className="text-xs bg-background rounded p-2 overflow-x-auto">
Team,Budget,Roster,IP,PA{"\n"}ABC,250,40,1200,5500{"\n"}XYZ,275,45,1400,6000
                </pre>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Roster</TableHead>
                      <TableHead className="text-right">IP</TableHead>
                      <TableHead className="text-right">PA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedBulkLimits.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.teamAbbreviation || '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{row.email || '-'}</TableCell>
                        <TableCell className="text-right">{row.budget || '-'}</TableCell>
                        <TableCell className="text-right">{row.rosterLimit || '-'}</TableCell>
                        <TableCell className="text-right">{row.ipLimit || '-'}</TableCell>
                        <TableCell className="text-right">{row.paLimit || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <p className="text-sm text-muted-foreground">
                {parsedBulkLimits.length} teams will be updated. Empty values will not change existing limits.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setBulkLimitsDialogOpen(false);
                setParsedBulkLimits([]);
              }}
            >
              Cancel
            </Button>
            {parsedBulkLimits.length > 0 && (
              <>
                <Button 
                  variant="outline"
                  onClick={() => setParsedBulkLimits([])}
                >
                  Upload Different File
                </Button>
                <Button 
                  onClick={() => bulkUpdateLimits.mutate(parsedBulkLimits)}
                  disabled={bulkUpdateLimits.isPending}
                  data-testid="button-apply-bulk-limits"
                >
                  {bulkUpdateLimits.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Apply Updates
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Limits Results Dialog */}
      <Dialog open={bulkLimitsResultsDialogOpen} onOpenChange={setBulkLimitsResultsDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Bulk Update Complete</DialogTitle>
            <DialogDescription>
              {bulkLimitsResults && (
                <>
                  Updated {bulkLimitsResults.updated} of {bulkLimitsResults.total} teams.
                  {bulkLimitsResults.results.filter(r => !r.success).length > 0 && (
                    <span className="text-amber-600 dark:text-amber-500 ml-1">
                      {bulkLimitsResults.results.filter(r => !r.success).length} teams could not be updated.
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {bulkLimitsResults && bulkLimitsResults.results.filter(r => !r.success).length > 0 && (
            <div className="space-y-2 py-4">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Teams Not Updated</span>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 max-h-60 overflow-y-auto">
                <div className="space-y-1">
                  {bulkLimitsResults.results.filter(r => !r.success).map((row, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-amber-700 dark:text-amber-400">{row.team}</span>
                      <span className="text-muted-foreground">{row.message || 'Not found'}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Check that team abbreviations or emails match enrolled teams in this auction.
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setBulkLimitsResultsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
