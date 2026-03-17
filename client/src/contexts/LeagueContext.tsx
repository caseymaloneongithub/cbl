import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { League, LeagueMember } from "@shared/schema";

type LeagueMemberWithUser = LeagueMember & {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
};

type LeagueWithRole = League & {
  role: 'owner' | 'commissioner';
  teamName: string | null;
  teamAbbreviation: string | null;
};

const SELECTED_LEAGUE_KEY = "selectedLeagueId";

interface LeagueContextValue {
  leagues: LeagueWithRole[];
  currentLeague: LeagueWithRole | null;
  selectedLeagueId: number | null;
  selectLeague: (leagueId: number) => void;
  isLoadingLeagues: boolean;
  isLeagueCommissioner: boolean;
  hasAnyCommissionerRole: boolean;
  leagueMembers: LeagueMemberWithUser[];
  isLoadingMembers: boolean;
}

const LeagueContext = createContext<LeagueContextValue | null>(null);

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(() => {
    const stored = localStorage.getItem(SELECTED_LEAGUE_KEY);
    return stored ? parseInt(stored, 10) : null;
  });

  const { data: leagues, isLoading: isLoadingLeagues } = useQuery<LeagueWithRole[]>({
    queryKey: ["/api/leagues"],
    retry: false,
  });

  const currentLeague = leagues?.find(l => l.id === selectedLeagueId) || leagues?.[0] || null;

  useEffect(() => {
    if (leagues && leagues.length > 0) {
      const match = leagues.find(l => l.id === selectedLeagueId);
      if (!match) {
        const firstLeague = leagues[0];
        setSelectedLeagueId(firstLeague.id);
        localStorage.setItem(SELECTED_LEAGUE_KEY, String(firstLeague.id));
      }
    }
  }, [leagues, selectedLeagueId]);

  useEffect(() => {
    if (selectedLeagueId !== null) {
      localStorage.setItem(SELECTED_LEAGUE_KEY, String(selectedLeagueId));
    }
  }, [selectedLeagueId]);

  const selectLeague = useCallback((leagueId: number) => {
    setSelectedLeagueId(leagueId);
    localStorage.setItem(SELECTED_LEAGUE_KEY, String(leagueId));
    queryClient.invalidateQueries();
  }, []);

  const { data: leagueMembers, isLoading: isLoadingMembers } = useQuery<LeagueMemberWithUser[]>({
    queryKey: ["/api/leagues", currentLeague?.id, "members"],
    enabled: !!currentLeague?.id,
  });

  const isLeagueCommissioner = currentLeague?.role === 'commissioner';
  const hasAnyCommissionerRole = leagues?.some(l => l.role === 'commissioner') || false;

  const value: LeagueContextValue = {
    leagues: leagues || [],
    currentLeague,
    selectedLeagueId: selectedLeagueId ?? currentLeague?.id ?? null,
    selectLeague,
    isLoadingLeagues,
    isLeagueCommissioner,
    hasAnyCommissionerRole,
    leagueMembers: leagueMembers || [],
    isLoadingMembers,
  };

  return (
    <LeagueContext.Provider value={value}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  const context = useContext(LeagueContext);
  if (!context) {
    throw new Error("useLeague must be used within a LeagueProvider");
  }
  return context;
}
