import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LeagueProvider } from "@/contexts/LeagueContext";
import { Header } from "@/components/Header";
import { PasswordResetDialog } from "@/components/PasswordResetDialog";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import ResetPassword from "@/pages/ResetPassword";
import Home from "@/pages/Home";
import MyBids from "@/pages/MyBids";
import Results from "@/pages/Results";
import MyRoster from "@/pages/MyRoster";
import Players from "@/pages/Players";
import CommissionerAuction from "@/pages/CommissionerAuction";
import CommissionerFreeAgency from "@/pages/commissioner/CommissionerFreeAgency";
import CommissionerTeams from "@/pages/commissioner/CommissionerTeams";
import CommissionerRosters from "@/pages/commissioner/CommissionerRosters";
import CommissionerSettings from "@/pages/commissioner/CommissionerSettings";
import CommissionerDraft from "@/pages/commissioner/CommissionerDraft";
import CommissionerDraftDetail from "@/pages/commissioner/CommissionerDraftDetail";
import SuperAdmin from "@/pages/SuperAdmin";
import DraftBoard from "@/pages/DraftBoard";

function CommissionerRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { user, isAuthenticated } = useAuth();
  const { hasAnyCommissionerRole, isLoadingLeagues } = useLeague();
  
  // Redirect to landing if not authenticated
  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }
  
  if (isLoadingLeagues) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  // Allow access if user is a commissioner in ANY league or is a super admin
  if (!hasAnyCommissionerRole && !user?.isSuperAdmin) {
    return <Redirect to="/" />;
  }
  
  return <Component />;
}

function SuperAdminRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { user, isAuthenticated } = useAuth();
  
  // Redirect to landing if not authenticated
  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }
  
  if (!user?.isSuperAdmin) {
    return <Redirect to="/" />;
  }
  
  return <Component />;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }
  
  return <Component />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/">
        {() => isAuthenticated ? <Home /> : <Landing />}
      </Route>
      <Route path="/my-bids">
        {() => <ProtectedRoute component={MyBids} />}
      </Route>
      <Route path="/results">
        {() => <ProtectedRoute component={Results} />}
      </Route>
      <Route path="/my-roster/mlb">
        {() => <ProtectedRoute component={() => <MyRoster level="mlb" />} />}
      </Route>
      <Route path="/my-roster/milb">
        {() => <ProtectedRoute component={() => <MyRoster level="milb" />} />}
      </Route>
      <Route path="/players/mlb">
        {() => <ProtectedRoute component={() => <Players level="mlb" />} />}
      </Route>
      <Route path="/players/milb">
        {() => <ProtectedRoute component={() => <Players level="milb" />} />}
      </Route>
      <Route path="/commissioner">
        {() => <CommissionerRoute component={() => <Redirect to="/commissioner/free-agency" />} />}
      </Route>
      <Route path="/commissioner/free-agency">
        {() => <CommissionerRoute component={CommissionerFreeAgency} />}
      </Route>
      <Route path="/commissioner/teams">
        {() => <CommissionerRoute component={CommissionerTeams} />}
      </Route>
      <Route path="/commissioner/rosters/mlb">
        {() => <CommissionerRoute component={() => <CommissionerRosters level="mlb" />} />}
      </Route>
      <Route path="/commissioner/rosters/milb">
        {() => <CommissionerRoute component={() => <CommissionerRosters level="milb" />} />}
      </Route>
      <Route path="/commissioner/settings">
        {() => <CommissionerRoute component={CommissionerSettings} />}
      </Route>
      <Route path="/commissioner/draft">
        {() => <CommissionerRoute component={CommissionerDraft} />}
      </Route>
      <Route path="/commissioner/drafts/:draftId">
        {() => <CommissionerRoute component={CommissionerDraftDetail} />}
      </Route>
      <Route path="/commissioner/auctions/:auctionId">
        {() => <CommissionerRoute component={CommissionerAuction} />}
      </Route>
      <Route path="/draft/:draftId">
        {() => <ProtectedRoute component={DraftBoard} />}
      </Route>
      <Route path="/super-admin">
        {() => <SuperAdminRoute component={SuperAdmin} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  
  return (
    <div className="min-h-screen bg-background">
      {(isAuthenticated || isLoading) && <Header />}
      <Router />
      <PasswordResetDialog />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <LeagueProvider>
            <Toaster />
            <AppContent />
          </LeagueProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
