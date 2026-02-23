import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, MailCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type InviteDetails = {
  valid: boolean;
  reason?: string;
  invite: {
    invitedEmail: string;
    expiresAt: string;
    status: string;
  };
  leagueName: string | null;
  teamName: string | null;
  teamAbbreviation: string | null;
  hasExistingAccount: boolean;
};

export default function TeamInvite() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const token = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("token") || "";
  }, []);

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setLoadingInvite(false);
        return;
      }
      try {
        const res = await fetch(`/api/team-invites/${token}`, { credentials: "include" });
        const data = await res.json();
        setInvite(data);
      } catch {
        setInvite(null);
      } finally {
        setLoadingInvite(false);
      }
    };
    run();
  }, [token]);

  const acceptExisting = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await apiRequest("POST", `/api/team-invites/${token}/accept`);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      toast({ title: "Invite accepted", description: "Team ownership has been transferred to your account." });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Accept failed", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const registerAndAccept = async () => {
    if (!token) return;
    if (!password || password.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", `/api/team-invites/${token}/register`, {
        firstName,
        lastName,
        password,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      toast({ title: "Account created", description: "You are now the team owner." });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInvite || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Invalid Invite Link</CardTitle>
            <CardDescription>No invite token was provided.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Invite Not Found</CardTitle>
            <CardDescription>This invite token is invalid.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="h-5 w-5" />
            Team Ownership Invite
          </CardTitle>
          <CardDescription>
            {invite.leagueName || "League"} • {invite.teamName || "Team"} {invite.teamAbbreviation ? `(${invite.teamAbbreviation})` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={invite.valid ? "secondary" : "destructive"}>
              {invite.valid ? "Valid" : invite.invite.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Invited email: {invite.invite.invitedEmail}
            </span>
          </div>

          {!invite.valid && (
            <p className="text-sm text-destructive">{invite.reason || "Invite is not usable."}</p>
          )}

          {invite.valid && isAuthenticated && (
            <>
              {user?.email?.toLowerCase() !== invite.invite.invitedEmail.toLowerCase() ? (
                <p className="text-sm text-destructive">
                  Signed in as {user?.email}. Sign in with {invite.invite.invitedEmail} to accept this invite.
                </p>
              ) : (
                <Button onClick={acceptExisting} disabled={submitting} data-testid="button-accept-team-invite">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Accept Invite
                </Button>
              )}
            </>
          )}

          {invite.valid && !isAuthenticated && (
            <div className="space-y-4">
              {invite.hasExistingAccount ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    An account already exists for {invite.invite.invitedEmail}. Sign in first, then open this invite link again.
                  </p>
                  <Link href="/">
                    <Button variant="outline">Go To Login</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Create your account to accept this invite.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="first-name">First Name</Label>
                      <Input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="last-name">Last Name</Label>
                      <Input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                  <Button onClick={registerAndAccept} disabled={submitting} data-testid="button-register-and-accept">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Create Account And Accept Invite
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

