import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
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
} from "@/components/ui/dropdown-menu";
import { Diamond, Users, Gavel, Trophy, Settings, LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Free Agents", icon: Users },
  { href: "/my-bids", label: "My Bids", icon: Gavel },
  { href: "/results", label: "Results", icon: Trophy },
];

export function Header() {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover-elevate active-elevate-2 rounded-md px-2 py-1">
            <Diamond className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg hidden sm:inline">Strat League</span>
          </Link>

          {/* Desktop Navigation */}
          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location === link.href;
                return (
                  <Link key={link.href} href={link.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      data-testid={`nav-${link.label.toLowerCase().replace(" ", "-")}`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {link.label}
                    </Button>
                  </Link>
                );
              })}
              {user?.isCommissioner && (
                <Link href="/commissioner">
                  <Button
                    variant={location === "/commissioner" ? "secondary" : "ghost"}
                    size="sm"
                    data-testid="nav-commissioner"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Commissioner
                  </Button>
                </Link>
              )}
            </nav>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {isAuthenticated ? (
              <>
                {/* Mobile Menu */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-64">
                    <nav className="flex flex-col gap-2 mt-8">
                      {navLinks.map((link) => {
                        const Icon = link.icon;
                        const isActive = location === link.href;
                        return (
                          <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}>
                            <Button
                              variant={isActive ? "secondary" : "ghost"}
                              className="w-full justify-start"
                            >
                              <Icon className="h-4 w-4 mr-2" />
                              {link.label}
                            </Button>
                          </Link>
                        );
                      })}
                      {user?.isCommissioner && (
                        <Link href="/commissioner" onClick={() => setMobileMenuOpen(false)}>
                          <Button
                            variant={location === "/commissioner" ? "secondary" : "ghost"}
                            className="w-full justify-start"
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Commissioner
                          </Button>
                        </Link>
                      )}
                    </nav>
                  </SheetContent>
                </Sheet>

                {/* User Menu */}
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
                    {user?.isCommissioner && (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1">
                          <Badge variant="secondary" className="text-xs">
                            Commissioner
                          </Badge>
                        </div>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href="/api/logout" className="cursor-pointer" data-testid="button-logout">
                        <LogOut className="mr-2 h-4 w-4" />
                        Log out
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button asChild data-testid="button-login">
                <a href="/api/login">Log In</a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
