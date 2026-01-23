import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { setupAuth, isAuthenticated, hashPassword, generateRandomPassword } from "./auth";
import { insertBidSchema, insertAutoBidSchema, autoBids } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { parse, isValid, format } from "date-fns";
import { syncPlayerStatsFromMLB, testMLBConnection } from "./mlb-api";

const EASTERN_TIMEZONE = "America/New_York";
const CST_TIMEZONE = "America/Chicago";

// Parse date string as CST (Central Standard Time) - used for CSV imports
function parseCSTTime(dateString: string): Date {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error(`Invalid date: empty or not a string`);
  }
  
  const trimmed = dateString.trim();
  if (!trimmed) {
    throw new Error(`Invalid date: empty string`);
  }
  
  // Try multiple date formats
  const formats = [
    "M/d/yyyy h:mm a",
    "M/d/yyyy h:mma", 
    "M/d/yyyy H:mm",
    "MM/dd/yyyy h:mm a",
    "MM/dd/yyyy h:mma",
    "MM/dd/yyyy H:mm",
    "yyyy-MM-dd HH:mm",
    "yyyy-MM-dd'T'HH:mm:ss",
    "yyyy-MM-dd'T'HH:mm",
  ];
  
  for (const fmt of formats) {
    try {
      const parsed = parse(trimmed, fmt, new Date());
      if (isValid(parsed) && parsed.getFullYear() > 2000) {
        const result = fromZonedTime(parsed, CST_TIMEZONE);
        if (isValid(result)) {
          return result;
        }
      }
    } catch (e) {
      // Try next format
    }
  }
  
  // Try ISO format as CST
  try {
    const normalizedDate = trimmed.replace(" ", "T");
    const result = fromZonedTime(normalizedDate, CST_TIMEZONE);
    if (isValid(result) && result.getFullYear() > 2000) {
      return result;
    }
  } catch (e) {
    // Fall through to error
  }
  
  throw new Error(`Invalid date format: ${dateString}`);
}

// Helper to check if user is commissioner for a specific league or super admin
async function hasLeagueCommissionerAccess(userId: string, leagueId: number): Promise<boolean> {
  const user = await storage.getUser(userId);
  if (user?.isSuperAdmin) return true;
  return storage.isLeagueCommissioner(leagueId, userId);
}

// Helper to check if user is commissioner for auction's league or super admin
async function hasAuctionCommissionerAccess(userId: string, auctionId: number): Promise<boolean> {
  const user = await storage.getUser(userId);
  if (user?.isSuperAdmin) return true;
  const leagueId = await storage.getLeagueIdFromAuction(auctionId);
  if (!leagueId) return false;
  return storage.isLeagueCommissioner(leagueId, userId);
}

function parseEasternTime(dateString: string): Date {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error(`Invalid date: empty or not a string`);
  }
  
  const trimmed = dateString.trim();
  if (!trimmed) {
    throw new Error(`Invalid date: empty string`);
  }
  
  // Try multiple date formats
  const formats = [
    "yyyy-MM-dd'T'HH:mm:ss",
    "yyyy-MM-dd'T'HH:mm",
    "yyyy-MM-dd HH:mm:ss",
    "yyyy-MM-dd HH:mm",
    "MM/dd/yyyy HH:mm:ss",
    "MM/dd/yyyy HH:mm",
    "MM/dd/yyyy h:mm a",
    "MM/dd/yyyy h:mm:ss a",
    "M/d/yyyy HH:mm:ss",
    "M/d/yyyy HH:mm",
    "M/d/yyyy h:mm a",
    "M/d/yyyy h:mm:ss a",
    "M/d/yy HH:mm",
    "M/d/yy h:mm a",
    "MM/dd/yy HH:mm",
    "MM/dd/yy h:mm a",
  ];
  
  for (const fmt of formats) {
    try {
      const parsed = parse(trimmed, fmt, new Date());
      if (isValid(parsed) && parsed.getFullYear() > 2000) {
        const result = fromZonedTime(parsed, EASTERN_TIMEZONE);
        if (isValid(result)) {
          return result;
        }
      }
    } catch (e) {
      // Continue to next format
    }
  }
  
  // Fallback: try normalizing and using fromZonedTime directly
  try {
    const normalizedDate = trimmed.replace(" ", "T");
    const result = fromZonedTime(normalizedDate, EASTERN_TIMEZONE);
    if (isValid(result) && result.getFullYear() > 2000) {
      return result;
    }
  } catch (e) {
    // Fall through to error
  }
  
  throw new Error(`Invalid date format: "${dateString}". Expected formats like "2025-12-17 20:00" or "12/17/2025 8:00 PM"`);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // League settings routes
  app.get("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      
      // Global settings can only be updated by super admin
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Super Admin access required" });
      }

      const settings = await storage.updateSettings(req.body);
      res.json(settings);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Owners routes
  app.get("/api/owners", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      
      // Check for leagueId query parameter
      let leagueId: number | undefined = undefined;
      if (req.query.leagueId) {
        const parsed = parseInt(req.query.leagueId);
        if (!isNaN(parsed)) {
          leagueId = parsed;
        }
      }
      
      if (leagueId) {
        // League-scoped: return league members
        // Super admin can access all leagues
        if (!user?.isSuperAdmin) {
          const membership = await storage.getLeagueMember(leagueId, userId);
          if (!membership) {
            return res.status(403).json({ message: "Not a member of this league" });
          }
          // Only commissioners of the league can manage owners (no global commissioner bypass)
          if (membership.role !== 'commissioner') {
            return res.status(403).json({ message: "Commissioner access required" });
          }
        }
        
        // Return league members with sanitized user info (no sensitive fields)
        const members = await storage.getLeagueMembers(leagueId);
        const owners = members.map(m => ({
          id: m.user.id,
          email: m.user.email,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          profileImageUrl: m.user.profileImageUrl,
          teamName: m.teamName || m.user.teamName,
          teamAbbreviation: m.teamAbbreviation || m.user.teamAbbreviation,
          leagueRole: m.role,
          isArchived: m.isArchived,
        }));
        res.json(owners);
      } else {
        // Legacy behavior: return all users (super admin only)
        if (!user?.isSuperAdmin) {
          return res.status(400).json({ message: "leagueId parameter is required" });
        }
        const owners = await storage.getAllUsers();
        res.json(owners);
      }
    } catch (error) {
      console.error("Error fetching owners:", error);
      res.status(500).json({ message: "Failed to fetch owners" });
    }
  });

  app.patch("/api/owners/:id/commissioner", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Super Admin access required" });
      }

      const { id } = req.params;
      const { isCommissioner } = req.body;
      
      if (isCommissioner) {
        const updatedUser = await storage.setSoleCommissioner(id);
        res.json(updatedUser);
      } else {
        const updatedUser = await storage.setSoleCommissioner(null);
        res.json(updatedUser);
      }
    } catch (error) {
      console.error("Error updating commissioner:", error);
      res.status(500).json({ message: "Failed to update commissioner status" });
    }
  });

  // Super admin set password for any user
  app.post("/api/admin/users/:userId/set-password", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.session.originalUserId || req.session.userId!;
      const admin = await storage.getUser(adminId);
      
      if (!admin?.isSuperAdmin) {
        return res.status(403).json({ message: "Super Admin access required" });
      }

      const { userId } = req.params;
      const { password } = req.body;
      
      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const targetUser = await storage.getUser(userId);
      
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const hashedPassword = await hashPassword(password);
      
      // Update password without forcing reset on login
      await storage.updateUserPassword(userId, hashedPassword, false);

      res.json({ 
        message: "Password set successfully",
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName
      });
    } catch (error) {
      console.error("Error setting user password:", error);
      res.status(500).json({ message: "Failed to set password" });
    }
  });

  // Check if a team can be deleted (requires leagueId for league-scoped check)
  app.get("/api/owners/:id/can-delete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      
      // Super admin can always access
      if (user?.isSuperAdmin) {
        const { id } = req.params;
        const result = await storage.canDeleteUser(id);
        return res.json(result);
      }
      
      // For non-super-admin, require leagueId and verify commissioner role in that league
      const leagueId = req.query.leagueId ? parseInt(req.query.leagueId) : undefined;
      if (!leagueId || isNaN(leagueId)) {
        return res.status(400).json({ message: "leagueId parameter is required" });
      }
      
      const membership = await storage.getLeagueMember(leagueId, userId);
      if (!membership || membership.role !== 'commissioner') {
        return res.status(403).json({ message: "Commissioner access required for this league" });
      }
      
      // Verify target user is a member of the same league
      const { id } = req.params;
      const targetMembership = await storage.getLeagueMember(leagueId, id);
      if (!targetMembership) {
        return res.status(403).json({ message: "Target user is not a member of this league" });
      }

      const result = await storage.canDeleteUser(id);
      res.json(result);
    } catch (error) {
      console.error("Error checking if user can be deleted:", error);
      res.status(500).json({ message: "Failed to check delete status" });
    }
  });

  // Delete a team (only if not in any auctions) - requires leagueId for league-scoped authorization
  app.delete("/api/owners/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      const { id } = req.params;
      
      // Super admin can always delete
      if (!user?.isSuperAdmin) {
        // For non-super-admin, require leagueId and verify commissioner role
        const leagueId = req.query.leagueId ? parseInt(req.query.leagueId) : undefined;
        if (!leagueId || isNaN(leagueId)) {
          return res.status(400).json({ message: "leagueId parameter is required" });
        }
        
        const membership = await storage.getLeagueMember(leagueId, userId);
        if (!membership || membership.role !== 'commissioner') {
          return res.status(403).json({ message: "Commissioner access required for this league" });
        }
        
        // Verify target user is a member of the same league
        const targetMembership = await storage.getLeagueMember(leagueId, id);
        if (!targetMembership) {
          return res.status(403).json({ message: "Target user is not a member of this league" });
        }
      }
      
      // Verify the team can be deleted
      const { canDelete, reason } = await storage.canDeleteUser(id);
      if (!canDelete) {
        return res.status(400).json({ message: reason || "Cannot delete team" });
      }

      await storage.deleteUser(id);
      res.json({ success: true, message: "Team deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting team:", error);
      res.status(500).json({ message: error.message || "Failed to delete team" });
    }
  });

  // Archive/unarchive a team - requires leagueId for league-scoped authorization
  app.patch("/api/owners/:id/archive", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      const { id } = req.params;
      const { isArchived } = req.body;
      
      // Super admin can always archive
      if (!user?.isSuperAdmin) {
        // For non-super-admin, require leagueId and verify commissioner role
        const leagueId = req.query.leagueId ? parseInt(req.query.leagueId) : undefined;
        if (!leagueId || isNaN(leagueId)) {
          return res.status(400).json({ message: "leagueId parameter is required" });
        }
        
        const membership = await storage.getLeagueMember(leagueId, userId);
        if (!membership || membership.role !== 'commissioner') {
          return res.status(403).json({ message: "Commissioner access required for this league" });
        }
        
        // Verify target user is a member of the same league
        const targetMembership = await storage.getLeagueMember(leagueId, id);
        if (!targetMembership) {
          return res.status(403).json({ message: "Target user is not a member of this league" });
        }
      }
      
      const updated = await storage.setUserArchived(id, isArchived);
      res.json(updated);
    } catch (error: any) {
      console.error("Error archiving team:", error);
      res.status(500).json({ message: error.message || "Failed to update team archive status" });
    }
  });

  // Free agents routes
  app.get("/api/free-agents", isAuthenticated, async (req: any, res) => {
    try {
      let auctionId: number | undefined = undefined;
      if (req.query.auctionId) {
        const parsed = parseInt(req.query.auctionId);
        if (!isNaN(parsed)) {
          auctionId = parsed;
        }
      }
      const agents = await storage.getActiveFreeAgents(auctionId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching free agents:", error);
      res.status(500).json({ message: "Failed to fetch free agents" });
    }
  });

  // Get a single free agent with current bid info
  app.get("/api/free-agents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid free agent ID" });
      }
      const agent = await storage.getFreeAgentWithBids(id);
      if (!agent) {
        return res.status(404).json({ message: "Free agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error fetching free agent:", error);
      res.status(500).json({ message: "Failed to fetch free agent" });
    }
  });

  app.get("/api/results", isAuthenticated, async (req: any, res) => {
    try {
      let auctionId: number | undefined = undefined;
      if (req.query.auctionId) {
        const parsed = parseInt(req.query.auctionId);
        if (!isNaN(parsed)) {
          auctionId = parsed;
        }
      }
      const agents = await storage.getClosedFreeAgents(auctionId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching results:", error);
      res.status(500).json({ message: "Failed to fetch results" });
    }
  });
  
  // Get all free agents for a specific auction (active and closed)
  app.get("/api/auctions/:id/free-agents", isAuthenticated, async (req: any, res) => {
    try {
      const auctionId = parseInt(req.params.id);
      const agents = await storage.getFreeAgentsByAuction(auctionId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching auction free agents:", error);
      res.status(500).json({ message: "Failed to fetch auction free agents" });
    }
  });

  // Get expired players with no bids for an auction (for relisting)
  app.get("/api/auctions/:id/expired-no-bids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      if (!await hasAuctionCommissionerAccess(userId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const agents = await storage.getExpiredFreeAgentsNoBids(auctionId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching expired players:", error);
      res.status(500).json({ message: "Failed to fetch expired players" });
    }
  });

  app.post("/api/free-agents/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const { players, auctionId } = req.body;
      
      if (!Array.isArray(players) || players.length === 0) {
        return res.status(400).json({ message: "No players provided" });
      }

      // Require auction ID - players must be tied to a specific auction
      if (!auctionId) {
        return res.status(400).json({ message: "Auction ID is required - please select an auction for these players" });
      }
      
      const auction = await storage.getAuction(auctionId);
      if (!auction) {
        return res.status(400).json({ message: "Invalid auction ID" });
      }
      
      if (!await hasAuctionCommissionerAccess(userId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      
      const targetAuctionId = auctionId;

      const defaultEndTime = new Date();
      defaultEndTime.setDate(defaultEndTime.getDate() + 7);

      // Helper to check if a value was explicitly provided in CSV (not blank)
      const isProvided = (val: any): boolean => val !== undefined && val !== null && val !== "";
      
      // Parse stats (all optional) - returns null for blank values
      const parseNum = (val: any): number | null => {
        if (!isProvided(val)) return null;
        const num = Number(val);
        return isNaN(num) ? null : num;
      };

      // Validate and sanitize player data - track which fields were explicitly provided
      const invalidPlayers: string[] = [];
      const agentsData = players.map((p: any, index: number) => {
        const name = p.name?.trim();
        if (!name) {
          invalidPlayers.push(`Row ${index + 2}: Missing player name`);
        }
        
        // Track which fields were explicitly provided for upsert logic
        const providedFields: Record<string, boolean> = {
          minimumBid: isProvided(p.minimumBid),
          minimumYears: isProvided(p.minimumYears),
          playerType: isProvided(p.playerType) || isProvided(p.type),
          team: isProvided(p.team),
          auctionStartTime: isProvided(p.auctionStartTime),
          auctionEndTime: isProvided(p.auctionEndTime),
          avg: isProvided(p.avg),
          hr: isProvided(p.hr),
          rbi: isProvided(p.rbi),
          runs: isProvided(p.runs),
          sb: isProvided(p.sb),
          ops: isProvided(p.ops),
          pa: isProvided(p.pa),
          wins: isProvided(p.wins),
          losses: isProvided(p.losses),
          era: isProvided(p.era),
          whip: isProvided(p.whip),
          strikeouts: isProvided(p.strikeouts),
          ip: isProvided(p.ip),
        };
        
        // Validate minimumBid: must be a valid number >= 1 (only if provided)
        let minimumBid = 1;
        if (providedFields.minimumBid) {
          const parsedBid = Number(p.minimumBid);
          if (isNaN(parsedBid) || parsedBid < 1) {
            invalidPlayers.push(`Row ${index + 2} (${name || "unknown"}): Invalid minimum bid "${p.minimumBid}" - must be a number >= 1`);
          } else {
            minimumBid = parsedBid;
          }
        }
        
        // Validate minimumYears: must be a valid number 1-5 (only if provided)
        let minimumYears = 1;
        if (providedFields.minimumYears) {
          const parsedYears = Number(p.minimumYears);
          if (isNaN(parsedYears) || parsedYears < 1 || parsedYears > 5) {
            invalidPlayers.push(`Row ${index + 2} (${name || "unknown"}): Invalid minimum years "${p.minimumYears}" - must be 1-5`);
          } else {
            minimumYears = Math.floor(parsedYears);
          }
        }
        
        // Determine player type - accepts "pitcher" or "hitter" (default to hitter for new players)
        const rawType = (p.playerType || p.type || "hitter").toLowerCase().trim();
        const playerType = rawType === "pitcher" || rawType === "p" ? "pitcher" : "hitter";

        return {
          providedFields,
          data: {
            name: name || `Unknown Player ${index}`,
            team: p.team || null,
            playerType,
            minimumBid,
            minimumYears,
            auctionStartTime: p.auctionStartTime ? parseCSTTime(p.auctionStartTime) : null,
            auctionEndTime: p.auctionEndTime ? parseCSTTime(p.auctionEndTime) : defaultEndTime,
            isActive: true,
            auctionId: targetAuctionId,
            // Hitter stats
            avg: parseNum(p.avg),
            hr: parseNum(p.hr) !== null ? Math.floor(parseNum(p.hr)!) : null,
            rbi: parseNum(p.rbi) !== null ? Math.floor(parseNum(p.rbi)!) : null,
            runs: parseNum(p.runs) !== null ? Math.floor(parseNum(p.runs)!) : null,
            sb: parseNum(p.sb) !== null ? Math.floor(parseNum(p.sb)!) : null,
            ops: parseNum(p.ops),
            pa: parseNum(p.pa) !== null ? Math.floor(parseNum(p.pa)!) : null,
            // Pitcher stats
            wins: parseNum(p.wins) !== null ? Math.floor(parseNum(p.wins)!) : null,
            losses: parseNum(p.losses) !== null ? Math.floor(parseNum(p.losses)!) : null,
            era: parseNum(p.era),
            whip: parseNum(p.whip),
            strikeouts: parseNum(p.strikeouts) !== null ? Math.floor(parseNum(p.strikeouts)!) : null,
            ip: parseNum(p.ip),
          }
        };
      });
      
      const agentsToCreate = agentsData.map(a => a.data);
      
      // If there are validation errors, reject the entire upload
      if (invalidPlayers.length > 0) {
        return res.status(400).json({ 
          message: `CSV validation failed:\n${invalidPlayers.slice(0, 5).join('\n')}${invalidPlayers.length > 5 ? `\n... and ${invalidPlayers.length - 5} more errors` : ''}` 
        });
      }

      // UPSERT LOGIC: Check for existing players by name in this auction
      const playerNames = agentsToCreate.map(a => a.name);
      const existingAgents = await storage.getFreeAgentsByNameAndAuction(playerNames, targetAuctionId);
      
      // Create a map of lowercase names to existing agents for quick lookup
      const existingMap = new Map<string, typeof existingAgents[0]>();
      for (const agent of existingAgents) {
        existingMap.set(agent.name.toLowerCase().trim(), agent);
      }
      
      // Separate into updates and inserts - track provided fields for updates
      const agentsToInsert: typeof agentsToCreate = [];
      const agentsToUpdate: { id: number; data: typeof agentsToCreate[0]; providedFields: Record<string, boolean> }[] = [];
      const skippedWonPlayers: string[] = [];
      
      const now = new Date();
      const skippedExpiredPlayers: string[] = [];
      
      for (let i = 0; i < agentsData.length; i++) {
        const { data, providedFields } = agentsData[i];
        const existing = existingMap.get(data.name.toLowerCase().trim());
        if (existing) {
          // Skip players that have already been won - don't allow updates
          if (existing.winnerId) {
            skippedWonPlayers.push(existing.name);
            continue;
          }
          // Skip players whose auction has already expired (even if no winner yet)
          if (existing.auctionEndTime && new Date(existing.auctionEndTime) <= now) {
            skippedExpiredPlayers.push(existing.name);
            continue;
          }
          // Update existing player - only with explicitly provided fields
          agentsToUpdate.push({ id: existing.id, data, providedFields });
        } else {
          agentsToInsert.push(data);
        }
      }
      
      // Perform inserts
      const newAgents = agentsToInsert.length > 0 
        ? await storage.createFreeAgentsBulk(agentsToInsert) 
        : [];
      
      // Perform updates - only update fields that were explicitly provided in CSV
      const updatedAgents: typeof existingAgents = [];
      for (const { id, data, providedFields } of agentsToUpdate) {
        // Build update object with only explicitly provided fields
        const updateData: any = {};
        
        // Only include fields that were explicitly provided in the CSV
        if (providedFields.team) updateData.team = data.team;
        if (providedFields.playerType) updateData.playerType = data.playerType;
        if (providedFields.minimumBid) updateData.minimumBid = data.minimumBid;
        if (providedFields.minimumYears) updateData.minimumYears = data.minimumYears;
        if (providedFields.auctionStartTime) updateData.auctionStartTime = data.auctionStartTime;
        if (providedFields.auctionEndTime) updateData.auctionEndTime = data.auctionEndTime;
        // Stats
        if (providedFields.avg) updateData.avg = data.avg;
        if (providedFields.hr) updateData.hr = data.hr;
        if (providedFields.rbi) updateData.rbi = data.rbi;
        if (providedFields.runs) updateData.runs = data.runs;
        if (providedFields.sb) updateData.sb = data.sb;
        if (providedFields.ops) updateData.ops = data.ops;
        if (providedFields.pa) updateData.pa = data.pa;
        if (providedFields.wins) updateData.wins = data.wins;
        if (providedFields.losses) updateData.losses = data.losses;
        if (providedFields.era) updateData.era = data.era;
        if (providedFields.whip) updateData.whip = data.whip;
        if (providedFields.strikeouts) updateData.strikeouts = data.strikeouts;
        if (providedFields.ip) updateData.ip = data.ip;
        
        // Only update if there are fields to update
        if (Object.keys(updateData).length > 0) {
          const updated = await storage.updateFreeAgent(id, updateData);
          if (updated) {
            updatedAgents.push(updated);
          }
        }
      }
      
      // Check for warnings
      const warnings: string[] = [];
      
      // Add info about updates vs inserts
      const totalSkipped = skippedWonPlayers.length + skippedExpiredPlayers.length;
      if (updatedAgents.length > 0 || totalSkipped > 0) {
        let msg = `Updated ${updatedAgents.length} existing player(s), added ${newAgents.length} new player(s).`;
        if (skippedWonPlayers.length > 0) {
          msg += ` Skipped ${skippedWonPlayers.length} already-won player(s).`;
        }
        if (skippedExpiredPlayers.length > 0) {
          msg += ` Skipped ${skippedExpiredPlayers.length} expired auction(s).`;
        }
        warnings.unshift(msg);
      }
      
      // Check if all hitters have PA = 0 or null
      const hitters = agentsToCreate.filter(a => a.playerType === 'hitter');
      if (hitters.length > 0) {
        const hittersWithPA = hitters.filter(a => a.pa !== null && a.pa > 0);
        if (hittersWithPA.length === 0) {
          warnings.push("Warning: All hitters have PA = 0 or missing. If your CSV has a different column name for plate appearances (like 'ab'), the PA values were not imported. You may need to re-upload with a 'pa' column.");
        }
      }
      
      // Check if all pitchers have IP = 0 or null
      const pitchers = agentsToCreate.filter(a => a.playerType === 'pitcher');
      if (pitchers.length > 0) {
        const pitchersWithIP = pitchers.filter(a => a.ip !== null && a.ip > 0);
        if (pitchersWithIP.length === 0) {
          warnings.push("Warning: All pitchers have IP = 0 or missing. The IP values were not imported correctly.");
        }
      }
      
      // Handle cblTeam - create bids for players that have an existing bid
      // Map player names (lowercase) to their newly created/updated agent IDs
      const allAgents = [...newAgents, ...updatedAgents];
      const agentByName = new Map<string, typeof allAgents[0]>();
      for (const agent of allAgents) {
        agentByName.set(agent.name.toLowerCase().trim(), agent);
      }
      
      // Get league members to map team abbreviations to user IDs
      let bidsCreated = 0;
      const bidErrors: string[] = [];
      
      if (auction.leagueId) {
        const leagueMembers = await storage.getLeagueMembers(auction.leagueId);
        const auctionTeams = await storage.getAuctionTeams(targetAuctionId);
        
        // Create a map of team abbreviation (lowercase) to user ID
        const abbrevToUserId = new Map<string, string>();
        for (const member of leagueMembers) {
          if (member.user.teamAbbreviation) {
            abbrevToUserId.set(member.user.teamAbbreviation.toLowerCase().trim(), member.userId);
          }
        }
        
        // Create a set of enrolled user IDs
        const enrolledUserIds = new Set(auctionTeams.map(t => t.userId));
        
        // Process players with cblTeam (support multiple column name variations)
        for (let i = 0; i < players.length; i++) {
          const p = players[i];
          const cblTeam = (p.cblTeam ?? p.cblteam ?? p.cbl_team ?? p.CBLTeam ?? p.CBLTEAM)?.trim();
          if (!cblTeam) continue;
          
          const playerName = p.name?.trim().toLowerCase();
          const agent = agentByName.get(playerName);
          if (!agent) continue; // Player wasn't created/updated (maybe skipped)
          
          // Find the user by team abbreviation
          const biddingUserId = abbrevToUserId.get(cblTeam.toLowerCase());
          if (!biddingUserId) {
            bidErrors.push(`Row ${i + 2} (${p.name}): Team abbreviation "${cblTeam}" not found in league`);
            continue;
          }
          
          // Check if user is enrolled in this auction
          if (!enrolledUserIds.has(biddingUserId)) {
            bidErrors.push(`Row ${i + 2} (${p.name}): Team "${cblTeam}" is not enrolled in this auction`);
            continue;
          }
          
          // Calculate bid amount and years from bidMinDollars/bidMinYears or fall back to minimumBid/minimumYears
          // Support multiple column name variations (case-insensitive matching done by CSV parser)
          const bidAmount = p.bidMinDollars ?? p.bidmindollars ?? p.bid_min_dollars ?? p.minimumBid ?? p.minimumbid ?? 1;
          const bidYears = p.bidMinYears ?? p.bidminyears ?? p.bid_min_years ?? p.minimumYears ?? p.minimumyears ?? 1;
          
          // Calculate total value using auction's year factors
          const yearFactors = [
            auction.yearFactor1,
            auction.yearFactor2,
            auction.yearFactor3,
            auction.yearFactor4,
            auction.yearFactor5,
          ];
          const yearFactor = yearFactors[bidYears - 1] || bidYears;
          const totalValue = Math.round(bidAmount * yearFactor);
          
          try {
            await storage.createBid({
              freeAgentId: agent.id,
              userId: biddingUserId,
              amount: bidAmount,
              years: bidYears,
              totalValue,
              isAutoBid: false,
              isImportedInitial: true, // Mark as imported bid - subsequent bids must have more years
            });
            
            // Update the free agent's minimumYears to require more years than the imported bid
            // This ensures UI shows correct minimum and all validators align
            const newMinYears = bidYears + 1;
            if (newMinYears > (agent.minimumYears || 1)) {
              await storage.updateFreeAgent(agent.id, { minimumYears: newMinYears });
            }
            
            bidsCreated++;
          } catch (err: any) {
            bidErrors.push(`Row ${i + 2} (${p.name}): Failed to create bid - ${err.message || err}`);
          }
        }
      }
      
      // Add bid-related warnings
      if (bidsCreated > 0) {
        warnings.push(`Created ${bidsCreated} bid(s) from cblTeam column.`);
      }
      if (bidErrors.length > 0) {
        const maxErrors = 5;
        warnings.push(`Bid import errors: ${bidErrors.slice(0, maxErrors).join('; ')}${bidErrors.length > maxErrors ? ` ... and ${bidErrors.length - maxErrors} more` : ''}`);
      }
      
      res.json({ 
        players: [...newAgents, ...updatedAgents], 
        count: newAgents.length + updatedAgents.length,
        inserted: newAgents.length,
        updated: updatedAgents.length,
        bidsCreated,
        warnings 
      });
    } catch (error: any) {
      console.error("Error uploading free agents:", error);
      const errorMessage = error?.message || String(error);
      const errorCode = error?.code || 'unknown';
      res.status(500).json({ 
        message: `Failed to upload free agents: ${errorMessage}`,
        code: errorCode
      });
    }
  });

  // Commissioner: Update stats for existing players by name (CSV re-upload)
  app.patch("/api/free-agents/bulk-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const { players, auctionId } = req.body;
      
      // Validate input
      if (!auctionId || typeof auctionId !== 'number') {
        return res.status(400).json({ message: "Valid auction ID is required" });
      }
      
      if (!Array.isArray(players) || players.length === 0) {
        return res.status(400).json({ message: "No players provided" });
      }
      
      // Basic validation: ensure each player has a name field
      const invalidPlayers = players.filter((p: any) => !p || typeof p.name !== 'string' || !p.name.trim());
      if (invalidPlayers.length > 0) {
        return res.status(400).json({ message: `${invalidPlayers.length} player(s) missing required 'name' field` });
      }
      
      const auction = await storage.getAuction(auctionId);
      if (!auction) {
        return res.status(400).json({ message: "Invalid auction ID" });
      }
      
      if (!await hasAuctionCommissionerAccess(userId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      // Get ALL players for this auction (including closed/won)
      const existingAgents = await storage.getFreeAgentsByAuction(auctionId);
      
      const parseNum = (val: any): number | null => {
        if (val === undefined || val === null || val === "") return null;
        const num = Number(val);
        return isNaN(num) ? null : num;
      };
      
      // Normalize names to handle accents, tildes, and special characters
      const normalizeName = (name: string): string => {
        return name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") // Remove accent marks
          .toLowerCase()
          .replace(/[^a-z\s]/g, "") // Remove non-letter characters
          .replace(/\s+/g, " ")
          .trim();
      };

      const results: { name: string; updated: boolean; reason?: string }[] = [];
      
      for (const p of players) {
        const name = p.name?.trim();
        if (!name) {
          results.push({ name: '(empty)', updated: false, reason: 'Missing name' });
          continue;
        }
        
        // Find matching player by normalized name (handles accents, tildes, special chars)
        const normalizedInputName = normalizeName(name);
        const matchingAgent = existingAgents.find(
          a => normalizeName(a.name) === normalizedInputName
        );
        
        if (!matchingAgent) {
          results.push({ name, updated: false, reason: 'Player not found in auction' });
          continue;
        }
        
        // Build update object with only stats that have values
        const statsUpdate: Record<string, number | null> = {};
        
        // Hitter stats
        if (parseNum(p.pa) !== null) statsUpdate.pa = Math.floor(parseNum(p.pa)!);
        if (parseNum(p.hr) !== null) statsUpdate.hr = Math.floor(parseNum(p.hr)!);
        if (parseNum(p.rbi) !== null) statsUpdate.rbi = Math.floor(parseNum(p.rbi)!);
        if (parseNum(p.runs) !== null) statsUpdate.runs = Math.floor(parseNum(p.runs)!);
        if (parseNum(p.sb) !== null) statsUpdate.sb = Math.floor(parseNum(p.sb)!);
        if (parseNum(p.avg) !== null) statsUpdate.avg = parseNum(p.avg);
        if (parseNum(p.ops) !== null) statsUpdate.ops = parseNum(p.ops);
        
        // Pitcher stats
        if (parseNum(p.ip) !== null) statsUpdate.ip = parseNum(p.ip);
        if (parseNum(p.wins) !== null) statsUpdate.wins = Math.floor(parseNum(p.wins)!);
        if (parseNum(p.losses) !== null) statsUpdate.losses = Math.floor(parseNum(p.losses)!);
        if (parseNum(p.era) !== null) statsUpdate.era = parseNum(p.era);
        if (parseNum(p.whip) !== null) statsUpdate.whip = parseNum(p.whip);
        if (parseNum(p.strikeouts) !== null) statsUpdate.strikeouts = Math.floor(parseNum(p.strikeouts)!);
        
        if (Object.keys(statsUpdate).length === 0) {
          results.push({ name, updated: false, reason: 'No stats to update' });
          continue;
        }
        
        // Update the player's stats
        await storage.updateFreeAgentStats(matchingAgent.id, statsUpdate);
        results.push({ name, updated: true });
      }
      
      const updatedCount = results.filter(r => r.updated).length;
      const notFoundResults = results.filter(r => !r.updated && r.reason === 'Player not found in auction');
      const notFoundCount = notFoundResults.length;
      const notFoundPlayers = notFoundResults.map(r => r.name);
      
      res.json({
        updatedCount,
        notFoundCount,
        notFoundPlayers,
        totalProcessed: players.length,
        results: results.slice(0, 20), // Return first 20 results for debugging
      });
    } catch (error: any) {
      console.error("Error updating free agent stats:", error);
      res.status(500).json({ 
        message: `Failed to update stats: ${error?.message || String(error)}`
      });
    }
  });

  // Commissioner: Sync stats from MLB API for free agents in an auction
  app.post("/api/free-agents/sync-mlb-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const { auctionId, season, selectedStats } = req.body;
      
      if (!auctionId || typeof auctionId !== 'number') {
        return res.status(400).json({ message: "Valid auction ID is required" });
      }
      
      if (!season || typeof season !== 'number' || season < 2000 || season > 2030) {
        return res.status(400).json({ message: "Valid season year is required (2000-2030)" });
      }
      
      // Validate selectedStats - default to all stats if not provided
      const allStats = ["pa", "hr", "rbi", "runs", "sb", "avg", "ops", "ip", "wins", "losses", "era", "whip", "strikeouts"];
      const statsToSync: string[] = Array.isArray(selectedStats) && selectedStats.length > 0
        ? selectedStats.filter((s: string) => allStats.includes(s))
        : allStats;
      
      const auction = await storage.getAuction(auctionId);
      if (!auction) {
        return res.status(400).json({ message: "Invalid auction ID" });
      }
      
      if (!await hasAuctionCommissionerAccess(userId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      
      // Test MLB API connection first
      const isConnected = await testMLBConnection();
      if (!isConnected) {
        return res.status(503).json({ message: "Unable to connect to MLB Stats API. Please try again later." });
      }
      
      // Get all free agents in this auction
      const freeAgents = await storage.getFreeAgentsByAuction(auctionId);
      if (freeAgents.length === 0) {
        return res.status(400).json({ message: "No free agents found in this auction" });
      }
      
      const playerNames = freeAgents.map(a => a.name);
      
      // Fetch stats from MLB API
      console.log(`[MLB Sync] Fetching ${season} stats for ${playerNames.length} players in auction ${auctionId}`);
      const syncResults = await syncPlayerStatsFromMLB(playerNames, season);
      
      // Update players with found stats
      let updatedCount = 0;
      let notFoundCount = 0;
      const notFoundPlayers: string[] = [];
      const updatedPlayers: { name: string; mlbName: string; stats: string }[] = [];
      
      for (const result of syncResults) {
        if (!result.found || !result.stats) {
          notFoundCount++;
          notFoundPlayers.push(result.playerName);
          continue;
        }
        
        // Find matching free agent
        const agent = freeAgents.find(a => a.name.toLowerCase() === result.playerName.toLowerCase());
        if (!agent) continue;
        
        // Build stats update object (only include selected stats with non-null values)
        const statsUpdate: Record<string, number | null> = {};
        const stats = result.stats;
        
        if (stats.playerType === "hitter") {
          if (statsToSync.includes("pa") && stats.pa !== undefined) statsUpdate.pa = stats.pa;
          if (statsToSync.includes("hr") && stats.hr !== undefined) statsUpdate.hr = stats.hr;
          if (statsToSync.includes("rbi") && stats.rbi !== undefined) statsUpdate.rbi = stats.rbi;
          if (statsToSync.includes("runs") && stats.runs !== undefined) statsUpdate.runs = stats.runs;
          if (statsToSync.includes("sb") && stats.sb !== undefined) statsUpdate.sb = stats.sb;
          if (statsToSync.includes("avg") && stats.avg !== undefined) statsUpdate.avg = stats.avg;
          if (statsToSync.includes("ops") && stats.ops !== undefined) statsUpdate.ops = stats.ops;
        } else {
          if (statsToSync.includes("ip") && stats.ip !== undefined) statsUpdate.ip = stats.ip;
          if (statsToSync.includes("wins") && stats.wins !== undefined) statsUpdate.wins = stats.wins;
          if (statsToSync.includes("losses") && stats.losses !== undefined) statsUpdate.losses = stats.losses;
          if (statsToSync.includes("era") && stats.era !== undefined) statsUpdate.era = stats.era;
          if (statsToSync.includes("whip") && stats.whip !== undefined) statsUpdate.whip = stats.whip;
          if (statsToSync.includes("strikeouts") && stats.strikeouts !== undefined) statsUpdate.strikeouts = stats.strikeouts;
        }
        
        if (Object.keys(statsUpdate).length > 0) {
          await storage.updateFreeAgentStats(agent.id, statsUpdate);
          updatedCount++;
          
          // Build summary of updated stats
          const statsSummary = Object.entries(statsUpdate)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
          
          updatedPlayers.push({
            name: result.playerName,
            mlbName: result.mlbName || result.playerName,
            stats: statsSummary,
          });
        }
      }
      
      console.log(`[MLB Sync] Updated ${updatedCount}/${freeAgents.length} players, ${notFoundCount} not found`);
      
      res.json({
        season,
        totalPlayers: freeAgents.length,
        updatedCount,
        notFoundCount,
        notFoundPlayers: notFoundPlayers.slice(0, 50), // Limit to first 50
        updatedPlayers: updatedPlayers.slice(0, 20), // Show first 20 updates
      });
    } catch (error: any) {
      console.error("Error syncing MLB stats:", error);
      res.status(500).json({ 
        message: `Failed to sync MLB stats: ${error?.message || String(error)}`
      });
    }
  });

  // Commissioner: Relist a player with no bids (new minimum bid and end time)
  app.post("/api/free-agents/:id/relist", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const agentId = parseInt(req.params.id);
      const agent = await storage.getFreeAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ message: "Free agent not found" });
      }
      
      // Check commissioner access for this agent's auction league
      if (agent.auctionId && !await hasAuctionCommissionerAccess(userId, agent.auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      // Check if auction has ended
      if (new Date(agent.auctionEndTime) > new Date()) {
        return res.status(400).json({ message: "Cannot relist - auction is still active" });
      }

      // Check if there are any bids
      const bids = await storage.getBidsForAgent(agentId);
      if (bids.length > 0) {
        return res.status(400).json({ message: "Cannot relist - player has existing bids" });
      }

      const { minimumBid, minimumYears, auctionEndTime } = req.body;
      
      // Validate minimumBid is a valid number >= 1
      const parsedMinBid = Number(minimumBid);
      if (isNaN(parsedMinBid) || parsedMinBid < 1) {
        return res.status(400).json({ message: "Minimum bid must be a valid number of at least $1" });
      }
      
      // Validate minimumYears is a valid number 1-5 (optional, defaults to 1)
      let parsedMinYears = 1;
      if (minimumYears !== undefined && minimumYears !== null && minimumYears !== "") {
        parsedMinYears = Number(minimumYears);
        if (isNaN(parsedMinYears) || parsedMinYears < 1 || parsedMinYears > 5) {
          return res.status(400).json({ message: "Minimum years must be between 1 and 5" });
        }
        parsedMinYears = Math.floor(parsedMinYears);
      }
      
      if (!auctionEndTime) {
        return res.status(400).json({ message: "Auction end time is required" });
      }

      const newEndTime = parseEasternTime(auctionEndTime);
      if (newEndTime <= new Date()) {
        return res.status(400).json({ message: "Auction end time must be in the future" });
      }

      // Update the agent with new minimum bid, minimum years, and end time
      const updatedAgent = await storage.relistFreeAgent(agentId, parsedMinBid, parsedMinYears, newEndTime);
      res.json(updatedAgent);
    } catch (error) {
      console.error("Error relisting free agent:", error);
      res.status(500).json({ message: "Failed to relist free agent" });
    }
  });

  // Bulk relist multiple expired players (commissioner or super admin only)
  app.post("/api/free-agents/bulk-relist", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const { playerIds, minimumBid, minimumYears, auctionEndTime, auctionId } = req.body;
      
      // If auctionId is provided, verify commissioner access upfront
      if (auctionId && !await hasAuctionCommissionerAccess(userId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      if (!Array.isArray(playerIds) || playerIds.length === 0) {
        return res.status(400).json({ message: "At least one player must be selected" });
      }

      // Validate minimumBid
      const parsedMinBid = Number(minimumBid);
      if (isNaN(parsedMinBid) || parsedMinBid < 1) {
        return res.status(400).json({ message: "Minimum bid must be a valid number of at least $1" });
      }

      // Validate minimumYears
      let parsedMinYears = 1;
      if (minimumYears !== undefined && minimumYears !== null && minimumYears !== "") {
        parsedMinYears = Number(minimumYears);
        if (isNaN(parsedMinYears) || parsedMinYears < 1 || parsedMinYears > 5) {
          return res.status(400).json({ message: "Minimum years must be between 1 and 5" });
        }
        parsedMinYears = Math.floor(parsedMinYears);
      }

      if (!auctionEndTime) {
        return res.status(400).json({ message: "Auction end time is required" });
      }

      const newEndTime = parseEasternTime(auctionEndTime);
      if (newEndTime <= new Date()) {
        return res.status(400).json({ message: "Auction end time must be in the future" });
      }

      // Process each player
      const results: { id: number; success: boolean; error?: string }[] = [];
      for (const playerId of playerIds) {
        try {
          const agent = await storage.getFreeAgent(playerId);
          if (!agent) {
            results.push({ id: playerId, success: false, error: "Player not found" });
            continue;
          }
          
          // Check commissioner access for this player's auction
          if (agent.auctionId && !await hasAuctionCommissionerAccess(userId, agent.auctionId)) {
            results.push({ id: playerId, success: false, error: "Commissioner access required" });
            continue;
          }

          // Check if auction is already active
          if (agent.isActive && agent.auctionEndTime && new Date(agent.auctionEndTime) > new Date()) {
            results.push({ id: playerId, success: false, error: "Auction is still active" });
            continue;
          }

          // Check for existing bids
          const bids = await storage.getBidsForAgent(playerId);
          if (bids.length > 0) {
            results.push({ id: playerId, success: false, error: "Has existing bids" });
            continue;
          }

          await storage.relistFreeAgent(playerId, parsedMinBid, parsedMinYears, newEndTime);
          results.push({ id: playerId, success: true });
        } catch (err) {
          results.push({ id: playerId, success: false, error: "Failed to relist" });
        }
      }

      const successCount = results.filter(r => r.success).length;
      res.json({ 
        message: `Successfully relisted ${successCount} of ${playerIds.length} players`,
        results 
      });
    } catch (error) {
      console.error("Error bulk relisting free agents:", error);
      res.status(500).json({ message: "Failed to bulk relist free agents" });
    }
  });

  // Create a single free agent (commissioner or super admin only)
  app.post("/api/free-agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const { name, playerType, team, minimumBid, minimumYears, auctionEndTime, auctionId,
              avg, hr, rbi, runs, sb, ops, pa, wins, losses, era, whip, strikeouts, ip } = req.body;
      
      // Check commissioner access for the target auction
      if (auctionId && !await hasAuctionCommissionerAccess(userId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      
      if (!name?.trim()) {
        return res.status(400).json({ message: "Player name is required" });
      }

      // Validate playerType
      const validPlayerType = playerType === "pitcher" ? "pitcher" : "hitter";

      // Validate minimumBid
      const parsedMinBid = Number(minimumBid) || 1;
      if (parsedMinBid < 1) {
        return res.status(400).json({ message: "Minimum bid must be at least $1" });
      }

      // Validate minimumYears
      const parsedMinYears = Number(minimumYears) || 1;
      if (parsedMinYears < 1 || parsedMinYears > 5) {
        return res.status(400).json({ message: "Minimum years must be between 1 and 5" });
      }

      // Validate auctionEndTime
      if (!auctionEndTime) {
        return res.status(400).json({ message: "Auction end time is required" });
      }
      
      const endTime = parseEasternTime(auctionEndTime);
      if (endTime <= new Date()) {
        return res.status(400).json({ message: "Auction end time must be in the future" });
      }

      // Require explicit auction ID - no fallback to active auction
      if (!auctionId) {
        return res.status(400).json({ message: "Auction selection is required" });
      }
      
      const auction = await storage.getAuction(auctionId);
      if (!auction) {
        return res.status(400).json({ message: "Invalid auction ID" });
      }
      const targetAuctionId = auctionId;

      const parseNum = (val: any): number | null => {
        if (val === undefined || val === null || val === "") return null;
        const num = Number(val);
        return isNaN(num) ? null : num;
      };

      const agent = await storage.createFreeAgent({
        name: name.trim(),
        team: team?.trim() || null,
        playerType: validPlayerType,
        minimumBid: parsedMinBid,
        minimumYears: Math.floor(parsedMinYears),
        auctionEndTime: endTime,
        auctionId: targetAuctionId,
        avg: parseNum(avg),
        hr: parseNum(hr),
        rbi: parseNum(rbi),
        runs: parseNum(runs),
        sb: parseNum(sb),
        ops: parseNum(ops),
        pa: parseNum(pa),
        wins: parseNum(wins),
        losses: parseNum(losses),
        era: parseNum(era),
        whip: parseNum(whip),
        strikeouts: parseNum(strikeouts),
        ip: parseNum(ip),
      });

      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating free agent:", error);
      res.status(500).json({ message: "Failed to create free agent" });
    }
  });

  // Delete a free agent (commissioner or super admin only)
  app.delete("/api/free-agents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const agentId = parseInt(req.params.id);
      const agent = await storage.getFreeAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ message: "Free agent not found" });
      }
      
      // Check commissioner access for this agent's auction league
      if (agent.auctionId && !await hasAuctionCommissionerAccess(userId, agent.auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      await storage.deleteFreeAgent(agentId);
      res.json({ message: "Free agent deleted successfully" });
    } catch (error) {
      console.error("Error deleting free agent:", error);
      res.status(500).json({ message: "Failed to delete free agent" });
    }
  });

  // Bids routes
  app.get("/api/free-agents/:id/bids", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const bids = await storage.getBidsForAgent(parseInt(id));
      res.json(bids);
    } catch (error) {
      console.error("Error fetching bids:", error);
      res.status(500).json({ message: "Failed to fetch bids" });
    }
  });

  app.post("/api/free-agents/:id/bids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const agentId = parseInt(req.params.id);
      
      const agent = await storage.getFreeAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Free agent not found" });
      }

      if (new Date(agent.auctionEndTime) <= new Date()) {
        return res.status(400).json({ message: "Auction has ended" });
      }

      // Check if auction has started (auctionStartTime is optional - null means immediately available)
      if (agent.auctionStartTime && new Date(agent.auctionStartTime) > new Date()) {
        return res.status(400).json({ message: "Bidding has not started yet for this player" });
      }

      const { amount, years } = req.body;
      
      if (!amount || !years || years < 1 || years > 5) {
        return res.status(400).json({ message: "Invalid bid parameters" });
      }

      // Check if bid meets minimum years requirement
      const minimumYears = agent.minimumYears || 1;
      if (years < minimumYears) {
        return res.status(400).json({ 
          message: `This player requires at least a ${minimumYears}-year contract` 
        });
      }

      // Get auction for per-auction settings (year factors, bid increment, budget enforcement)
      const auction = agent.auctionId ? await storage.getAuction(agent.auctionId) : null;
      const yearFactors = auction ? [
        auction.yearFactor1,
        auction.yearFactor2,
        auction.yearFactor3,
        auction.yearFactor4,
        auction.yearFactor5,
      ] : [1.0, 1.25, 1.33, 1.43, 1.55]; // Fallback defaults
      
      // Total Value = amount × factor (year factor already accounts for contract length)
      const totalValue = amount * yearFactors[years - 1];

      // Check if bid meets minimum bid requirement (always enforce the player's minimum)
      if (amount < agent.minimumBid) {
        return res.status(400).json({ 
          message: `Bid must be at least $${agent.minimumBid} (minimum bid for this player)` 
        });
      }
      
      // Get the auction's bid increment (default 10%)
      const bidIncrement = auction?.bidIncrement ?? 0.10;
      
      const currentHighBid = await storage.getHighestBidForAgent(agentId);
      if (currentHighBid) {
        // For imported initial bids, subsequent bids must have more years AND at least match the dollar amount
        if (currentHighBid.isImportedInitial) {
          if (years <= currentHighBid.years) {
            return res.status(400).json({ 
              message: `This player has an imported opening bid. Subsequent bids must have more years than the current bid. Current bid is ${currentHighBid.years} year${currentHighBid.years === 1 ? '' : 's'}, you must bid at least ${currentHighBid.years + 1} years.` 
            });
          }
          if (amount < currentHighBid.amount) {
            return res.status(400).json({ 
              message: `This player has an imported opening bid of $${currentHighBid.amount}. Your bid must be at least $${currentHighBid.amount}.` 
            });
          }
        }
        
        const incrementMultiplier = 1 + bidIncrement;
        
        // Subsequent bid - must beat current high bid by the auction's increment percentage
        const minRequired = currentHighBid.totalValue * incrementMultiplier;
        if (totalValue < minRequired) {
          const incrementPercent = Math.round(bidIncrement * 100);
          return res.status(400).json({ 
            message: `Bid must be at least ${incrementPercent}% higher than current bid. Minimum total value: $${Math.ceil(minRequired)}` 
          });
        }
      }

      // Check budget if enforcement is enabled (per-auction setting)
      // Budget tracks bid AMOUNT, not total value
      const enforceBudget = auction?.enforceBudget ?? true;
      if (enforceBudget && agent.auctionId) {
        let budgetInfo;
        try {
          budgetInfo = await storage.getUserBudgetInfo(userId, agent.auctionId);
        } catch (error) {
          return res.status(400).json({ message: "You are not enrolled in this auction. Please contact the commissioner." });
        }
        
        // Calculate available budget for this bid
        // If user is already high bidder on this auction, that amount is freed up
        let availableForThisBid = budgetInfo.available;
        if (currentHighBid && currentHighBid.userId === userId) {
          availableForThisBid += currentHighBid.amount;
        }
        
        if (amount > availableForThisBid) {
          return res.status(400).json({ 
            message: `Bid exceeds your available budget. Available: $${Math.floor(availableForThisBid)}, Bid amount: $${amount}` 
          });
        }
      }

      // Check team limits (roster, IP, PA)
      const limitsCheck = await storage.canUserBidOnPlayer(userId, agentId);
      if (!limitsCheck.canBid) {
        return res.status(400).json({ message: limitsCheck.reason });
      }

      const bid = await storage.createBid({
        freeAgentId: agentId,
        userId,
        amount,
        years,
        totalValue,
        isAutoBid: false,
      });

      // Check if we need to extend the auction end time (24-hour extension feature)
      let auctionExtended = false;
      if (auction?.extendAuctionOnBid) {
        const now = new Date();
        const endTime = new Date(agent.auctionEndTime);
        const hoursUntilEnd = (endTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        // If bid placed within 24 hours of end time, extend by 24 hours
        if (hoursUntilEnd > 0 && hoursUntilEnd <= 24) {
          const newEndTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
          await storage.updateFreeAgentAuctionEndTime(agentId, newEndTime);
          auctionExtended = true;
          console.log(`[Bid] Extended auction for ${agent.name} to ${newEndTime.toISOString()}`);
        }
      }

      // Process all auto-bids (regular + bundle items) until stable
      const autoBidsTriggered = await processAllAutoBidsUntilStable(agentId, userId, auction);

      res.json({ ...bid, autoBidsTriggered, auctionExtended });
    } catch (error) {
      console.error("Error placing bid:", error);
      res.status(500).json({ message: "Failed to place bid" });
    }
  });

  // Auto-bid routes
  app.get("/api/free-agents/:id/auto-bid", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const agentId = parseInt(req.params.id);
      const autoBid = await storage.getAutoBid(agentId, userId);
      res.json(autoBid || null);
    } catch (error) {
      console.error("Error fetching auto-bid:", error);
      res.status(500).json({ message: "Failed to fetch auto-bid" });
    }
  });

  app.post("/api/free-agents/:id/auto-bid", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const agentId = parseInt(req.params.id);
      
      const agent = await storage.getFreeAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Free agent not found" });
      }

      if (new Date(agent.auctionEndTime) <= new Date()) {
        return res.status(400).json({ message: "Auction has ended" });
      }

      // Check if auto-bidding is enabled for this auction
      if (agent.auctionId) {
        const auction = await storage.getAuction(agent.auctionId);
        if (auction && !auction.allowAutoBidding) {
          return res.status(400).json({ message: "Auto-bidding is not enabled for this auction" });
        }
      }

      // Check if user is enrolled in this auction
      const canBidResult = await storage.canUserBidOnPlayer(userId, agentId);
      if (!canBidResult.canBid) {
        return res.status(400).json({ message: canBidResult.reason || "You cannot bid on this player" });
      }

      const { maxAmount, years, isActive } = req.body;
      
      // Check if auction has started
      const hasStarted = !agent.auctionStartTime || new Date(agent.auctionStartTime) <= new Date();
      
      // Only allow canceling auto-bids if user has no active bids on this player
      if (!isActive && hasStarted) {
        // Check if user has any bids on this player
        const userBids = await storage.getBidsForAgent(agentId);
        const userHasBid = userBids.some(bid => bid.userId === userId);
        
        if (userHasBid) {
          return res.status(400).json({ 
            message: "Cannot cancel auto-bid - you have an active bid on this player" 
          });
        }
      }
      
      // Only validate bid details if the auto-bid is being activated (not just canceled)
      if (isActive) {
        // Check if auto-bid meets minimum years requirement
        const minimumYears = agent.minimumYears || 1;
        if (years < minimumYears) {
          return res.status(400).json({ 
            message: `This player requires at least a ${minimumYears}-year contract` 
          });
        }
        
        // For imported initial bids, subsequent bids must have more years AND at least match the dollar amount
        const currentHighBid = await storage.getHighestBidForAgent(agentId);
        if (currentHighBid && currentHighBid.isImportedInitial) {
          if (years <= currentHighBid.years) {
            return res.status(400).json({ 
              message: `This player has an imported opening bid. Subsequent bids must have more years than the current bid. Current bid is ${currentHighBid.years} year${currentHighBid.years === 1 ? '' : 's'}, you must bid at least ${currentHighBid.years + 1} years.` 
            });
          }
          if (maxAmount < currentHighBid.amount) {
            return res.status(400).json({ 
              message: `This player has an imported opening bid of $${currentHighBid.amount}. Your max amount must be at least $${currentHighBid.amount}.` 
            });
          }
        }
      }
      
      const autoBid = await storage.createOrUpdateAutoBid({
        freeAgentId: agentId,
        userId,
        maxAmount,
        years,
        isActive,
      });

      // If auto-bid is active and auction has started, try to place an auto-bid immediately
      // (if start time hasn't passed, auto-bid is saved but won't place a bid yet)
      if (isActive && agent.auctionId && hasStarted) {
        // Get auction for per-auction settings
        const auction = await storage.getAuction(agent.auctionId);
        const currentHighBid = await storage.getHighestBidForAgent(agentId);
        const yearFactors = auction ? [
          auction.yearFactor1,
          auction.yearFactor2,
          auction.yearFactor3,
          auction.yearFactor4,
          auction.yearFactor5,
        ] : [1.0, 1.25, 1.33, 1.43, 1.55]; // Fallback defaults
        const factor = yearFactors[years - 1];
        
        // Check budget if enforcement is enabled (per-auction setting)
        let availableBudget = Infinity;
        const enforceBudget = auction?.enforceBudget ?? true;
        if (enforceBudget) {
          try {
            const budgetInfo = await storage.getUserBudgetInfo(userId, agent.auctionId);
            availableBudget = budgetInfo.available;
            // If already high bidder, that amount is freed
            if (currentHighBid && currentHighBid.userId === userId) {
              availableBudget += currentHighBid.amount;
            }
          } catch (error) {
            // User not enrolled in this auction - skip budget check
            return res.status(400).json({ message: "You are not enrolled in this auction. Please contact the commissioner." });
          }
        }
        
        if (currentHighBid && currentHighBid.userId !== userId) {
          // Get the auction's bid increment (default 10%)
          const bidIncrement = auction?.bidIncrement ?? 0.10;
          
          // Try to beat the current bid
          // Total Value = amount × factor
          const maxTotalValue = maxAmount * factor;
          const requiredTotalValue = currentHighBid.totalValue * (1 + bidIncrement);
          
          console.log(`[AutoBid Debug] Player ${agentId}: maxTotalValue=${maxTotalValue}, requiredTotalValue=${requiredTotalValue}, currentHighBid.totalValue=${currentHighBid.totalValue}`);
          
          if (maxTotalValue >= requiredTotalValue) {
            // Calculate bid amount, ensuring it meets the player's minimum bid
            // bidAmount = requiredTotalValue / factor
            let bidAmount = Math.ceil(requiredTotalValue / factor);
            bidAmount = Math.max(bidAmount, agent.minimumBid);
            const bidTotalValue = bidAmount * factor;
            
            console.log(`[AutoBid Debug] bidAmount=${bidAmount}, maxAmount=${maxAmount}, availableBudget=${availableBudget}`);
            
            // Check max amount and budget before placing bid
            if (bidAmount <= maxAmount && bidAmount <= availableBudget) {
              console.log(`[AutoBid Debug] Placing counter-bid for ${userId} on ${agentId}: $${bidAmount}`);
              await storage.createBid({
                freeAgentId: agentId,
                userId,
                amount: bidAmount,
                years,
                totalValue: bidTotalValue,
                isAutoBid: true,
              });
              
              // Process all auto-bids until stable
              const triggered = await processAllAutoBidsUntilStable(agentId, userId, auction);
              return res.json({ ...autoBid, autoBidsTriggered: triggered });
            } else {
              console.log(`[AutoBid Debug] Cannot place bid: bidAmount ${bidAmount} > maxAmount ${maxAmount}? ${bidAmount > maxAmount}, bidAmount ${bidAmount} > availableBudget ${availableBudget}? ${bidAmount > availableBudget}`);
            }
          } else {
            console.log(`[AutoBid Debug] Cannot beat: maxTotalValue ${maxTotalValue} < requiredTotalValue ${requiredTotalValue}`);
          }
        } else if (!currentHighBid) {
          // No current bid, place minimum bid (player's minimum or $1)
          const startingBid = Math.max(agent.minimumBid, 1);
          
          // Check max amount and budget before placing bid
          if (maxAmount >= startingBid && startingBid <= availableBudget) {
            const startingTotalValue = startingBid * factor;
            await storage.createBid({
              freeAgentId: agentId,
              userId,
              amount: startingBid,
              years,
              totalValue: startingTotalValue,
              isAutoBid: true,
            });
            
            // Process all auto-bids until stable
            const triggered = await processAllAutoBidsUntilStable(agentId, userId, auction);
            return res.json({ ...autoBid, autoBidsTriggered: triggered });
          }
        }
      }

      res.json({ ...autoBid, autoBidsTriggered: false });
    } catch (error) {
      console.error("Error saving auto-bid:", error);
      res.status(500).json({ message: "Failed to save auto-bid" });
    }
  });

  // Super admin endpoint to manually trigger auto-bid competition
  app.post("/api/free-agents/:id/trigger-competition", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Only super admins can trigger auto-bid competition" });
      }
      
      const agentId = parseInt(req.params.id);
      
      const agent = await storage.getFreeAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Free agent not found" });
      }
      
      // Check if auction has started
      if (agent.auctionStartTime && new Date(agent.auctionStartTime) > new Date()) {
        return res.status(400).json({ message: "Auction has not started yet" });
      }
      
      // Check if auction is still open
      if (new Date(agent.auctionEndTime) <= new Date()) {
        return res.status(400).json({ message: "Auction has already ended" });
      }
      
      // Get auction for settings
      const auction = agent.auctionId ? await storage.getAuction(agent.auctionId) : null;
      
      // Trigger the competition with empty excludeUserId to allow all auto-bids to compete
      const triggered = await processAllAutoBidsUntilStable(agentId, "", auction);
      
      // Get updated bid count
      const bids = await storage.getBidsForAgent(agentId);
      
      res.json({ 
        success: true, 
        triggered,
        message: triggered ? "Auto-bid competition triggered successfully" : "No auto-bids needed to compete",
        bidCount: bids.length
      });
    } catch (error) {
      console.error("Error triggering auto-bid competition:", error);
      res.status(500).json({ message: "Failed to trigger competition" });
    }
  });

  // My bids
  app.get("/api/my-bids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const auctionId = req.query.auctionId ? parseInt(req.query.auctionId) : undefined;
      const bids = await storage.getUserBids(userId, auctionId);
      res.json(bids);
    } catch (error) {
      console.error("Error fetching user bids:", error);
      res.status(500).json({ message: "Failed to fetch bids" });
    }
  });

  app.get("/api/my-outbid", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const auctionId = req.query.auctionId ? parseInt(req.query.auctionId) : undefined;
      const outbidPlayers = await storage.getUserOutbidPlayers(userId, auctionId);
      res.json(outbidPlayers);
    } catch (error) {
      console.error("Error fetching outbid players:", error);
      res.status(500).json({ message: "Failed to fetch outbid players" });
    }
  });

  app.get("/api/my-auto-bids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const auctionId = req.query.auctionId ? parseInt(req.query.auctionId) : undefined;
      const autoBids = await storage.getUserAutoBids(userId, auctionId);
      res.json(autoBids);
    } catch (error) {
      console.error("Error fetching auto-bids:", error);
      res.status(500).json({ message: "Failed to fetch auto-bids" });
    }
  });

  // Bid bundles - get user's bundles
  app.get("/api/my-bundles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const auctionId = req.query.auctionId ? parseInt(req.query.auctionId) : undefined;
      const bundles = await storage.getUserBidBundles(userId, auctionId);
      res.json(bundles);
    } catch (error) {
      console.error("Error fetching bundles:", error);
      res.status(500).json({ message: "Failed to fetch bundles" });
    }
  });

  // Get user's bundles by auction ID (path parameter version)
  app.get("/api/my-bundles/:auctionId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const auctionId = parseInt(req.params.auctionId);
      const bundles = await storage.getUserBidBundles(userId, auctionId);
      res.json(bundles);
    } catch (error) {
      console.error("Error fetching bundles:", error);
      res.status(500).json({ message: "Failed to fetch bundles" });
    }
  });

  // Create a new bid bundle
  app.post("/api/bundles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const { auctionId, name, items } = req.body;

      // Check if bundled bids are enabled for this auction
      if (auctionId) {
        const auction = await storage.getAuction(auctionId);
        if (auction && !auction.allowBundledBids) {
          return res.status(400).json({ message: "Bundled bids are not enabled for this auction" });
        }
      }

      // Validate items
      if (!items || !Array.isArray(items) || items.length === 0 || items.length > 5) {
        return res.status(400).json({ message: "Bundle must have 1-5 items" });
      }

      // Validate each item has required fields
      for (const item of items) {
        if (!item.freeAgentId || !item.amount || !item.years || !item.priority) {
          return res.status(400).json({ message: "Each item must have freeAgentId, amount, years, and priority" });
        }
        if (item.years < 1 || item.years > 5) {
          return res.status(400).json({ message: "Years must be between 1 and 5" });
        }
        if (item.priority < 1 || item.priority > 5) {
          return res.status(400).json({ message: "Priority must be between 1 and 5" });
        }
      }

      // Check for duplicate priorities
      const priorities = items.map((i: any) => i.priority);
      if (new Set(priorities).size !== priorities.length) {
        return res.status(400).json({ message: "Each item must have a unique priority" });
      }

      // Verify all players exist, auctions are open, and minimumYears is met
      for (const item of items) {
        const agent = await storage.getFreeAgent(item.freeAgentId);
        if (!agent) {
          return res.status(400).json({ message: `Player not found: ${item.freeAgentId}` });
        }
        if (new Date(agent.auctionEndTime) <= new Date()) {
          return res.status(400).json({ message: `Auction closed for player: ${agent.name}` });
        }
        // Verify player belongs to the specified auction
        if (agent.auctionId !== auctionId) {
          return res.status(400).json({ message: `Player ${agent.name} is not in the specified auction` });
        }
        // Verify years meets player's minimum requirement
        const minYears = agent.minimumYears || 1;
        if (item.years < minYears) {
          return res.status(400).json({ message: `${agent.name} requires at least a ${minYears}-year contract` });
        }
      }

      // Sort items by priority before creating
      const sortedItems = [...items].sort((a: any, b: any) => a.priority - b.priority);

      const bundle = await storage.createBidBundle(
        { auctionId, userId, name, status: 'active', activeItemPriority: sortedItems[0].priority },
        sortedItems.map((item: any) => ({
          freeAgentId: item.freeAgentId,
          priority: item.priority,
          amount: item.amount,
          years: item.years,
          status: 'pending',
        }))
      );

      // Deploy the first active item using the unified approach
      let currentItem: typeof bundle.items[0] | undefined = bundle.items.find(i => i.status === 'active');
      while (currentItem) {
        const success = await deployBundleItemAsAutoBid(currentItem, bundle);
        if (success) {
          break; // Successfully deployed a bid
        }
        // Check if the item was actually skipped (vs just waiting for auction to start)
        const updatedItem = await storage.getBidBundleItem(currentItem.id);
        if (updatedItem?.status === 'active') {
          // Item is still active (waiting for auction to start) - don't cascade to next
          break;
        }
        // Item was skipped - try to activate next item
        const nextItem = await storage.activateNextBundleItem(bundle.id);
        currentItem = nextItem ?? undefined;
      }

      // Fetch the updated bundle with final statuses
      const finalBundle = await storage.getBidBundle(bundle.id);
      res.json(finalBundle);
    } catch (error) {
      console.error("Error creating bundle:", error);
      res.status(500).json({ message: "Failed to create bundle" });
    }
  });

  // Get a specific bundle
  app.get("/api/bundles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const bundleId = parseInt(req.params.id);
      const bundle = await storage.getBidBundle(bundleId);
      
      if (!bundle) {
        return res.status(404).json({ message: "Bundle not found" });
      }
      if (bundle.userId !== userId) {
        return res.status(403).json({ message: "Not your bundle" });
      }

      res.json(bundle);
    } catch (error) {
      console.error("Error fetching bundle:", error);
      res.status(500).json({ message: "Failed to fetch bundle" });
    }
  });

  // Update a bundle
  app.put("/api/bundles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const bundleId = parseInt(req.params.id);
      const { name, items } = req.body;

      const existingBundle = await storage.getBidBundle(bundleId);
      if (!existingBundle) {
        return res.status(404).json({ message: "Bundle not found" });
      }
      if (existingBundle.userId !== userId) {
        return res.status(403).json({ message: "Not your bundle" });
      }
      if (existingBundle.status !== 'active') {
        return res.status(400).json({ message: "Can only edit active bundles" });
      }

      // Validate items
      if (!items || !Array.isArray(items) || items.length === 0 || items.length > 5) {
        return res.status(400).json({ message: "Bundle must have 1-5 items" });
      }

      for (const item of items) {
        if (!item.freeAgentId || !item.amount || !item.years || !item.priority) {
          return res.status(400).json({ message: "Each item must have freeAgentId, amount, years, and priority" });
        }
        if (item.years < 1 || item.years > 5) {
          return res.status(400).json({ message: "Years must be between 1 and 5" });
        }
        if (item.priority < 1 || item.priority > 5) {
          return res.status(400).json({ message: "Priority must be between 1 and 5" });
        }
      }

      // Check for duplicate priorities
      const priorities = items.map((i: any) => i.priority);
      if (new Set(priorities).size !== priorities.length) {
        return res.status(400).json({ message: "Each item must have a unique priority" });
      }

      // Verify all players exist, auctions are open, and minimumYears is met
      for (const item of items) {
        const agent = await storage.getFreeAgent(item.freeAgentId);
        if (!agent) {
          return res.status(400).json({ message: `Player not found: ${item.freeAgentId}` });
        }
        if (new Date(agent.auctionEndTime) <= new Date()) {
          return res.status(400).json({ message: `Auction closed for player: ${agent.name}` });
        }
        if (agent.auctionId !== existingBundle.auctionId) {
          return res.status(400).json({ message: `Player ${agent.name} is not in the specified auction` });
        }
        // Verify years meets player's minimum requirement
        const minYears = agent.minimumYears || 1;
        if (item.years < minYears) {
          return res.status(400).json({ message: `${agent.name} requires at least a ${minYears}-year contract` });
        }
      }

      // Sort items by priority
      const sortedItems = [...items].sort((a: any, b: any) => a.priority - b.priority);

      // Update the bundle using the new storage method
      const updatedBundle = await storage.updateBidBundleWithItems(
        bundleId,
        { name: name || existingBundle.name },
        sortedItems.map((item: any) => ({
          freeAgentId: item.freeAgentId,
          priority: item.priority,
          amount: item.amount,
          years: item.years,
          status: 'pending',
        }))
      );

      // Deploy the first active item using the unified approach
      let currentItem: typeof updatedBundle.items[0] | undefined = updatedBundle.items.find(i => i.status === 'active');
      while (currentItem) {
        const success = await deployBundleItemAsAutoBid(currentItem, updatedBundle);
        if (success) {
          break; // Successfully deployed a bid
        }
        // Check if the item was actually skipped (vs just waiting for auction to start)
        const updatedItem = await storage.getBidBundleItem(currentItem.id);
        if (updatedItem?.status === 'active') {
          // Item is still active (waiting for auction to start) - don't cascade to next
          break;
        }
        // Item was skipped - try to activate next item
        const nextItem = await storage.activateNextBundleItem(updatedBundle.id);
        currentItem = nextItem ?? undefined;
      }

      // Fetch the updated bundle with final statuses
      const finalBundle = await storage.getBidBundle(updatedBundle.id);
      res.json(finalBundle);
    } catch (error) {
      console.error("Error updating bundle:", error);
      res.status(500).json({ message: "Failed to update bundle" });
    }
  });

  // Cancel a bundle
  app.delete("/api/bundles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const bundleId = parseInt(req.params.id);
      const bundle = await storage.getBidBundle(bundleId);
      
      if (!bundle) {
        return res.status(404).json({ message: "Bundle not found" });
      }
      if (bundle.userId !== userId) {
        return res.status(403).json({ message: "Not your bundle" });
      }

      await storage.deleteBidBundle(bundleId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting bundle:", error);
      res.status(500).json({ message: "Failed to delete bundle" });
    }
  });

  // Stats
  app.get("/api/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const auctionId = req.query.auctionId ? parseInt(req.query.auctionId) : undefined;
      const stats = await storage.getUserStats(userId, auctionId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Budget (requires auctionId - budgets are per-auction)
  app.get("/api/budget", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const auctionId = req.query.auctionId ? parseInt(req.query.auctionId) : undefined;
      
      if (!auctionId || isNaN(auctionId)) {
        return res.status(400).json({ message: "auctionId is required" });
      }
      
      const budgetInfo = await storage.getUserBudgetInfo(userId, auctionId);
      res.json(budgetInfo);
    } catch (error: any) {
      if (error.message === "Team not enrolled in this auction") {
        return res.status(404).json({ message: error.message });
      }
      console.error("Error fetching budget:", error);
      res.status(500).json({ message: "Failed to fetch budget" });
    }
  });

  // Team limits (requires auctionId - limits are per-auction)
  // Commissioners can query other teams by passing userId parameter
  // Also includes budget info for convenience
  app.get("/api/limits", isAuthenticated, async (req: any, res) => {
    try {
      // For permission checks, use the real admin (originalUserId if impersonating)
      const permissionUserId = req.session.originalUserId || req.session.userId!;
      // For fetching "my" limits, use the current session user (impersonated user when impersonating)
      const currentUserId = req.session.userId!;
      const auctionId = req.query.auctionId ? parseInt(req.query.auctionId) : undefined;
      const targetUserId = req.query.userId as string | undefined;
      
      if (!auctionId || isNaN(auctionId)) {
        return res.status(400).json({ message: "auctionId is required" });
      }
      
      // By default, fetch the current user's limits (respects impersonation)
      let userIdToQuery = currentUserId;
      // If querying another user's limits, require commissioner access
      if (targetUserId && targetUserId !== currentUserId) {
        if (!await hasAuctionCommissionerAccess(permissionUserId, auctionId)) {
          return res.status(403).json({ message: "Commissioner access required to view other team's limits" });
        }
        userIdToQuery = targetUserId;
      }
      
      const limitsInfo = await storage.getUserLimitsInfo(userIdToQuery, auctionId);
      const budgetInfo = await storage.getUserBudgetInfo(userIdToQuery, auctionId);
      
      // Combine limits and budget info
      res.json({
        ...limitsInfo,
        budget: budgetInfo.budget,
        spent: budgetInfo.spent,
        committed: budgetInfo.committed,
        available: budgetInfo.available,
      });
    } catch (error: any) {
      if (error.message === "Team not enrolled in this auction") {
        return res.status(404).json({ message: error.message });
      }
      console.error("Error fetching limits:", error);
      res.status(500).json({ message: "Failed to fetch limits" });
    }
  });

  // Check if user can bid on a player (limit validation)
  app.get("/api/free-agents/:id/can-bid", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const playerId = parseInt(req.params.id);
      const result = await storage.canUserBidOnPlayer(userId, playerId);
      res.json(result);
    } catch (error) {
      console.error("Error checking bid eligibility:", error);
      res.status(500).json({ message: "Failed to check bid eligibility" });
    }
  });


  // CSV Export - Auction Results
  app.get("/api/exports/auction-results.csv", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      
      // Support optional auction filtering
      let results = await storage.getClosedFreeAgents();
      if (req.query.auctionId) {
        const auctionId = parseInt(req.query.auctionId);
        if (!isNaN(auctionId)) {
          // Check commissioner access for this auction's league
          if (!await hasAuctionCommissionerAccess(userId, auctionId)) {
            return res.status(403).json({ message: "Commissioner access required" });
          }
          results = results.filter(agent => agent.auctionId === auctionId);
        }
      } else {
        // If no specific auction, require super admin for all-auctions export
        const user = await storage.getUser(userId);
        if (!user?.isSuperAdmin) {
          return res.status(403).json({ message: "Super admin access required for cross-auction exports" });
        }
      }
      
      const headers = [
        "Team",
        "Last Name",
        "First Name",
        "MLB Team",
        "Years",
        "Salary",
        "Auction End Date"
      ];

      const rows = results.map(agent => {
        // Split player name into first and last name
        // Handle formats like "First Last", "First Middle Last", etc.
        const nameParts = (agent.name || "").trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        
        // Format auction end date as MM/DD/YYYY
        const endDate = agent.auctionEndTime 
          ? format(new Date(agent.auctionEndTime), "M/d/yyyy")
          : "";
        
        return [
          agent.highBidder?.teamAbbreviation || "",
          lastName ? `"${lastName.replace(/"/g, '""')}"` : "",
          firstName ? `"${firstName.replace(/"/g, '""')}"` : "",
          agent.team || "",
          agent.currentBid?.years || 0,
          agent.currentBid?.amount || 0,
          endDate
        ];
      });

      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=auction-results.csv");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.send(csv);
    } catch (error) {
      console.error("Error exporting auction results:", error);
      res.status(500).json({ message: "Failed to export auction results" });
    }
  });

  // CSV Export - Final Rosters by Owner
  app.get("/api/exports/final-rosters.csv", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      
      // Support optional auction filtering
      let results = await storage.getClosedFreeAgents();
      if (req.query.auctionId) {
        const auctionId = parseInt(req.query.auctionId);
        if (!isNaN(auctionId)) {
          // Check commissioner access for this auction's league
          if (!await hasAuctionCommissionerAccess(userId, auctionId)) {
            return res.status(403).json({ message: "Commissioner access required" });
          }
          results = results.filter(agent => agent.auctionId === auctionId);
        }
      } else {
        // If no specific auction, require super admin for all-auctions export
        const user = await storage.getUser(userId);
        if (!user?.isSuperAdmin) {
          return res.status(403).json({ message: "Super admin access required for cross-auction exports" });
        }
      }
      const allUsers = await storage.getAllUsers();
      
      const headers = [
        "Owner Name",
        "Owner Email",
        "Team Name",
        "Team Abbr",
        "Player ID",
        "Player Name",
        "Type",
        "Team",
        "Contract Years",
        "Salary Per Year",
        "Total Contract Value",
        "Auction End Time"
      ];

      const rows: string[][] = [];
      
      for (const agent of results) {
        if (agent.highBidder && agent.currentBid) {
          const owner = allUsers.find(u => u.id === agent.currentBid?.userId);
          rows.push([
            `"${((owner?.firstName || '') + ' ' + (owner?.lastName || '')).trim()}"`,
            owner?.email ? `"${owner.email}"` : "",
            owner?.teamName ? `"${owner.teamName.replace(/"/g, '""')}"` : "",
            owner?.teamAbbreviation || "",
            String(agent.id),
            `"${agent.name.replace(/"/g, '""')}"`,
            agent.playerType === "pitcher" ? "Pitcher" : "Hitter",
            agent.team ? `"${agent.team.replace(/"/g, '""')}"` : "",
            String(agent.currentBid.years),
            String(agent.currentBid.amount),
            String(agent.currentBid.totalValue),
            new Date(agent.auctionEndTime).toISOString()
          ]);
        }
      }

      // Sort by owner name
      rows.sort((a, b) => a[0].localeCompare(b[0]));

      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=final-rosters.csv");
      res.send(csv);
    } catch (error) {
      console.error("Error exporting final rosters:", error);
      res.status(500).json({ message: "Failed to export final rosters" });
    }
  });

  // Commissioner: Create a single user/team (no budget - budgets are per-auction)
  app.post("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.session.userId!;
      const admin = await storage.getUser(adminId);
      
      if (!admin?.isCommissioner && !admin?.isSuperAdmin) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { email, firstName, lastName, teamName, isCommissioner, password } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if user already exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Generate or use provided password
      const userPassword = password || generateRandomPassword();
      const passwordHash = await hashPassword(userPassword);

      const user = await storage.createUserWithPassword({
        email,
        passwordHash,
        firstName,
        lastName,
        teamName,
        isCommissioner: isCommissioner ?? false,
        mustResetPassword: !password, // Must reset if auto-generated
      });

      res.json({ 
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          teamName: user.teamName,
          isCommissioner: user.isCommissioner,
        },
        temporaryPassword: !password ? userPassword : undefined,
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Bulk user creation validation schema (no budget - budgets are per-auction)
  const bulkUserSchema = z.object({
    users: z.array(z.object({
      email: z.string().email("Invalid email format"),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      teamName: z.string().optional(),
      teamAbbreviation: z.string().max(3).optional(),
      password: z.string().min(6, "Password must be at least 6 characters").optional(),
    })).min(1, "At least one user is required").max(500, "Maximum 500 users per upload"),
    leagueId: z.number().optional(),
  });

  // Commissioner: Bulk create users/teams via CSV
  app.post("/api/users/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.session.userId!;
      const admin = await storage.getUser(adminId);
      
      if (!admin?.isCommissioner && !admin?.isSuperAdmin) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      // Validate input
      const validation = bulkUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: validation.error.flatten().fieldErrors 
        });
      }

      const { users: usersData, leagueId } = validation.data;

      console.log("[Bulk Upload] Starting upload with leagueId:", leagueId, "users count:", usersData.length);

      // If leagueId provided, verify it exists
      if (leagueId) {
        const league = await storage.getLeague(leagueId);
        if (!league) {
          return res.status(400).json({ message: "Invalid league ID" });
        }
        console.log("[Bulk Upload] League verified:", league.name);
      }

      const results: { email: string; password: string; success: boolean; error?: string }[] = [];

      for (const userData of usersData) {
        const email = userData.email.trim();
        try {
          // Check if user already exists
          const existing = await storage.getUserByEmail(email);
          console.log("[Bulk Upload] Processing:", email, "existing:", !!existing);
          if (existing) {
            // If user exists and leagueId provided, try to add them to the league
            if (leagueId) {
              const existingMember = await storage.getLeagueMember(leagueId, existing.id);
              console.log("[Bulk Upload] Existing user", email, "existingMember:", !!existingMember);
              if (!existingMember) {
                await storage.addLeagueMember({
                  leagueId,
                  userId: existing.id,
                  role: 'owner',
                  teamName: userData.teamName?.trim() || existing.teamName,
                  teamAbbreviation: userData.teamAbbreviation?.trim().toUpperCase().slice(0, 3) || existing.teamAbbreviation,
                });
                console.log("[Bulk Upload] Added existing user to league:", email);
                results.push({ email, password: "(existing user - added to league)", success: true });
              } else {
                results.push({ email, password: "", success: false, error: "User already in this league" });
              }
            } else {
              console.log("[Bulk Upload] No leagueId provided, skipping existing user");
              results.push({ email, password: "", success: false, error: "User already exists" });
            }
            continue;
          }

          // Use provided password or generate a random one
          const userPassword = userData.password?.trim() || generateRandomPassword();
          const passwordHash = await hashPassword(userPassword);
          const passwordWasProvided = !!userData.password?.trim();

          const newUser = await storage.createUserWithPassword({
            email,
            passwordHash,
            firstName: userData.firstName?.trim(),
            lastName: userData.lastName?.trim(),
            teamName: userData.teamName?.trim(),
            teamAbbreviation: userData.teamAbbreviation?.trim().toUpperCase().slice(0, 3),
            isCommissioner: false,
            mustResetPassword: !passwordWasProvided, // Only require reset if password was auto-generated
          });

          // If leagueId provided, add user to the league
          if (leagueId) {
            await storage.addLeagueMember({
              leagueId,
              userId: newUser.id,
              role: 'owner',
              teamName: userData.teamName?.trim(),
              teamAbbreviation: userData.teamAbbreviation?.trim().toUpperCase().slice(0, 3),
            });
          }

          results.push({ email, password: passwordWasProvided ? "(set from CSV)" : userPassword, success: true });
        } catch (err: any) {
          results.push({ 
            email, 
            password: "", 
            success: false, 
            error: err.message || "Unknown error" 
          });
        }
      }

      res.json({ results });
    } catch (error) {
      console.error("Error bulk creating users:", error);
      res.status(500).json({ message: "Failed to bulk create users" });
    }
  });

  // Commissioner/Super Admin: Update user details
  app.patch("/api/users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.session.userId!;
      const admin = await storage.getUser(adminId);
      
      if (!admin?.isCommissioner && !admin?.isSuperAdmin) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const targetUserId = req.params.id;
      const { email, firstName, lastName, teamName, teamAbbreviation } = req.body;

      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // If changing email, check it's not already taken
      if (email && email !== targetUser.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ message: "Email already in use by another user" });
        }
      }

      const updatedUser = await storage.updateUserDetails(targetUserId, {
        email,
        firstName,
        lastName,
        teamName,
        teamAbbreviation,
      });
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user details:", error);
      res.status(500).json({ message: "Failed to update user details" });
    }
  });

  // Super Admin: Set commissioner status for a user
  app.patch("/api/users/:id/commissioner", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.session.userId!;
      const admin = await storage.getUser(adminId);
      
      if (!admin?.isSuperAdmin) {
        return res.status(403).json({ message: "Super Admin access required" });
      }

      const targetUserId = req.params.id;
      const { isCommissioner } = req.body;

      if (typeof isCommissioner !== 'boolean') {
        return res.status(400).json({ message: "isCommissioner must be a boolean" });
      }

      // Cannot change super admin's commissioner status
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUserCommissioner(targetUserId, isCommissioner);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating commissioner status:", error);
      res.status(500).json({ message: "Failed to update commissioner status" });
    }
  });

  // Auction routes
  app.get("/api/auctions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      
      // Check for leagueId query parameter
      let leagueId: number | undefined = undefined;
      if (req.query.leagueId) {
        const parsed = parseInt(req.query.leagueId);
        if (!isNaN(parsed)) {
          leagueId = parsed;
        }
      }
      
      // If leagueId is specified, check user has access to this league
      if (leagueId) {
        // Super admin can access all leagues
        if (!user?.isSuperAdmin) {
          const membership = await storage.getLeagueMember(leagueId, userId);
          if (!membership) {
            return res.status(403).json({ message: "Not a member of this league" });
          }
          // Only commissioners of the league can access auctions (no global commissioner bypass)
          if (membership.role !== 'commissioner') {
            return res.status(403).json({ message: "Commissioner access required" });
          }
        }
        const auctions = await storage.getAuctionsByLeague(leagueId);
        res.json(auctions);
      } else {
        // No leagueId specified - only super admin can see all auctions
        // Commissioners must specify a leagueId
        if (!user?.isSuperAdmin) {
          return res.status(400).json({ message: "leagueId parameter is required" });
        }
        const allAuctions = await storage.getAllAuctions();
        res.json(allAuctions);
      }
    } catch (error) {
      console.error("Error fetching auctions:", error);
      res.status(500).json({ message: "Failed to fetch auctions" });
    }
  });

  app.get("/api/auctions/active", isAuthenticated, async (req, res) => {
    try {
      const leagueId = req.query.leagueId ? parseInt(req.query.leagueId as string) : undefined;
      const activeAuction = await storage.getActiveAuction(leagueId);
      res.json(activeAuction || null);
    } catch (error) {
      console.error("Error fetching active auction:", error);
      res.status(500).json({ message: "Failed to fetch active auction" });
    }
  });

  app.get("/api/auctions/enrolled", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const enrolledAuctions = await storage.getUserEnrolledAuctions(userId);
      res.json(enrolledAuctions);
    } catch (error) {
      console.error("Error fetching enrolled auctions:", error);
      res.status(500).json({ message: "Failed to fetch enrolled auctions" });
    }
  });

  app.get("/api/auctions/:id/enrolled", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const auctionId = parseInt(req.params.id);
      const isEnrolled = await storage.isUserEnrolledInAuction(userId, auctionId);
      res.json({ enrolled: isEnrolled });
    } catch (error) {
      console.error("Error checking enrollment:", error);
      res.status(500).json({ message: "Failed to check enrollment" });
    }
  });

  app.get("/api/auctions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const auctionId = parseInt(req.params.id);
      const auction = await storage.getAuction(auctionId);
      
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      res.json(auction);
    } catch (error) {
      console.error("Error fetching auction:", error);
      res.status(500).json({ message: "Failed to fetch auction" });
    }
  });

  app.post("/api/auctions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const { name, leagueId } = req.body;
      
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Auction name is required" });
      }
      
      if (!leagueId) {
        return res.status(400).json({ message: "League ID is required" });
      }
      
      // Check commissioner access for the target league
      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const auction = await storage.createAuction({
        name: name.trim(),
        status: "draft",
        createdById: userId,
        leagueId,
      });

      res.json(auction);
    } catch (error) {
      console.error("Error creating auction:", error);
      res.status(500).json({ message: "Failed to create auction" });
    }
  });

  app.patch("/api/auctions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(userId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      
      const auction = await storage.getAuction(auctionId);
      
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }

      const { 
        name, status, bidIncrement,
        yearFactor1, yearFactor2, yearFactor3, yearFactor4, yearFactor5,
        defaultBudget, enforceBudget
      } = req.body;
      const updateData: any = {};
      
      if (name !== undefined) updateData.name = name.trim();
      if (status !== undefined) {
        if (!["draft", "active", "completed"].includes(status)) {
          return res.status(400).json({ message: "Invalid status" });
        }
        
        // If activating this auction, deactivate all others
        if (status === "active") {
          const allAuctions = await storage.getAllAuctions();
          for (const a of allAuctions) {
            if (a.id !== auctionId && a.status === "active") {
              await storage.updateAuction(a.id, { status: "draft" });
            }
          }
        }
        
        updateData.status = status;
      }
      
      // Auction-level settings
      if (bidIncrement !== undefined) updateData.bidIncrement = bidIncrement;
      if (yearFactor1 !== undefined) updateData.yearFactor1 = yearFactor1;
      if (yearFactor2 !== undefined) updateData.yearFactor2 = yearFactor2;
      if (yearFactor3 !== undefined) updateData.yearFactor3 = yearFactor3;
      if (yearFactor4 !== undefined) updateData.yearFactor4 = yearFactor4;
      if (yearFactor5 !== undefined) updateData.yearFactor5 = yearFactor5;
      if (defaultBudget !== undefined) updateData.defaultBudget = defaultBudget;
      if (enforceBudget !== undefined) updateData.enforceBudget = enforceBudget;

      const updatedAuction = await storage.updateAuction(auctionId, updateData);
      res.json(updatedAuction);
    } catch (error) {
      console.error("Error updating auction:", error);
      res.status(500).json({ message: "Failed to update auction" });
    }
  });

  // Update auction settings (specific endpoint for settings dialog)
  app.patch("/api/auctions/:id/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(userId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const auction = await storage.getAuction(auctionId);
      
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }

      const { 
        bidIncrement,
        yearFactor1, yearFactor2, yearFactor3, yearFactor4, yearFactor5,
        enforceBudget,
        allowAutoBidding,
        allowBundledBids,
        extendAuctionOnBid,
        emailNotifications
      } = req.body;
      
      const updateData: any = {};
      
      if (bidIncrement !== undefined) updateData.bidIncrement = bidIncrement;
      if (yearFactor1 !== undefined) updateData.yearFactor1 = yearFactor1;
      if (yearFactor2 !== undefined) updateData.yearFactor2 = yearFactor2;
      if (yearFactor3 !== undefined) updateData.yearFactor3 = yearFactor3;
      if (yearFactor4 !== undefined) updateData.yearFactor4 = yearFactor4;
      if (yearFactor5 !== undefined) updateData.yearFactor5 = yearFactor5;
      if (enforceBudget !== undefined) updateData.enforceBudget = enforceBudget;
      if (allowAutoBidding !== undefined) updateData.allowAutoBidding = allowAutoBidding;
      if (allowBundledBids !== undefined) updateData.allowBundledBids = allowBundledBids;
      if (extendAuctionOnBid !== undefined) updateData.extendAuctionOnBid = extendAuctionOnBid;
      if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;

      const updatedAuction = await storage.updateAuction(auctionId, updateData);
      res.json(updatedAuction);
    } catch (error) {
      console.error("Error updating auction settings:", error);
      res.status(500).json({ message: "Failed to update auction settings" });
    }
  });

  // Delete auction (requires password confirmation)
  app.delete("/api/auctions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(userId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      
      const user = await storage.getUser(userId);
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: "Password confirmation required" });
      }

      // Verify password using bcrypt
      const bcrypt = await import("bcryptjs");
      const isValidPassword = await bcrypt.compare(password, user?.passwordHash || "");
      
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid password" });
      }

      const auction = await storage.getAuction(auctionId);
      
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }

      await storage.deleteAuction(auctionId);
      res.json({ success: true, message: "Auction deleted" });
    } catch (error) {
      console.error("Error deleting auction:", error);
      res.status(500).json({ message: "Failed to delete auction" });
    }
  });

  // Reset auction (requires password confirmation)
  app.post("/api/auctions/:id/reset", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(userId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      
      const user = await storage.getUser(userId);
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: "Password confirmation required" });
      }

      // Verify password using bcrypt
      const bcrypt = await import("bcryptjs");
      const isValidPassword = await bcrypt.compare(password, user?.passwordHash || "");
      
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid password" });
      }
      const auction = await storage.getAuction(auctionId);
      
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }

      await storage.resetAuction(auctionId);
      res.json({ success: true, message: "Auction reset successfully" });
    } catch (error) {
      console.error("Error resetting auction:", error);
      res.status(500).json({ message: "Failed to reset auction" });
    }
  });

  // Auction teams
  app.get("/api/auctions/:id/teams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(userId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const teams = await storage.getAuctionTeams(auctionId);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching auction teams:", error);
      res.status(500).json({ message: "Failed to fetch auction teams" });
    }
  });

  // Get teams not enrolled in an auction
  app.get("/api/auctions/:id/available-teams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(userId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const availableTeams = await storage.getTeamsNotInAuction(auctionId);
      res.json(availableTeams);
    } catch (error) {
      console.error("Error fetching available teams:", error);
      res.status(500).json({ message: "Failed to fetch available teams" });
    }
  });

  // Enroll teams in an auction
  app.post("/api/auctions/:id/teams/enroll", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(userId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      const { userIds, budget, rosterLimit, ipLimit, paLimit } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "userIds array is required" });
      }

      if (typeof budget !== 'number' || budget < 0) {
        return res.status(400).json({ message: "Valid budget is required" });
      }

      const teams = await storage.enrollTeamsInAuction(
        auctionId, 
        userIds, 
        budget,
        rosterLimit ?? null,
        ipLimit ?? null,
        paLimit ?? null
      );
      res.json(teams);
    } catch (error) {
      console.error("Error enrolling teams:", error);
      res.status(500).json({ message: "Failed to enroll teams" });
    }
  });

  // Bulk enroll teams with individual budgets and limits
  app.post("/api/auctions/:id/teams/enroll-bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(userId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      const { teams } = req.body;

      if (!Array.isArray(teams) || teams.length === 0) {
        return res.status(400).json({ message: "teams array is required" });
      }

      // Validate each team entry
      for (const team of teams) {
        if (!team.userId || typeof team.budget !== 'number' || team.budget < 0) {
          return res.status(400).json({ 
            message: `Invalid team entry: userId and valid budget are required` 
          });
        }
      }

      const enrolledTeams = await storage.enrollTeamsInAuctionBulk(auctionId, teams);
      res.json(enrolledTeams);
    } catch (error) {
      console.error("Error bulk enrolling teams:", error);
      res.status(500).json({ message: "Failed to enroll teams" });
    }
  });

  // Remove a team from an auction
  app.delete("/api/auctions/:id/teams/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(sessionUserId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const targetUserId = req.params.userId;

      const result = await storage.removeTeamFromAuction(auctionId, targetUserId);
      if (!result) {
        return res.status(404).json({ message: "Team not found in auction" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing team from auction:", error);
      res.status(500).json({ message: "Failed to remove team from auction" });
    }
  });

  app.patch("/api/auctions/:id/teams/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(sessionUserId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const targetUserId = req.params.userId;
      const { isActive } = req.body;

      const team = await storage.setAuctionTeamActive(auctionId, targetUserId, isActive);
      res.json(team);
    } catch (error) {
      console.error("Error updating auction team:", error);
      res.status(500).json({ message: "Failed to update auction team" });
    }
  });

  // Update per-auction team budget
  app.patch("/api/auctions/:id/teams/:userId/budget", isAuthenticated, async (req: any, res) => {
    try {
      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(sessionUserId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const targetUserId = req.params.userId;
      const { budget } = req.body;

      if (typeof budget !== 'number' || budget < 0) {
        return res.status(400).json({ message: "Invalid budget value" });
      }

      const team = await storage.updateAuctionTeamBudget(auctionId, targetUserId, budget);
      res.json(team);
    } catch (error) {
      console.error("Error updating auction team budget:", error);
      res.status(500).json({ message: "Failed to update auction team budget" });
    }
  });

  // Update per-auction team limits (and optionally budget)
  app.patch("/api/auctions/:id/teams/:userId/limits", isAuthenticated, async (req: any, res) => {
    try {
      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(sessionUserId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const targetUserId = req.params.userId;
      const { rosterLimit, ipLimit, paLimit, budget } = req.body;

      // Update limits
      let team = await storage.updateAuctionTeamLimits(auctionId, targetUserId, {
        rosterLimit: rosterLimit ?? null,
        ipLimit: ipLimit ?? null,
        paLimit: paLimit ?? null,
      });
      
      // Also update budget if provided
      if (budget !== undefined && typeof budget === 'number') {
        team = await storage.updateAuctionTeamBudget(auctionId, targetUserId, budget);
      }
      
      res.json(team);
    } catch (error) {
      console.error("Error updating auction team limits:", error);
      res.status(500).json({ message: "Failed to update auction team limits" });
    }
  });

  // Bulk update team limits via CSV data
  app.post("/api/auctions/:id/teams/bulk-limits", isAuthenticated, async (req: any, res) => {
    try {
      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(sessionUserId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { data } = req.body;
      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ message: "No data provided" });
      }

      // Get the auction to find its league
      const auction = await storage.getAuction(auctionId);
      if (!auction || !auction.leagueId) {
        return res.status(404).json({ message: "Auction not found or not associated with a league" });
      }

      // Get all enrolled teams for this auction with their league member info
      const enrolledTeams = await storage.getAuctionTeams(auctionId);
      const leagueMembers = await storage.getLeagueMembers(auction.leagueId);
      
      // Create lookup maps by team abbreviation and email
      const teamByAbbr = new Map<string, { userId: string; teamName: string }>();
      const teamByEmail = new Map<string, { userId: string; teamName: string }>();
      
      for (const member of leagueMembers) {
        const enrolled = enrolledTeams.find(t => t.userId === member.userId);
        if (enrolled) {
          if (member.teamAbbreviation) {
            teamByAbbr.set(member.teamAbbreviation.toUpperCase(), { 
              userId: member.userId, 
              teamName: member.teamName || '' 
            });
          }
          if (member.user?.email) {
            teamByEmail.set(member.user.email.toLowerCase(), { 
              userId: member.userId, 
              teamName: member.teamName || '' 
            });
          }
        }
      }

      const results: { team: string; success: boolean; message?: string }[] = [];
      let successCount = 0;

      for (const row of data) {
        // Try to find team by abbreviation first, then by email
        const abbr = (row.teamAbbreviation || row.team || row.abbr || '').toString().trim().toUpperCase();
        const email = (row.email || '').toString().trim().toLowerCase();
        
        let teamInfo = abbr ? teamByAbbr.get(abbr) : null;
        if (!teamInfo && email) {
          teamInfo = teamByEmail.get(email);
        }

        if (!teamInfo) {
          results.push({ 
            team: abbr || email || 'Unknown', 
            success: false, 
            message: 'Team not found or not enrolled in auction' 
          });
          continue;
        }

        try {
          // Parse limit values - handle empty strings and null values
          const parseNumber = (val: any): number | null => {
            if (val === '' || val === null || val === undefined) return null;
            const num = parseFloat(val);
            return isNaN(num) ? null : num;
          };

          const budget = parseNumber(row.budget);
          const rosterLimit = parseNumber(row.rosterLimit || row.roster);
          const ipLimit = parseNumber(row.ipLimit || row.ip);
          const paLimit = parseNumber(row.paLimit || row.pa);

          // Update limits if any are provided
          if (rosterLimit !== null || ipLimit !== null || paLimit !== null) {
            await storage.updateAuctionTeamLimits(auctionId, teamInfo.userId, {
              rosterLimit,
              ipLimit,
              paLimit,
            });
          }

          // Update budget if provided
          if (budget !== null && budget >= 0) {
            await storage.updateAuctionTeamBudget(auctionId, teamInfo.userId, budget);
          }

          results.push({ team: abbr || teamInfo.teamName, success: true });
          successCount++;
        } catch (err: any) {
          results.push({ 
            team: abbr || teamInfo.teamName, 
            success: false, 
            message: err.message 
          });
        }
      }

      res.json({ 
        success: true, 
        updated: successCount,
        total: data.length,
        results 
      });
    } catch (error) {
      console.error("Error bulk updating team limits:", error);
      res.status(500).json({ message: "Failed to bulk update team limits" });
    }
  });

  // Reset all team budgets in an auction
  app.post("/api/auctions/:id/reset-budgets", isAuthenticated, async (req: any, res) => {
    try {
      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(sessionUserId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { budget } = req.body;

      if (typeof budget !== 'number' || budget < 0) {
        return res.status(400).json({ message: "Invalid budget value" });
      }

      await storage.resetAuctionBudgets(auctionId, budget);
      res.json({ success: true });
    } catch (error) {
      console.error("Error resetting auction budgets:", error);
      res.status(500).json({ message: "Failed to reset auction budgets" });
    }
  });

  // Sync auction limits from roster usage (calculate available = league cap - roster usage)
  app.post("/api/auctions/:id/sync-from-roster", isAuthenticated, async (req: any, res) => {
    try {
      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(sessionUserId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      // Get the auction to check if it has a league
      const auction = await storage.getAuction(auctionId);
      if (!auction || !auction.leagueId) {
        return res.status(404).json({ message: "Auction not found or not associated with a league" });
      }

      // Get the league to check if caps are set
      const league = await storage.getLeague(auction.leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      if (league.budgetCap === null && league.ipCap === null && league.paCap === null) {
        return res.status(400).json({ 
          message: "No league caps configured. Please set budget, IP, or PA caps in Roster Management first." 
        });
      }

      // Sync limits from roster
      const result = await storage.syncAuctionLimitsFromRoster(auctionId);
      
      // Update the auction to use roster-derived limits
      await storage.updateAuction(auctionId, { limitSource: "roster" });

      res.json({ 
        success: true, 
        message: `Updated limits for ${result.updated} teams based on roster usage.`,
        teams: result.teams
      });
    } catch (error) {
      console.error("Error syncing auction limits from roster:", error);
      res.status(500).json({ message: "Failed to sync auction limits from roster" });
    }
  });

  // Get user's email opt-out status for an auction
  app.get("/api/auctions/:id/email-opt-out", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      const optedOut = await storage.getEmailOptOut(auctionId, userId);
      res.json({ optedOut });
    } catch (error) {
      console.error("Error getting email opt-out status:", error);
      res.status(500).json({ message: "Failed to get email opt-out status" });
    }
  });

  // Toggle user's email opt-out status for an auction
  app.post("/api/auctions/:id/email-opt-out", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const auctionId = parseInt(req.params.id);
      const { optedOut } = req.body;
      
      if (typeof optedOut !== 'boolean') {
        return res.status(400).json({ message: "optedOut must be a boolean" });
      }
      
      await storage.setEmailOptOut(auctionId, userId, optedOut);
      res.json({ success: true, optedOut });
    } catch (error) {
      console.error("Error setting email opt-out status:", error);
      res.status(500).json({ message: "Failed to set email opt-out status" });
    }
  });

  // ================== LEAGUE MANAGEMENT ROUTES ==================

  // Get all leagues for the current user (or all leagues for super admin)
  app.get("/api/leagues", isAuthenticated, async (req: any, res) => {
    try {
      // Use impersonated user's ID if impersonating, otherwise the logged-in user
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Super admin sees all leagues, regular users see their leagues
      let rawLeagues;
      if (user.isSuperAdmin) {
        // For super admin, get all leagues
        rawLeagues = await storage.getAllLeagues();
      } else {
        rawLeagues = await storage.getUserLeagues(userId);
      }
      
      // Enrich leagues with user's membership info (role, teamName, teamAbbreviation)
      const leaguesWithMembership = await Promise.all(
        rawLeagues.map(async (league) => {
          const membership = await storage.getLeagueMember(league.id, userId);
          return {
            ...league,
            role: membership?.role || (user.isSuperAdmin ? 'commissioner' : 'owner'),
            teamName: membership?.teamName || null,
            teamAbbreviation: membership?.teamAbbreviation || null,
          };
        })
      );
      
      res.json(leaguesWithMembership);
    } catch (error) {
      console.error("Error fetching leagues:", error);
      res.status(500).json({ message: "Failed to fetch leagues" });
    }
  });

  // Get a specific league by ID
  app.get("/api/leagues/:id", isAuthenticated, async (req: any, res) => {
    try {
      const leagueId = parseInt(req.params.id);
      if (isNaN(leagueId)) {
        return res.status(400).json({ message: "Invalid league ID" });
      }

      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Check if user has access to this league
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isSuperAdmin) {
        const member = await storage.getLeagueMember(leagueId, userId);
        if (!member) {
          return res.status(403).json({ message: "Access denied to this league" });
        }
      }

      res.json(league);
    } catch (error) {
      console.error("Error fetching league:", error);
      res.status(500).json({ message: "Failed to fetch league" });
    }
  });

  // Get a league by slug
  app.get("/api/leagues/slug/:slug", isAuthenticated, async (req: any, res) => {
    try {
      const { slug } = req.params;
      const league = await storage.getLeagueBySlug(slug);
      
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Check if user has access to this league
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isSuperAdmin) {
        const member = await storage.getLeagueMember(league.id, userId);
        if (!member) {
          return res.status(403).json({ message: "Access denied to this league" });
        }
      }

      res.json(league);
    } catch (error) {
      console.error("Error fetching league by slug:", error);
      res.status(500).json({ message: "Failed to fetch league" });
    }
  });

  // Create a new league (super admin only)
  app.post("/api/leagues", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Super Admin access required" });
      }

      const { name, slug, timezone } = req.body;
      
      if (!name?.trim()) {
        return res.status(400).json({ message: "League name is required" });
      }
      
      if (!slug?.trim()) {
        return res.status(400).json({ message: "League slug is required" });
      }

      // Validate slug format (lowercase alphanumeric with hyphens)
      const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugPattern.test(slug)) {
        return res.status(400).json({ message: "Slug must be lowercase letters, numbers, and hyphens only" });
      }

      // Check if slug is already taken
      const existingLeague = await storage.getLeagueBySlug(slug);
      if (existingLeague) {
        return res.status(400).json({ message: "A league with this slug already exists" });
      }

      const league = await storage.createLeague({
        name: name.trim(),
        slug: slug.toLowerCase().trim(),
        timezone: timezone || "America/New_York",
        createdById: userId,
      });

      res.status(201).json(league);
    } catch (error) {
      console.error("Error creating league:", error);
      res.status(500).json({ message: "Failed to create league" });
    }
  });

  // Update a league (commissioner of that league or super admin)
  app.patch("/api/leagues/:id", isAuthenticated, async (req: any, res) => {
    try {
      const leagueId = parseInt(req.params.id);
      if (isNaN(leagueId)) {
        return res.status(400).json({ message: "Invalid league ID" });
      }

      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);

      // Check authorization: super admin or league commissioner
      let authorized = user?.isSuperAdmin;
      if (!authorized) {
        const member = await storage.getLeagueMember(leagueId, userId);
        authorized = member?.role === 'commissioner';
      }

      if (!authorized) {
        return res.status(403).json({ message: "Commissioner or Super Admin access required" });
      }

      const { name, timezone } = req.body;
      const updateData: any = {};
      
      if (name !== undefined) updateData.name = name.trim();
      if (timezone !== undefined) updateData.timezone = timezone;

      const league = await storage.updateLeague(leagueId, updateData);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      res.json(league);
    } catch (error) {
      console.error("Error updating league:", error);
      res.status(500).json({ message: "Failed to update league" });
    }
  });

  // Get league members
  app.get("/api/leagues/:id/members", isAuthenticated, async (req: any, res) => {
    try {
      const leagueId = parseInt(req.params.id);
      if (isNaN(leagueId)) {
        return res.status(400).json({ message: "Invalid league ID" });
      }

      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);

      // Check if user has access to this league
      if (!user?.isSuperAdmin) {
        const member = await storage.getLeagueMember(leagueId, userId);
        if (!member) {
          return res.status(403).json({ message: "Access denied to this league" });
        }
      }

      const members = await storage.getLeagueMembers(leagueId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching league members:", error);
      res.status(500).json({ message: "Failed to fetch league members" });
    }
  });

  // Add a member to a league (commissioner or super admin)
  app.post("/api/leagues/:id/members", isAuthenticated, async (req: any, res) => {
    try {
      const leagueId = parseInt(req.params.id);
      if (isNaN(leagueId)) {
        return res.status(400).json({ message: "Invalid league ID" });
      }

      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);

      // Check authorization
      let authorized = user?.isSuperAdmin;
      if (!authorized) {
        const member = await storage.getLeagueMember(leagueId, userId);
        authorized = member?.role === 'commissioner';
      }

      if (!authorized) {
        return res.status(403).json({ message: "Commissioner or Super Admin access required" });
      }

      const { userId: targetUserId, email, role, teamName, teamAbbreviation } = req.body;
      
      // Look up user by userId or email
      let targetUser;
      if (targetUserId) {
        targetUser = await storage.getUser(targetUserId);
      } else if (email) {
        targetUser = await storage.getUserByEmail(email);
      } else {
        return res.status(400).json({ message: "User ID or email is required" });
      }

      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const resolvedUserId = targetUser.id;

      // Check if user is already a member
      const existingMember = await storage.getLeagueMember(leagueId, resolvedUserId);
      if (existingMember) {
        return res.status(400).json({ message: "User is already a member of this league" });
      }

      const member = await storage.addLeagueMember({
        leagueId,
        userId: resolvedUserId,
        role: role || 'member',
        teamName: teamName || targetUser.teamName,
        teamAbbreviation: teamAbbreviation || targetUser.teamAbbreviation,
      });

      res.status(201).json(member);
    } catch (error) {
      console.error("Error adding league member:", error);
      res.status(500).json({ message: "Failed to add league member" });
    }
  });

  // Update a league member (commissioner or super admin)
  app.patch("/api/leagues/:id/members/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const leagueId = parseInt(req.params.id);
      if (isNaN(leagueId)) {
        return res.status(400).json({ message: "Invalid league ID" });
      }

      const targetUserId = req.params.userId;
      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(sessionUserId);

      // Check authorization
      let authorized = user?.isSuperAdmin;
      if (!authorized) {
        const member = await storage.getLeagueMember(leagueId, sessionUserId);
        authorized = member?.role === 'commissioner';
      }

      if (!authorized) {
        return res.status(403).json({ message: "Commissioner or Super Admin access required" });
      }

      const { role, teamName, teamAbbreviation, isArchived } = req.body;
      const updateData: any = {};
      
      if (role !== undefined) updateData.role = role;
      if (teamName !== undefined) updateData.teamName = teamName;
      if (teamAbbreviation !== undefined) updateData.teamAbbreviation = teamAbbreviation?.toUpperCase().slice(0, 3);
      if (isArchived !== undefined) updateData.isArchived = isArchived;

      const member = await storage.updateLeagueMember(leagueId, targetUserId, updateData);
      if (!member) {
        return res.status(404).json({ message: "League member not found" });
      }

      res.json(member);
    } catch (error) {
      console.error("Error updating league member:", error);
      res.status(500).json({ message: "Failed to update league member" });
    }
  });

  // Remove a member from a league (commissioner or super admin)
  app.delete("/api/leagues/:id/members/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const leagueId = parseInt(req.params.id);
      if (isNaN(leagueId)) {
        return res.status(400).json({ message: "Invalid league ID" });
      }

      const targetUserId = req.params.userId;
      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(sessionUserId);

      // Check authorization
      let authorized = user?.isSuperAdmin;
      if (!authorized) {
        const member = await storage.getLeagueMember(leagueId, sessionUserId);
        authorized = member?.role === 'commissioner';
      }

      if (!authorized) {
        return res.status(403).json({ message: "Commissioner or Super Admin access required" });
      }

      // Check if target member exists
      const targetMember = await storage.getLeagueMember(leagueId, targetUserId);
      if (!targetMember) {
        return res.status(404).json({ message: "League member not found" });
      }

      // Prevent removing the owner
      if (targetMember.role === 'owner') {
        return res.status(400).json({ message: "Cannot remove the league owner" });
      }

      await storage.removeLeagueMember(leagueId, targetUserId);
      res.json({ success: true, message: "Member removed from league" });
    } catch (error) {
      console.error("Error removing league member:", error);
      res.status(500).json({ message: "Failed to remove league member" });
    }
  });

  // ================== ROSTER MANAGEMENT ROUTES ==================

  // Get roster players for a league (optionally filtered by user)
  app.get("/api/leagues/:id/roster", isAuthenticated, async (req: any, res) => {
    try {
      const leagueId = parseInt(req.params.id);
      if (isNaN(leagueId)) {
        return res.status(400).json({ message: "Invalid league ID" });
      }

      const userId = req.query.userId as string | undefined;
      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(sessionUserId);

      // Check authorization - member of this league or super admin
      let authorized = user?.isSuperAdmin;
      if (!authorized) {
        const member = await storage.getLeagueMember(leagueId, sessionUserId);
        authorized = !!member;
      }

      if (!authorized) {
        return res.status(403).json({ message: "Access denied - not a member of this league" });
      }

      const players = await storage.getRosterPlayers(leagueId, userId);
      res.json(players);
    } catch (error) {
      console.error("Error fetching roster players:", error);
      res.status(500).json({ message: "Failed to fetch roster players" });
    }
  });

  // Get roster usage for all teams in a league
  app.get("/api/leagues/:id/roster-usage", isAuthenticated, async (req: any, res) => {
    try {
      const leagueId = parseInt(req.params.id);
      if (isNaN(leagueId)) {
        return res.status(400).json({ message: "Invalid league ID" });
      }

      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(sessionUserId);

      // Check authorization - member of this league or super admin
      let authorized = user?.isSuperAdmin;
      if (!authorized) {
        const member = await storage.getLeagueMember(leagueId, sessionUserId);
        authorized = !!member;
      }

      if (!authorized) {
        return res.status(403).json({ message: "Access denied - not a member of this league" });
      }

      // Get the league to include caps
      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const usage = await storage.getAllTeamsRosterUsage(leagueId);
      res.json({
        caps: {
          budgetCap: league.budgetCap,
          ipCap: league.ipCap,
          paCap: league.paCap,
        },
        teams: usage,
      });
    } catch (error) {
      console.error("Error fetching roster usage:", error);
      res.status(500).json({ message: "Failed to fetch roster usage" });
    }
  });

  // Upload roster players via CSV (commissioner or super admin)
  app.post("/api/leagues/:id/roster/upload", isAuthenticated, async (req: any, res) => {
    try {
      const leagueId = parseInt(req.params.id);
      if (isNaN(leagueId)) {
        return res.status(400).json({ message: "Invalid league ID" });
      }

      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(sessionUserId);

      // Check authorization
      let authorized = user?.isSuperAdmin;
      if (!authorized) {
        const member = await storage.getLeagueMember(leagueId, sessionUserId);
        authorized = member?.role === 'commissioner';
      }

      if (!authorized) {
        return res.status(403).json({ message: "Commissioner or Super Admin access required" });
      }

      const { players, replaceExisting } = req.body;
      if (!Array.isArray(players)) {
        return res.status(400).json({ message: "Players must be an array" });
      }

      // If replacing existing, delete all roster players for this league first
      if (replaceExisting) {
        await storage.deleteAllRosterPlayers(leagueId);
      }

      // Get all league members to match team abbreviations
      const members = await storage.getLeagueMembers(leagueId);
      const abbrevToUser = new Map<string, string>();
      for (const member of members) {
        if (member.teamAbbreviation) {
          abbrevToUser.set(member.teamAbbreviation.toUpperCase(), member.userId);
        }
      }

      const validPlayers: any[] = [];
      const errors: string[] = [];

      for (const player of players) {
        const abbrev = (player.teamAbbreviation || "").toUpperCase();
        const userId = abbrevToUser.get(abbrev);
        
        if (!userId) {
          errors.push(`Unknown team abbreviation: ${abbrev} for player ${player.playerName}`);
          continue;
        }

        validPlayers.push({
          leagueId,
          userId,
          playerName: player.playerName,
          playerType: player.playerType || 'hitter',
          ip: player.ip || null,
          pa: player.pa || null,
          salary: player.salary || 0,
          contractYears: player.contractYears || 1,
        });
      }

      let created: any[] = [];
      if (validPlayers.length > 0) {
        created = await storage.createRosterPlayersBulk(validPlayers);
      }

      res.json({
        success: true,
        created: created.length,
        errors,
        message: `Created ${created.length} roster players${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
      });
    } catch (error) {
      console.error("Error uploading roster:", error);
      res.status(500).json({ message: "Failed to upload roster" });
    }
  });

  // Delete all roster players for a league (or specific team)
  app.delete("/api/leagues/:id/roster", isAuthenticated, async (req: any, res) => {
    try {
      const leagueId = parseInt(req.params.id);
      if (isNaN(leagueId)) {
        return res.status(400).json({ message: "Invalid league ID" });
      }

      const targetUserId = req.query.userId as string | undefined;
      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(sessionUserId);

      // Check authorization
      let authorized = user?.isSuperAdmin;
      if (!authorized) {
        const member = await storage.getLeagueMember(leagueId, sessionUserId);
        authorized = member?.role === 'commissioner';
      }

      if (!authorized) {
        return res.status(403).json({ message: "Commissioner or Super Admin access required" });
      }

      const deleted = await storage.deleteAllRosterPlayers(leagueId, targetUserId);
      res.json({ success: true, deleted, message: `Deleted ${deleted} roster players` });
    } catch (error) {
      console.error("Error deleting roster:", error);
      res.status(500).json({ message: "Failed to delete roster" });
    }
  });

  // Delete a specific roster player
  app.delete("/api/roster/:id", isAuthenticated, async (req: any, res) => {
    try {
      const playerId = parseInt(req.params.id);
      if (isNaN(playerId)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(sessionUserId);

      // Get the player to check league
      const players = await storage.getRosterPlayers(0); // This won't work, need to get by ID
      // For now, just allow super admin or we need a getById method
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Super Admin access required" });
      }

      await storage.deleteRosterPlayer(playerId);
      res.json({ success: true, message: "Roster player deleted" });
    } catch (error) {
      console.error("Error deleting roster player:", error);
      res.status(500).json({ message: "Failed to delete roster player" });
    }
  });

  // Update league caps (commissioner or super admin)
  app.patch("/api/leagues/:id/caps", isAuthenticated, async (req: any, res) => {
    try {
      const leagueId = parseInt(req.params.id);
      if (isNaN(leagueId)) {
        return res.status(400).json({ message: "Invalid league ID" });
      }

      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(sessionUserId);

      // Check authorization
      let authorized = user?.isSuperAdmin;
      if (!authorized) {
        const member = await storage.getLeagueMember(leagueId, sessionUserId);
        authorized = member?.role === 'commissioner';
      }

      if (!authorized) {
        return res.status(403).json({ message: "Commissioner or Super Admin access required" });
      }

      const { budgetCap, ipCap, paCap } = req.body;
      const updateData: any = {};
      
      if (budgetCap !== undefined) updateData.budgetCap = budgetCap;
      if (ipCap !== undefined) updateData.ipCap = ipCap;
      if (paCap !== undefined) updateData.paCap = paCap;

      const league = await storage.updateLeague(leagueId, updateData);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      res.json(league);
    } catch (error) {
      console.error("Error updating league caps:", error);
      res.status(500).json({ message: "Failed to update league caps" });
    }
  });

  // Commissioner bid endpoints - place bids on behalf of teams
  app.post("/api/commissioner/bids", isAuthenticated, async (req: any, res) => {
    try {
      const commissionerId = req.session.userId!;
      
      // Validate and coerce input types
      const freeAgentId = parseInt(req.body.freeAgentId);
      const targetUserId = String(req.body.targetUserId || "");
      const amount = parseInt(req.body.amount);
      const years = parseInt(req.body.years);
      
      if (isNaN(freeAgentId) || !targetUserId || isNaN(amount) || isNaN(years)) {
        return res.status(400).json({ message: "Missing or invalid required fields: freeAgentId (number), targetUserId (string), amount (number), years (number)" });
      }
      
      if (amount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number" });
      }
      
      const agent = await storage.getFreeAgent(freeAgentId);
      if (!agent) {
        return res.status(404).json({ message: "Free agent not found" });
      }
      
      if (!agent.auctionId) {
        return res.status(400).json({ message: "Player is not associated with an auction" });
      }
      
      if (!await hasAuctionCommissionerAccess(commissionerId, agent.auctionId)) {
        return res.status(403).json({ message: "You don't have commissioner access for this auction" });
      }
      
      // Always verify target team is enrolled in this auction (before other checks)
      const limitsCheck = await storage.canUserBidOnPlayer(targetUserId, freeAgentId);
      if (!limitsCheck.canBid) {
        return res.status(400).json({ message: limitsCheck.reason || "Target team is not enrolled in this auction" });
      }
      
      if (new Date(agent.auctionEndTime) <= new Date()) {
        return res.status(400).json({ message: "Auction has ended" });
      }
      
      if (agent.auctionStartTime && new Date(agent.auctionStartTime) > new Date()) {
        return res.status(400).json({ message: "Bidding has not started yet for this player" });
      }
      
      if (years < 1 || years > 5) {
        return res.status(400).json({ message: "Years must be between 1 and 5" });
      }
      
      const minimumYears = agent.minimumYears || 1;
      if (years < minimumYears) {
        return res.status(400).json({ message: `This player requires at least a ${minimumYears}-year contract` });
      }
      
      const auction = await storage.getAuction(agent.auctionId);
      const yearFactors = auction ? [
        auction.yearFactor1, auction.yearFactor2, auction.yearFactor3, auction.yearFactor4, auction.yearFactor5,
      ] : [1.0, 1.25, 1.33, 1.43, 1.55];
      
      const totalValue = amount * yearFactors[years - 1];
      
      if (amount < agent.minimumBid) {
        return res.status(400).json({ message: `Bid must be at least $${agent.minimumBid}` });
      }
      
      const bidIncrement = auction?.bidIncrement ?? 0.10;
      const currentHighBid = await storage.getHighestBidForAgent(freeAgentId);
      
      if (currentHighBid) {
        if (currentHighBid.isImportedInitial) {
          if (years <= currentHighBid.years) {
            return res.status(400).json({ 
              message: `Imported opening bid requires more years. Current: ${currentHighBid.years} year(s), minimum: ${currentHighBid.years + 1} years.` 
            });
          }
          if (amount < currentHighBid.amount) {
            return res.status(400).json({ message: `Bid must be at least $${currentHighBid.amount}` });
          }
        }
        
        const minRequired = currentHighBid.totalValue * (1 + bidIncrement);
        if (totalValue < minRequired) {
          return res.status(400).json({ 
            message: `Bid must beat current bid. Minimum total value: $${Math.ceil(minRequired)}` 
          });
        }
      }
      
      const enforceBudget = auction?.enforceBudget ?? true;
      if (enforceBudget) {
        const budgetInfo = await storage.getUserBudgetInfo(targetUserId, agent.auctionId);
        let availableForThisBid = budgetInfo.available;
        if (currentHighBid && currentHighBid.userId === targetUserId) {
          availableForThisBid += currentHighBid.amount;
        }
        if (amount > availableForThisBid) {
          return res.status(400).json({ 
            message: `Bid exceeds team's available budget. Available: $${Math.floor(availableForThisBid)}, Bid: $${amount}` 
          });
        }
      }
      
      const bid = await storage.createBid({
        freeAgentId,
        userId: targetUserId,
        amount,
        years,
        totalValue,
        isAutoBid: false,
      });
      
      let auctionExtended = false;
      if (auction?.extendAuctionOnBid) {
        const now = new Date();
        const endTime = new Date(agent.auctionEndTime);
        const hoursUntilEnd = (endTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilEnd > 0 && hoursUntilEnd <= 24) {
          const newEndTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
          await storage.updateFreeAgentAuctionEndTime(freeAgentId, newEndTime);
          auctionExtended = true;
        }
      }
      
      const autoBidsTriggered = await processAllAutoBidsUntilStable(freeAgentId, targetUserId, auction);
      
      console.log(`[Commissioner Bid] ${commissionerId} placed bid for ${targetUserId} on player ${agent.name}: $${amount} x ${years}yr`);
      res.json({ ...bid, autoBidsTriggered, auctionExtended });
    } catch (error) {
      console.error("Error placing commissioner bid:", error);
      res.status(500).json({ message: "Failed to place bid" });
    }
  });

  // Commissioner auto-bid endpoint
  app.post("/api/commissioner/auto-bids", isAuthenticated, async (req: any, res) => {
    try {
      const commissionerId = req.session.userId!;
      
      // Validate and coerce input types
      const freeAgentId = parseInt(req.body.freeAgentId);
      const targetUserId = String(req.body.targetUserId || "");
      const maxAmount = parseInt(req.body.maxAmount) || 0;
      const years = parseInt(req.body.years) || 1;
      const isActive = req.body.isActive !== false;
      
      if (isNaN(freeAgentId) || !targetUserId) {
        return res.status(400).json({ message: "Missing or invalid required fields: freeAgentId (number), targetUserId (string)" });
      }
      
      const agent = await storage.getFreeAgent(freeAgentId);
      if (!agent) {
        return res.status(404).json({ message: "Free agent not found" });
      }
      
      if (!agent.auctionId) {
        return res.status(400).json({ message: "Player is not associated with an auction" });
      }
      
      if (!await hasAuctionCommissionerAccess(commissionerId, agent.auctionId)) {
        return res.status(403).json({ message: "You don't have commissioner access for this auction" });
      }
      
      // Always verify target team is enrolled
      const canBidResult = await storage.canUserBidOnPlayer(targetUserId, freeAgentId);
      if (!canBidResult.canBid) {
        return res.status(400).json({ message: canBidResult.reason || "Target team is not enrolled in this auction" });
      }
      
      if (new Date(agent.auctionEndTime) <= new Date()) {
        return res.status(400).json({ message: "Auction has ended" });
      }
      
      const auction = await storage.getAuction(agent.auctionId);
      if (auction && !auction.allowAutoBidding) {
        return res.status(400).json({ message: "Auto-bidding is not enabled for this auction" });
      }
      
      const hasStarted = !agent.auctionStartTime || new Date(agent.auctionStartTime) <= new Date();
      
      if (isActive) {
        const minimumYears = agent.minimumYears || 1;
        if (years < minimumYears) {
          return res.status(400).json({ message: `This player requires at least a ${minimumYears}-year contract` });
        }
        
        if (maxAmount < agent.minimumBid) {
          return res.status(400).json({ message: `Max amount must be at least $${agent.minimumBid}` });
        }
        
        if (maxAmount <= 0) {
          return res.status(400).json({ message: "Max amount must be a positive number" });
        }
        
        if (years < 1 || years > 5) {
          return res.status(400).json({ message: "Years must be between 1 and 5" });
        }
      }
      
      const autoBid = await storage.createOrUpdateAutoBid({
        freeAgentId,
        userId: targetUserId,
        maxAmount: maxAmount || 0,
        years: years || 1,
        isActive: isActive ?? true,
      });
      
      if (hasStarted && autoBid.isActive) {
        const yearFactors = auction ? [
          auction.yearFactor1, auction.yearFactor2, auction.yearFactor3, auction.yearFactor4, auction.yearFactor5,
        ] : [1.0, 1.25, 1.33, 1.43, 1.55];
        
        const highestBid = await storage.getHighestBidForAgent(freeAgentId);
        
        if (!highestBid) {
          const openingAmount = Math.max(agent.minimumBid, 1);
          if (openingAmount <= autoBid.maxAmount) {
            const newTotalValue = openingAmount * yearFactors[autoBid.years - 1];
            await storage.createBid({
              freeAgentId,
              userId: targetUserId,
              amount: openingAmount,
              years: autoBid.years,
              totalValue: newTotalValue,
              isAutoBid: true,
            });
            const triggered = await processAllAutoBidsUntilStable(freeAgentId, targetUserId, auction);
            console.log(`[Commissioner Auto-Bid] Created for ${targetUserId} on ${agent.name}: max $${maxAmount} x ${years}yr`);
            return res.json({ ...autoBid, autoBidsTriggered: triggered });
          }
        } else if (highestBid.userId !== targetUserId) {
          const triggered = await processAllAutoBidsUntilStable(freeAgentId, "", auction);
          console.log(`[Commissioner Auto-Bid] Created for ${targetUserId} on ${agent.name}: max $${maxAmount} x ${years}yr`);
          return res.json({ ...autoBid, autoBidsTriggered: triggered });
        }
      }
      
      console.log(`[Commissioner Auto-Bid] Created for ${targetUserId} on ${agent.name}: max $${maxAmount} x ${years}yr`);
      res.json({ ...autoBid, autoBidsTriggered: false });
    } catch (error) {
      console.error("Error placing commissioner auto-bid:", error);
      res.status(500).json({ message: "Failed to place auto-bid" });
    }
  });

  // Commissioner: Get a team's bids for an auction
  app.get("/api/commissioner/teams/:userId/bids", isAuthenticated, async (req: any, res) => {
    try {
      const commissionerId = req.session.originalUserId || req.session.userId!;
      const targetUserId = req.params.userId;
      const auctionId = req.query.auctionId ? parseInt(req.query.auctionId) : undefined;
      
      if (!auctionId || isNaN(auctionId)) {
        return res.status(400).json({ message: "auctionId is required" });
      }
      
      if (!await hasAuctionCommissionerAccess(commissionerId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      
      const bids = await storage.getUserBidsRaw(targetUserId, auctionId);
      res.json(bids);
    } catch (error) {
      console.error("Error fetching team bids:", error);
      res.status(500).json({ message: "Failed to fetch team bids" });
    }
  });

  // Commissioner: Get a team's auto-bids for an auction
  app.get("/api/commissioner/teams/:userId/auto-bids", isAuthenticated, async (req: any, res) => {
    try {
      const commissionerId = req.session.originalUserId || req.session.userId!;
      const targetUserId = req.params.userId;
      const auctionId = req.query.auctionId ? parseInt(req.query.auctionId) : undefined;
      
      if (!auctionId || isNaN(auctionId)) {
        return res.status(400).json({ message: "auctionId is required" });
      }
      
      if (!await hasAuctionCommissionerAccess(commissionerId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      
      const autoBids = await storage.getUserAutoBids(targetUserId, auctionId);
      res.json(autoBids);
    } catch (error) {
      console.error("Error fetching team auto-bids:", error);
      res.status(500).json({ message: "Failed to fetch team auto-bids" });
    }
  });

  // Commissioner: Cancel a bid
  app.delete("/api/commissioner/bids/:bidId", isAuthenticated, async (req: any, res) => {
    try {
      const commissionerId = req.session.originalUserId || req.session.userId!;
      const bidId = parseInt(req.params.bidId);
      
      if (isNaN(bidId)) {
        return res.status(400).json({ message: "Invalid bid ID" });
      }
      
      const bid = await storage.getBid(bidId);
      if (!bid) {
        return res.status(404).json({ message: "Bid not found" });
      }
      
      const agent = await storage.getFreeAgent(bid.freeAgentId);
      if (!agent || !agent.auctionId) {
        return res.status(404).json({ message: "Associated player not found" });
      }
      
      if (!await hasAuctionCommissionerAccess(commissionerId, agent.auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      
      // Check if auction has ended - can't delete bids from closed auctions
      if (new Date(agent.auctionEndTime) <= new Date()) {
        return res.status(400).json({ message: "Cannot cancel bids from closed auctions" });
      }
      
      await storage.deleteBid(bidId);
      console.log(`[Commissioner] Cancelled bid ${bidId} for user ${bid.userId} on player ${agent.name}`);
      
      res.json({ message: "Bid cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling bid:", error);
      res.status(500).json({ message: "Failed to cancel bid" });
    }
  });

  // Commissioner: Cancel an auto-bid
  app.delete("/api/commissioner/auto-bids/:autoBidId", isAuthenticated, async (req: any, res) => {
    try {
      const commissionerId = req.session.originalUserId || req.session.userId!;
      const autoBidId = parseInt(req.params.autoBidId);
      
      if (isNaN(autoBidId)) {
        return res.status(400).json({ message: "Invalid auto-bid ID" });
      }
      
      // Need to find the auto-bid first
      const [autoBid] = await db.select().from(autoBids).where(eq(autoBids.id, autoBidId));
      if (!autoBid) {
        return res.status(404).json({ message: "Auto-bid not found" });
      }
      
      const agent = await storage.getFreeAgent(autoBid.freeAgentId);
      if (!agent || !agent.auctionId) {
        return res.status(404).json({ message: "Associated player not found" });
      }
      
      if (!await hasAuctionCommissionerAccess(commissionerId, agent.auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      
      await storage.deleteAutoBid(autoBidId);
      console.log(`[Commissioner] Cancelled auto-bid ${autoBidId} for user ${autoBid.userId} on player ${agent.name}`);
      
      res.json({ message: "Auto-bid cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling auto-bid:", error);
      res.status(500).json({ message: "Failed to cancel auto-bid" });
    }
  });

  return httpServer;
}

// Unified auto-bid processor that handles both regular auto-bids and bundle items
// Iterates until stable state (two passes with no changes)
// Returns true if any changes were made (auto-bids triggered)
async function processAllAutoBidsUntilStable(
  agentId: number,
  excludeUserId: string,
  auction: any
): Promise<boolean> {
  console.log(`[UnifiedAutoBid] START processing for agent ${agentId}, excludeUserId=${excludeUserId}`);
  
  const agent = await storage.getFreeAgent(agentId);
  if (!agent) {
    console.log(`[UnifiedAutoBid] Agent ${agentId} not found, exiting`);
    return false;
  }
  
  // Check if auction is still open
  if (new Date(agent.auctionEndTime) <= new Date()) {
    console.log(`[UnifiedAutoBid] Agent ${agentId} auction ended, exiting`);
    return false;
  }
  
  // Check if auction has started (auctionStartTime is optional - null means immediately available)
  if (agent.auctionStartTime && new Date(agent.auctionStartTime) > new Date()) {
    console.log(`[UnifiedAutoBid] Agent ${agentId} auction not started yet, exiting`);
    return false;
  }
  
  const yearFactors = auction ? [
    auction.yearFactor1,
    auction.yearFactor2,
    auction.yearFactor3,
    auction.yearFactor4,
    auction.yearFactor5,
  ] : [1.0, 1.25, 1.33, 1.43, 1.55];
  
  const bidIncrement = auction?.bidIncrement ?? 0.10;
  const enforceBudget = auction?.enforceBudget ?? true;
  
  console.log(`[UnifiedAutoBid] Agent ${agentId}: bidIncrement=${bidIncrement}, enforceBudget=${enforceBudget}, yearFactors=${JSON.stringify(yearFactors)}`);
  
  let passesWithNoChange = 0;
  const maxIterations = 100; // Safety limit
  let iterations = 0;
  let anyChangesMade = false;
  
  // Track who placed the most recent bid (to prevent immediate self-counter)
  let lastBidderId = excludeUserId;
  
  while (passesWithNoChange < 2 && iterations < maxIterations) {
    iterations++;
    let madeChange = false;
    
    // Get current highest bid
    const highestBid = await storage.getHighestBidForAgent(agentId);
    if (!highestBid) {
      console.log(`[UnifiedAutoBid] No highest bid found, breaking loop`);
      break; // No bids to respond to
    }
    
    const currentHighUserId = highestBid.userId;
    const currentTotalValue = highestBid.totalValue;
    const requiredTotalValue = currentTotalValue * (1 + bidIncrement);
    
    console.log(`[UnifiedAutoBid] Iteration ${iterations}: highBidder=${currentHighUserId}, totalValue=${currentTotalValue}, required=${requiredTotalValue}, lastBidder=${lastBidderId}`);
    
    // Get all regular auto-bids for this player
    const autoBids = await storage.getAutoBidsForAgent(agentId);
    
    // Get all deployed bundle items for this player
    const deployedBundleItems = await storage.getAllDeployedBundleItemsForAgent(agentId);
    
    // Process regular auto-bids first
    for (const autoBid of autoBids) {
      // Skip if this user is already winning or just placed the last bid
      if (autoBid.userId === currentHighUserId || autoBid.userId === lastBidderId || !autoBid.isActive) {
        console.log(`[UnifiedAutoBid] Skipping user ${autoBid.userId}: isHighBidder=${autoBid.userId === currentHighUserId}, isLastBidder=${autoBid.userId === lastBidderId}, active=${autoBid.isActive}`);
        continue;
      }
      
      // For imported initial bids, subsequent bids must have more years AND at least match the dollar amount
      if (highestBid.isImportedInitial) {
        if (autoBid.years <= highestBid.years) continue;
        if (autoBid.maxAmount < highestBid.amount) continue;
      }
      
      const factor = yearFactors[autoBid.years - 1];
      const maxTotalValue = autoBid.maxAmount * factor;
      
      console.log(`[UnifiedAutoBid] Evaluating user ${autoBid.userId}: maxAmount=${autoBid.maxAmount}, years=${autoBid.years}, factor=${factor}, maxTotalValue=${maxTotalValue}, requiredTotalValue=${requiredTotalValue}`);
      
      if (maxTotalValue >= requiredTotalValue) {
        // Can counter - calculate bid amount
        let bidAmount = Math.ceil(requiredTotalValue / factor);
        bidAmount = Math.max(bidAmount, agent.minimumBid);
        const bidTotalValue = bidAmount * factor;
        
        if (bidAmount > autoBid.maxAmount) continue;
        
        // Check budget
        if (enforceBudget && agent.auctionId) {
          try {
            const budgetInfo = await storage.getUserBudgetInfo(autoBid.userId, agent.auctionId);
            if (bidAmount > budgetInfo.available) continue;
          } catch (error) {
            console.error("Error checking budget for auto-bid:", error);
            continue;
          }
        }
        
        // Place the counter-bid
        await storage.createBid({
          freeAgentId: agentId,
          userId: autoBid.userId,
          amount: bidAmount,
          years: autoBid.years,
          totalValue: bidTotalValue,
          isAutoBid: true,
        });
        
        console.log(`[UnifiedAutoBid] Auto-bid placed: ${autoBid.userId} bid $${bidAmount} on agent ${agentId}`);
        madeChange = true;
        lastBidderId = autoBid.userId; // Track who just bid
        break; // Only one bid per pass
      }
    }
    
    // If no regular auto-bid placed, check bundle items
    if (!madeChange) {
      for (const bundleItem of deployedBundleItems) {
        const bundleOwner = bundleItem.bundle.userId;
        
        // Skip if this user is already winning
        if (bundleOwner === currentHighUserId) continue;
        
        // For imported initial bids, subsequent bids must have more years AND at least match the dollar amount
        if (highestBid.isImportedInitial) {
          if (bundleItem.years <= highestBid.years || bundleItem.amount < highestBid.amount) {
            // Bundle item can't counter due to years/amount restriction - mark as outbid and activate next
            await storage.updateBidBundleItem(bundleItem.id, { status: 'outbid' });
            const nextItem = await storage.activateNextBundleItem(bundleItem.bundle.id);
            if (nextItem) {
              console.log(`[UnifiedAutoBid] Bundle item ${bundleItem.id} outbid (years/amount), activated next: ${nextItem.id}`);
              madeChange = true;
            }
            continue;
          }
        }
        
        const factor = yearFactors[bundleItem.years - 1];
        const maxTotalValue = bundleItem.amount * factor;
        
        if (maxTotalValue >= requiredTotalValue) {
          // Bundle item can counter - calculate bid amount
          let bidAmount = Math.ceil(requiredTotalValue / factor);
          bidAmount = Math.max(bidAmount, agent.minimumBid);
          const bidTotalValue = bidAmount * factor;
          
          if (bidAmount > bundleItem.amount) continue;
          
          // Check budget
          if (enforceBudget) {
            try {
              const budgetInfo = await storage.getUserBudgetInfo(bundleOwner, bundleItem.bundle.auctionId);
              if (bidAmount > budgetInfo.available) {
                // Can't afford - mark as outbid and activate next
                await storage.updateBidBundleItem(bundleItem.id, { status: 'outbid' });
                const nextItem = await storage.activateNextBundleItem(bundleItem.bundle.id);
                if (nextItem) {
                  console.log(`[UnifiedAutoBid] Bundle item ${bundleItem.id} outbid (budget), activated next: ${nextItem.id}`);
                  madeChange = true;
                }
                continue;
              }
            } catch (error) {
              console.error("Error checking budget for bundle counter-bid:", error);
              continue;
            }
          }
          
          // Place the counter-bid
          const newBid = await storage.createBid({
            freeAgentId: agentId,
            userId: bundleOwner,
            amount: bidAmount,
            years: bundleItem.years,
            totalValue: bidTotalValue,
            isAutoBid: true,
          });
          
          // Update bundle item with new bid
          await storage.updateBidBundleItem(bundleItem.id, { bidId: newBid.id });
          
          console.log(`[UnifiedAutoBid] Bundle counter-bid placed: ${bundleOwner} bid $${bidAmount} on agent ${agentId}`);
          madeChange = true;
          lastBidderId = bundleOwner; // Track who just bid (bundle owner)
          break; // Only one bid per pass
        } else {
          // Bundle item can't counter - mark as outbid and activate next
          console.log(`[UnifiedAutoBid] Bundle item ${bundleItem.id} can't counter (max=${maxTotalValue}, required=${requiredTotalValue})`);
          await storage.updateBidBundleItem(bundleItem.id, { status: 'outbid' });
          const nextItem = await storage.activateNextBundleItem(bundleItem.bundle.id);
          if (nextItem) {
            console.log(`[UnifiedAutoBid] Activated next bundle item: ${nextItem.id} for player ${nextItem.freeAgentId}`);
            // Deploy the next item as an initial bid on its player
            await deployBundleItemAsAutoBid(nextItem, bundleItem.bundle);
            madeChange = true;
          }
        }
      }
    }
    
    if (madeChange) {
      passesWithNoChange = 0;
      anyChangesMade = true;
      console.log(`[UnifiedAutoBid] Iteration ${iterations} made change, resetting passesWithNoChange to 0`);
    } else {
      passesWithNoChange++;
      console.log(`[UnifiedAutoBid] Iteration ${iterations} no change, passesWithNoChange=${passesWithNoChange}`);
    }
  }
  
  if (iterations >= maxIterations) {
    console.error(`[UnifiedAutoBid] Hit max iterations (${maxIterations}) for agent ${agentId}`);
  }
  
  console.log(`[UnifiedAutoBid] END for agent ${agentId}: totalIterations=${iterations}, anyChangesMade=${anyChangesMade}`);
  return anyChangesMade;
}

// Deploy a bundle item as an initial bid on its player (called when cascade activates a new item)
async function deployBundleItemAsAutoBid(
  item: any,
  bundle: any
): Promise<boolean> {
  const agent = await storage.getFreeAgent(item.freeAgentId);
  if (!agent) {
    await storage.updateBidBundleItem(item.id, { status: 'skipped' });
    return false;
  }
  
  // Check if auction has ended (skip the item)
  if (new Date(agent.auctionEndTime) <= new Date()) {
    await storage.updateBidBundleItem(item.id, { status: 'skipped' });
    return false;
  }
  
  // Check if auction hasn't started yet (don't skip - wait for it to start)
  if (new Date(agent.auctionStartTime) > new Date()) {
    // Auction hasn't started - leave the item as-is, the background job will deploy it later
    console.log(`[Bundle] Item ${item.id} for ${agent.name}: auction hasn't started yet, will deploy when it starts`);
    return false;
  }
  
  const auction = await storage.getAuction(bundle.auctionId);
  if (!auction) {
    await storage.updateBidBundleItem(item.id, { status: 'skipped' });
    return false;
  }
  
  const yearFactors = [
    auction.yearFactor1,
    auction.yearFactor2,
    auction.yearFactor3,
    auction.yearFactor4,
    auction.yearFactor5,
  ];
  const bidIncrement = auction.bidIncrement ?? 0.10;
  const factor = yearFactors[item.years - 1];
  const userId = bundle.userId;
  
  // Get current highest bid
  const highestBid = await storage.getHighestBidForAgent(item.freeAgentId);
  let bidAmount: number;
  let bidTotalValue: number;
  
  if (highestBid) {
    // Check if WE are already the high bidder
    if (highestBid.userId === userId) {
      await storage.updateBidBundleItem(item.id, { status: 'deployed', bidId: highestBid.id });
      return true;
    }
    
    // For imported initial bids, subsequent bids must have more years AND at least match the dollar amount
    if (highestBid.isImportedInitial) {
      if (item.years <= highestBid.years || item.amount < highestBid.amount) {
        await storage.updateBidBundleItem(item.id, { status: 'skipped' });
        return false;
      }
    }
    
    // Need to beat the current highest bid
    const requiredTotalValue = highestBid.totalValue * (1 + bidIncrement);
    const ourMaxTotalValue = item.amount * factor;
    
    if (ourMaxTotalValue < requiredTotalValue) {
      await storage.updateBidBundleItem(item.id, { status: 'skipped' });
      return false;
    }
    
    bidAmount = Math.ceil(requiredTotalValue / factor);
    bidAmount = Math.max(bidAmount, agent.minimumBid);
    bidTotalValue = bidAmount * factor;
  } else {
    // No existing bids
    bidAmount = Math.max(agent.minimumBid, 1);
    bidAmount = Math.min(bidAmount, item.amount);
    bidTotalValue = bidAmount * factor;
  }
  
  // Check budget
  const enforceBudget = auction.enforceBudget ?? true;
  if (enforceBudget) {
    try {
      const budgetInfo = await storage.getUserBudgetInfo(userId, bundle.auctionId);
      if (bidAmount > budgetInfo.available) {
        await storage.updateBidBundleItem(item.id, { status: 'skipped' });
        return false;
      }
    } catch (error) {
      console.error("Error checking budget for bundle bid:", error);
      await storage.updateBidBundleItem(item.id, { status: 'skipped' });
      return false;
    }
  }
  
  // Check roster/IP/PA limits
  const limitCheck = await storage.canUserBidOnPlayer(userId, item.freeAgentId);
  if (!limitCheck.canBid) {
    await storage.updateBidBundleItem(item.id, { status: 'skipped' });
    return false;
  }
  
  // Place the bid
  const newBid = await storage.createBid({
    freeAgentId: item.freeAgentId,
    userId: userId,
    amount: bidAmount,
    years: item.years,
    totalValue: bidTotalValue,
    isAutoBid: true,
  });
  
  await storage.updateBidBundleItem(item.id, { status: 'deployed', bidId: newBid.id });
  
  console.log(`[deployBundleItemAsAutoBid] Deployed bundle item ${item.id} with bid $${bidAmount} on player ${agent.name}`);
  
  // Now run unified processing on this new player to handle any auto-bids
  await processAllAutoBidsUntilStable(item.freeAgentId, userId, auction);
  
  return true;
}

// Export functions for use in background jobs
export { processAllAutoBidsUntilStable, deployBundleItemAsAutoBid };
