import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollText, Search, ArrowLeftRight, Gavel, FileText, UserPlus, ChevronLeft, ChevronRight, Scissors } from "lucide-react";
import { useState, useMemo, useEffect } from "react";

interface Transaction {
  id: string;
  type: "trade" | "claim" | "signing" | "draft" | "cut";
  playerName: string;
  playerPosition: string | null;
  playerMlbTeam: string | null;
  fromTeam: string;
  toTeam: string;
  fromUserId: string | null;
  toUserId: string | null;
  rosterType: string;
  date: string | null;
  season: number;
  details: string;
}

interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
}

interface LeagueMember {
  userId: string;
  teamName: string | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    teamName: string | null;
  };
}

const PAGE_SIZE = 50;

export default function Transactions() {
  const { user } = useAuth();
  const { currentLeague, selectedLeagueId } = useLeague();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);

  const leagueId = selectedLeagueId;

  useEffect(() => {
    setPage(0);
  }, [typeFilter, teamFilter, yearFilter, levelFilter, searchQuery]);

  const membersQuery = useQuery<LeagueMember[]>({
    queryKey: ["/api/leagues", leagueId, "members"],
    queryFn: () => fetch(`/api/leagues/${leagueId}/members`).then(r => r.json()),
    enabled: !!leagueId,
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (teamFilter !== "all") params.set("team", teamFilter);
    if (yearFilter !== "all") params.set("year", yearFilter);
    if (levelFilter !== "all") params.set("level", levelFilter);
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    return params.toString();
  }, [typeFilter, teamFilter, yearFilter, levelFilter, searchQuery, page]);

  const transactionsQuery = useQuery<TransactionsResponse>({
    queryKey: ["/api/leagues", leagueId, "transactions", queryParams],
    queryFn: () => fetch(`/api/leagues/${leagueId}/transactions?${queryParams}`).then(r => r.json()),
    enabled: !!leagueId,
  });

  if (!currentLeague) {
    return (
      <div className="container mx-auto p-4">
        <Card><CardContent className="py-8 text-center text-muted-foreground">No active league selected.</CardContent></Card>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const transactions = transactionsQuery.data?.transactions || [];
  const total = transactionsQuery.data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const typeBadge = (type: string) => {
    switch (type) {
      case "trade": return <Badge variant="outline" className="gap-1 text-xs"><ArrowLeftRight className="h-3 w-3" />Trade</Badge>;
      case "signing": return <Badge className="bg-blue-600 hover:bg-blue-700 text-xs gap-1"><Gavel className="h-3 w-3" />Signing</Badge>;
      case "draft": return <Badge className="bg-green-600 hover:bg-green-700 text-xs gap-1"><FileText className="h-3 w-3" />Draft</Badge>;
      case "claim": return <Badge className="bg-orange-600 hover:bg-orange-700 text-xs gap-1"><UserPlus className="h-3 w-3" />Claim</Badge>;
      case "cut": return <Badge className="bg-red-600 hover:bg-red-700 text-xs gap-1"><Scissors className="h-3 w-3" />Cut</Badge>;
      default: return <Badge variant="outline" className="text-xs">{type}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <ScrollText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="page-title">Transactions</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by player name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36" data-testid="select-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="trade">Trades</SelectItem>
            <SelectItem value="signing">Signings</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="claim">Claims</SelectItem>
            <SelectItem value="cut">Cuts</SelectItem>
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-28" data-testid="select-level-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="mlb">MLB</SelectItem>
            <SelectItem value="milb">MiLB</SelectItem>
          </SelectContent>
        </Select>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-44" data-testid="select-team-filter">
            <SelectValue placeholder="All Teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {(membersQuery.data || []).map(m => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.teamName || `${m.user.firstName} ${m.user.lastName}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-28" data-testid="select-year-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {transactionsQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No transactions found matching your filters.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map(tx => (
                  <TableRow key={tx.id} data-testid={`transaction-row-${tx.id}`}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {tx.date ? new Date(tx.date).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>{typeBadge(tx.type)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{tx.playerName}</div>
                      {tx.playerPosition && (
                        <div className="text-xs text-muted-foreground">
                          {tx.playerPosition}{tx.playerMlbTeam ? `, ${tx.playerMlbTeam}` : ""}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tx.rosterType === "mlb" ? "default" : "secondary"} className="text-xs">
                        {(tx.rosterType || "mlb").toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{tx.fromTeam}</TableCell>
                    <TableCell className="text-sm font-medium">{tx.toTeam}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.details}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span data-testid="text-transaction-count">
          {total === 0
            ? "0 transactions"
            : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total} transaction${total !== 1 ? "s" : ""}`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <span className="text-sm font-medium" data-testid="text-page-number">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
