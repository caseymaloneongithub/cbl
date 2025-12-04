import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";
import { sendPasswordResetEmail } from "./email";

declare module "express-session" {
  interface SessionData {
    userId: string;
    originalUserId?: string; // Set when super admin is impersonating another user
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
      sameSite: "lax",
    },
  });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateRandomPassword(length: number = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (!user.passwordHash) {
        return res.status(401).json({ message: "Account not set up. Contact your commissioner." });
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ message: "Session error" });
        }
        req.session.userId = user.id;
        req.session.save((err) => {
          if (err) {
            return res.status(500).json({ message: "Session error" });
          }
          res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            teamName: user.teamName,
            isCommissioner: user.isCommissioner,
            isSuperAdmin: user.isSuperAdmin,
            mustResetPassword: user.mustResetPassword,
          });
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }

      // Check if we're impersonating
      const isImpersonating = !!req.session.originalUserId;
      let originalUser = null;
      if (isImpersonating) {
        originalUser = await storage.getUser(req.session.originalUserId!);
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        teamName: user.teamName,
        budget: user.budget,
        isCommissioner: user.isCommissioner,
        isSuperAdmin: user.isSuperAdmin,
        mustResetPassword: user.mustResetPassword,
        isImpersonating,
        originalUser: originalUser ? {
          id: originalUser.id,
          email: originalUser.email,
          firstName: originalUser.firstName,
          lastName: originalUser.lastName,
          isSuperAdmin: originalUser.isSuperAdmin,
        } : null,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Super admin: Start impersonating another user
  app.post("/api/auth/impersonate/:userId", isAuthenticated, async (req, res) => {
    try {
      const adminId = req.session.originalUserId || req.session.userId!;
      const admin = await storage.getUser(adminId);
      
      if (!admin?.isSuperAdmin) {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const targetUserId = req.params.userId;
      const targetUser = await storage.getUser(targetUserId);
      
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Can't impersonate yourself
      if (targetUserId === adminId) {
        return res.status(400).json({ message: "Cannot impersonate yourself" });
      }

      // Store original admin ID and switch to target user
      req.session.originalUserId = adminId;
      req.session.userId = targetUserId;
      
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ message: "Session error" });
        }
        res.json({
          message: "Now impersonating user",
          user: {
            id: targetUser.id,
            email: targetUser.email,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
            teamName: targetUser.teamName,
          }
        });
      });
    } catch (error) {
      console.error("Impersonate error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Super admin: Stop impersonating and return to own account
  app.post("/api/auth/stop-impersonate", isAuthenticated, async (req, res) => {
    try {
      if (!req.session.originalUserId) {
        return res.status(400).json({ message: "Not currently impersonating" });
      }

      const originalUserId = req.session.originalUserId;
      const originalUser = await storage.getUser(originalUserId);
      
      if (!originalUser) {
        return res.status(404).json({ message: "Original user not found" });
      }

      // Restore original admin session
      req.session.userId = originalUserId;
      delete req.session.originalUserId;
      
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ message: "Session error" });
        }
        res.json({
          message: "Stopped impersonating",
          user: {
            id: originalUser.id,
            email: originalUser.email,
            firstName: originalUser.firstName,
            lastName: originalUser.lastName,
            isSuperAdmin: originalUser.isSuperAdmin,
          }
        });
      });
    } catch (error) {
      console.error("Stop impersonate error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/change-password", isAuthenticated, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.session.userId!;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      // If user has a password hash, verify current password is provided and correct
      // Exception: Users in forced reset state don't need current password
      if (user.passwordHash && !user.mustResetPassword) {
        if (!currentPassword) {
          return res.status(400).json({ message: "Current password is required" });
        }
        const isValid = await verifyPassword(currentPassword, user.passwordHash);
        if (!isValid) {
          return res.status(401).json({ message: "Current password is incorrect" });
        }
      }

      // If user has no password hash but is also not in forced reset state,
      // this is an invalid account state - reject the request
      if (!user.passwordHash && !user.mustResetPassword) {
        return res.status(400).json({ message: "Account not properly configured" });
      }

      const newHash = await hashPassword(newPassword);
      await storage.updateUserPassword(userId, newHash, false);

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Request password reset (unauthenticated - public endpoint)
  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ message: "If an account with that email exists, a reset link has been sent." });
      }

      // Generate a secure random token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Store the token
      await storage.createPasswordResetToken(user.id, token, expiresAt);

      // Get the app URL from request
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost:5000";
      const appUrl = `${protocol}://${host}`;

      // Send the email
      const result = await sendPasswordResetEmail(
        user.email,
        user.firstName || "User",
        token,
        appUrl
      );

      if (!result.success) {
        console.error("Failed to send password reset email:", result.error);
        // Still return success to user to prevent information leakage
      }

      res.json({ message: "If an account with that email exists, a reset link has been sent." });
    } catch (error) {
      console.error("Request password reset error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Verify password reset token (unauthenticated - for checking if token is valid)
  app.get("/api/auth/verify-reset-token/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ valid: false, message: "Invalid or expired reset link" });
      }

      if (resetToken.usedAt) {
        return res.status(400).json({ valid: false, message: "This reset link has already been used" });
      }

      if (new Date() > new Date(resetToken.expiresAt)) {
        return res.status(400).json({ valid: false, message: "This reset link has expired" });
      }

      const user = await storage.getUser(resetToken.userId);
      if (!user) {
        return res.status(400).json({ valid: false, message: "User not found" });
      }

      res.json({ 
        valid: true, 
        email: user.email,
        firstName: user.firstName 
      });
    } catch (error) {
      console.error("Verify reset token error:", error);
      res.status(500).json({ valid: false, message: "Internal server error" });
    }
  });

  // Reset password using token (unauthenticated)
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Reset token is required" });
      }

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      if (resetToken.usedAt) {
        return res.status(400).json({ message: "This reset link has already been used" });
      }

      if (new Date() > new Date(resetToken.expiresAt)) {
        return res.status(400).json({ message: "This reset link has expired" });
      }

      const user = await storage.getUser(resetToken.userId);
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      // Update the password
      const newHash = await hashPassword(newPassword);
      await storage.updateUserPassword(user.id, newHash, false);

      // Mark the token as used
      await storage.markPasswordResetTokenUsed(resetToken.id);

      // Clean up expired tokens periodically
      await storage.deleteExpiredPasswordResetTokens();

      res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
