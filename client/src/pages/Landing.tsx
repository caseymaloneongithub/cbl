import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Diamond, Loader2, Mail, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Landing() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { login, isLoggingIn } = useAuth();
  const { toast } = useToast();

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setIsRequestingReset(true);
    try {
      await apiRequest("POST", "/api/auth/request-password-reset", { email: resetEmail });
      setResetEmailSent(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    } finally {
      setIsRequestingReset(false);
    }
  };

  const handleCloseForgotPassword = () => {
    setShowForgotPassword(false);
    setResetEmail("");
    setResetEmailSent(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please enter your email and password",
        variant: "destructive",
      });
      return;
    }

    try {
      await login({ email, password });
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto rounded-full bg-primary/10 p-4 w-fit">
            <Diamond className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">CBL Auctions</CardTitle>
          <CardDescription>
            Sign in to access the auction platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoggingIn}
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoggingIn}
                data-testid="input-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoggingIn}
              data-testid="button-login"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-forgot-password"
              >
                Forgot your password?
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={showForgotPassword} onOpenChange={handleCloseForgotPassword}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit mb-2">
              {resetEmailSent ? (
                <CheckCircle className="h-6 w-6 text-primary" />
              ) : (
                <Mail className="h-6 w-6 text-primary" />
              )}
            </div>
            <DialogTitle className="text-center">
              {resetEmailSent ? "Check Your Email" : "Password Reset"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {resetEmailSent 
                ? "If an account exists with that email, we've sent you a password reset link."
                : "Enter your email address and we'll send you a link to reset your password."
              }
            </DialogDescription>
          </DialogHeader>
          
          {resetEmailSent ? (
            <div className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground text-center">
                The link will expire in 1 hour. If you don't see the email, check your spam folder.
              </p>
              <Button
                className="w-full"
                onClick={handleCloseForgotPassword}
                data-testid="button-close-forgot-password"
              >
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="your@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  disabled={isRequestingReset}
                  data-testid="input-reset-email"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isRequestingReset}
                data-testid="button-send-reset"
              >
                {isRequestingReset ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleCloseForgotPassword}
                disabled={isRequestingReset}
                data-testid="button-cancel-reset"
              >
                Cancel
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
