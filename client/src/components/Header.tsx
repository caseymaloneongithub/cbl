import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useLeague } from "@/hooks/useLeague";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { LogOut, Menu, UserCog, X, Globe, Check, Building2, ChevronDown } from "lucide-react";
import { BaseballIcon } from "@/components/BaseballIcon";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User, DraftWithDetails } from "@shared/schema";

function NavDropdown({ label, items, location: loc, testId }: {
  label: string;
  items: { href: string; label: string }[];
  location: string;
  testId: string;
}) {
  const isActive = items.some(item => item.href === loc || (item.href !== "/" && loc.startsWith(item.href)));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isActive ? "secondary" : "ghost"}
          size="sm"
          data-testid={testId}
        >
          {label}
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map((item) => {
          const itemActive = item.href === loc || (item.href !== "/" && loc.startsWith(item.href));
          return (
            <DropdownMenuItem
              key={item.href}
              asChild
              className={`cursor-pointer ${itemActive ? "bg-accent" : ""}`}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Link href={item.href}>
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const { 
    user, 
    isAuthenticated, 
    logout, 
    isLoggingOut,
    isImpersonating,
    originalUser,
    isSuperAdmin,
    impersonate,
    stopImpersonate,
    isStartingImpersonation,
    isStoppingImpersonation,
  } = useAuth();
  const { leagues, currentLeague, selectedLeagueId, selectLeague, isLoadingLeagues, hasAnyCommissionerRole } = useLeague();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["/api/owners", currentLeague?.id],
    queryFn: async () => {
      const res = await fetch(`/api/owners?leagueId=${currentLeague?.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: (isSuperAdmin || isImpersonating) && !!currentLeague?.id,
  });

  const { data: drafts } = useQuery<DraftWithDetails[]>({
    queryKey: ["/api/drafts", { leagueId: selectedLeagueId }],
    queryFn: async () => {
      const res = await fetch(`/api/drafts?leagueId=${selectedLeagueId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch drafts");
      return res.json();
    },
    enabled: !!selectedLeagueId && isAuthenticated,
    staleTime: 5_000,
  });

  const draftsArray = Array.isArray(drafts) ? drafts : [];
  const activeDraft = draftsArray.find(d => d.status === "active" || d.status === "paused");
  const draftHref = activeDraft ? `/draft/${activeDraft.id}` : "/drafts";

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0]?.toUpperCase() || "?";

  const handleImpersonate = async (userId: string) => {
    try {
      await impersonate(userId);
    } catch (error) {
      console.error("Impersonation failed:", error);
    }
  };

  const handleStopImpersonate = async () => {
    try {
      await stopImpersonate();
    } catch (error) {
      console.error("Stop impersonation failed:", error);
    }
  };

  const freeAgencyItems = [
    { href: "/free-agents", label: "Free Agents" },
    { href: "/my-bids", label: "My Bids" },
    { href: "/results", label: "Results" },
  ];

  const draftItems = [
    { href: "/drafts", label: "Drafts" },
  ];

  const myRosterItems = [
    { href: "/my-roster/mlb", label: "MLB" },
    { href: "/my-roster/milb", label: "MiLB" },
  ];

  const tradeItems = [
    { href: "/submit-trade", label: "Submit Trade" },
    { href: "/trades", label: "Trades" },
  ];

  const playersItems = [
    { href: "/players/mlb", label: "MLB" },
    { href: "/players/milb", label: "MiLB" },
    { href: "/transactions", label: "Transactions" },
  ];

  const commissionerItems = [
    { href: "/commissioner/free-agency", label: "Auction Management" },
    { href: "/commissioner/draft", label: "Draft" },
    { href: "/commissioner/teams", label: "Teams" },
    { href: "/commissioner/reconciliation", label: "Reconciliation" },
    { href: "/commissioner/rosters/mlb", label: "MLB Rosters" },
    { href: "/commissioner/rosters/milb", label: "MiLB Rosters" },
    { href: "/commissioner/settings", label: "League Settings" },
  ];

  return (
    <>
      {isImpersonating && (
        <div className="bg-amber-500 dark:bg-amber-600 text-white px-4 py-2">
          <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserCog className="h-4 w-4" />
              <span>
                Viewing as: <strong>{user?.firstName} {user?.lastName}</strong> ({currentLeague?.teamName || user?.teamName || user?.email})
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="bg-white/20 border-white/40 text-white hover:bg-white/30"
              onClick={handleStopImpersonate}
              disabled={isStoppingImpersonation}
              data-testid="button-stop-impersonate"
            >
              <X className="h-4 w-4 mr-1" />
              {isStoppingImpersonation ? "Returning..." : "Exit View"}
            </Button>
          </div>
        </div>
      )}
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover-elevate active-elevate-2 rounded-md px-2 py-1">
              <BaseballIcon className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg hidden sm:inline">
                {currentLeague?.name || "CBL Strat"}
              </span>
            </Link>
          </div>

          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1">
              <NavDropdown
                label="My Roster"
                items={myRosterItems}
                location={location}
                testId="nav-my-roster"
              />
              <NavDropdown
                label="Players"
                items={playersItems}
                location={location}
                testId="nav-players"
              />
              <NavDropdown
                label="Trade"
                items={tradeItems}
                location={location}
                testId="nav-trade"
              />
              <Link href={draftHref}>
                <Button
                  variant={location === "/drafts" || location.startsWith("/draft/") ? "secondary" : "ghost"}
                  size="sm"
                  data-testid="nav-drafts"
                >
                  Draft
                </Button>
              </Link>
              <NavDropdown
                label="Free Agency"
                items={freeAgencyItems}
                location={location}
                testId="nav-free-agency"
              />
              {(hasAnyCommissionerRole || user?.isSuperAdmin) && (
                <NavDropdown
                  label="Commissioner"
                  items={commissionerItems}
                  location={location}
                  testId="nav-commissioner"
                />
              )}
              {user?.isSuperAdmin && (
                <Link href="/super-admin">
                  <Button
                    variant={location === "/super-admin" ? "secondary" : "ghost"}
                    size="sm"
                    data-testid="nav-super-admin"
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Super Admin
                  </Button>
                </Link>
              )}
            </nav>
          )}

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {isAuthenticated ? (
              <>
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-64 overflow-y-auto">
                    <nav className="flex flex-col gap-1 mt-8">
                      {leagues.length > 1 && (
                        <>
                          <div className="px-2 py-1">
                            <span className="text-xs text-muted-foreground font-medium">Switch League:</span>
                          </div>
                          {leagues.map((league) => (
                            <Button
                              key={league.id}
                              variant={currentLeague?.id === league.id ? "secondary" : "ghost"}
                              className="w-full justify-start"
                              onClick={() => {
                                selectLeague(league.id);
                                setMobileMenuOpen(false);
                              }}
                              data-testid={`mobile-switch-league-${league.id}`}
                            >
                              <Building2 className="h-4 w-4 mr-2" />
                              <span className="flex-1 truncate text-left">{league.name}</span>
                              {currentLeague?.id === league.id && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </Button>
                          ))}
                          <div className="border-b my-2" />
                        </>
                      )}
                      <div className="px-2 py-1">
                        <span className="text-xs text-muted-foreground font-medium">My Roster</span>
                      </div>
                      {myRosterItems.map((link) => {
                        const isActive = location === link.href;
                        return (
                          <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}>
                            <Button
                              variant={isActive ? "secondary" : "ghost"}
                              className="w-full justify-start"
                              size="sm"
                            >
                              {link.label}
                            </Button>
                          </Link>
                        );
                      })}
                      <div className="border-b my-2" />
                      <div className="px-2 py-1">
                        <span className="text-xs text-muted-foreground font-medium">Players</span>
                      </div>
                      {playersItems.map((link) => {
                        const isActive = location === link.href;
                        return (
                          <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}>
                            <Button
                              variant={isActive ? "secondary" : "ghost"}
                              className="w-full justify-start"
                              size="sm"
                            >
                              {link.label}
                            </Button>
                          </Link>
                        );
                      })}
                      <div className="border-b my-2" />
                      <div className="px-2 py-1">
                        <span className="text-xs text-muted-foreground font-medium">Trade</span>
                      </div>
                      {tradeItems.map((link) => {
                        const isActive = location === link.href;
                        return (
                          <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}>
                            <Button
                              variant={isActive ? "secondary" : "ghost"}
                              className="w-full justify-start"
                              size="sm"
                            >
                              {link.label}
                            </Button>
                          </Link>
                        );
                      })}
                      <div className="border-b my-2" />
                      <div className="px-2 py-1">
                        <span className="text-xs text-muted-foreground font-medium">Drafts</span>
                      </div>
                      <Link href={draftHref} onClick={() => setMobileMenuOpen(false)}>
                        <Button
                          variant={location === "/drafts" || location.startsWith("/draft/") ? "secondary" : "ghost"}
                          className="w-full justify-start"
                          size="sm"
                        >
                          Draft
                        </Button>
                      </Link>
                      <div className="border-b my-2" />
                      <div className="px-2 py-1">
                        <span className="text-xs text-muted-foreground font-medium">Free Agency</span>
                      </div>
                      {freeAgencyItems.map((link) => {
                        const isActive = link.href === location;
                        return (
                          <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}>
                            <Button
                              variant={isActive ? "secondary" : "ghost"}
                              className="w-full justify-start"
                              size="sm"
                            >
                              {link.label}
                            </Button>
                          </Link>
                        );
                      })}
                      <div className="border-b my-2" />
                      {(hasAnyCommissionerRole || user?.isSuperAdmin) && (
                        <>
                          <div className="px-2 py-1">
                            <span className="text-xs text-muted-foreground font-medium">Commissioner</span>
                          </div>
                          {commissionerItems.map((link) => {
                            const isActive = location === link.href;
                            return (
                              <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}>
                                <Button
                                  variant={isActive ? "secondary" : "ghost"}
                                  className="w-full justify-start"
                                  size="sm"
                                >
                                  {link.label}
                                </Button>
                              </Link>
                            );
                          })}
                          <div className="border-b my-2" />
                        </>
                      )}
                      {user?.isSuperAdmin && (
                        <Link href="/super-admin" onClick={() => setMobileMenuOpen(false)}>
                          <Button
                            variant={location === "/super-admin" ? "secondary" : "ghost"}
                            className="w-full justify-start"
                          >
                            <Globe className="h-4 w-4 mr-2" />
                            Super Admin
                          </Button>
                        </Link>
                      )}
                    </nav>
                  </SheetContent>
                </Sheet>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-user-menu">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} className="object-cover" />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="flex items-center gap-2 p-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} className="object-cover" />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {user?.firstName} {user?.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">{user?.email}</span>
                      </div>
                    </div>
                    {(user?.isCommissioner || user?.isSuperAdmin) && (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1 flex flex-wrap gap-1">
                          {user?.isCommissioner && (
                            <Badge variant="secondary" className="text-xs">
                              Commissioner
                            </Badge>
                          )}
                          {user?.isSuperAdmin && (
                            <Badge variant="default" className="text-xs">
                              Super Admin
                            </Badge>
                          )}
                        </div>
                      </>
                    )}
                    {leagues.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1">
                          <span className="text-xs text-muted-foreground font-medium">
                            {leagues.length > 1 ? "Switch League:" : "Your League:"}
                          </span>
                        </div>
                        <div className="max-h-32 overflow-y-auto">
                          {leagues.map((league) => (
                            <DropdownMenuItem
                              key={league.id}
                              className="cursor-pointer text-sm"
                              onClick={() => selectLeague(league.id)}
                              data-testid={`button-switch-league-${league.id}`}
                            >
                              <Building2 className="mr-2 h-4 w-4" />
                              <span className="flex-1 truncate">{league.name}</span>
                              {currentLeague?.id === league.id && (
                                <Check className="ml-2 h-4 w-4 text-primary" />
                              )}
                              {league.role === 'commissioner' && (
                                <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">
                                  Comm
                                </Badge>
                              )}
                            </DropdownMenuItem>
                          ))}
                        </div>
                      </>
                    )}
                    {(isSuperAdmin || isImpersonating) && allUsers && allUsers.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1">
                          <span className="text-xs text-muted-foreground font-medium">View as user:</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {allUsers
                            .filter(u => u.id !== (originalUser?.id || user?.id))
                            .map((targetUser) => (
                              <DropdownMenuItem
                                key={targetUser.id}
                                className="cursor-pointer text-sm"
                                onClick={() => handleImpersonate(targetUser.id)}
                                disabled={isStartingImpersonation}
                                data-testid={`button-impersonate-${targetUser.id}`}
                              >
                                <UserCog className="mr-2 h-4 w-4" />
                                {targetUser.firstName} {targetUser.lastName}
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {targetUser.teamName || targetUser.email}
                                </span>
                              </DropdownMenuItem>
                            ))}
                        </div>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => logout()}
                      disabled={isLoggingOut}
                      data-testid="button-logout"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {isLoggingOut ? "Logging out..." : "Log out"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Link href="/">
                <Button data-testid="button-login">
                  Log In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
    </>
  );
}
