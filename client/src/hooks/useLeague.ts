import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
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

export function useLeague() {
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
    if (leagues && leagues.length > 0 && !selectedLeagueId) {
      const firstLeague = leagues[0];
      setSelectedLeagueId(firstLeague.id);
      localStorage.setItem(SELECTED_LEAGUE_KEY, String(firstLeague.id));
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
  
  // Check if user is a commissioner in ANY league (useful for route guards)
  const hasAnyCommissionerRole = leagues?.some(l => l.role === 'commissioner') || false;

  return {
    leagues: leagues || [],
    currentLeague,
    selectedLeagueId: currentLeague?.id || null,
    selectLeague,
    isLoadingLeagues,
    isLeagueCommissioner,
    hasAnyCommissionerRole,
    leagueMembers: leagueMembers || [],
    isLoadingMembers,
  };
}
