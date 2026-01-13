import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

type OriginalUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isSuperAdmin: boolean;
};

type AuthUser = User & {
  isImpersonating?: boolean;
  originalUser?: OriginalUser | null;
};

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword?: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword });
      return res.json();
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/auth/impersonate/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      // Clear selected league so the impersonated user's leagues are loaded fresh
      localStorage.removeItem("selectedLeagueId");
      queryClient.clear();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const stopImpersonateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/stop-impersonate");
      return res.json();
    },
    onSuccess: () => {
      // Clear selected league so the original user's leagues are loaded fresh
      localStorage.removeItem("selectedLeagueId");
      queryClient.clear();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isImpersonating: user?.isImpersonating ?? false,
    originalUser: user?.originalUser ?? null,
    isSuperAdmin: user?.isSuperAdmin ?? false,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    changePassword: changePasswordMutation.mutateAsync,
    isChangingPassword: changePasswordMutation.isPending,
    impersonate: impersonateMutation.mutateAsync,
    isStartingImpersonation: impersonateMutation.isPending,
    stopImpersonate: stopImpersonateMutation.mutateAsync,
    isStoppingImpersonation: stopImpersonateMutation.isPending,
  };
}
