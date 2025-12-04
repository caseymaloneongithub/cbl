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
import type { LeagueSettings, User } from "@shared/schema";
import { Upload, Settings, Users, Loader2, FileSpreadsheet, Trash2, Crown } from "lucide-react";

const settingsSchema = z.object({
  yearFactor1: z.number().min(0.1).max(10),
  yearFactor2: z.number().min(0.1).max(10),
  yearFactor3: z.number().min(0.1).max(10),
  yearFactor4: z.number().min(0.1).max(10),
  yearFactor5: z.number().min(0.1).max(10),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface ParsedPlayer {
  name: string;
  position: string;
  team: string;
  auctionEndTime: string;
}

export default function Commissioner() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [parsedPlayers, setParsedPlayers] = useState<ParsedPlayer[]>([]);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: settings, isLoading: loadingSettings } = useQuery<LeagueSettings>({
    queryKey: ["/api/settings"],
    enabled: isAuthenticated && user?.isCommissioner,
  });

  const { data: owners, isLoading: loadingOwners } = useQuery<User[]>({
    queryKey: ["/api/owners"],
    enabled: isAuthenticated && user?.isCommissioner,
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      yearFactor1: 1.0,
      yearFactor2: 1.8,
      yearFactor3: 2.5,
      yearFactor4: 3.1,
      yearFactor5: 3.6,
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
          window.location.href = "/api/login";
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
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
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

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split("\n");
    const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
    
    const nameIdx = headers.findIndex(h => h === "name" || h === "player");
    const posIdx = headers.findIndex(h => h === "position" || h === "pos");
    const teamIdx = headers.findIndex(h => h === "team");
    const endTimeIdx = headers.findIndex(h => h === "end" || h === "endtime" || h === "auction_end" || h === "end_time");

    if (nameIdx === -1 || posIdx === -1) {
      toast({
        title: "Invalid CSV",
        description: "CSV must have 'name' and 'position' columns",
        variant: "destructive",
      });
      return;
    }

    const players: ParsedPlayer[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      if (values[nameIdx]) {
        players.push({
          name: values[nameIdx],
          position: values[posIdx] || "UTIL",
          team: teamIdx !== -1 ? values[teamIdx] || "" : "",
          auctionEndTime: endTimeIdx !== -1 ? values[endTimeIdx] : "",
        });
      }
    }

    setParsedPlayers(players);
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

  if (!user?.isCommissioner) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Commissioner Access Required</h3>
            <p className="text-muted-foreground">
              Only the league commissioner can access these settings.
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              League Owners
            </CardTitle>
            <CardDescription>
              View and manage team owners
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
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {owners.map((owner) => (
                  <div
                    key={owner.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`owner-${owner.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="font-medium">
                          {owner.firstName} {owner.lastName}
                        </span>
                        {owner.isCommissioner && (
                          <Badge variant="secondary" className="ml-2">
                            <Crown className="h-3 w-3 mr-1" />
                            Commissioner
                          </Badge>
                        )}
                        <p className="text-xs text-muted-foreground">{owner.email}</p>
                      </div>
                    </div>
                    {!owner.isCommissioner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => makeCommissioner.mutate(owner.id)}
                      >
                        <Crown className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      {/* CSV Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Free Agents
          </CardTitle>
          <CardDescription>
            Upload a CSV file with player data. Required columns: name, position. Optional: team, end_time
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
                      <TableHead>Position</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>End Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedPlayers.slice(0, 10).map((player, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{player.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{player.position}</Badge>
                        </TableCell>
                        <TableCell>{player.team || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {player.auctionEndTime || "Default"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {parsedPlayers.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
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
