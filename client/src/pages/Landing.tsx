import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Diamond } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto rounded-full bg-primary/10 p-4 w-fit">
            <Diamond className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Strat League Auction</CardTitle>
          <CardDescription>
            Sign in to access the auction platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" size="lg" asChild data-testid="button-login">
            <a href="/api/login">
              Sign In
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
