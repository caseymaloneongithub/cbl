import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Diamond, Gavel, Clock, TrendingUp, Users, Shield } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Diamond className="h-12 w-12 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Strat League Auction
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              The ultimate platform for managing your league's free agent auctions.
              Multi-year contracts, automated bidding, and real-time updates.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild data-testid="button-hero-login">
                <a href="/api/login">
                  Get Started
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#features">
                  Learn More
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-card/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">Everything You Need</h2>
            <p className="mt-4 text-muted-foreground">
              Powerful tools for commissioners and team owners alike
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card className="bg-background">
              <CardHeader>
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 w-fit">
                  <Gavel className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Smart Bidding</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Place manual bids or set up auto-bidding to compete automatically up to your maximum amount.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background">
              <CardHeader>
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 w-fit">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Timed Auctions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Each player has a specific end time. Real-time countdown timers keep you informed.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background">
              <CardHeader>
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 w-fit">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Multi-Year Contracts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Bid on contracts from 1 to 5 years with commissioner-set year multipliers for total value calculation.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background">
              <CardHeader>
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 w-fit">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>CSV Import</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Commissioners can easily upload free agents via CSV with names, positions, and auction end times.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background">
              <CardHeader>
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 w-fit">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>10% Minimum Increase</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Every new bid must beat the previous by at least 10% in total value, ensuring fair competition.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background">
              <CardHeader>
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 w-fit">
                  <Diamond className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Track Your Portfolio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Monitor all your active bids, see when you've been outbid, and celebrate your wins.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-primary/5 border border-primary/10 px-8 py-16 text-center">
            <h2 className="text-3xl font-bold">Ready to Start Bidding?</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Log in to access the auction platform and start building your championship team.
            </p>
            <Button size="lg" className="mt-8" asChild data-testid="button-cta-login">
              <a href="/api/login">
                Enter the Auction
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Diamond className="h-4 w-4" />
            <span className="text-sm">Strat League Auction Platform</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
