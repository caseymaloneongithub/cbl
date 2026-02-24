import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { setupAuth, isAuthenticated, hashPassword, generateRandomPassword } from "./auth";
import {
  insertBidSchema,
  insertAutoBidSchema,
  autoBids,
  teamOwnershipInvites,
  leagueMembers,
  leagues,
  users,
  rosterPlayers,
  leagueRosterAssignments,
  auctions,
  auctionTeams,
  drafts,
  draftOrder,
  draftPicks,
  autoDraftLists,
} from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { parse, isValid, format } from "date-fns";
import crypto from "crypto";
import { syncPlayerStatsFromMLB, testMLBConnection, fetchAllAffiliatedPlayers } from "./mlb-api";
import { sendDraftRoundSummaryEmail } from "./email";
import fs from "fs/promises";
import path from "path";

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

function normalizeEmail(value: string): string {
  return String(value || "").trim().toLowerCase();
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
          teamAbbreviation: m.teamAbbreviation,
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
          if (member.teamAbbreviation) {
            abbrevToUserId.set(member.teamAbbreviation.toLowerCase().trim(), member.userId);
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

  // Super admin: Sync professional players from MLB API into reference database
  app.post("/api/admin/mlb-players/sync", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Super Admin access required" });
      }

      const { season } = req.body;
      const currentYear = new Date().getFullYear();
      const syncSeason = typeof season === "number" && season >= 2000 && season <= currentYear + 1
        ? season
        : currentYear;

      console.log(`[MLB Sync] Starting professional players sync for season ${syncSeason}`);

      const players = await fetchAllAffiliatedPlayers(syncSeason);

      const upserted = await storage.upsertMlbPlayers(
        players.map(p => ({
          mlbId: p.mlbId,
          fullName: p.fullName,
          fullFmlName: p.fullFmlName,
          firstName: p.firstName,
          middleName: p.middleName,
          lastName: p.lastName,
          primaryPosition: p.primaryPosition,
          positionName: p.positionName,
          positionType: p.positionType,
          batSide: p.batSide,
          throwHand: p.throwHand,
          currentTeamId: p.currentTeamId,
          currentTeamName: p.currentTeamName,
          parentOrgId: p.parentOrgId,
          parentOrgName: p.parentOrgName,
          sportId: p.sportId,
          sportLevel: p.sportLevel,
          birthDate: p.birthDate,
          age: p.age,
          isActive: p.isActive,
          hadHittingStats: p.hadHittingStats,
          hadPitchingStats: p.hadPitchingStats,
          hittingAtBats: p.hittingAtBats,
          hittingWalks: p.hittingWalks,
          hittingSingles: p.hittingSingles,
          hittingDoubles: p.hittingDoubles,
          hittingTriples: p.hittingTriples,
          hittingHomeRuns: p.hittingHomeRuns,
          hittingAvg: p.hittingAvg,
          hittingObp: p.hittingObp,
          hittingSlg: p.hittingSlg,
          hittingOps: p.hittingOps,
          pitchingGames: p.pitchingGames,
          pitchingGamesStarted: p.pitchingGamesStarted,
          pitchingStrikeouts: p.pitchingStrikeouts,
          pitchingWalks: p.pitchingWalks,
          pitchingHits: p.pitchingHits,
          pitchingHomeRuns: p.pitchingHomeRuns,
          pitchingEra: p.pitchingEra,
          pitchingInningsPitched: p.pitchingInningsPitched,
          hittingGamesStarted: p.hittingGamesStarted,
          hittingPlateAppearances: p.hittingPlateAppearances,
          isTwoWayQualified: p.isTwoWayQualified,
          season: p.season,
        }))
      );

      const levelCounts: Record<string, number> = {};
      for (const p of players) {
        levelCounts[p.sportLevel] = (levelCounts[p.sportLevel] || 0) + 1;
      }

      console.log(`[MLB Sync] Completed: ${upserted} players synced`);

      res.json({
        message: `Synced ${upserted} professional players for ${syncSeason} season`,
        season: syncSeason,
        totalPlayers: upserted,
        byLevel: levelCounts,
      });
    } catch (error: any) {
      console.error("Error syncing MLB players:", error);
      res.status(500).json({ message: error.message || "Failed to sync MLB players" });
    }
  });

  // Super admin: Get MLB player counts/status
  app.get("/api/admin/mlb-players/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Super Admin access required" });
      }

      const season = req.query.season ? parseInt(String(req.query.season), 10) : undefined;
      if (req.query.season && Number.isNaN(season)) {
        return res.status(400).json({ message: "Invalid season" });
      }

      const levels = ["MLB", "AAA", "AA", "High-A", "Single-A", "Rookie"];
      const total = await storage.getMlbPlayerCount({ season });

      const byLevel: Record<string, { total: number; hitters: number; pitchers: number; twoWayQualified: number }> = {};
      const twoWayQualified = await storage.getMlbPlayerCount({ isTwoWayQualified: true, season });
      for (const level of levels) {
        const levelTotal = await storage.getMlbPlayerCount({ sportLevel: level, season });
        const hitters = await storage.getMlbPlayerCount({
          sportLevel: level,
          hadHittingStats: true,
          isTwoWayQualified: false,
          season,
        });
        const pitchers = await storage.getMlbPlayerCount({
          sportLevel: level,
          hadPitchingStats: true,
          hadHittingStats: false,
          season,
        });
        const levelTwoWayQualified = await storage.getMlbPlayerCount({
          sportLevel: level,
          isTwoWayQualified: true,
          season,
        });
        byLevel[level] = { total: levelTotal, hitters, pitchers, twoWayQualified: levelTwoWayQualified };
      }

      res.json({ total, byLevel, twoWayQualified, season });
    } catch (error: any) {
      console.error("Error fetching MLB player status:", error);
      res.status(500).json({ message: "Failed to fetch MLB player status" });
    }
  });

  // Search MLB players reference database (available to all authenticated users)
  app.get("/api/mlb-players", isAuthenticated, async (req: any, res) => {
    try {
      const { search, sportLevel, limit, offset, currentTeamName, parentOrgName, season, sortBy, sortDir } = req.query;
      const filters: any = {
        search: search as string,
        sportLevel: sportLevel as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
        season: season ? parseInt(season as string) : undefined,
        sortBy: sortBy as string,
        sortDir: sortDir as string,
      };
      if (currentTeamName) filters.currentTeamName = currentTeamName as string;
      if (parentOrgName) filters.parentOrgName = parentOrgName as string;
      const players = await storage.getMlbPlayers(filters);
      const count = await storage.getMlbPlayerCount(filters);
      res.json({ players, total: count });
    } catch (error: any) {
      console.error("Error searching MLB players:", error);
      res.status(500).json({ message: "Failed to search MLB players" });
    }
  });

  app.get("/api/mlb-players/teams", isAuthenticated, async (req: any, res) => {
    try {
      const { season, sportLevel } = req.query;
      const teams = await storage.getMlbPlayerTeams(
        season ? parseInt(season as string) : undefined,
        sportLevel as string,
      );
      res.json(teams);
    } catch (error: any) {
      console.error("Error fetching MLB teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  // ==================== LEAGUE ROSTER ASSIGNMENTS ====================

  // Get roster assignments for a league (league members only)
  app.get("/api/leagues/:id/roster-assignments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);

      const user = await storage.getUser(userId);
      if (!user?.isSuperAdmin) {
        const member = await storage.getLeagueMember(leagueId, userId);
        if (!member) return res.status(403).json({ message: "League membership required" });
      }

      const season = parseInt(req.query.season as string) || 2025;
      const filterUserId = req.query.userId as string | undefined;
      const rosterType = req.query.rosterType as string | undefined;

      const assignments = await storage.getLeagueRosterAssignments(leagueId, season, {
        userId: filterUserId,
        rosterType,
      });
      const counts = await storage.getRosterAssignmentCounts(leagueId, season);

      res.json({ assignments, counts });
    } catch (error: any) {
      console.error("Error fetching roster assignments:", error);
      res.status(500).json({ message: "Failed to fetch roster assignments" });
    }
  });

  // Get unassigned (free agent) players for a league (league members only)
  app.get("/api/leagues/:id/unassigned-players", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);

      const user = await storage.getUser(userId);
      if (!user?.isSuperAdmin) {
        const member = await storage.getLeagueMember(leagueId, userId);
        if (!member) return res.status(403).json({ message: "League membership required" });
      }
      const season = parseInt(req.query.season as string) || 2025;
      const search = req.query.search as string | undefined;
      const sportLevel = req.query.sportLevel as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const players = await storage.getUnassignedPlayers(leagueId, season, {
        search, sportLevel, limit, offset,
      });
      const total = await storage.getUnassignedPlayerCount(leagueId, season, { search, sportLevel });

      res.json({ players, total });
    } catch (error: any) {
      console.error("Error fetching unassigned players:", error);
      res.status(500).json({ message: "Failed to fetch unassigned players" });
    }
  });

  // Assign a player to a team's roster (commissioner only)
  app.post("/api/leagues/:id/roster-assignments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);

      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { mlbPlayerId, assignToUserId, rosterType, season } = req.body;
      if (!mlbPlayerId || !assignToUserId || !rosterType || !season) {
        return res.status(400).json({ message: "mlbPlayerId, assignToUserId, rosterType, and season are required" });
      }
      if (!['mlb', 'milb', 'draft'].includes(rosterType)) {
        return res.status(400).json({ message: "rosterType must be 'mlb', 'milb', or 'draft'" });
      }
      if (rosterType === "mlb") {
        const existingMlbAssignments = await storage.getLeagueRosterAssignments(leagueId, Number(season), { rosterType: "mlb" });
        const conflict = existingMlbAssignments.find((a) => a.mlbPlayerId === Number(mlbPlayerId));
        if (conflict) {
          return res.status(409).json({
            message: "MLB player is already assigned for this league/season. Resolve in reconciliation.",
            conflict: {
              assignmentId: conflict.id,
              userId: conflict.userId,
              playerName: conflict.player?.fullName || null,
              mlbApiId: conflict.player?.mlbId || null,
            },
          });
        }
      }

      const assignment = await storage.assignPlayerToRoster({
        leagueId,
        userId: assignToUserId,
        mlbPlayerId,
        rosterType,
        season,
      });

      res.json(assignment);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ message: "Player is already assigned in this league for this season" });
      }
      console.error("Error assigning player:", error);
      res.status(500).json({ message: "Failed to assign player" });
    }
  });

  // Bulk assign players (commissioner only)
  app.post("/api/leagues/:id/roster-assignments/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);

      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { assignments } = req.body;
      if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({ message: "assignments array is required" });
      }

      const toInsert = assignments.map((a: any) => ({
        leagueId,
        userId: a.userId,
        mlbPlayerId: a.mlbPlayerId,
        rosterType: a.rosterType,
        season: a.season,
      }));

      const incomingMlb = toInsert.filter((a: any) => String(a.rosterType) === "mlb");
      if (incomingMlb.length > 0) {
        const seenIncoming = new Set<number>();
        for (const row of incomingMlb) {
          const playerId = Number(row.mlbPlayerId);
          if (seenIncoming.has(playerId)) {
            return res.status(409).json({
              message: "Bulk assignment contains duplicate MLB player IDs. Resolve in reconciliation.",
              mlbPlayerId: playerId,
            });
          }
          seenIncoming.add(playerId);
        }

        const seasonSet = new Set<number>(incomingMlb.map((a: any) => Number(a.season)).filter((s: number) => Number.isInteger(s)));
        for (const scopedSeason of Array.from(seasonSet.values())) {
          const existingMlbAssignments = await storage.getLeagueRosterAssignments(leagueId, scopedSeason, { rosterType: "mlb" });
          const existingPlayerIds = new Set<number>(existingMlbAssignments.map((a) => Number(a.mlbPlayerId)));
          const conflictingIncoming = incomingMlb.find((a: any) => Number(a.season) === scopedSeason && existingPlayerIds.has(Number(a.mlbPlayerId)));
          if (conflictingIncoming) {
            return res.status(409).json({
              message: "One or more MLB players are already assigned for this league/season. Resolve in reconciliation.",
              season: scopedSeason,
              mlbPlayerId: Number(conflictingIncoming.mlbPlayerId),
            });
          }
        }
      }

      const count = await storage.bulkAssignPlayers(toInsert);
      res.json({ count });
    } catch (error: any) {
      console.error("Error bulk assigning players:", error);
      res.status(500).json({ message: "Failed to bulk assign players" });
    }
  });

  // Update a roster assignment (move between rosters or teams)
  app.patch("/api/leagues/:id/roster-assignments/:assignmentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);
      const assignmentId = parseInt(req.params.assignmentId);

      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { rosterType, userId: newUserId } = req.body;
      const updated = await storage.updateRosterAssignment(assignmentId, { rosterType, userId: newUserId });
      if (!updated) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating roster assignment:", error);
      res.status(500).json({ message: "Failed to update roster assignment" });
    }
  });

  // Get duplicate roster assignments for a league/season and scope (commissioner only)
  app.get("/api/leagues/:id/roster-assignments/duplicates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);
      const season = parseInt(req.query.season as string) || 2025;
      const rosterType = String(req.query.rosterType || "mlb").toLowerCase();

      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      if (rosterType !== "mlb" && rosterType !== "milb" && rosterType !== "draft") {
        return res.status(400).json({ message: "Invalid rosterType" });
      }

      const [assignments, members] = await Promise.all([
        storage.getLeagueRosterAssignments(leagueId, season, { rosterType: rosterType as "mlb" | "milb" | "draft" }),
        storage.getLeagueMembers(leagueId),
      ]);
      const memberByUserId = new Map(members.map((m) => [m.userId, m]));
      const grouped = new Map<number, typeof assignments>();
      for (const assignment of assignments) {
        const list = grouped.get(assignment.mlbPlayerId) || [];
        list.push(assignment);
        grouped.set(assignment.mlbPlayerId, list);
      }

      const duplicates = Array.from(grouped.entries())
        .filter(([, rows]) => rows.length > 1)
        .map(([mlbPlayerId, rows]) => ({
          mlbPlayerId,
          mlbApiId: rows[0]?.player?.mlbId ?? null,
          playerName: rows[0]?.player?.fullName ?? `Player ${mlbPlayerId}`,
          assignments: rows
            .map((row) => {
              const member = memberByUserId.get(row.userId);
              return {
                assignmentId: row.id,
                userId: row.userId,
                teamName: member?.teamName || null,
                teamAbbreviation: member?.teamAbbreviation || null,
                createdAt: row.createdAt,
              };
            })
            .sort((a, b) => String(a.teamName || a.teamAbbreviation || a.userId).localeCompare(String(b.teamName || b.teamAbbreviation || b.userId))),
        }))
        .sort((a, b) => a.playerName.localeCompare(b.playerName));

      res.json({
        leagueId,
        season,
        rosterType,
        duplicatePlayerCount: duplicates.length,
        duplicateAssignmentCount: duplicates.reduce((sum, d) => sum + d.assignments.length, 0),
        duplicates,
      });
    } catch (error: any) {
      console.error("Error loading duplicate roster assignments:", error);
      res.status(500).json({ message: "Failed to load duplicate roster assignments" });
    }
  });

  // Resolve duplicate roster assignments by removing selected assignment IDs (commissioner only)
  app.post("/api/leagues/:id/roster-assignments/duplicates/resolve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);
      const season = parseInt(req.body?.season) || 2025;
      const rosterType = String(req.body?.rosterType || "mlb").toLowerCase();
      const removeAssignmentIds = Array.isArray(req.body?.removeAssignmentIds)
        ? req.body.removeAssignmentIds.map((x: any) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0)
        : [];

      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      if (rosterType !== "mlb" && rosterType !== "milb" && rosterType !== "draft") {
        return res.status(400).json({ message: "Invalid rosterType" });
      }
      if (removeAssignmentIds.length === 0) {
        return res.status(400).json({ message: "removeAssignmentIds is required" });
      }

      const scopedAssignments = await storage.getLeagueRosterAssignments(leagueId, season, { rosterType: rosterType as "mlb" | "milb" | "draft" });
      const allowedAssignmentIds = new Set(scopedAssignments.map((a) => a.id));
      const invalidIds = removeAssignmentIds.filter((id: number) => !allowedAssignmentIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          message: `Some assignment IDs are not in this league/season ${rosterType.toUpperCase()} scope`,
          invalidIds,
        });
      }

      for (const assignmentId of removeAssignmentIds) {
        await storage.removeRosterAssignment(assignmentId);
      }

      res.json({ removed: removeAssignmentIds.length });
    } catch (error: any) {
      console.error("Error resolving duplicate roster assignments:", error);
      res.status(500).json({ message: "Failed to resolve duplicate roster assignments" });
    }
  });

  // Execute a commissioner trade between two teams (atomic swap of selected roster assignments)
  app.post("/api/leagues/:id/roster-assignments/trade", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);
      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const {
        season,
        teamAUserId,
        teamBUserId,
        teamAAssignmentIds,
        teamBAssignmentIds,
      } = req.body || {};

      const tradeSeason = Number(season) || 2025;
      if (!teamAUserId || !teamBUserId || teamAUserId === teamBUserId) {
        return res.status(400).json({ message: "Select two different teams" });
      }
      if (!Array.isArray(teamAAssignmentIds) || !Array.isArray(teamBAssignmentIds)) {
        return res.status(400).json({ message: "teamAAssignmentIds and teamBAssignmentIds are required arrays" });
      }
      if (teamAAssignmentIds.length === 0 && teamBAssignmentIds.length === 0) {
        return res.status(400).json({ message: "Select at least one player to trade" });
      }

      const memberA = await storage.getLeagueMember(leagueId, teamAUserId);
      const memberB = await storage.getLeagueMember(leagueId, teamBUserId);
      if (!memberA || memberA.isArchived || !memberB || memberB.isArchived) {
        return res.status(400).json({ message: "Both trade teams must be active league members" });
      }

      const result = await storage.executeRosterTrade({
        leagueId,
        season: tradeSeason,
        teamAUserId,
        teamBUserId,
        teamAAssignmentIds: teamAAssignmentIds.map((x: any) => Number(x)).filter((x: number) => Number.isInteger(x)),
        teamBAssignmentIds: teamBAssignmentIds.map((x: any) => Number(x)).filter((x: number) => Number.isInteger(x)),
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error executing roster trade:", error);
      res.status(500).json({ message: error?.message || "Failed to execute trade" });
    }
  });

  // Remove a roster assignment (back to free agent pool)
  app.delete("/api/leagues/:id/roster-assignments/:assignmentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);
      const assignmentId = parseInt(req.params.assignmentId);

      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      await storage.removeRosterAssignment(assignmentId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error removing roster assignment:", error);
      res.status(500).json({ message: "Failed to remove roster assignment" });
    }
  });

  // Clear all roster assignments for a league/season (commissioner only)
  app.delete("/api/leagues/:id/roster-assignments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);
      const season = parseInt(req.query.season as string) || 2025;

      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const count = await storage.removeAllRosterAssignments(leagueId, season);
      res.json({ count });
    } catch (error: any) {
      console.error("Error clearing roster assignments:", error);
      res.status(500).json({ message: "Failed to clear roster assignments" });
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

  // Bulk assign via CSV payload (commissioner only)
  app.post("/api/leagues/:id/roster-assignments/upload-csv", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);
      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const csvData = String(req.body?.csvData || "").trim();
      const season = Number(req.body?.season) || 2025;
      const requestedDefaultRosterType = String(req.body?.defaultRosterType || "").trim().toLowerCase();
      const defaultRosterType: "mlb" | "milb" | "draft" =
        requestedDefaultRosterType === "mlb" || requestedDefaultRosterType === "milb" || requestedDefaultRosterType === "draft"
          ? (requestedDefaultRosterType as "mlb" | "milb" | "draft")
          : "milb";
      const assumePageScope = req.body?.assumePageScope === true;
      const reconciliationScope = defaultRosterType;
      const requestedOperation = String(req.body?.operation || "").trim().toLowerCase();
      const reconciliationOperation: "upload" | "rerun" | "apply" | "save" =
        requestedOperation === "apply" || requestedOperation === "rerun" || requestedOperation === "upload" || requestedOperation === "save"
          ? requestedOperation
          : "upload";
      const allowPartialImportDuringMatching =
        reconciliationOperation === "upload" || reconciliationOperation === "rerun";
      const matchingStage: "matching" | "applying" =
        reconciliationOperation === "apply" ? "applying" : "matching";
      const matchingMessage =
        reconciliationOperation === "apply"
          ? "Applying confirmed resolutions and validating rows"
          : reconciliationOperation === "save"
            ? "Saving confirmed reconciliation state"
          : reconciliationOperation === "rerun"
            ? "Re-running matching on loaded CSV"
            : "Matching uploaded rows";
      const processedCount = Math.max(0, csvData.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean).length - 1);
      const progressPath = path.join(process.cwd(), "attached_assets", `roster-reconcile-progress-${reconciliationScope}.json`);
      const persistProgress = async (payload: {
        running: boolean;
        processed: number;
        totalRows: number;
        stage: "matching" | "applying" | "awaiting_resolution" | "importing" | "completed" | "error";
        message?: string;
      }) => {
        const total = Math.max(0, Number(payload.totalRows || 0));
        const done = Math.max(0, Math.min(total || Number(payload.processed || 0), Number(payload.processed || 0)));
        const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;
        const body = {
          leagueId,
          season,
          updatedAt: new Date().toISOString(),
          running: payload.running,
          processed: done,
          totalRows: total,
          percent,
          stage: payload.stage,
          message: payload.message || null,
        };
        try {
          await fs.writeFile(progressPath, JSON.stringify(body, null, 2), "utf8");
        } catch (e) {
          console.error("Failed to persist roster reconciliation progress:", e);
        }
      };
      const setOnboardingStatus = async (params: {
        status: "pending" | "in_progress" | "completed";
        imported: number;
        unresolved: number;
        errors: number;
        completedAt: Date | null;
      }) => {
        await storage.updateLeague(leagueId, {
          rosterOnboardingSeason: season,
          rosterOnboardingStatus: params.status,
          rosterOnboardingLastProcessed: processedCount,
          rosterOnboardingLastImported: params.imported,
          rosterOnboardingLastUnresolved: params.unresolved,
          rosterOnboardingLastErrors: params.errors,
          rosterOnboardingCompletedAt: params.completedAt,
          rosterOnboardingUpdatedAt: new Date(),
        });
      };
      const latestSnapshotPath = path.join(process.cwd(), "attached_assets", `roster-reconcile-latest-${reconciliationScope}.json`);
      const persistLatestSnapshot = async (payload: {
        processed: number;
        created: number;
        unresolvedCount: number;
        unresolved: any[];
        errors: string[];
        warnings: string[];
        csvData: string;
        csvHash?: string;
        persistedCuts?: Array<{ rowNum: number; cutKey: string }>;
        resolvedRows?: Array<{ rowNum: number; mlbApiId: number; rosterType: "mlb" | "milb" | "draft"; userId: string }>;
      }) => {
        const body = {
          leagueId,
          season,
          rosterType: reconciliationScope,
          updatedAt: new Date().toISOString(),
          ...payload,
        };
        try {
          await fs.writeFile(latestSnapshotPath, JSON.stringify(body, null, 2), "utf8");
        } catch (e) {
          console.error("Failed to persist latest roster reconciliation snapshot:", e);
        }
      };
      if (!csvData) {
        return res.status(400).json({ message: "csvData is required" });
      }
      const csvHash = crypto.createHash("sha256").update(csvData).digest("hex");
      const persistedCutEntries = new Map<string, { rowNum: number; cutKey: string }>();
      // Keep saved cuts across reruns of the same loaded CSV (same hash).
      // "upload" starts fresh unless it is intentionally the same CSV content.
      const preservePriorReconciliationState =
        reconciliationOperation === "apply" ||
        reconciliationOperation === "save" ||
        reconciliationOperation === "rerun" ||
        reconciliationOperation === "upload";
      if (preservePriorReconciliationState) {
        try {
          const previousRaw = await fs.readFile(latestSnapshotPath, "utf8");
          const previous = JSON.parse(previousRaw || "{}");
          if (
            Number(previous?.leagueId) === leagueId &&
            Number(previous?.season) === season &&
            String(previous?.csvHash || "") === csvHash &&
            Array.isArray(previous?.persistedCuts)
          ) {
            for (const c of previous.persistedCuts) {
              const rowNum = Number(c?.rowNum);
              const cutKey = String(c?.cutKey || "").trim();
              if (!Number.isInteger(rowNum) || rowNum <= 0) continue;
              const id = cutKey || `row:${rowNum}`;
              persistedCutEntries.set(id, { rowNum, cutKey });
            }
          }
        } catch {
          // No prior snapshot to hydrate cuts from.
        }
      }
      const persistedCutRows = new Set<string>(
        Array.from(persistedCutEntries.values())
          .map((c) => String(c.rowNum))
          .filter(Boolean),
      );
      const persistedCutKeys = new Set<string>(
        Array.from(persistedCutEntries.values())
          .map((c) => String(c.cutKey || "").trim())
          .filter(Boolean),
      );
      const toPersistedCutRowNumbers = () =>
        Array.from(new Set(
          Array.from(persistedCutEntries.values())
            .map((c) => Number(c.rowNum))
            .filter((n) => Number.isInteger(n) && n > 0),
        ));

      const lines = csvData.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        return res.status(400).json({ message: "CSV must include a header and at least one data row" });
      }
      const joinedCsv = lines.join("\n").toLowerCase();
      const looksLikeTemplateUpload =
        lines.length <= 6 &&
        joinedCsv.includes("example prospect") &&
        joinedCsv.includes("shohei ohtani");
      if (looksLikeTemplateUpload) {
        return res.status(400).json({
          message: "Template/sample CSV detected. Replace example rows with your real league data before uploading.",
        });
      }
      const detectDelimiter = (line: string) => {
        const comma = (line.match(/,/g) || []).length;
        const semicolon = (line.match(/;/g) || []).length;
        const tab = (line.match(/\t/g) || []).length;
        if (tab > comma && tab > semicolon) return "\t";
        if (semicolon > comma) return ";";
        return ",";
      };
      const delimiter = detectDelimiter(lines[0]);
      const isLargeUpload = lines.length > 1200;
      const totalRows = Math.max(0, lines.length - 1);
      await persistProgress({ running: true, processed: 0, totalRows, stage: matchingStage, message: matchingMessage });

      const normalizeHeader = (rawHeader: string) =>
        String(rawHeader || "")
          .replace(/^\uFEFF/, "")
          .replace(/^"+|"+$/g, "")
          .trim()
          .toLowerCase();
      const headers = lines[0].split(delimiter).map((h: string) => normalizeHeader(h));
      const mlbIdIdx = headers.findIndex((h: string) => ["mlb_api_id", "mlb_id", "mlbid", "player_id", "id"].includes(h));
      const nameIdx = headers.findIndex((h: string) => ["player_name", "name", "player", "full_name", "player full name"].includes(h));
      const firstNameIdx = headers.findIndex((h: string) => ["first_name", "first name", "firstname", "first", "fname"].includes(h));
      const lastNameIdx = headers.findIndex((h: string) => ["last_name", "last name", "lastname", "last", "lname"].includes(h));
      const abbrIdx = headers.findIndex((h: string) => ["team_abbreviation", "team_abbrev", "abbreviation", "team", "abbr", "cbl"].includes(h));
      const rosterTypeIdx = headers.findIndex((h: string) => ["roster_type", "roster type", "type", "scope"].includes(h));
      const rosterTypeColumnMissing = rosterTypeIdx === -1;
      const middleNameIdx = headers.findIndex((h: string) => ["middle_name", "middlename", "middle"].includes(h));
      const statusIdx = headers.findIndex((h: string) => ["status", "contract_status", "contract"].includes(h));
      const salary2026Idx = headers.findIndex((h: string) => ["2026", "salary_2026", "salary2026", "2026_salary", "2026 salary", "salary 2026"].includes(h));
      const yearsIdx = headers.findIndex((h: string) => ["years", "year", "milb_years", "status_years", "contract_years"].includes(h));
      const ageIdx = headers.findIndex((h: string) => ["age"].includes(h));
      const mlbTeamIdx = headers.findIndex((h: string) => ["mlb_team", "mlb", "team_name", "current_team"].includes(h));
      const orgIdx = headers.findIndex((h: string) => ["org", "parent_org", "organization"].includes(h));
      const fangraphsIdx = headers.findIndex((h: string) => ["fangraphs_id", "fangraphs id", "fg_id", "fgid"].includes(h));
      const acquiredIdx = headers.findIndex((h: string) => ["acquired", "acq", "date_acquired", "date acquired"].includes(h));
      if (abbrIdx === -1 || (mlbIdIdx === -1 && nameIdx === -1 && (firstNameIdx === -1 || lastNameIdx === -1))) {
        return res.status(400).json({ message: "CSV must include team abbreviation and either MLB API ID, player_name, or first_name + last_name columns" });
      }
      const headerWarnings: string[] = [];
      if (rosterTypeColumnMissing) {
        headerWarnings.push(
          `CSV is missing roster_type column; rows without explicit roster type default to ${reconciliationScope.toUpperCase()}.`,
        );
      }
      let parseErrorWarning: string | null = null;

      const resolutions: Record<string, number> = req.body?.resolutions && typeof req.body.resolutions === "object"
        ? req.body.resolutions
        : {};
      const duplicateTeamResolutions: Record<string, string> =
        req.body?.duplicateTeamResolutions && typeof req.body.duplicateTeamResolutions === "object"
          ? req.body.duplicateTeamResolutions
          : {};
      const cuts = new Set<string>(
        Array.isArray(req.body?.cuts)
          ? req.body.cuts
              .map((v: any) => Number(v))
              .filter((v: number) => Number.isInteger(v) && v > 0)
              .map((v: number) => String(v))
          : [],
      );

      const stripParentheticalName = (value: string) =>
        String(value || "")
          .replace(/\([^)]*\)/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      const buildCutKey = (rowNum: number, playerName: string, teamAbbreviation: string, rosterType: "mlb" | "milb" | "draft") => {
        const normalizedName = String(stripParentheticalName(playerName || ""))
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
        return `${rowNum}|${normalizedName}|${String(teamAbbreviation || "").toUpperCase()}|${rosterType}`;
      };
      const normalizeName = (value: string) =>
        String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
      const normalizeNameWithSpaces = (value: string) =>
        String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      const toNameVariants = (value: string) => {
        const raw = String(value || "").trim();
        const stripped = stripParentheticalName(raw);
        const variants = [raw, stripped]
          .filter(Boolean)
          .map((v) => normalizeName(v))
          .filter(Boolean);
        return Array.from(new Set(variants));
      };
      const mergeCandidatesByMlbId = (lists: any[][]) => {
        const map = new Map<number, any>();
        for (const list of lists) {
          for (const p of list || []) {
            const key = Number(p?.mlbId);
            if (!Number.isInteger(key) || key <= 0) continue;
            if (!map.has(key)) map.set(key, p);
          }
        }
        return Array.from(map.values());
      };
      const buildResolutionRuleKey = (
        playerName: string,
        teamAbbreviation: string,
        rosterType: "mlb" | "milb" | "draft",
      ) => {
        const normalizedName = normalizeNameWithSpaces(stripParentheticalName(playerName || ""));
        return `${normalizedName}|${String(teamAbbreviation || "").toUpperCase()}|${rosterType}`;
      };
      const rulesPath = path.join(process.cwd(), "attached_assets", `roster-reconcile-rules-${reconciliationScope}.json`);
      const persistedNameTeamRules = new Map<string, number>();
      const persistedDuplicateTeamRules = new Map<string, string>();
      try {
        const rulesRaw = await fs.readFile(rulesPath, "utf8");
        const rules = JSON.parse(rulesRaw || "{}");
        if (
          Number(rules?.leagueId) === leagueId &&
          String(rules?.rosterType || "") === reconciliationScope
        ) {
          const nameTeamRules = rules?.nameTeamRules && typeof rules.nameTeamRules === "object"
            ? rules.nameTeamRules
            : {};
          for (const [k, v] of Object.entries(nameTeamRules as Record<string, unknown>)) {
            const key = String(k || "").trim();
            const mlbApiId = Number(v);
            if (!key || !Number.isInteger(mlbApiId) || mlbApiId <= 0) continue;
            persistedNameTeamRules.set(key, mlbApiId);
          }
          const duplicateTeamRules = rules?.duplicateTeamRules && typeof rules.duplicateTeamRules === "object"
            ? rules.duplicateTeamRules
            : {};
          for (const [k, v] of Object.entries(duplicateTeamRules as Record<string, unknown>)) {
            const key = String(k || "").trim();
            const userId = String(v || "").trim();
            if (!key || !userId) continue;
            persistedDuplicateTeamRules.set(key, userId);
          }
        }
      } catch {
        // No persisted ad-hoc rules yet.
      }
      const TEAM_HINT_ALIASES: Record<string, string[]> = {
        ATH: ["athletics", "oakland", "sacramento", "a's"],
        OAK: ["athletics", "oakland", "sacramento", "a's"],
        ARI: ["diamondbacks", "arizona"],
        ATL: ["braves", "atlanta"],
        BAL: ["orioles", "baltimore"],
        BOS: ["red sox", "boston"],
        CHC: ["cubs", "chicago cubs"],
        CIN: ["reds", "cincinnati"],
        CLE: ["guardians", "cleveland", "indians"],
        COL: ["rockies", "colorado"],
        DET: ["tigers", "detroit"],
        HOU: ["astros", "houston"],
        KC: ["royals", "kansas city"],
        TB: ["rays", "tampa bay"],
        TBR: ["rays", "tampa bay"],
        TBA: ["rays", "tampa bay"],
        LAA: ["angels", "los angeles angels"],
        LAD: ["dodgers", "los angeles dodgers"],
        MIA: ["marlins", "miami", "florida"],
        MIL: ["brewers", "milwaukee"],
        MIN: ["twins", "minnesota"],
        NYM: ["mets", "new york mets"],
        NYY: ["yankees", "new york yankees"],
        PHI: ["phillies", "philadelphia"],
        PIT: ["pirates", "pittsburgh"],
        SD: ["padres", "san diego"],
        CHW: ["white sox", "chicago white sox"],
        CWS: ["white sox", "chicago white sox"],
        KCR: ["royals", "kansas city"],
        SF: ["giants", "san francisco"],
        SFG: ["giants", "san francisco"],
        SDP: ["padres", "san diego"],
        SEA: ["mariners", "seattle"],
        STL: ["cardinals", "st louis", "saint louis"],
        TEX: ["rangers", "texas"],
        TOR: ["blue jays", "toronto"],
        WSH: ["nationals", "washington", "expos"],
        WSN: ["nationals", "washington"],
      };
      const expandTeamHintVariants = (raw: string | null | undefined) => {
        const hint = String(raw || "").trim().toLowerCase();
        if (!hint) return [] as string[];
        const key = hint.toUpperCase();
        const expanded = [hint, ...(TEAM_HINT_ALIASES[key] || [])];
        return Array.from(new Set(expanded.map((v) => v.toLowerCase())));
      };
      const parseDobHint = (value: string): { month: number; day: number; year: number | null } | null => {
        const m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(String(value || ""));
        if (!m) return null;
        const month = Number(m[1]);
        const day = Number(m[2]);
        let year = Number(m[3]);
        if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12 || day < 1 || day > 31) return null;
        if (!Number.isFinite(year)) return { month, day, year: null };
        if (year < 100) year = year >= 30 ? 1900 + year : 2000 + year;
        return { month, day, year };
      };
      const extractParentheticalMiddleHint = (value: string): string | null => {
        const text = String(value || "");
        const matches = text.match(/\(([^)]+)\)/g) || [];
        for (const token of matches) {
          const inner = token.replace(/[()]/g, "").trim();
          if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(inner)) continue;
          if (/^[a-zA-Z.'-]+$/.test(inner)) return inner;
        }
        return null;
      };
      const parseMinorLeagueStatusYears = (statusRaw: string, yearsRaw: string): { minorLeagueStatus: string | null; minorLeagueYears: number | null } => {
        const statusToken = String(statusRaw || "").trim().toUpperCase();
        const yearsToken = String(yearsRaw || "").trim();
        let minorLeagueStatus: string | null = null;
        let minorLeagueYears: number | null = null;

        const slashMatch = /^([A-Z]{2,3})\s*\/\s*(\d+)$/.exec(statusToken);
        if (slashMatch) {
          minorLeagueStatus = slashMatch[1];
          minorLeagueYears = Number.parseInt(slashMatch[2], 10);
        } else if (statusToken) {
          minorLeagueStatus = statusToken;
        }

        if (yearsToken && Number.isFinite(Number(yearsToken))) {
          const parsed = Number(yearsToken);
          if (Number.isInteger(parsed) && parsed >= 0) {
            minorLeagueYears = parsed;
          }
        }

        if (minorLeagueStatus && !["MH", "MC", "FA"].includes(minorLeagueStatus)) {
          minorLeagueStatus = null;
        }
        if (minorLeagueYears != null && (!Number.isInteger(minorLeagueYears) || minorLeagueYears < 0)) {
          minorLeagueYears = null;
        }
        return { minorLeagueStatus, minorLeagueYears };
      };
      const levenshtein = (aRaw: string, bRaw: string): number => {
        const a = String(aRaw || "");
        const b = String(bRaw || "");
        const m = a.length;
        const n = b.length;
        if (m === 0) return n;
        if (n === 0) return m;
        const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
          for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
              dp[i - 1][j] + 1,
              dp[i][j - 1] + 1,
              dp[i - 1][j - 1] + cost,
            );
          }
        }
        return dp[m][n];
      };
      const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
      const stripSuffixTokens = (tokens: string[]) => {
        const out = [...tokens];
        while (out.length > 1 && NAME_SUFFIXES.has(out[out.length - 1])) {
          out.pop();
        }
        return out;
      };
      const tokenizeNormName = (value: string) =>
        stripSuffixTokens(normalizeNameWithSpaces(value).split(/\s+/).filter(Boolean));
      const FIRST_NAME_NICKNAME_GROUPS: string[][] = [
        ["alex", "alexander", "alexandre", "alexandro"],
        ["andrew", "andy", "drew"],
        ["anthony", "tony"],
        ["ben", "benjamin", "benny"],
        ["bill", "william", "billy", "will", "willy", "liam"],
        ["cam", "cameron"],
        ["charlie", "charles", "chuck"],
        ["chris", "christopher", "christoper", "christofer", "topher"],
        ["dan", "daniel", "danny"],
        ["dave", "david", "davy"],
        ["ed", "edward", "eddie", "ted", "teddy"],
        ["enrique", "kike", "quique", "kiko"],
        ["frank", "francisco", "frankie", "franky", "fran", "paco"],
        ["greg", "gregory"],
        ["jim", "james", "jimmy", "jamie"],
        ["joe", "joseph", "joey"],
        ["josh", "joshua"],
        ["leo", "leonardo"],
        ["mat", "matheu", "mathieu"],
        ["matt", "matthew"],
        ["mike", "michael", "mikey"],
        ["nick", "nicholas", "nicolas", "nicky"],
        ["pat", "patrick"],
        ["ricardo", "ricky", "rico"],
        ["rob", "robert", "roberto", "robbie", "bob", "bobby"],
        ["sam", "samuel", "sammy"],
        ["steve", "steven", "stephen", "stevie"],
        ["tim", "timothy"],
        ["vin", "vincent", "vince"],
        ["vic", "victor"],
        ["zac", "zachary", "zach", "zack", "zackary"],
      ];
      const FIRST_NAME_ALIAS_MAP: Record<string, string> = {};
      for (const group of FIRST_NAME_NICKNAME_GROUPS) {
        if (!Array.isArray(group) || group.length === 0) continue;
        const canonical = String(group[0] || "").trim().toLowerCase();
        if (!canonical) continue;
        for (const entry of group) {
          const alias = String(entry || "").trim().toLowerCase();
          if (!alias) continue;
          FIRST_NAME_ALIAS_MAP[alias] = canonical;
        }
      }
      const canonicalFirstName = (first: string): string => {
        const v = String(first || "").trim().toLowerCase();
        if (!v) return "";
        return FIRST_NAME_ALIAS_MAP[v] || v;
      };
      // Common first names need stronger evidence before auto-mapping one-letter surname variants.
      const COMMON_FIRST_NAMES_FOR_SURNAME_TYPO_AUTOMAP = new Set([
        "jose",
        "juan",
        "luis",
        "miguel",
        "carlos",
        "angel",
        "jesus",
        "pedro",
        "francisco",
        "alex",
        "david",
        "daniel",
        "john",
        "joseph",
        "michael",
        "will",
        "ben",
        "chris",
      ]);
      const splitNormName = (value: string) => {
        const parts = tokenizeNormName(stripParentheticalName(value));
        return {
          first: parts[0] || "",
          last: parts.length ? parts[parts.length - 1] : "",
          full: parts.join(" "),
        };
      };
      const extractMiddleInitialFromName = (value: string): string | null => {
        const parts = tokenizeNormName(stripParentheticalName(value));
        if (parts.length < 3) return null;
        for (const token of parts.slice(1, -1)) {
          if (token.length === 1) return token;
        }
        return null;
      };
      const getCandidateMiddleInitial = (candidate: any): string | null => {
        const middleFromField = normalizeName(candidate?.middleName || "");
        if (middleFromField) return middleFromField[0];
        const full = String(candidate?.fullFmlName || candidate?.fullFMLName || candidate?.fullName || "");
        const parts = tokenizeNormName(full);
        if (parts.length < 3) return null;
        for (const token of parts.slice(1, -1)) {
          if (token.length === 1) return token;
        }
        return null;
      };
      const normalizeConfusableCharacters = (value: string): string => {
        let out = String(value || "");
        // Common OCR/typing confusables in player-name data.
        out = out
          .replace(/rn/g, "m")
          .replace(/vv/g, "w")
          .replace(/cl/g, "d");
        // Collapse vowels to a single class for near-phonetic variants (yeremi/yeremy).
        out = out.replace(/[aeiouy]/g, "a");
        return out;
      };
      const charSimilarity = (aRaw: string, bRaw: string): number => {
        const a = String(aRaw || "");
        const b = String(bRaw || "");
        if (!a && !b) return 1;
        if (!a || !b) return 0;
        const dist = levenshtein(a, b);
        const maxLen = Math.max(a.length, b.length);
        if (maxLen <= 0) return 0;
        const base = Math.max(0, 1 - dist / maxLen);
        const aNorm = normalizeConfusableCharacters(a);
        const bNorm = normalizeConfusableCharacters(b);
        const normDist = levenshtein(aNorm, bNorm);
        const normMaxLen = Math.max(aNorm.length, bNorm.length) || 1;
        const confusableAdjusted = Math.max(0, 1 - normDist / normMaxLen);
        // Use the stronger of raw and confusable-adjusted similarity.
        return Math.max(base, confusableAdjusted);
      };
      const dedupeLatestByMlbId = (players: any[]) => {
        const byMlbId = new Map<number, any>();
        const sorted = [...players].sort((a, b) => Number(b?.season || 0) - Number(a?.season || 0));
        for (const p of sorted) {
          if (!Number.isInteger(Number(p?.mlbId))) continue;
          const key = Number(p.mlbId);
          if (!byMlbId.has(key)) byMlbId.set(key, p);
        }
        return Array.from(byMlbId.values());
      };
      let cachedAllPlayersForFallback: any[] | null = null;
      const searchMlbPeople = async (name: string): Promise<any[]> => {
        const q = String(name || "").trim();
        if (!q) return [];
        const split = splitNormName(q);
        const rawTokens = normalizeNameWithSpaces(q).split(/\s+/).filter(Boolean);
        const fallbackQueries = new Set<string>([q]);
        // MLB people/search often fails on full extended names; retry with first+last.
        if (split.first && split.last && split.first !== split.last) {
          fallbackQueries.add(`${split.first} ${split.last}`);
        }
        if (rawTokens.length >= 2) {
          fallbackQueries.add(`${rawTokens[0]} ${rawTokens[rawTokens.length - 1]}`);
        }
        const queries = Array.from(fallbackQueries).filter(Boolean);
        try {
          const merged: any[] = [];
          for (const query of queries) {
            const response = await fetch(`https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(query)}`);
            if (!response.ok) continue;
            const payload = await response.json();
            const people = Array.isArray(payload?.people) ? payload.people : [];
            merged.push(...people);
          }
          return mergeCandidatesByMlbId([merged.map((p: any) => ({
            mlbId: Number(p?.id),
            fullName: String(p?.fullName || "").trim(),
            fullFmlName: String(p?.fullFMLName || "").trim() || null,
            nameFirstLast: String(p?.nameFirstLast || "").trim() || null,
            firstName: p?.firstName || null,
            middleName: p?.middleName || null,
            lastName: p?.lastName || null,
            age: Number.isFinite(Number(p?.currentAge)) ? Number(p.currentAge) : null,
            currentTeamName: p?.currentTeam?.name || null,
            parentOrgName: null,
            sportLevel: "WEB",
            birthDate: p?.birthDate || null,
          })).filter((p: any) => Number.isInteger(p.mlbId) && p.mlbId > 0 && p.fullName)]);
        } catch {
          return [];
        }
      };
      const SPORT_IDS_FOR_DIRECTORY = [11, 12, 13, 14, 16];
      const webDirectoryCache = new Map<string, any[]>();
      const searchMlbDirectoryBySurname = async (rawName: string, season: number): Promise<any[]> => {
        const parts = splitNormName(rawName);
        const surname = (parts.last || "").trim();
        if (!surname || surname.length < 4) return [];
        const candidates: any[] = [];
        const seasons = [season, season - 1, season - 2, season - 3, season - 4];
        for (const y of seasons) {
          for (const sportId of SPORT_IDS_FOR_DIRECTORY) {
            const key = `${sportId}-${y}`;
            let roster = webDirectoryCache.get(key);
            if (!roster) {
              try {
                const response = await fetch(`https://statsapi.mlb.com/api/v1/sports/${sportId}/players?season=${y}`);
                if (!response.ok) {
                  webDirectoryCache.set(key, []);
                  continue;
                }
                const payload = await response.json();
                const people = Array.isArray(payload?.people) ? payload.people : [];
                roster = people.map((p: any) => ({
                  mlbId: Number(p?.id),
                  fullName: String(p?.fullName || "").trim(),
                  fullFmlName: String(p?.fullFMLName || "").trim() || null,
                  nameFirstLast: String(p?.nameFirstLast || "").trim() || null,
                  firstName: p?.firstName || null,
                  middleName: p?.middleName || null,
                  lastName: p?.lastName || null,
                  age: Number.isFinite(Number(p?.currentAge)) ? Number(p.currentAge) : null,
                  currentTeamName: p?.currentTeam?.name || null,
                  parentOrgName: null,
                  sportLevel: "DIR",
                  birthDate: p?.birthDate || null,
                  season: y,
                })).filter((p: any) => Number.isInteger(p.mlbId) && p.mlbId > 0 && p.fullName);
                webDirectoryCache.set(key, roster || []);
              } catch {
                webDirectoryCache.set(key, []);
                roster = [];
              }
            }
            for (const p of roster || []) {
              const candLast = splitNormName(p.fullName || "").last;
              const lastDist = levenshtein(surname, candLast);
              if (lastDist <= 1 || candLast === surname) {
                candidates.push(p);
              }
            }
          }
        }
        return mergeCandidatesByMlbId([candidates]).slice(0, 50);
      };
      const getAccentInsensitiveCandidates = async (rawName: string, limit = 15) => {
        if (!cachedAllPlayersForFallback) {
          cachedAllPlayersForFallback = dedupeLatestByMlbId(await storage.getMlbPlayers({}));
        }
        const normNeedles = toNameVariants(rawName);
        const rowSplit = splitNormName(rawName);
        if (normNeedles.length === 0 && !rowSplit.last) return [];
        const scored = cachedAllPlayersForFallback
          .map((p: any) => {
            const normFull = normalizeName(p.fullName || "");
            const candSplit = splitNormName(p.fullName || "");
            let score = 0;
            for (const normNeedle of normNeedles) {
              if (normFull === normNeedle) score = Math.max(score, 100);
              else if (normFull.startsWith(normNeedle) || normNeedle.startsWith(normFull)) score = Math.max(score, 70);
              else if (normFull.includes(normNeedle) || normNeedle.includes(normFull)) score = Math.max(score, 50);
            }
            // Typo-tolerant fallback: preserve last-name anchor, tolerate first-name edit distance.
            if (rowSplit.last && candSplit.last) {
              const lastDist = levenshtein(rowSplit.last, candSplit.last);
              if (lastDist <= 1) {
                score = Math.max(score, 40);
                if (rowSplit.first && candSplit.first) {
                  const firstDist = levenshtein(rowSplit.first, candSplit.first);
                  if (firstDist <= 1) score = Math.max(score, 78);
                  else if (firstDist <= 2) score = Math.max(score, 68);
                }
                const fullDist = levenshtein(rowSplit.full, candSplit.full);
                if (fullDist <= 2) score = Math.max(score, 74);
                else if (fullDist <= 3) score = Math.max(score, 62);
              }
            }
            return { p, score };
          })
          .filter((x: any) => x.score > 0)
          .sort((a: any, b: any) => b.score - a.score);
        return scored.slice(0, limit).map((x: any) => x.p);
      };
      const scoreCandidate = (candidate: any, row: any) => {
        let score = 0;
        const rowCompact = normalizeName(row.playerName || "");
        let bestFirstDistForSameLast: number | null = null;
        const candidateNameVariants = Array.from(new Set([
          normalizeName(candidate.fullName || ""),
          normalizeName(candidate.fullFmlName || ""),
          normalizeName(candidate.nameFirstLast || ""),
          normalizeName(candidate.fullFMLName || ""),
          normalizeName(
            [candidate.firstName, candidate.middleName, candidate.lastName]
              .filter(Boolean)
              .join(" "),
          ),
        ].filter(Boolean)));
        const candidateNameVariantsSpaced = Array.from(new Set([
          normalizeNameWithSpaces(candidate.fullName || ""),
          normalizeNameWithSpaces(candidate.fullFmlName || ""),
          normalizeNameWithSpaces(candidate.nameFirstLast || ""),
          normalizeNameWithSpaces(candidate.fullFMLName || ""),
          normalizeNameWithSpaces(
            [candidate.firstName, candidate.middleName, candidate.lastName]
              .filter(Boolean)
              .join(" "),
          ),
        ].filter(Boolean)));
        const rowNameVariants = toNameVariants(row.playerName || "");
        for (const rowName of rowNameVariants) {
          for (const candName of candidateNameVariants) {
            if (candName === rowName) score = Math.max(score, 100);
            else if (candName.startsWith(rowName) || rowName.startsWith(candName)) score = Math.max(score, 60);
            else if (candName.includes(rowName) || rowName.includes(candName)) score = Math.max(score, 35);
          }
        }
        const rowSplit = splitNormName(row.playerName || "");
        const candidateSplit = splitNormName(
          candidate.fullFmlName ||
          candidate.fullFMLName ||
          candidate.fullName ||
          candidate.nameFirstLast ||
          [candidate.firstName, candidate.middleName, candidate.lastName].filter(Boolean).join(" ") ||
          [candidate.firstName, candidate.lastName].filter(Boolean).join(" ") ||
          "",
        );
        // Deterministic first/last fallback across all candidate name variants.
        // Prevents obvious near-typos from being outscored by unrelated surnames.
        if (rowSplit.first && rowSplit.last && candidateNameVariantsSpaced.length > 0) {
          for (const variant of candidateNameVariantsSpaced) {
            const tokens = tokenizeNormName(variant);
            if (tokens.length < 2) continue;
            const pairs = [
              { first: tokens[0], last: tokens[tokens.length - 1] },
              { first: tokens[tokens.length - 1], last: tokens[0] },
            ];
            for (const pair of pairs) {
              if (!pair.first || !pair.last) continue;
              if (pair.last !== rowSplit.last) continue;
              const d = levenshtein(rowSplit.first, pair.first);
              if (bestFirstDistForSameLast == null || d < bestFirstDistForSameLast) {
                bestFirstDistForSameLast = d;
              }
            }
          }
          if (bestFirstDistForSameLast != null) {
            if (bestFirstDistForSameLast <= 1) score = Math.max(score, 90);
            else if (bestFirstDistForSameLast <= 2) score = Math.max(score, 78);
            else if (bestFirstDistForSameLast <= 3) score = Math.max(score, 52);
          }
        }
        if (rowSplit.full && candidateSplit.full && rowSplit.full === candidateSplit.full) {
          score = Math.max(score, 98);
        }
        // Character-based fallback for sparse/inconsistent name fields.
        // Keeps scoring deterministic while tolerating minor typos.
        const candidateCompact = normalizeName(
          candidateSplit.full ||
          candidate.fullName ||
          candidate.nameFirstLast ||
          [candidate.firstName, candidate.middleName, candidate.lastName].filter(Boolean).join(" "),
        );
        if (rowCompact && candidateCompact) {
          const compactSimilarity = charSimilarity(rowCompact, candidateCompact);
          if (compactSimilarity >= 0.95) score = Math.max(score, 86);
          else if (compactSimilarity >= 0.9) score = Math.max(score, 76);
          else if (compactSimilarity >= 0.86) score = Math.max(score, 66);
        }
        // Token-order bonus: first/last in expected order with same initials.
        const rowTokens = tokenizeNormName(row.playerName || "");
        const candTokens = tokenizeNormName(
          candidate.fullFmlName ||
          candidate.fullFMLName ||
          candidate.fullName ||
          candidate.nameFirstLast ||
          [candidate.firstName, candidate.middleName, candidate.lastName].filter(Boolean).join(" "),
        );
        if (rowTokens.length >= 2 && candTokens.length >= 2) {
          const rowFirst = rowTokens[0];
          const rowLast = rowTokens[rowTokens.length - 1];
          const candFirst = candTokens[0];
          const candLast = candTokens[candTokens.length - 1];
          if (rowLast && candLast && rowLast === candLast) {
            if (rowFirst && candFirst && rowFirst[0] === candFirst[0]) score += 10;
            if (rowFirst && candFirst && charSimilarity(rowFirst, candFirst) >= 0.75) score += 8;
          }
        }
        if (rowSplit.last && candidateSplit.last && rowSplit.last === candidateSplit.last) {
          const rowFirstCanon = canonicalFirstName(rowSplit.first);
          const candFirstCanon = canonicalFirstName(candidateSplit.first);
          if (rowFirstCanon && candFirstCanon && rowFirstCanon === candFirstCanon) {
            score = Math.max(score, 88);
          } else if (rowSplit.first && candidateSplit.first) {
            const firstDist = levenshtein(rowSplit.first, candidateSplit.first);
            if (firstDist <= 1) {
              // Strong typo-tolerant first-name signal when surname is exact.
              score = Math.max(score, 82);
            } else if (firstDist <= 2) {
              score = Math.max(score, 72);
            } else if (firstDist <= 3) {
              // Slightly weaker typo tolerance for sparse-name records.
              score = Math.max(score, 62);
            } else {
              // Same surname but distant first names should not out-rank close typos.
              score -= 22;
            }
            if (rowSplit.first[0] !== candidateSplit.first[0]) {
              score -= 14;
            }
          } else if (
            rowSplit.first &&
            candidateSplit.first &&
            (rowSplit.first.startsWith(candidateSplit.first) || candidateSplit.first.startsWith(rowSplit.first))
          ) {
            score = Math.max(score, 76);
          } else {
            // Missing/partial first name with exact surname is weaker than explicit near-typo matches.
            score -= 8;
          }
        }
        if (row.mlbTeamHint) {
          const hints = expandTeamHintVariants(row.mlbTeamHint);
          const cur = String(candidate.currentTeamName || "").toLowerCase();
          const org = String(candidate.parentOrgName || "").toLowerCase();
          if (hints.some((h) => cur && cur.includes(h))) score += 25;
          if (hints.some((h) => org && org.includes(h))) score += 20;
        }
        if (row.orgHint) {
          const hints = expandTeamHintVariants(row.orgHint);
          const org = String(candidate.parentOrgName || "").toLowerCase();
          const cur = String(candidate.currentTeamName || "").toLowerCase();
          if (hints.some((h) => org && org.includes(h))) score += 25;
          else if (hints.some((h) => cur && cur.includes(h))) score += 12;
        }
        if (row.ageHint && candidate.age) {
          const diff = Math.abs(Number(candidate.age) - Number(row.ageHint));
          if (diff === 0) score += 15;
          else if (diff === 1) score += 8;
          else if (diff === 2) score += 4;
        }
        if (row.middleNameHint) {
          const candMiddle = normalizeName(candidate.middleName || "");
          const rowMiddle = normalizeName(row.middleNameHint || "");
          if (candMiddle && rowMiddle) {
            if (candMiddle === rowMiddle) score += 25;
            else if (candMiddle.startsWith(rowMiddle) || rowMiddle.startsWith(candMiddle)) score += 12;
          }
        }
        if (row.middleInitialHint) {
          const candMiddleInitial = getCandidateMiddleInitial(candidate);
          if (candMiddleInitial) {
            if (candMiddleInitial === row.middleInitialHint) score += 16;
            else score -= 14;
          }
        }
        if (row.dobHint && candidate.birthDate) {
          const d = new Date(String(candidate.birthDate));
          if (!Number.isNaN(d.getTime())) {
            const month = d.getUTCMonth() + 1;
            const day = d.getUTCDate();
            const year = d.getUTCFullYear();
            if (month === row.dobHint.month && day === row.dobHint.day) score += 35;
            if (row.dobHint.year && year === row.dobHint.year) score += 12;
          }
        }
        // Deterministic final discriminator for same-surname candidates.
        // Near first-name typo stays high; distant first names get capped low.
        if (bestFirstDistForSameLast != null) {
          if (bestFirstDistForSameLast <= 1) score = Math.max(score, 90);
          else if (bestFirstDistForSameLast === 2) score = Math.min(score, 75);
          else if (bestFirstDistForSameLast === 3) score = Math.min(score, 35);
          else score = Math.min(score, 8);
        }
        return Math.max(0, score);
      };

      const members = await storage.getLeagueMembers(leagueId);
      const abbrevToUser = new Map<string, string>();
      const userToAbbrev = new Map<string, string>();
      for (const m of members) {
        if (!m.isArchived && m.teamAbbreviation) {
          const upperAbbr = m.teamAbbreviation.toUpperCase();
          abbrevToUser.set(upperAbbr, m.userId);
          userToAbbrev.set(m.userId, upperAbbr);
        }
      }
      const resolveConflictSelectionUserId = (
        rawSelection: unknown,
        optionsByUserId: Map<string, { userId: string; teamAbbreviation: string; rowNums: number[] }>,
      ): string => {
        const raw = String(rawSelection || "").trim();
        if (!raw) return "";
        if (optionsByUserId.has(raw)) return raw;
        const asAbbr = raw.toUpperCase();
        for (const opt of optionsByUserId.values()) {
          if (String(opt.teamAbbreviation || "").toUpperCase() === asAbbr) {
            return opt.userId;
          }
        }
        const mappedUserId = abbrevToUser.get(asAbbr);
        if (mappedUserId && optionsByUserId.has(mappedUserId)) return mappedUserId;
        return "";
      };

      if (reconciliationOperation === "save") {
        let latestSnapshot: any = null;
        try {
          const previousRaw = await fs.readFile(latestSnapshotPath, "utf8");
          latestSnapshot = JSON.parse(previousRaw || "{}");
        } catch {
          latestSnapshot = null;
        }
        const latestUnresolvedRows = Array.isArray(latestSnapshot?.unresolved) ? latestSnapshot.unresolved : [];
        const latestErrors = Array.isArray(latestSnapshot?.errors) ? latestSnapshot.errors : [];
        const unresolvedByRowNum = new Map<number, any>();
        for (const row of latestUnresolvedRows) {
          const rowNum = Number(row?.rowNum);
          if (!Number.isInteger(rowNum) || rowNum <= 0) continue;
          unresolvedByRowNum.set(rowNum, row);
        }

        const confirmedResolutionRows = new Map<number, number>();
        for (const [rowKey, value] of Object.entries(resolutions)) {
          const rowNum = Number(rowKey);
          const mlbApiId = Number(value);
          if (!Number.isInteger(rowNum) || rowNum <= 0) continue;
          if (!Number.isInteger(mlbApiId) || mlbApiId <= 0) continue;
          confirmedResolutionRows.set(rowNum, mlbApiId);
        }
        const confirmedCutRows = new Set<number>(
          Array.from(cuts)
            .map((v) => Number(v))
            .filter((v) => Number.isInteger(v) && v > 0),
        );

        for (const rowNum of confirmedCutRows) {
          const row = unresolvedByRowNum.get(rowNum);
          if (!row) continue;
          const cutKey = buildCutKey(
            rowNum,
            String(row.playerName || ""),
            String(row.teamAbbreviation || ""),
            String(row.rosterType || reconciliationScope) as "mlb" | "milb" | "draft",
          );
          persistedCutEntries.set(cutKey, { rowNum, cutKey });
        }

        // Persist ad-hoc mapping/team-conflict rules for future matching passes.
        for (const [rowNum, mlbApiId] of confirmedResolutionRows.entries()) {
          const row = unresolvedByRowNum.get(rowNum);
          if (!row) continue;
          const rosterTypeRaw = String(row.rosterType || reconciliationScope).toLowerCase();
          const rosterType =
            rosterTypeRaw === "mlb" || rosterTypeRaw === "milb" || rosterTypeRaw === "draft"
              ? rosterTypeRaw
              : reconciliationScope;
          const ruleKey = buildResolutionRuleKey(
            String(row.playerName || ""),
            String(row.teamAbbreviation || ""),
            rosterType as "mlb" | "milb" | "draft",
          );
          if (ruleKey) persistedNameTeamRules.set(ruleKey, mlbApiId);
        }
        for (const [conflictKeyRaw, selectedUserIdRaw] of Object.entries(duplicateTeamResolutions)) {
          const conflictKey = String(conflictKeyRaw || "").trim();
          const selectedUserId = String(selectedUserIdRaw || "").trim();
          if (!conflictKey || !selectedUserId) continue;
          persistedDuplicateTeamRules.set(conflictKey, selectedUserId);
        }
        try {
          await fs.writeFile(
            rulesPath,
            JSON.stringify({
              leagueId,
              rosterType: reconciliationScope,
              updatedAt: new Date().toISOString(),
              nameTeamRules: Object.fromEntries(persistedNameTeamRules.entries()),
              duplicateTeamRules: Object.fromEntries(persistedDuplicateTeamRules.entries()),
            }, null, 2),
            "utf8",
          );
        } catch (e) {
          console.error("Failed to persist roster reconciliation ad-hoc rules:", e);
        }

        const unresolvedAfterSave = latestUnresolvedRows.filter((row: any) => {
          const rowNum = Number(row?.rowNum);
          if (!Number.isInteger(rowNum) || rowNum <= 0) return true;
          if (confirmedCutRows.has(rowNum)) return false;
          if (confirmedResolutionRows.has(rowNum)) return false;
          const conflictKey = String(row?.duplicateConflictKey || "").trim();
          if (conflictKey) {
            const selectedUserId = String(duplicateTeamResolutions[conflictKey] || "").trim();
            if (selectedUserId) return false;
          }
          return true;
        });

        const saveWarnings = [
          ...headerWarnings,
          "Confirmed reconciliation saved. Click Apply to import assignments.",
        ];
        await persistLatestSnapshot({
          processed: lines.length - 1,
          created: 0,
          unresolvedCount: unresolvedAfterSave.length,
          unresolved: unresolvedAfterSave,
          errors: latestErrors,
          warnings: saveWarnings,
          csvData,
          csvHash,
          persistedCuts: Array.from(persistedCutEntries.values()),
          resolvedRows: Array.isArray(latestSnapshot?.resolvedRows) ? latestSnapshot.resolvedRows : [],
        });
        await setOnboardingStatus({
          status: "in_progress",
          imported: 0,
          unresolved: unresolvedAfterSave.length,
          errors: latestErrors.length,
          completedAt: null,
        });
        await persistProgress({
          running: false,
          processed: totalRows,
          totalRows,
          stage: "awaiting_resolution",
          message: "Confirmed reconciliation saved",
        });
        return res.json({
          requiresResolution: true,
          unresolved: unresolvedAfterSave,
          processed: lines.length - 1,
          errors: latestErrors,
          warnings: saveWarnings,
          created: 0,
          cutCount: confirmedCutRows.size,
          persistedCutRows: toPersistedCutRowNumbers(),
          middleNamesUpdated: 0,
        });
      }

      const errors: string[] = [];
      let parsedRows: Array<{
        rowNum: number;
        mlbApiId: number;
        userId: string;
        teamAbbreviation: string;
        rosterType: "mlb" | "milb" | "draft";
        contractStatus: string | null;
        salary2026: number | null;
        minorLeagueStatus: string | null;
        minorLeagueYears: number | null;
        playerName?: string;
        ageHint?: number | null;
        mlbTeamHint?: string | null;
        orgHint?: string | null;
        fangraphsId?: string | null;
      }> = [];
      let sameTeamDuplicateConflictCount = 0;
      let sameTeamDuplicateRowCount = 0;
      const unresolved: Array<{
        rowNum: number;
        playerName: string;
        teamAbbreviation: string;
        rosterType: "mlb" | "milb" | "draft";
        ageHint?: number | null;
        mlbTeamHint?: string | null;
        orgHint?: string | null;
        fangraphsId?: string | null;
        resolutionHint?: string;
        duplicateConflictKey?: string | null;
        duplicateTeamOptions?: Array<{
          userId: string;
          teamAbbreviation: string;
          rowNums: number[];
        }>;
        candidates: Array<{
          mlbApiId: number;
          fullName: string;
          age: number | null;
          currentTeamName: string | null;
          parentOrgName: string | null;
          sportLevel: string;
          lastActiveSeason?: number | null;
          score: number;
        }>;
      }> = [];
      const middleNameUpdates = new Map<number, string>();
      const uniqueApiIds = new Set<number>();
      let cutCount = 0;
      let outOfScopeRowCount = 0;
      let processedRowsLive = 0;
      const lastActiveSeasonCache = new Map<number, number | null>();
      const remoteLastPlayedSeasonCache = new Map<number, number | null>();
      const getRemoteLastPlayedSeason = async (mlbApiId: number): Promise<number | null> => {
        if (remoteLastPlayedSeasonCache.has(mlbApiId)) {
          return remoteLastPlayedSeasonCache.get(mlbApiId) ?? null;
        }
        try {
          const [hittingRes, pitchingRes] = await Promise.all([
            fetch(`https://statsapi.mlb.com/api/v1/people/${mlbApiId}/stats?stats=yearByYear&group=hitting`),
            fetch(`https://statsapi.mlb.com/api/v1/people/${mlbApiId}/stats?stats=yearByYear&group=pitching`),
          ]);
          const parseMaxSeason = (payload: any): number | null => {
            const splits = Array.isArray(payload?.stats?.[0]?.splits) ? payload.stats[0].splits : [];
            let maxSeason: number | null = null;
            for (const split of splits) {
              const s = Number.parseInt(String(split?.season || ""), 10);
              if (!Number.isInteger(s) || s < 1900) continue;
              maxSeason = maxSeason == null ? s : Math.max(maxSeason, s);
            }
            return maxSeason;
          };
          const hittingPayload = hittingRes.ok ? await hittingRes.json() : null;
          const pitchingPayload = pitchingRes.ok ? await pitchingRes.json() : null;
          const maxHitting = parseMaxSeason(hittingPayload);
          const maxPitching = parseMaxSeason(pitchingPayload);
          const resolved =
            maxHitting == null
              ? maxPitching
              : (maxPitching == null ? maxHitting : Math.max(maxHitting, maxPitching));
          remoteLastPlayedSeasonCache.set(mlbApiId, resolved ?? null);
          return resolved ?? null;
        } catch {
          remoteLastPlayedSeasonCache.set(mlbApiId, null);
          return null;
        }
      };
      const getLastActiveSeason = async (candidate: any): Promise<number | null> => {
        const mlbApiId = Number(candidate?.mlbId);
        const localSeason = Number(candidate?.season);
        if (!Number.isInteger(mlbApiId) || mlbApiId <= 0) {
          return Number.isInteger(localSeason) && localSeason > 1900 ? localSeason : null;
        }
        if (lastActiveSeasonCache.has(mlbApiId)) {
          return lastActiveSeasonCache.get(mlbApiId) ?? null;
        }

        // Derive "last played" from all locally synced seasons for this MLB ID.
        // Prefer seasons with actual batting/pitching activity, then fall back to any known season.
        const result = await db.execute(sql`
          SELECT
            MAX(
              CASE
                WHEN
                  COALESCE(hitting_plate_appearances, 0) > 0
                  OR COALESCE(pitching_games, 0) > 0
                  OR COALESCE(pitching_innings_pitched, 0) > 0
                  OR COALESCE(had_hitting_stats, false) = true
                  OR COALESCE(had_pitching_stats, false) = true
                THEN season
                ELSE NULL
              END
            )::int AS max_played_season,
            MAX(season)::int AS max_known_season
          FROM mlb_players
          WHERE mlb_id = ${mlbApiId}
        `);
        const row = (result.rows?.[0] || {}) as any;
        const maxPlayed = Number(row.max_played_season);
        const maxKnown = Number(row.max_known_season);
        let resolved =
          (Number.isInteger(maxPlayed) && maxPlayed > 1900 ? maxPlayed : null) ??
          (Number.isInteger(maxKnown) && maxKnown > 1900 ? maxKnown : null) ??
          (Number.isInteger(localSeason) && localSeason > 1900 ? localSeason : null);
        if (!isLargeUpload && (!resolved || resolved < season)) {
          const remoteResolved = await getRemoteLastPlayedSeason(mlbApiId);
          if (remoteResolved && remoteResolved > (resolved || 0)) {
            resolved = remoteResolved;
          }
        }
        lastActiveSeasonCache.set(mlbApiId, resolved);
        return resolved;
      };

      for (let i = 1; i < lines.length; i++) {
        const rowNum = i + 1;
        processedRowsLive++;
        if (processedRowsLive === 1 || processedRowsLive % 50 === 0 || processedRowsLive >= totalRows) {
          await persistProgress({
            running: true,
            processed: processedRowsLive,
            totalRows,
            stage: matchingStage,
            message: matchingMessage,
          });
        }
        const cols = lines[i].split(delimiter).map((c: string) => c.trim());
        const rawMlbId = mlbIdIdx >= 0 ? cols[mlbIdIdx] : "";
        const firstNameRaw = firstNameIdx >= 0 ? (cols[firstNameIdx] || "").trim() : "";
        const lastNameRaw = lastNameIdx >= 0 ? (cols[lastNameIdx] || "").trim() : "";
        const rawName = nameIdx >= 0
          ? (cols[nameIdx] || "").trim()
          : [firstNameRaw, lastNameRaw].filter(Boolean).join(" ").trim();
        const rawAbbr = (cols[abbrIdx] || "").toUpperCase();
        const rawRosterType = (rosterTypeIdx >= 0 ? cols[rosterTypeIdx] : defaultRosterType).toLowerCase();
        const rawMiddleName = middleNameIdx >= 0 ? (cols[middleNameIdx] || "").trim() : "";
        const rawStatus = statusIdx >= 0 ? (cols[statusIdx] || "").trim() : "";
        const rawSalary2026 = salary2026Idx >= 0 ? (cols[salary2026Idx] || "").trim() : "";
        const rawYears = yearsIdx >= 0 ? (cols[yearsIdx] || "").trim() : "";
        const rawAge = ageIdx >= 0 ? (cols[ageIdx] || "").trim() : "";
        const rawMlbTeam = mlbTeamIdx >= 0 ? (cols[mlbTeamIdx] || "").trim() : "";
        const rawOrg = orgIdx >= 0 ? (cols[orgIdx] || "").trim() : "";
        const rawFangraphs = fangraphsIdx >= 0 ? (cols[fangraphsIdx] || "").trim() : "";
        const looksLikeExtraneousCopyrightLine =
          !rawMlbId &&
          !rawAbbr &&
          !!rawName &&
          (/\(c\)/i.test(rawName) || /©/.test(rawName) || /copyright/i.test(rawName));
                const hasCopyrightMarkerInName =
          !!rawName && (/\(c\)/i.test(rawName) || /©/.test(rawName) || /copyright/i.test(rawName));
        if (looksLikeExtraneousCopyrightLine) {
          continue;
        }
        const dobHint = parseDobHint(rawName);
        const middleNameHint = rawMiddleName || extractParentheticalMiddleHint(rawName) || null;
        const normalizedMiddleNameHint = normalizeName(middleNameHint || "");
        const middleInitialHint =
          (normalizedMiddleNameHint ? normalizedMiddleNameHint[0] : null) ||
          extractMiddleInitialFromName(rawName);
        const parsedRosterType = rawRosterType === "mlb" || rawRosterType === "milb" || rawRosterType === "draft"
          ? (rawRosterType as "mlb" | "milb" | "draft")
          : defaultRosterType;
        const rosterType: "mlb" | "milb" | "draft" = assumePageScope ? reconciliationScope : parsedRosterType;
        const rowResolutionRuleKey = buildResolutionRuleKey(rawName, rawAbbr, rosterType);
        if (!assumePageScope && rosterType !== reconciliationScope) {
          outOfScopeRowCount++;
          continue;
        }
        const rowCutKey = buildCutKey(rowNum, rawName, rawAbbr, rosterType);
        const rowMarkedCut = cuts.has(String(rowNum)) || persistedCutRows.has(String(rowNum)) || persistedCutKeys.has(rowCutKey);
        if (rowMarkedCut) {
          cutCount++;
          persistedCutEntries.set(rowCutKey, { rowNum, cutKey: rowCutKey });
          continue;
        }
        const ageHint = rawAge && Number.isFinite(Number(rawAge)) ? Number(rawAge) : null;
        const salary2026 = rawSalary2026 && Number.isFinite(Number(rawSalary2026)) ? Number(rawSalary2026) : null;
        const contractStatus = rawStatus || null;
        const { minorLeagueStatus, minorLeagueYears } = parseMinorLeagueStatusYears(rawStatus, rawYears);

        const targetUserId = abbrevToUser.get(rawAbbr);
        if (!targetUserId) {
          errors.push(`Row ${rowNum}: unknown team abbreviation "${rawAbbr}"`);
          continue;
        }
        let mlbApiId = Number(rawMlbId);
        if (!Number.isInteger(mlbApiId) || mlbApiId <= 0) {
          const resolvedId = Number(resolutions[String(rowNum)]);
          if (Number.isInteger(resolvedId) && resolvedId > 0) {
            mlbApiId = resolvedId;
          } else {
            const mappedByRule = Number(persistedNameTeamRules.get(rowResolutionRuleKey));
            if (Number.isInteger(mappedByRule) && mappedByRule > 0) {
              mlbApiId = mappedByRule;
            }
          }
          if ((!Number.isInteger(mlbApiId) || mlbApiId <= 0) && rawName) {
            const nameForSearch = stripParentheticalName(rawName) || rawName;
            const searchAliases = Array.from(new Set((() => {
              const aliases = [rawName, nameForSearch].filter(Boolean);
              const split = splitNormName(nameForSearch || rawName);
              const canonicalFirst = canonicalFirstName(split.first || "");
              if (canonicalFirst && split.last && canonicalFirst !== split.first) {
                aliases.push(`${canonicalFirst} ${split.last}`);
              }
              return aliases;
            })()));
            const seasonCandidateLists = await Promise.all(
              searchAliases.map((alias) => storage.getMlbPlayers({ search: alias, season, limit: 30 })),
            );
            let candidates = mergeCandidatesByMlbId(seasonCandidateLists).slice(0, 30);
            if (candidates.length === 0) {
              const fallbackLists = await Promise.all(
                searchAliases.map((alias) => storage.getMlbPlayers({ search: alias, limit: 60 })),
              );
              let mergedFallback = dedupeLatestByMlbId(mergeCandidatesByMlbId(fallbackLists));
              candidates = mergedFallback.slice(0, 30);
            }
            if (candidates.length === 0) {
              candidates = await getAccentInsensitiveCandidates(rawName, 15);
            }
            // Live MLB people search should augment (not just replace) local candidates.
            // This captures expanded-name records where local `full_name` search misses middle names.
            if (!isLargeUpload) {
              const [webRaw, webStripped] = await Promise.all([
                searchMlbPeople(rawName),
                nameForSearch !== rawName ? searchMlbPeople(nameForSearch) : Promise.resolve([]),
              ]);
              candidates = mergeCandidatesByMlbId([candidates, webRaw, webStripped]).slice(0, 50);
            }
            // Generic deep fallback: MLB sport directories across prior years filtered by surname fuzziness.
            if (!isLargeUpload && candidates.length === 0) {
              candidates = await searchMlbDirectoryBySurname(rawName, season);
            }
            const hasDobExactCandidate = (list: any[]) => {
              if (!dobHint) return false;
              return list.some((cand) => {
                if (!cand?.birthDate) return false;
                const d = new Date(String(cand.birthDate));
                if (Number.isNaN(d.getTime())) return false;
                const month = d.getUTCMonth() + 1;
                const day = d.getUTCDate();
                const year = d.getUTCFullYear();
                if (month !== dobHint.month || day !== dobHint.day) return false;
                if (dobHint.year && year !== dobHint.year) return false;
                return true;
              });
            };
            // If a DOB hint is present and current candidates don't contain a DOB-exact match,
            // augment with directory-based surname lookup before final scoring.
            if (dobHint && !hasDobExactCandidate(candidates)) {
              const directoryCandidates = await searchMlbDirectoryBySurname(rawName, season);
              if (directoryCandidates.length > 0) {
                candidates = mergeCandidatesByMlbId([candidates, directoryCandidates]).slice(0, 80);
              }
            }
            const scoredCandidates = candidates
              .map((p) => ({
                p,
                score: scoreCandidate(p, {
                  playerName: rawName,
                  ageHint,
                  mlbTeamHint: rawMlbTeam,
                  orgHint: rawOrg,
                  middleNameHint,
                  middleInitialHint,
                  dobHint,
                }),
              }))
              .sort((a, b) => b.score - a.score);
            const ranked = scoredCandidates.slice(0, 5);
            const top = ranked[0];
            const second = ranked[1];
            const searchSplit = splitNormName(nameForSearch || rawName);
            const searchTokens = tokenizeNormName(nameForSearch || rawName);
            const searchNorm = normalizeName(nameForSearch || rawName);
            const topIsUniqueDisplayedExactFullNameMatch =
              !!top &&
              !!searchNorm &&
              normalizeName(top.p?.fullName || "") === searchNorm &&
              !ranked.slice(1).some((r) => normalizeName(r.p?.fullName || "") === searchNorm);
            const getCandidateNameVariants = (candidate: any): string[] =>
              Array.from(new Set([
                candidate?.fullFmlName,
                candidate?.fullFMLName,
                candidate?.fullName,
                candidate?.nameFirstLast,
                [candidate?.firstName, candidate?.middleName, candidate?.lastName].filter(Boolean).join(" "),
                [candidate?.firstName, candidate?.lastName].filter(Boolean).join(" "),
              ]
                .map((v) => String(v || "").trim())
                .filter(Boolean)));
            const getCandidateFirstLastPairs = (
              candidate: any,
            ): Array<{ first: string; last: string; full: string }> => {
              const out: Array<{ first: string; last: string; full: string }> = [];
              const seen = new Set<string>();
              const pushPair = (firstRaw: string, lastRaw: string, fullRaw: string) => {
                const first = String(firstRaw || "").trim();
                const last = String(lastRaw || "").trim();
                const full = String(fullRaw || "").trim();
                if (!first || !last) return;
                const key = `${first}|${last}|${full}`;
                if (seen.has(key)) return;
                seen.add(key);
                out.push({ first, last, full });
              };
              for (const variant of getCandidateNameVariants(candidate)) {
                const tokens = tokenizeNormName(variant);
                if (tokens.length < 2) continue;
                const directFirst = tokens[0] || "";
                const directLast = tokens[tokens.length - 1] || "";
                const reversedFirst = tokens[tokens.length - 1] || "";
                const reversedLast = tokens[0] || "";
                const full = tokens.join(" ").trim();
                pushPair(directFirst, directLast, full);
                if (reversedFirst !== directFirst || reversedLast !== directLast) {
                  pushPair(reversedFirst, reversedLast, full);
                }
              }
              if (!out.length) {
                const fallback = splitNormName(
                  candidate?.fullName ||
                  candidate?.nameFirstLast ||
                  [candidate?.firstName, candidate?.middleName, candidate?.lastName].filter(Boolean).join(" "),
                );
                pushPair(fallback.first, fallback.last, fallback.full);
              }
              return out;
            };
            const getCandidateBestSplit = (candidate: any) => {
              const pairs = getCandidateFirstLastPairs(candidate);
              if (!pairs.length) return { first: "", last: "", full: "" };
              if (!searchSplit.first || !searchSplit.last) {
                return pairs[0];
              }
              let best = pairs[0];
              let bestScore = Number.NEGATIVE_INFINITY;
              for (const pair of pairs) {
                let score = 0;
                if (pair.last === searchSplit.last) score += 90;
                else {
                  const lastDist = levenshtein(searchSplit.last, pair.last);
                  if (lastDist <= 1) score += 40;
                  else score -= Math.min(60, lastDist * 12);
                }
                if (pair.first === searchSplit.first) score += 60;
                else {
                  const firstDist = levenshtein(searchSplit.first, pair.first);
                  if (firstDist <= 1) score += 32;
                  else if (firstDist <= 2) score += 16;
                  else score -= Math.min(40, firstDist * 6);
                }
                if (
                  searchSplit.first &&
                  pair.first &&
                  canonicalFirstName(searchSplit.first) === canonicalFirstName(pair.first)
                ) {
                  score += 20;
                }
                if (searchSplit.first && pair.first && searchSplit.first[0] === pair.first[0]) {
                  score += 8;
                }
                if (searchSplit.full && pair.full && searchSplit.full === pair.full) {
                  score += 30;
                }
                if (score > bestScore) {
                  best = pair;
                  bestScore = score;
                }
              }
              return best;
            };
            const candidateMatchesExactNormalizedName = (candidate: any): boolean => {
              if (!candidate || !searchNorm) return false;
              return getCandidateNameVariants(candidate)
                .some((variant) => normalizeName(variant) === searchNorm);
            };
            const candidateMatchesExactFirstLast = (candidate: any): boolean => {
              if (!candidate || !searchSplit.first || !searchSplit.last) return false;
              return getCandidateFirstLastPairs(candidate).some((pair) => {
                return pair.first === searchSplit.first && pair.last === searchSplit.last;
              });
            };
            const candidateMatchesCanonicalFirstLast = (candidate: any): boolean => {
              if (!candidate || !searchSplit.first || !searchSplit.last) return false;
              const rowFirstCanonical = canonicalFirstName(searchSplit.first);
              if (!rowFirstCanonical) return false;
              return getCandidateFirstLastPairs(candidate).some((pair) => {
                return (
                  pair.last === searchSplit.last &&
                  canonicalFirstName(pair.first) === rowFirstCanonical
                );
              });
            };
            const exactNormalizedRanked = ranked.filter((r) => {
              return candidateMatchesExactNormalizedName(r.p);
            });
            const exactFirstLastRanked = ranked.filter((r) => {
              return candidateMatchesExactFirstLast(r.p);
            });
            const topIsUniqueExactNormalizedMatch =
              exactNormalizedRanked.length === 1 &&
              !!top &&
              Number(exactNormalizedRanked[0].p?.mlbId) === Number(top.p?.mlbId);
            const topIsUniqueExactFirstLastMatch =
              exactFirstLastRanked.length === 1 &&
              !!top &&
              Number(exactFirstLastRanked[0].p?.mlbId) === Number(top.p?.mlbId);
            const hintVariants = expandTeamHintVariants(rawMlbTeam || rawOrg);
            const candidateMatchesHint = (candidate: any) => {
              if (!hintVariants.length || !candidate) return false;
              const cur = normalizeNameWithSpaces(candidate.currentTeamName || "");
              const org = normalizeNameWithSpaces(candidate.parentOrgName || "");
              return hintVariants.some((h) => (cur && cur.includes(h)) || (org && org.includes(h)));
            };
            const candidateNearName = (candidate: any) => {
              const candSplit = getCandidateBestSplit(candidate);
              if (!candSplit.last || candSplit.last !== searchSplit.last) return false;
              if (!candSplit.first || !searchSplit.first) return false;
              return levenshtein(candSplit.first, searchSplit.first) <= 2;
            };
            const topSplit = top ? getCandidateBestSplit(top.p) : null;
            const firstLastMatches = ranked.filter((r) => {
              const candSplit = getCandidateBestSplit(r.p);
              return candSplit.first === searchSplit.first && candSplit.last === searchSplit.last;
            });
            const firstLastCanonicalMatches = ranked.filter((r) => {
              const candSplit = getCandidateBestSplit(r.p);
              return (
                candSplit.last === searchSplit.last &&
                canonicalFirstName(candSplit.first) === canonicalFirstName(searchSplit.first)
              );
            });
            const closeTypoMatches = ranked.filter((r) => {
              const candSplit = getCandidateBestSplit(r.p);
              if (!candSplit.last || candSplit.last !== searchSplit.last) return false;
              if (!candSplit.first || !searchSplit.first) return false;
              return levenshtein(candSplit.first, searchSplit.first) <= 2;
            });
            const nearSurnameTypoMatches = ranked.filter((r) => {
              const candSplit = getCandidateBestSplit(r.p);
              if (!candSplit.last || !searchSplit.last) return false;
              if (levenshtein(candSplit.last, searchSplit.last) > 1) return false;
              if (!candSplit.first || !searchSplit.first) return false;
              const candFirstCanon = canonicalFirstName(candSplit.first);
              const rowFirstCanon = canonicalFirstName(searchSplit.first);
              if (candFirstCanon && rowFirstCanon && candFirstCanon === rowFirstCanon) return true;
              return levenshtein(candSplit.first, searchSplit.first) <= 1;
            });
            const highCharSimilarityMatches = ranked.filter((r) => {
              const candSplit = getCandidateBestSplit(r.p);
              if (!candSplit.full || !searchSplit.full) return false;
              const fullSim = charSimilarity(candSplit.full, searchSplit.full);
              const firstSim = charSimilarity(candSplit.first, searchSplit.first);
              const lastSim = charSimilarity(candSplit.last, searchSplit.last);
              const firstInitialAligned = !!candSplit.first && !!searchSplit.first && candSplit.first[0] === searchSplit.first[0];
              const lastInitialAligned = !!candSplit.last && !!searchSplit.last && candSplit.last[0] === searchSplit.last[0];
              if (!firstInitialAligned || !lastInitialAligned) return false;
              return fullSim >= 0.86 || (lastSim >= 0.84 && firstSim >= 0.7);
            });
            const hintedOneCharSurnameVariantMatches = ranked.filter((r) => {
              const candSplit = getCandidateBestSplit(r.p);
              if (!candidateMatchesHint(r.p)) return false;
              if (!candSplit.first || !searchSplit.first) return false;
              if (canonicalFirstName(candSplit.first) !== canonicalFirstName(searchSplit.first)) return false;
              if (!candSplit.last || !searchSplit.last) return false;
              return levenshtein(candSplit.last, searchSplit.last) <= 1;
            });
            const topIsUniqueFirstLastMatch =
              !!top &&
              firstLastMatches.length === 1 &&
              Number(firstLastMatches[0].p?.mlbId) === Number(top.p?.mlbId);
            const topIsUniqueCanonicalFirstLastMatch =
              !!top &&
              firstLastCanonicalMatches.length === 1 &&
              Number(firstLastCanonicalMatches[0].p?.mlbId) === Number(top.p?.mlbId) &&
              (
                // Exact first-name matches can still auto-resolve via canonical path.
                (topSplit?.first || "") === (searchSplit.first || "") ||
                // Nickname-driven matches only auto-resolve when no other close options exist.
                !ranked.slice(1).some((r) => {
                  const candSplit = getCandidateBestSplit(r.p);
                  if (!candSplit.first || !candSplit.last || !searchSplit.first || !searchSplit.last) return false;
                  if (candSplit.last !== searchSplit.last) return false;
                  const firstDist = levenshtein(candSplit.first, searchSplit.first);
                  const sameCanonicalFirst =
                    canonicalFirstName(candSplit.first) === canonicalFirstName(searchSplit.first);
                  return firstDist <= 2 || sameCanonicalFirst;
                })
              );
            const topIsUniqueCloseTypoMatch =
              !!top &&
              closeTypoMatches.length === 1 &&
              Number(closeTypoMatches[0].p?.mlbId) === Number(top.p?.mlbId) &&
              top.score >= 60;
            const topIsUniqueNearSurnameTypoMatch =
              !!top &&
              nearSurnameTypoMatches.length === 1 &&
              Number(nearSurnameTypoMatches[0].p?.mlbId) === Number(top.p?.mlbId) &&
              top.score >= 60;
            const topIsUniqueExactFirstNearSurnameNoCloseAlternative =
              !!top &&
              !!topSplit &&
              !!searchSplit.first &&
              !!searchSplit.last &&
              topSplit.first === searchSplit.first &&
              levenshtein(topSplit.last, searchSplit.last) <= 1 &&
              (!second || (top.score - second.score) >= 10);
            const topIsUniqueHighCharSimilarityMatch =
              !!top &&
              highCharSimilarityMatches.length === 1 &&
              Number(highCharSimilarityMatches[0].p?.mlbId) === Number(top.p?.mlbId) &&
              top.score >= 58;
            const topFullCharSimilarity = top && topSplit && searchSplit
              ? charSimilarity(topSplit.full, searchSplit.full)
              : 0;
            const secondSplit = second
              ? getCandidateBestSplit(second.p)
              : null;
            const secondFullCharSimilarity = second && secondSplit && searchSplit
              ? charSimilarity(secondSplit.full, searchSplit.full)
              : 0;
            const topIsUniqueCharDominantNoCompetition =
              !!top &&
              !!topSplit &&
              !!searchSplit &&
              canonicalFirstName(topSplit.first) === canonicalFirstName(searchSplit.first) &&
              topFullCharSimilarity >= 0.9 &&
              (
                !second ||
                secondFullCharSimilarity <= (topFullCharSimilarity - 0.08)
              );
            const topIsUniqueHintedOneCharSurnameVariantMatch =
              !!top &&
              hintedOneCharSurnameVariantMatches.length === 1 &&
              Number(hintedOneCharSurnameVariantMatches[0].p?.mlbId) === Number(top.p?.mlbId) &&
              top.score >= 0;
            const compoundSurnameMatches = scoredCandidates.filter((r) => {
              const candSplit = getCandidateBestSplit(r.p);
              const rowFirst = canonicalFirstName(searchSplit.first);
              const candFirst = canonicalFirstName(candSplit.first);
              if (!rowFirst || !candFirst || rowFirst !== candFirst) return false;
              if (searchTokens.length < 3) return false;
              const rowSurnameParts = searchTokens.slice(1);
              return rowSurnameParts.includes(candSplit.last);
            });
            const topIsUniqueCompoundSurnameMatch =
              !!top &&
              compoundSurnameMatches.length === 1 &&
              Number(compoundSurnameMatches[0].p?.mlbId) === Number(top.p?.mlbId) &&
              top.score >= 55;
            const hintMatchedRanked = ranked.filter((r) => candidateMatchesHint(r.p));
            const topIsUniqueHintMatched =
              !!top &&
              hintMatchedRanked.length === 1 &&
              Number(hintMatchedRanked[0].p?.mlbId) === Number(top.p?.mlbId) &&
              top.score >= 55;
            const dobExactRanked = ranked.filter((r) => {
              if (!dobHint || !r.p?.birthDate) return false;
              const d = new Date(String(r.p.birthDate));
              if (Number.isNaN(d.getTime())) return false;
              const month = d.getUTCMonth() + 1;
              const day = d.getUTCDate();
              const year = d.getUTCFullYear();
              if (month !== dobHint.month || day !== dobHint.day) return false;
              if (dobHint.year && year !== dobHint.year) return false;
              return true;
            });
            const topIsUniqueDobExactMatch =
              !!top &&
              dobExactRanked.length === 1 &&
              Number(dobExactRanked[0].p?.mlbId) === Number(top.p?.mlbId);
            const topHintMatchedNearName =
              !!top &&
              candidateMatchesHint(top.p) &&
              candidateNearName(top.p) &&
              top.score >= 20;
            const bestHintMatched = hintMatchedRanked[0];
            const secondHintMatched = hintMatchedRanked[1];
            const bestHintMatchedNearName =
              !!bestHintMatched &&
              candidateNearName(bestHintMatched.p) &&
              (
                !secondHintMatched ||
                Number(bestHintMatched.score) - Number(secondHintMatched.score) >= 8 ||
                !candidateNearName(secondHintMatched.p)
              );
            const topLooksLikeSingleTypo =
              !!top &&
              !!topSplit &&
              !!searchSplit.last &&
              topSplit.last === searchSplit.last &&
              !!searchSplit.first &&
              !!topSplit.first &&
              levenshtein(searchSplit.first, topSplit.first) <= 2 &&
              (!second || (top.score - second.score) >= 12) &&
              top.score >= 65;
            const strippedExactTopMatch =
              !!top &&
              normalizeName(top.p.fullName || "") === normalizeName(nameForSearch || rawName);
            const strippedTokenExactTopMatch =
              !!top &&
              topSplit?.full &&
              searchSplit.full &&
              topSplit.full === searchSplit.full;
            const topMiddleInitial = top ? getCandidateMiddleInitial(top.p) : null;
            const middleInitialConflictsTop =
              !!middleInitialHint &&
              !!topMiddleInitial &&
              topMiddleInitial !== middleInitialHint;
            const serializeCandidates = async (rows: Array<{ p: any; score: number }>) =>
              Promise.all(
                rows.map(async (r) => ({
                  mlbApiId: r.p.mlbId,
                  fullName: r.p.fullName,
                  age: r.p.age ?? null,
                  currentTeamName: r.p.currentTeamName ?? null,
                  parentOrgName: r.p.parentOrgName ?? null,
                  sportLevel: r.p.sportLevel,
                  lastActiveSeason: await getLastActiveSeason(r.p),
                  score: r.score,
                })),
              );
            const exactNameCandidatesAll = scoredCandidates.filter(
              (r) => candidateMatchesExactNormalizedName(r.p) || candidateMatchesExactFirstLast(r.p),
            );
            const exactNameCandidateIdCount = new Set(
              exactNameCandidatesAll
                .map((r) => Number(r.p?.mlbId))
                .filter((id) => Number.isInteger(id) && id > 0),
            ).size;
            const exactNormalizedNameCandidates = exactNameCandidatesAll.filter((r) =>
              candidateMatchesExactNormalizedName(r.p),
            );
            const exactNormalizedNameIdCount = new Set(
              exactNormalizedNameCandidates
                .map((r) => Number(r.p?.mlbId))
                .filter((id) => Number.isInteger(id) && id > 0),
            ).size;
            const exactNameTeamMatched = hintVariants.length > 0
              ? exactNameCandidatesAll.filter((r) => candidateMatchesHint(r.p))
              : [];
            const exactNameTeamMatchedIdCount = new Set(
              exactNameTeamMatched
                .map((r) => Number(r.p?.mlbId))
                .filter((id) => Number.isInteger(id) && id > 0),
            ).size;
            const canonicalFirstLastCandidates = scoredCandidates.filter((r) =>
              candidateMatchesCanonicalFirstLast(r.p),
            );
            const canonicalFirstLastIdCount = new Set(
              canonicalFirstLastCandidates
                .map((r) => Number(r.p?.mlbId))
                .filter((id) => Number.isInteger(id) && id > 0),
            ).size;
            const canonicalFirstLastTeamMatched = hintVariants.length > 0
              ? canonicalFirstLastCandidates.filter((r) => candidateMatchesHint(r.p))
              : [];
            const canonicalFirstLastTeamMatchedIdCount = new Set(
              canonicalFirstLastTeamMatched
                .map((r) => Number(r.p?.mlbId))
                .filter((id) => Number.isInteger(id) && id > 0),
            ).size;
            const exactAutoPick =
              exactNormalizedNameIdCount === 1
                ? exactNormalizedNameCandidates[0]?.p || null
                : exactNameCandidateIdCount === 1
                ? exactNameCandidatesAll[0]?.p || null
                : exactNameCandidateIdCount > 1 && exactNameTeamMatchedIdCount === 1
                  ? exactNameTeamMatched[0]?.p || null
                : canonicalFirstLastIdCount === 1
                  ? canonicalFirstLastCandidates[0]?.p || null
                : canonicalFirstLastIdCount > 1 && canonicalFirstLastTeamMatchedIdCount === 1
                  ? canonicalFirstLastTeamMatched[0]?.p || null
                  : null;
            const isNearTypoCandidate = (candidate: any): boolean => {
              if (!candidate) return false;
              const candSplit = getCandidateBestSplit(candidate);
              if (!searchSplit.first || !searchSplit.last || !candSplit.first || !candSplit.last) return false;
              const firstInitialAligned = searchSplit.first[0] === candSplit.first[0];
              const firstDist = levenshtein(searchSplit.first, candSplit.first);
              const lastDist = levenshtein(searchSplit.last, candSplit.last);
              const firstConfDist = levenshtein(
                normalizeConfusableCharacters(searchSplit.first),
                normalizeConfusableCharacters(candSplit.first),
              );
              const lastConfDist = levenshtein(
                normalizeConfusableCharacters(searchSplit.last),
                normalizeConfusableCharacters(candSplit.last),
              );
              const closeLast = lastDist <= 1 || lastConfDist <= 1;
              const closeFirst = (firstInitialAligned && firstDist <= 2) || firstConfDist <= 1;
              return closeLast && closeFirst;
            };
            const typoCandidatesAll = scoredCandidates.filter((r) => isNearTypoCandidate(r.p));
            const typoCandidatesHinted = hintVariants.length > 0
              ? typoCandidatesAll.filter((r) => candidateMatchesHint(r.p))
              : [];
            const typoCandidatePool = typoCandidatesHinted.length > 0 ? typoCandidatesHinted : typoCandidatesAll;
            const typoCandidateUniqueIdCount = new Set(
              typoCandidatePool
                .map((r) => Number(r.p?.mlbId))
                .filter((id) => Number.isInteger(id) && id > 0),
            ).size;
            const sortedTypoPool = [...typoCandidatePool].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
            const typoTop = sortedTypoPool[0];
            const typoSecond = sortedTypoPool[1];
            const typoGap = typoTop && typoSecond ? Number(typoTop.score || 0) - Number(typoSecond.score || 0) : 999;
            const typoTopSplit = typoTop ? getCandidateBestSplit(typoTop.p) : null;
            const typoTopLastDist =
              typoTopSplit?.last && searchSplit.last
                ? levenshtein(searchSplit.last, typoTopSplit.last)
                : null;
            const rowFirstCanonical = canonicalFirstName(searchSplit.first || "");
            const typoBlockedForCommonFirstSurnameVariant =
              !exactAutoPick &&
              !!typoTop &&
              !!rowFirstCanonical &&
              COMMON_FIRST_NAMES_FOR_SURNAME_TYPO_AUTOMAP.has(rowFirstCanonical) &&
              typoTopLastDist === 1 &&
              !dobHint &&
              !candidateMatchesHint(typoTop.p);
            const typoBlockedForCopyrightNoise =
              !exactAutoPick &&
              !!typoTop &&
              hasCopyrightMarkerInName &&
              typoTopLastDist === 1;
            const typoAutoPick =
              !exactAutoPick &&
              typoCandidateUniqueIdCount === 1 &&
              !!typoTop &&
              !typoBlockedForCommonFirstSurnameVariant &&
              !typoBlockedForCopyrightNoise &&
              (!typoSecond || typoGap >= 8)
                ? typoTop.p
                : null;
            const selectedAutoPick = exactAutoPick || typoAutoPick;
            if (selectedAutoPick?.mlbId) {
              mlbApiId = Number(selectedAutoPick.mlbId);
            } else {
              const rankedCandidates = await serializeCandidates(ranked);
              let resolutionHint = "No unique exact name match. Choose player manually.";
              if (exactNameCandidateIdCount > 1 && exactNameTeamMatchedIdCount !== 1) {
                resolutionHint = hintVariants.length > 0
                  ? "Multiple players share this exact name and team hint did not produce a unique match. Choose player manually."
                  : "Multiple players share this exact name. Add team hint or choose player manually.";
              } else if (!ranked.length) {
                resolutionHint = "No candidates found from name search. Enter MLB API ID manually or adjust name spelling.";
              }
              unresolved.push({
                rowNum,
                playerName: rawName,
                teamAbbreviation: rawAbbr,
                rosterType,
                ageHint,
                mlbTeamHint: rawMlbTeam || null,
                orgHint: rawOrg || null,
                fangraphsId: rawFangraphs || null,
                resolutionHint,
                candidates: rankedCandidates,
              });
              continue;
            }
            if (selectedAutoPick) {
              const rowGate = splitNormName(nameForSearch || rawName);
              const candGate = getCandidateBestSplit(selectedAutoPick);
              const rowFirstCanon = canonicalFirstName(rowGate.first);
              const candFirstCanon = canonicalFirstName(candGate.first);
              const firstDist =
                rowGate.first && candGate.first ? levenshtein(rowGate.first, candGate.first) : null;
              const lastDist =
                rowGate.last && candGate.last ? levenshtein(rowGate.last, candGate.last) : null;
              const firstInitialMismatch =
                !!rowGate.first && !!candGate.first && rowGate.first[0] !== candGate.first[0];
              const distantFirstNameMismatch =
                firstDist != null &&
                firstDist >= 4 &&
                rowFirstCanon !== candFirstCanon &&
                firstInitialMismatch;
              const surnameNotClose = lastDist != null && lastDist > 1;
              const exactNameGatePass =
                candidateMatchesExactNormalizedName(selectedAutoPick) ||
                candidateMatchesExactFirstLast(selectedAutoPick);
              const uniqueExactNameCandidate =
                ranked.length === 1 && exactNameGatePass;
              const unsafeAutoResolve = (exactNameGatePass || uniqueExactNameCandidate)
                ? false
                : (distantFirstNameMismatch || surnameNotClose);
              if (!unsafeAutoResolve) {
                mlbApiId = selectedAutoPick.mlbId;
              } else {
                const rankedCandidates = await serializeCandidates(ranked);
                unresolved.push({
                  rowNum,
                  playerName: rawName,
                  teamAbbreviation: rawAbbr,
                  rosterType,
                  ageHint,
                  mlbTeamHint: rawMlbTeam || null,
                  orgHint: rawOrg || null,
                  fangraphsId: rawFangraphs || null,
                  resolutionHint:
                    "Blocked auto-match: strong first-name mismatch with candidate. Choose player manually.",
                  candidates: rankedCandidates,
                });
                continue;
              }
            }
          } else if (!Number.isInteger(mlbApiId) || mlbApiId <= 0) {
            unresolved.push({
              rowNum,
              playerName: rawName || "(missing name)",
              teamAbbreviation: rawAbbr,
              rosterType,
              ageHint,
              mlbTeamHint: rawMlbTeam || null,
              orgHint: rawOrg || null,
              fangraphsId: rawFangraphs || null,
              resolutionHint: "Missing MLB API ID and player name. Provide player_name (or first_name + last_name) or enter MLB API ID manually.",
              candidates: [],
            });
            continue;
          }
        }

        parsedRows.push({
          rowNum,
          mlbApiId,
          userId: targetUserId,
          teamAbbreviation: rawAbbr,
          rosterType,
          contractStatus,
          salary2026,
          minorLeagueStatus,
          minorLeagueYears,
          playerName: rawName || undefined,
          ageHint,
          mlbTeamHint: rawMlbTeam || null,
          orgHint: rawOrg || null,
          fangraphsId: rawFangraphs || null,
        });
        uniqueApiIds.add(mlbApiId);
        if (rawMiddleName) {
          middleNameUpdates.set(mlbApiId, rawMiddleName);
        }
      }
      // Duplicate MLB IDs in the same upload require commissioner team selection.
      // Example: same player listed on two teams; commissioner must choose winner.
      {
        const byMlbApiId = new Map<number, typeof parsedRows>();
        for (const row of parsedRows) {
          const group = byMlbApiId.get(row.mlbApiId) || [];
          group.push(row);
          byMlbApiId.set(row.mlbApiId, group);
        }
        const dedupedRows: typeof parsedRows = [];
        const duplicateConflictContext = new Map<string, {
          optionsByUserId: Map<string, { userId: string; teamAbbreviation: string; rowNums: number[] }>;
          options: Array<{ userId: string; teamAbbreviation: string; rowNums: number[] }>;
          selectedUserId: string;
        }>();
        const emittedSelectedConflict = new Set<string>();
        for (const row of parsedRows) {
          const group = byMlbApiId.get(row.mlbApiId) || [];
          if (group.length <= 1) {
            dedupedRows.push(row);
            continue;
          }
          const conflictKey = `dup:${row.mlbApiId}`;
          let context = duplicateConflictContext.get(conflictKey);
          if (!context) {
            const optionsByUserId = new Map<string, { userId: string; teamAbbreviation: string; rowNums: number[] }>();
            for (const g of group) {
              const existing = optionsByUserId.get(g.userId);
              if (existing) {
                existing.rowNums.push(g.rowNum);
              } else {
                optionsByUserId.set(g.userId, {
                  userId: g.userId,
                  teamAbbreviation: g.teamAbbreviation,
                  rowNums: [g.rowNum],
                });
              }
            }
            const options = Array.from(optionsByUserId.values())
              .map((o) => ({ ...o, rowNums: o.rowNums.sort((a, b) => a - b) }))
              .sort((a, b) => a.teamAbbreviation.localeCompare(b.teamAbbreviation));
            const singleTeamDuplicate = optionsByUserId.size === 1;
            if (singleTeamDuplicate) {
              sameTeamDuplicateConflictCount += 1;
              sameTeamDuplicateRowCount += Math.max(0, group.length - 1);
            }
            const selectedUserId = resolveConflictSelectionUserId(
              singleTeamDuplicate
                ? Array.from(optionsByUserId.keys())[0]
                : (duplicateTeamResolutions[conflictKey] || persistedDuplicateTeamRules.get(conflictKey)),
              optionsByUserId,
            );
            context = { optionsByUserId, options, selectedUserId };
            duplicateConflictContext.set(conflictKey, context);
          }
          const { optionsByUserId, options, selectedUserId } = context;
          if (selectedUserId && optionsByUserId.has(selectedUserId)) {
            if (!emittedSelectedConflict.has(conflictKey)) {
              const selectedTeamAbbreviation = optionsByUserId.get(selectedUserId)?.teamAbbreviation || row.teamAbbreviation;
              const chosenTemplate = group.find((g) => g.userId === selectedUserId) || group[0];
              dedupedRows.push({
                ...chosenTemplate,
                userId: selectedUserId,
                teamAbbreviation: selectedTeamAbbreviation,
              });
              emittedSelectedConflict.add(conflictKey);
            }
            continue;
          }
          unresolved.push({
            rowNum: row.rowNum,
            playerName: row.playerName || `MLB ID ${row.mlbApiId}`,
            teamAbbreviation: row.teamAbbreviation,
            rosterType: row.rosterType,
            ageHint: row.ageHint,
            mlbTeamHint: row.mlbTeamHint || null,
            orgHint: row.orgHint || null,
            fangraphsId: row.fangraphsId || null,
            resolutionHint: "Duplicate MLB ID appears on multiple teams in this upload. Choose the team that should keep this player.",
            duplicateConflictKey: conflictKey,
            duplicateTeamOptions: options,
            candidates: [],
          });
        }
        parsedRows = dedupedRows;
      }
      const resolvedRowsSnapshot = parsedRows.map((row) => ({
        rowNum: row.rowNum,
        mlbApiId: row.mlbApiId,
        rosterType: row.rosterType,
        userId: row.userId,
      }));

      if (unresolved.length > 0 && !allowPartialImportDuringMatching) {
        const scopeWarnings =
          !assumePageScope && outOfScopeRowCount > 0
            ? [`Skipped ${outOfScopeRowCount} rows outside active ${reconciliationScope.toUpperCase()} scope.`]
            : [];
        const duplicateCollapseWarnings =
          sameTeamDuplicateConflictCount > 0
            ? [
                `${sameTeamDuplicateRowCount} duplicate row(s) for ${sameTeamDuplicateConflictCount} player(s) were auto-collapsed because all duplicate rows mapped to the same team.`,
              ]
            : [];
        const unresolvedWarnings = [...headerWarnings, ...scopeWarnings, ...duplicateCollapseWarnings];
        await persistLatestSnapshot({
          processed: lines.length - 1,
          created: 0,
          unresolvedCount: unresolved.length,
          unresolved,
          errors,
          warnings: unresolvedWarnings,
          csvData,
          csvHash,
          persistedCuts: Array.from(persistedCutEntries.values()),
          resolvedRows: resolvedRowsSnapshot,
        });
        await setOnboardingStatus({
          status: "in_progress",
          imported: 0,
          unresolved: unresolved.length,
          errors: errors.length,
          completedAt: null,
        });
        await persistProgress({
          running: false,
          processed: totalRows,
          totalRows,
          stage: "awaiting_resolution",
          message: `${unresolved.length} unresolved rows require review`,
        });
        return res.json({
          requiresResolution: true,
          unresolved,
          processed: lines.length - 1,
          errors,
          warnings: unresolvedWarnings,
          created: 0,
          cutCount,
          persistedCutRows: toPersistedCutRowNumbers(),
          middleNamesUpdated: 0,
        });
      }
      if (errors.length > 0) {
        if (parsedRows.length > 0) {
          // Allow partial import and retain parse errors for commissioner visibility.
          parseErrorWarning = `${errors.length} rows had parse/validation errors and were skipped.`;
        } else {
        const scopeWarnings =
          !assumePageScope && outOfScopeRowCount > 0
            ? [`Skipped ${outOfScopeRowCount} rows outside active ${reconciliationScope.toUpperCase()} scope.`]
            : [];
        const errorWarnings = [...headerWarnings, ...scopeWarnings];
        await persistLatestSnapshot({
          processed: lines.length - 1,
          created: 0,
          unresolvedCount: 0,
          unresolved: [],
          errors,
          warnings: errorWarnings,
          csvData,
          csvHash,
          persistedCuts: Array.from(persistedCutEntries.values()),
          resolvedRows: resolvedRowsSnapshot,
        });
        await setOnboardingStatus({
          status: "in_progress",
          imported: 0,
          unresolved: 0,
          errors: errors.length,
          completedAt: null,
        });
        await persistProgress({
          running: false,
          processed: totalRows,
          totalRows,
          stage: "error",
          message: `${errors.length} row errors`,
        });
        return res.json({
          requiresResolution: true,
          unresolved: [],
          processed: lines.length - 1,
          errors,
          warnings: errorWarnings,
          created: 0,
          cutCount,
          persistedCutRows: toPersistedCutRowNumbers(),
          middleNamesUpdated: 0,
        });
        }
      }

      const players = await storage.getMlbPlayersByMlbIdsWithSeasonFallback(Array.from(uniqueApiIds), season);
      const byApiId = new Map<number, number>();
      for (const p of players) byApiId.set(p.mlbId, p.id);
      const seededMlbIds = new Set<number>();
      const seedMlbPlayerFromApi = async (mlbId: number): Promise<number | null> => {
        if (seededMlbIds.has(mlbId)) {
          const existing = await storage.getMlbPlayerByMlbId(mlbId);
          return existing?.id ?? null;
        }
        try {
          const response = await fetch(`https://statsapi.mlb.com/api/v1/people/${mlbId}`);
          if (!response.ok) return null;
          const payload = await response.json();
          const person = Array.isArray(payload?.people) ? payload.people[0] : null;
          if (!person?.id || !person?.fullName) return null;
          await storage.upsertMlbPlayers([{
            mlbId: Number(person.id),
            fullName: String(person.fullName),
            fullFmlName: String(person.fullFMLName || "").trim() || null,
            firstName: person.firstName || null,
            middleName: person.middleName || null,
            lastName: person.lastName || null,
            primaryPosition: person.primaryPosition?.abbreviation || null,
            positionName: person.primaryPosition?.name || null,
            positionType: person.primaryPosition?.type || null,
            batSide: person.batSide?.code || null,
            throwHand: person.pitchHand?.code || null,
            currentTeamId: person.currentTeam?.id || null,
            currentTeamName: person.currentTeam?.name || null,
            parentOrgId: null,
            parentOrgName: null,
            sportId: 1,
            sportLevel: "MLB",
            birthDate: person.birthDate || null,
            age: Number.isFinite(Number(person.currentAge)) ? Number(person.currentAge) : null,
            isActive: person.active !== false,
            hadHittingStats: false,
            hadPitchingStats: false,
            hittingAtBats: 0,
            hittingWalks: 0,
            hittingSingles: 0,
            hittingDoubles: 0,
            hittingTriples: 0,
            hittingHomeRuns: 0,
            hittingAvg: null,
            hittingObp: null,
            hittingSlg: null,
            hittingOps: null,
            pitchingGames: 0,
            pitchingGamesStarted: 0,
            pitchingStrikeouts: 0,
            pitchingWalks: 0,
            pitchingHits: 0,
            pitchingHomeRuns: 0,
            pitchingEra: null,
            pitchingInningsPitched: 0,
            hittingGamesStarted: 0,
            hittingPlateAppearances: 0,
            isTwoWayQualified: false,
            season,
          }] as any);
          seededMlbIds.add(mlbId);
          const seeded = await storage.getMlbPlayerByMlbId(mlbId);
          return seeded?.id ?? null;
        } catch {
          return null;
        }
      };

      const existingAssignments = await storage.getLeagueRosterAssignments(leagueId, season);
      const alreadyAssigned = new Set<number>(existingAssignments.map((a) => a.mlbPlayerId));
      const existingByPlayerId = new Map<number, any>(existingAssignments.map((a) => [a.mlbPlayerId, a]));
      const seenPlayerIds = new Set<number>();
      const warnings: string[] = [];
      warnings.push(...headerWarnings);
      if (parseErrorWarning) {
        warnings.push(parseErrorWarning);
      }
      if (!assumePageScope && outOfScopeRowCount > 0) {
        warnings.push(`Skipped ${outOfScopeRowCount} rows outside active ${reconciliationScope.toUpperCase()} scope.`);
      }
      if (sameTeamDuplicateConflictCount > 0) {
        warnings.push(
          `${sameTeamDuplicateRowCount} duplicate row(s) for ${sameTeamDuplicateConflictCount} player(s) were auto-collapsed because all duplicate rows mapped to the same team.`,
        );
      }
      let idempotentSkipCount = 0;
      const toInsert: Array<{
        leagueId: number;
        userId: string;
        mlbPlayerId: number;
        rosterType: "mlb" | "milb" | "draft";
        contractStatus?: string | null;
        salary2026?: number | null;
        minorLeagueStatus?: string | null;
        minorLeagueYears?: number | null;
        season: number;
      }> = [];
      const toReassign: Array<{
        assignmentId: number;
        userId: string;
        rosterType: "mlb" | "milb" | "draft";
        contractStatus?: string | null;
        salary2026?: number | null;
        minorLeagueStatus?: string | null;
        minorLeagueYears?: number | null;
      }> = [];

      for (const row of parsedRows) {
        let internalPlayerId = byApiId.get(row.mlbApiId);
        if (!internalPlayerId) {
          const seededId = await seedMlbPlayerFromApi(row.mlbApiId);
          if (seededId) {
            internalPlayerId = seededId;
            byApiId.set(row.mlbApiId, seededId);
          }
        }
        if (!internalPlayerId) {
          errors.push(`Row ${row.rowNum}: MLB API ID ${row.mlbApiId} not found for season ${season}`);
          continue;
        }
        if (alreadyAssigned.has(internalPlayerId)) {
          const existing = existingByPlayerId.get(internalPlayerId);
          if (existing && existing.userId === row.userId && existing.rosterType === row.rosterType) {
            idempotentSkipCount++;
            continue;
          }
          if (existing) {
            const conflictKey = `assigned:${row.mlbApiId}`;
            const existingTeamAbbreviation =
              String(userToAbbrev.get(existing.userId) || row.teamAbbreviation || "").toUpperCase();
            const uploadedTeamAbbreviation = String(row.teamAbbreviation || "").toUpperCase();
            const optionsByUserId = new Map<string, { userId: string; teamAbbreviation: string; rowNums: number[] }>();
            optionsByUserId.set(existing.userId, {
              userId: existing.userId,
              teamAbbreviation: existingTeamAbbreviation,
              rowNums: [],
            });
            optionsByUserId.set(row.userId, {
              userId: row.userId,
              teamAbbreviation: uploadedTeamAbbreviation,
              rowNums: [row.rowNum],
            });
            const singleTeamConflict = optionsByUserId.size === 1;
            const selectedUserId = resolveConflictSelectionUserId(
              singleTeamConflict
                ? Array.from(optionsByUserId.keys())[0]
                : (duplicateTeamResolutions[conflictKey] || persistedDuplicateTeamRules.get(conflictKey)),
              optionsByUserId,
            );
            if (selectedUserId && optionsByUserId.has(selectedUserId)) {
              if (selectedUserId === existing.userId) {
                const existingRosterType = String(existing.rosterType || "").toLowerCase();
                const needsScopeUpdate = existingRosterType !== row.rosterType;
                if (needsScopeUpdate) {
                  toReassign.push({
                    assignmentId: existing.id,
                    userId: existing.userId,
                    rosterType: row.rosterType,
                    contractStatus: row.rosterType === "mlb" ? row.contractStatus : null,
                    salary2026: row.rosterType === "mlb" ? row.salary2026 : null,
                    minorLeagueStatus: row.rosterType !== "mlb" ? row.minorLeagueStatus : null,
                    minorLeagueYears: row.rosterType !== "mlb" ? row.minorLeagueYears : null,
                  });
                  continue;
                }
                idempotentSkipCount++;
                continue;
              }
              if (assumePageScope) {
                toReassign.push({
                  assignmentId: existing.id,
                  userId: row.userId,
                  rosterType: row.rosterType,
                  contractStatus: row.rosterType === "mlb" ? row.contractStatus : null,
                  salary2026: row.rosterType === "mlb" ? row.salary2026 : null,
                  minorLeagueStatus: row.rosterType !== "mlb" ? row.minorLeagueStatus : null,
                  minorLeagueYears: row.rosterType !== "mlb" ? row.minorLeagueYears : null,
                });
                continue;
              }
            }
            unresolved.push({
              rowNum: row.rowNum,
              playerName: row.playerName || `MLB ID ${row.mlbApiId}`,
              teamAbbreviation: uploadedTeamAbbreviation,
              rosterType: row.rosterType,
              ageHint: row.ageHint,
              mlbTeamHint: row.mlbTeamHint || null,
              orgHint: row.orgHint || null,
              fangraphsId: row.fangraphsId || null,
              resolutionHint: "Player is already assigned in this league/season. Choose which team should keep this player.",
              duplicateConflictKey: conflictKey,
              duplicateTeamOptions: Array.from(optionsByUserId.values()).sort((a, b) => a.teamAbbreviation.localeCompare(b.teamAbbreviation)),
              candidates: [],
            });
            continue;
          }
          errors.push(`Row ${row.rowNum}: player ${row.mlbApiId} is already assigned in this league/season`);
          continue;
        }
        if (seenPlayerIds.has(internalPlayerId)) {
          errors.push(`Row ${row.rowNum}: duplicate player ${row.mlbApiId} in upload`);
          continue;
        }
        seenPlayerIds.add(internalPlayerId);
        toInsert.push({
          leagueId,
          userId: row.userId,
          mlbPlayerId: internalPlayerId,
          rosterType: row.rosterType,
          contractStatus: row.rosterType === "mlb" ? row.contractStatus : null,
          salary2026: row.rosterType === "mlb" ? row.salary2026 : null,
          minorLeagueStatus: row.rosterType !== "mlb" ? row.minorLeagueStatus : null,
          minorLeagueYears: row.rosterType !== "mlb" ? row.minorLeagueYears : null,
          season,
        });
      }
      if (unresolved.length > 0 && !allowPartialImportDuringMatching) {
        const scopeWarnings =
          !assumePageScope && outOfScopeRowCount > 0
            ? [`Skipped ${outOfScopeRowCount} rows outside active ${reconciliationScope.toUpperCase()} scope.`]
            : [];
        const unresolvedWarnings = [...warnings, ...scopeWarnings];
        await persistLatestSnapshot({
          processed: lines.length - 1,
          created: 0,
          unresolvedCount: unresolved.length,
          unresolved,
          errors,
          warnings: unresolvedWarnings,
          csvData,
          csvHash,
          persistedCuts: Array.from(persistedCutEntries.values()),
          resolvedRows: resolvedRowsSnapshot,
        });
        await setOnboardingStatus({
          status: "in_progress",
          imported: 0,
          unresolved: unresolved.length,
          errors: errors.length,
          completedAt: null,
        });
        await persistProgress({
          running: false,
          processed: totalRows,
          totalRows,
          stage: "awaiting_resolution",
          message: `${unresolved.length} unresolved rows`,
        });
        return res.json({
          requiresResolution: true,
          unresolved,
          processed: lines.length - 1,
          errors,
          warnings: unresolvedWarnings,
          created: 0,
          cutCount,
          persistedCutRows: toPersistedCutRowNumbers(),
          middleNamesUpdated: 0,
        });
      }
      if (errors.length > 0) {
        if (toInsert.length > 0 || toReassign.length > 0) {
          warnings.push(`${errors.length} rows were skipped due to row-level errors.`);
        } else {
        await persistLatestSnapshot({
          processed: lines.length - 1,
          created: 0,
          unresolvedCount: 0,
          unresolved: [],
          errors,
          warnings,
          csvData,
          csvHash,
          persistedCuts: Array.from(persistedCutEntries.values()),
          resolvedRows: resolvedRowsSnapshot,
        });
        await setOnboardingStatus({
          status: "in_progress",
          imported: 0,
          unresolved: 0,
          errors: errors.length,
          completedAt: null,
        });
        await persistProgress({
          running: false,
          processed: totalRows,
          totalRows,
          stage: "error",
          message: `${errors.length} row errors`,
        });
        return res.json({
          requiresResolution: true,
          unresolved: [],
          processed: lines.length - 1,
          errors,
          warnings,
          created: 0,
          cutCount,
          persistedCutRows: toPersistedCutRowNumbers(),
          middleNamesUpdated: 0,
        });
        }
      }

      if (idempotentSkipCount > 0) {
        warnings.push(`${idempotentSkipCount} rows were already assigned to the same team/roster and were skipped.`);
      }
      if (toReassign.length > 0) {
        warnings.push(`${toReassign.length} existing assignments were updated to match this ${reconciliationScope.toUpperCase()} upload.`);
      }
      if (toInsert.length > 0) {
        const league = await storage.getLeague(leagueId);
        const counts = await storage.getRosterAssignmentCounts(leagueId, season);
        const countMap = new Map<string, { mlb: number; milb: number }>();
        for (const c of counts) {
          const existing = countMap.get(c.userId) || { mlb: 0, milb: 0 };
          if (c.rosterType === "mlb") existing.mlb = c.count;
          if (c.rosterType === "milb") existing.milb = c.count;
          countMap.set(c.userId, existing);
        }

        for (const row of toInsert) {
          const teamCounts = countMap.get(row.userId) || { mlb: 0, milb: 0 };
          if (row.rosterType === "mlb") {
            teamCounts.mlb += 1;
            if (league?.mlRosterLimit && teamCounts.mlb > league.mlRosterLimit) {
              warnings.push(`Team ${row.userId} exceeds MLB roster soft limit (${teamCounts.mlb}/${league.mlRosterLimit})`);
            }
          } else if (row.rosterType === "milb") {
            teamCounts.milb += 1;
            if (league?.milbRosterLimit && teamCounts.milb > league.milbRosterLimit) {
              warnings.push(`Team ${row.userId} exceeds MiLB roster soft limit (${teamCounts.milb}/${league.milbRosterLimit})`);
            }
          }
          countMap.set(row.userId, teamCounts);
        }
      }

      await persistProgress({
        running: true,
        processed: totalRows,
        totalRows,
        stage: "importing",
        message: "Writing roster assignments",
      });
      const insertedCount = await storage.bulkAssignPlayers(toInsert as any);
      for (const row of toReassign) {
        await db
          .update(leagueRosterAssignments)
          .set({
            userId: row.userId,
            rosterType: row.rosterType,
            contractStatus: row.contractStatus ?? null,
            salary2026: row.salary2026 ?? null,
            minorLeagueStatus: row.minorLeagueStatus ?? null,
            minorLeagueYears: row.minorLeagueYears ?? null,
          })
          .where(eq(leagueRosterAssignments.id, row.assignmentId));
      }
      const created = insertedCount + toReassign.length;
      const middleNamesUpdated = await storage.updateMlbPlayerMiddleNames(
        Array.from(middleNameUpdates.entries()).map(([mlbId, middleName]) => ({ mlbId, middleName })),
      );
      if (unresolved.length > 0) {
        warnings.push(`${created} matched rows imported; ${unresolved.length} rows still need reconciliation.`);
        await persistLatestSnapshot({
          processed: lines.length - 1,
          created,
          unresolvedCount: unresolved.length,
          unresolved,
          errors,
          warnings,
          csvData,
          csvHash,
          persistedCuts: Array.from(persistedCutEntries.values()),
          resolvedRows: resolvedRowsSnapshot,
        });
        await setOnboardingStatus({
          status: "in_progress",
          imported: created,
          unresolved: unresolved.length,
          errors: errors.length,
          completedAt: null,
        });
        await persistProgress({
          running: false,
          processed: totalRows,
          totalRows,
          stage: "awaiting_resolution",
          message: `${created} imported, ${unresolved.length} unresolved`,
        });
        return res.json({
          requiresResolution: true,
          unresolved,
          processed: lines.length - 1,
          errors,
          warnings,
          created,
          cutCount,
          persistedCutRows: toPersistedCutRowNumbers(),
          middleNamesUpdated,
        });
      }
      await persistLatestSnapshot({
        processed: lines.length - 1,
        created,
        unresolvedCount: 0,
        unresolved: [],
        errors,
        warnings,
        csvData,
        csvHash,
        persistedCuts: Array.from(persistedCutEntries.values()),
        resolvedRows: resolvedRowsSnapshot,
      });
      await setOnboardingStatus({
        status: "completed",
        imported: created,
        unresolved: 0,
        errors: 0,
        completedAt: new Date(),
      });
      await persistProgress({
        running: false,
        processed: totalRows,
        totalRows,
        stage: "completed",
        message: `Completed: ${created} imported`,
      });
      await persistLatestSnapshot({
        processed: lines.length - 1,
        created,
        unresolvedCount: 0,
        unresolved: [],
        errors,
        warnings,
        csvData,
        csvHash,
        persistedCuts: Array.from(persistedCutEntries.values()),
        resolvedRows: resolvedRowsSnapshot,
      });
      res.json({
        requiresResolution: false,
        created,
        cutCount,
        persistedCutRows: toPersistedCutRowNumbers(),
        middleNamesUpdated,
        processed: lines.length - 1,
        errors,
        warnings,
      });
      } catch (error: any) {
      console.error("Error uploading roster assignments CSV:", error);
      try {
        const leagueId = parseInt(req.params.id);
        const csvData = String(req.body?.csvData || "").trim();
        const requestedDefaultRosterType = String(req.body?.defaultRosterType || "").trim().toLowerCase();
        const scope =
          requestedDefaultRosterType === "mlb" || requestedDefaultRosterType === "milb" || requestedDefaultRosterType === "draft"
            ? requestedDefaultRosterType
            : "milb";
        const totalRows = Math.max(0, csvData.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean).length - 1);
        const progressPath = path.join(process.cwd(), "attached_assets", `roster-reconcile-progress-${scope}.json`);
        await fs.writeFile(progressPath, JSON.stringify({
          leagueId,
          season: Number(req.body?.season) || 2025,
          rosterType: scope,
          updatedAt: new Date().toISOString(),
          running: false,
          processed: 0,
          totalRows,
          percent: 0,
          stage: "error",
          message: error?.message || "Failed to upload roster assignments CSV",
        }, null, 2), "utf8");
      } catch (e) {
        console.error("Failed to write reconciliation error progress snapshot:", e);
      }
      res.status(500).json({ message: "Failed to upload roster assignments CSV" });
    }
  });

  // Commissioner: live progress for reconciliation upload
  app.get("/api/leagues/:id/roster-reconciliation/progress", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);
      const requestedRosterType = String(req.query?.rosterType || "milb").trim().toLowerCase();
      const rosterTypeScope =
        requestedRosterType === "mlb" || requestedRosterType === "milb" || requestedRosterType === "draft"
          ? requestedRosterType
          : "milb";
      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }
      const league = await storage.getLeague(leagueId);
      const progressPath = path.join(process.cwd(), "attached_assets", `roster-reconcile-progress-${rosterTypeScope}.json`);
      try {
        const raw = await fs.readFile(progressPath, "utf8");
        const payload = JSON.parse(raw || "{}");
        if (Number(payload?.leagueId) === leagueId) {
          const payloadUpdatedAtMs = payload?.updatedAt ? Date.parse(String(payload.updatedAt)) : NaN;
          const isFresh = Number.isFinite(payloadUpdatedAtMs) && (Date.now() - payloadUpdatedAtMs) < 5 * 60 * 1000;
          const staleRunning = payload?.running && !isFresh;
          if (!staleRunning) return res.json(payload);
        }
      } catch {
        // Fall through to synthesized default.
      }
      res.json({
        leagueId,
        season: Number(league?.rosterOnboardingSeason || 2025),
        rosterType: rosterTypeScope,
        updatedAt: new Date().toISOString(),
        running: false,
        processed: 0,
        totalRows: 0,
        percent: 0,
        stage: "awaiting_resolution",
        message: "Idle",
      });
    } catch (error) {
      console.error("Error loading reconciliation progress:", error);
      res.status(500).json({ message: "Failed to load reconciliation progress" });
    }
  });

  // Load latest unresolved reconciliation rows from onboarding report (commissioner only)
  app.get("/api/leagues/:id/roster-reconciliation/latest", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);
      const requestedRosterType = String(req.query?.rosterType || "milb").trim().toLowerCase();
      const rosterTypeScope =
        requestedRosterType === "mlb" || requestedRosterType === "milb" || requestedRosterType === "draft"
          ? requestedRosterType
          : "milb";
      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const latestSnapshotPathScoped = path.join(process.cwd(), "attached_assets", `roster-reconcile-latest-${rosterTypeScope}.json`);
      const normalizedCsvPath = path.join(process.cwd(), "attached_assets", "roster-normalized-upload.csv");
      type SourceMeta = {
        source: "latest_snapshot";
        path: string;
        raw: string;
        updatedAtMs: number;
      };
      const sources: SourceMeta[] = [];
      for (const candidate of [
        { source: "latest_snapshot" as const, path: latestSnapshotPathScoped },
      ]) {
        try {
          const [raw, stat] = await Promise.all([
            fs.readFile(candidate.path, "utf8"),
            fs.stat(candidate.path),
          ]);
          let updatedAtMs = stat.mtimeMs;
          try {
            const parsed = JSON.parse(raw || "{}");
            if (parsed?.updatedAt) {
              const parsedMs = Date.parse(String(parsed.updatedAt));
              if (Number.isFinite(parsedMs)) updatedAtMs = parsedMs;
            }
          } catch {
            // Keep stat-based timestamp.
          }
          sources.push({
            source: candidate.source,
            path: candidate.path,
            raw,
            updatedAtMs,
          });
        } catch {
          // Ignore missing candidate and continue.
        }
      }
      if (sources.length === 0) {
        return res.status(404).json({ message: "No reconciliation report found yet" });
      }
      sources.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      const chosen = sources[0];
      const raw = chosen.raw;
      const source = chosen.source;

      const report = JSON.parse(raw || "{}");
      if (Number(report?.leagueId) !== leagueId) {
        return res.status(404).json({ message: "No reconciliation report found for this league" });
      }
      if (String(report?.rosterType || "").toLowerCase() !== rosterTypeScope) {
        return res.status(404).json({ message: `No ${rosterTypeScope.toUpperCase()} reconciliation report found for this league` });
      }

      let normalizedCsvData: string | null = null;
      try {
        normalizedCsvData = await fs.readFile(normalizedCsvPath, "utf8");
      } catch {
        normalizedCsvData = null;
      }

      const unresolvedSourceRows = Array.isArray(report?.unresolved)
        ? report.unresolved
        : Array.isArray(report?.unresolvedRows)
          ? report.unresolvedRows
          : [];
      const unresolvedRows = unresolvedSourceRows
        .map((row: any, idx: number) => ({
            rowNum: Number(row?.rowNum) || idx + 2,
            playerName: String(row?.playerName || row?.player_name || "").trim(),
            teamAbbreviation: String(row?.teamAbbreviation || "").toUpperCase(),
            rosterType: (["mlb", "milb", "draft"].includes(String(row?.rosterType || "").toLowerCase())
              ? String(row?.rosterType || "").toLowerCase()
              : "milb") as "mlb" | "milb" | "draft",
            ageHint: row?.ageHint != null && Number.isFinite(Number(row.ageHint)) ? Number(row.ageHint) : null,
            mlbTeamHint: row?.mlbHint || row?.mlbTeamHint || null,
            orgHint: row?.orgHint || null,
            fangraphsId: row?.fangraphsId || null,
            resolutionHint: row?.resolutionHint || row?.hint || null,
            duplicateConflictKey: row?.duplicateConflictKey ? String(row.duplicateConflictKey) : null,
            duplicateTeamOptions: Array.isArray(row?.duplicateTeamOptions)
              ? row.duplicateTeamOptions
                  .map((o: any) => ({
                    userId: String(o?.userId || "").trim(),
                    teamAbbreviation: String(o?.teamAbbreviation || "").toUpperCase(),
                    rowNums: Array.isArray(o?.rowNums)
                      ? o.rowNums
                          .map((n: any) => Number(n))
                          .filter((n: number) => Number.isInteger(n) && n > 0)
                      : [],
                  }))
                  .filter((o: any) => o.userId && o.teamAbbreviation)
              : [],
            candidates: Array.isArray(row?.topCandidates)
              ? row.topCandidates.map((c: any) => ({
                  mlbApiId: Number(c?.mlbId),
                  fullName: String(c?.fullName || "").trim(),
                  age: c?.age != null && Number.isFinite(Number(c.age)) ? Number(c.age) : null,
                  currentTeamName: c?.currentTeam || c?.currentTeamName || null,
                  parentOrgName: c?.org || c?.parentOrgName || null,
                  sportLevel: String(c?.level || c?.sportLevel || ""),
                  lastActiveSeason: c?.lastActiveSeason != null && Number.isFinite(Number(c.lastActiveSeason)) ? Number(c.lastActiveSeason) : null,
                  score: Number.isFinite(Number(c?.score)) ? Number(c.score) : 0,
                }))
                  .filter((c: any) => Number.isInteger(c.mlbApiId) && c.mlbApiId > 0)
              : Array.isArray(row?.candidates)
                ? row.candidates.map((c: any) => ({
                    mlbApiId: Number(c?.mlbApiId || c?.mlbId),
                    fullName: String(c?.fullName || "").trim(),
                    age: c?.age != null && Number.isFinite(Number(c.age)) ? Number(c.age) : null,
                    currentTeamName: c?.currentTeamName || c?.currentTeam || null,
                    parentOrgName: c?.parentOrgName || c?.org || null,
                    sportLevel: String(c?.sportLevel || c?.level || ""),
                    lastActiveSeason: c?.lastActiveSeason != null && Number.isFinite(Number(c.lastActiveSeason)) ? Number(c.lastActiveSeason) : null,
                    score: Number.isFinite(Number(c?.score)) ? Number(c.score) : 0,
                  }))
                    .filter((c: any) => Number.isInteger(c.mlbApiId) && c.mlbApiId > 0)
                : [],
          }));
      const persistedCutRows = Array.isArray(report?.persistedCuts)
        ? Array.from(
            new Set(
              report.persistedCuts
                .map((c: any) => Number(c?.rowNum))
                .filter((n: number) => Number.isInteger(n) && n > 0),
            ),
          )
        : [];

      res.json({
        source,
        rosterType: rosterTypeScope,
        processed: Number(report?.processed || report?.inputRecords || 0),
        created: Number(report?.created || report?.inserted || 0),
        unresolvedCount: Number(report?.unresolvedCount || report?.unresolved || unresolvedRows.length || 0),
        errors: Array.isArray(report?.errors) ? report.errors : [],
        csvData: report?.csvData || normalizedCsvData,
        persistedCutRows,
        unresolved: unresolvedRows,
      });
    } catch (error) {
      console.error("Error loading latest roster reconciliation rows:", error);
      res.status(500).json({ message: "Failed to load latest roster reconciliation rows" });
    }
  });

  // Download reconciliation audit report for a scope (commissioner only)
  app.get("/api/leagues/:id/roster-reconciliation/audit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);
      const requestedRosterType = String(req.query?.rosterType || "milb").trim().toLowerCase();
      const rosterTypeScope =
        requestedRosterType === "mlb" || requestedRosterType === "milb" || requestedRosterType === "draft"
          ? requestedRosterType
          : "milb";
      const format = String(req.query?.format || "csv").trim().toLowerCase();

      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const latestSnapshotPathScoped = path.join(process.cwd(), "attached_assets", `roster-reconcile-latest-${rosterTypeScope}.json`);
      const raw = await fs.readFile(latestSnapshotPathScoped, "utf8");
      const report = JSON.parse(raw || "{}");
      if (Number(report?.leagueId) !== leagueId) {
        return res.status(404).json({ message: "No reconciliation report found for this league/scope" });
      }
      const season = Number(report?.season) || 2025;
      const csvData = String(report?.csvData || "").trim();
      if (!csvData) {
        return res.status(404).json({ message: "No uploaded CSV available for this scope yet" });
      }

      const unresolvedRows = Array.isArray(report?.unresolved) ? report.unresolved : [];
      const unresolvedRowNums = new Set<number>(
        unresolvedRows.map((r: any) => Number(r?.rowNum)).filter((n: number) => Number.isInteger(n) && n > 0),
      );
      const errorMap = new Map<number, string>();
      for (const err of Array.isArray(report?.errors) ? report.errors : []) {
        const match = /^Row\s+(\d+):\s*(.+)$/i.exec(String(err || ""));
        if (!match) continue;
        errorMap.set(Number(match[1]), match[2]);
      }
      const cutRows = new Set<number>(
        Array.isArray(report?.persistedCutRows)
          ? report.persistedCutRows.map((x: any) => Number(x)).filter((n: number) => Number.isInteger(n) && n > 0)
          : [],
      );

      const lines = csvData.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
      const detectDelimiter = (line: string) => {
        const comma = (line.match(/,/g) || []).length;
        const semicolon = (line.match(/;/g) || []).length;
        const tab = (line.match(/\t/g) || []).length;
        if (tab > comma && tab > semicolon) return "\t";
        if (semicolon > comma) return ";";
        return ",";
      };
      const delimiter = detectDelimiter(lines[0] || "");
      const normalizeHeader = (rawHeader: string) =>
        String(rawHeader || "").replace(/^\uFEFF/, "").replace(/^"+|"+$/g, "").trim().toLowerCase();
      const headers = (lines[0] || "").split(delimiter).map((h: string) => normalizeHeader(h));
      const mlbIdIdx = headers.findIndex((h: string) => ["mlb_api_id", "mlb_id", "mlbid", "player_id", "id"].includes(h));
      const nameIdx = headers.findIndex((h: string) => ["player_name", "name", "player", "full_name", "player full name"].includes(h));
      const firstNameIdx = headers.findIndex((h: string) => ["first_name", "first name", "firstname", "first", "fname"].includes(h));
      const lastNameIdx = headers.findIndex((h: string) => ["last_name", "last name", "lastname", "last", "lname"].includes(h));
      const abbrIdx = headers.findIndex((h: string) => ["team_abbreviation", "team_abbrev", "abbreviation", "team", "abbr", "cbl"].includes(h));
      const rosterTypeIdx = headers.findIndex((h: string) => ["roster_type", "roster type", "type", "scope"].includes(h));
      const resolvedRowMap = new Map<number, number>();
      if (Array.isArray(report?.resolvedRows)) {
        for (const row of report.resolvedRows) {
          const rowNum = Number(row?.rowNum);
          const mlbApiId = Number(row?.mlbApiId);
          if (!Number.isInteger(rowNum) || rowNum <= 0) continue;
          if (!Number.isInteger(mlbApiId) || mlbApiId <= 0) continue;
          resolvedRowMap.set(rowNum, mlbApiId);
        }
      }

      const csvRows: Array<{
        rowNum: number;
        teamAbbreviation: string;
        playerName: string;
        rosterType: string;
        inputMlbApiId: number | null;
        resolvedMlbApiIdFromMapping: number | null;
      }> = [];
      const apiIds = new Set<number>();
      for (let i = 1; i < lines.length; i++) {
        const rowNum = i + 1;
        const cols = lines[i].split(delimiter).map((c: string) => c.trim());
        const mlbRaw = mlbIdIdx >= 0 ? cols[mlbIdIdx] : "";
        const inputMlbApiId = Number.isInteger(Number(mlbRaw)) && Number(mlbRaw) > 0 ? Number(mlbRaw) : null;
        const resolvedMlbApiId = inputMlbApiId || resolvedRowMap.get(rowNum) || null;
        if (resolvedMlbApiId) apiIds.add(resolvedMlbApiId);
        const firstNameRaw = firstNameIdx >= 0 ? cols[firstNameIdx] : "";
        const lastNameRaw = lastNameIdx >= 0 ? cols[lastNameIdx] : "";
        const playerName = nameIdx >= 0 ? (cols[nameIdx] || "") : [firstNameRaw, lastNameRaw].filter(Boolean).join(" ").trim();
        const teamAbbreviation = (abbrIdx >= 0 ? cols[abbrIdx] : "").toUpperCase();
        const rawRosterType = (rosterTypeIdx >= 0 ? cols[rosterTypeIdx] : rosterTypeScope).toLowerCase();
        const rosterType = (rawRosterType === "mlb" || rawRosterType === "milb" || rawRosterType === "draft") ? rawRosterType : rosterTypeScope;
        csvRows.push({
          rowNum,
          teamAbbreviation,
          playerName,
          rosterType,
          inputMlbApiId,
          resolvedMlbApiIdFromMapping: resolvedMlbApiId,
        });
      }
      const rowsByResolvedMlbId = new Map<number, number[]>();
      for (const row of csvRows) {
        const resolvedMlbApiId = Number(row.resolvedMlbApiIdFromMapping);
        if (!Number.isInteger(resolvedMlbApiId) || resolvedMlbApiId <= 0) continue;
        const existing = rowsByResolvedMlbId.get(resolvedMlbApiId) || [];
        existing.push(row.rowNum);
        rowsByResolvedMlbId.set(resolvedMlbApiId, existing);
      }
      const duplicatePeersByRow = new Map<number, number[]>();
      for (const [, rowNums] of rowsByResolvedMlbId.entries()) {
        if (!Array.isArray(rowNums) || rowNums.length <= 1) continue;
        for (const rowNum of rowNums) {
          duplicatePeersByRow.set(
            rowNum,
            rowNums.filter((n) => n !== rowNum).sort((a, b) => a - b),
          );
        }
      }

      const players = await storage.getMlbPlayersByMlbIdsWithSeasonFallback(Array.from(apiIds), season);
      const playerByMlbApiId = new Map<number, any>();
      for (const p of players) playerByMlbApiId.set(Number(p.mlbId), p);
      const assignments = await storage.getLeagueRosterAssignments(leagueId, season);
      const assignmentByPlayerId = new Map<number, any>();
      for (const a of assignments) assignmentByPlayerId.set(Number(a.mlbPlayerId), a);
      const memberByAbbr = new Map<string, string>();
      const abbrByUserId = new Map<string, string>();
      const members = await storage.getLeagueMembers(leagueId);
      for (const member of members) {
        const abbr = String(member.teamAbbreviation || "").toUpperCase();
        if (abbr) {
          memberByAbbr.set(abbr, member.userId);
          abbrByUserId.set(member.userId, abbr);
        }
      }
      const normalizeAuditName = (value: string) =>
        String(value || "")
          .replace(/\([^)]*\)/g, " ")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      const assignmentsByScope = assignments.filter((a: any) => String(a.rosterType) === rosterTypeScope);
      const assignmentsByTeam = new Map<string, any[]>();
      for (const a of assignmentsByScope) {
        const existing = assignmentsByTeam.get(a.userId) || [];
        existing.push(a);
        assignmentsByTeam.set(a.userId, existing);
      }

      const auditRows = csvRows.map((row) => {
        if (cutRows.has(row.rowNum)) {
          return { ...row, resolvedMlbApiId: null, status: "cut", detail: "Row marked cut." };
        }
        if (duplicatePeersByRow.has(row.rowNum)) {
          const resolvedMlbApiId = row.resolvedMlbApiIdFromMapping;
          const peers = duplicatePeersByRow.get(row.rowNum) || [];
          const peerText =
            peers.length === 1
              ? `row ${peers[0]}`
              : `rows ${peers.join(", ")}`;
          return {
            ...row,
            resolvedMlbApiId: resolvedMlbApiId ?? null,
            status: "duplicate_in_upload",
            detail: `Duplicate of ${peerText} for the same MLB API ID in this upload.`,
          };
        }
        const error = errorMap.get(row.rowNum);
        if (error) {
          return { ...row, resolvedMlbApiId: null, status: "error", detail: error };
        }
        if (unresolvedRowNums.has(row.rowNum)) {
          return { ...row, resolvedMlbApiId: null, status: "unresolved", detail: "Needs commissioner review." };
        }
        const resolvedMlbApiId = row.resolvedMlbApiIdFromMapping;
        if (resolvedMlbApiId) {
          const player = playerByMlbApiId.get(resolvedMlbApiId);
          const assignment = player ? assignmentByPlayerId.get(Number(player.id)) : null;
          if (assignment) {
            return {
              ...row,
              resolvedMlbApiId,
              status: "assigned",
              detail: `Assigned to ${assignment.rosterType.toUpperCase()} roster.`,
            };
          }
          return { ...row, resolvedMlbApiId, status: "not_assigned", detail: "No assignment found yet." };
        }
        const teamUserId = memberByAbbr.get(row.teamAbbreviation);
        if (teamUserId && row.playerName) {
          const needle = normalizeAuditName(row.playerName);
          if (needle) {
            const candidates = (assignmentsByTeam.get(teamUserId) || []).filter((a: any) => {
              const names = [
                a?.player?.fullName,
                a?.player?.fullFmlName,
                a?.player?.fullFMLName,
                [a?.player?.firstName, a?.player?.middleName, a?.player?.lastName].filter(Boolean).join(" "),
              ]
                .map((n) => normalizeAuditName(String(n || "")))
                .filter(Boolean);
              return names.includes(needle);
            });
            if (candidates.length === 1) {
              const candidate = candidates[0];
              const candidateMlbId = Number(candidate?.player?.mlbId);
              if (Number.isInteger(candidateMlbId) && candidateMlbId > 0) {
                return {
                  ...row,
                  resolvedMlbApiId: candidateMlbId,
                  status: "assigned",
                  detail: `Assigned to ${candidate.rosterType.toUpperCase()} roster (name/team fallback).`,
                };
              }
            }
            const crossTeamMatches = assignmentsByScope.filter((a: any) => {
              const names = [
                a?.player?.fullName,
                a?.player?.fullFmlName,
                a?.player?.fullFMLName,
                [a?.player?.firstName, a?.player?.middleName, a?.player?.lastName].filter(Boolean).join(" "),
              ]
                .map((n) => normalizeAuditName(String(n || "")))
                .filter(Boolean);
              return names.includes(needle);
            });
            if (crossTeamMatches.length > 0) {
              const uniqueTeams = Array.from(new Set(crossTeamMatches.map((a: any) => String(abbrByUserId.get(String(a.userId)) || a.userId))));
              const uniqueMlbIds = Array.from(
                new Set(
                  crossTeamMatches
                    .map((a: any) => Number(a?.player?.mlbId))
                    .filter((id: number) => Number.isInteger(id) && id > 0),
                ),
              );
              if (uniqueMlbIds.length === 1) {
                const assignedTeamText = uniqueTeams.length === 1 ? uniqueTeams[0] : uniqueTeams.join(", ");
                return {
                  ...row,
                  resolvedMlbApiId: uniqueMlbIds[0],
                  status: "assigned_other_team",
                  detail: `Matched by name to MLB API ID ${uniqueMlbIds[0]}, already assigned to team ${assignedTeamText}.`,
                };
              }
              if (uniqueMlbIds.length > 1) {
                return {
                  ...row,
                  resolvedMlbApiId: null,
                  status: "assigned_other_team_ambiguous",
                  detail: `Name matches players already assigned to other teams (${uniqueTeams.join(", ")}).`,
                };
              }
            }
          }
        }
        return { ...row, resolvedMlbApiId: null, status: "no_mlb_id", detail: "No MLB API ID on row." };
      });

      if (format === "json") {
        return res.json({
          leagueId,
          season,
          rosterType: rosterTypeScope,
          generatedAt: new Date().toISOString(),
          rowCount: auditRows.length,
          rows: auditRows,
        });
      }

      const csvEscape = (value: unknown) => {
        const rawValue = String(value ?? "");
        if (rawValue.includes(",") || rawValue.includes("\"") || rawValue.includes("\n") || rawValue.includes("\r")) {
          return `"${rawValue.replace(/"/g, "\"\"")}"`;
        }
        return rawValue;
      };
      const header = [
        "row_num",
        "team_abbreviation",
        "player_name",
        "roster_type",
        "input_mlb_api_id",
        "resolved_mlb_api_id",
        "status",
        "detail",
      ].join(",");
      const linesOut = auditRows.map((row) =>
        [
          row.rowNum,
          row.teamAbbreviation,
          row.playerName,
          row.rosterType,
          row.inputMlbApiId ?? "",
          row.resolvedMlbApiId ?? "",
          row.status,
          row.detail,
        ].map(csvEscape).join(","),
      );
      const csvOut = [header, ...linesOut].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"reconciliation-audit-${rosterTypeScope}-${season}.csv\"`);
      return res.status(200).send(csvOut);
    } catch (error: any) {
      console.error("Error generating reconciliation audit report:", error);
      return res.status(500).json({ message: "Failed to generate reconciliation audit report" });
    }
  });

  // Commissioner: reset reconciliation state for a specific scope (mlb/milb/draft)
  app.post("/api/leagues/:id/roster-reconciliation/reset", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const leagueId = parseInt(req.params.id);
      const requestedRosterType = String(req.body?.rosterType || req.query?.rosterType || "milb").trim().toLowerCase();
      const rosterTypeScope =
        requestedRosterType === "mlb" || requestedRosterType === "milb" || requestedRosterType === "draft"
          ? requestedRosterType
          : "milb";
      const season = Number(req.body?.season) || 2025;

      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const progressPath = path.join(process.cwd(), "attached_assets", `roster-reconcile-progress-${rosterTypeScope}.json`);
      const latestSnapshotPath = path.join(process.cwd(), "attached_assets", `roster-reconcile-latest-${rosterTypeScope}.json`);
      const rulesPath = path.join(process.cwd(), "attached_assets", `roster-reconcile-rules-${rosterTypeScope}.json`);

      const resetProgress = {
        leagueId,
        season,
        rosterType: rosterTypeScope,
        updatedAt: new Date().toISOString(),
        running: false,
        processed: 0,
        totalRows: 0,
        percent: 0,
        stage: "awaiting_resolution",
        message: "Reset",
      };
      const resetLatest = {
        leagueId,
        season,
        rosterType: rosterTypeScope,
        updatedAt: new Date().toISOString(),
        processed: 0,
        created: 0,
        unresolvedCount: 0,
        unresolved: [],
        errors: [],
        warnings: [`${rosterTypeScope.toUpperCase()} reconciliation state was reset.`],
        csvData: "",
        persistedCuts: [],
      };
      const resetRules = {
        leagueId,
        rosterType: rosterTypeScope,
        updatedAt: new Date().toISOString(),
        nameTeamRules: {},
        duplicateTeamRules: {},
      };

      await Promise.all([
        fs.writeFile(progressPath, JSON.stringify(resetProgress, null, 2), "utf8"),
        fs.writeFile(latestSnapshotPath, JSON.stringify(resetLatest, null, 2), "utf8"),
        fs.writeFile(rulesPath, JSON.stringify(resetRules, null, 2), "utf8"),
      ]);

      return res.json({ success: true, rosterType: rosterTypeScope });
    } catch (error: any) {
      console.error("Error resetting reconciliation scope state:", error);
      return res.status(500).json({ message: "Failed to reset reconciliation scope state" });
    }
  });

  // Owner/Commissioner: DFA a won free agent to free roster capacity
  app.post("/api/free-agents/:id/dfa", isAuthenticated, async (req: any, res) => {
    try {
      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const agentId = parseInt(req.params.id);
      const agent = await storage.getFreeAgent(agentId);

      if (!agent) {
        return res.status(404).json({ message: "Free agent not found" });
      }
      if (!agent.auctionId) {
        return res.status(400).json({ message: "Player is not associated with an auction" });
      }
      if (!agent.winnerId) {
        return res.status(400).json({ message: "Player is not currently assigned to a winner" });
      }

      const isCommissioner = await hasAuctionCommissionerAccess(sessionUserId, agent.auctionId);
      const isOwner = agent.winnerId === sessionUserId;
      if (!isCommissioner && !isOwner) {
        return res.status(403).json({ message: "Only the winning owner or a commissioner can DFA this player" });
      }

      const updated = await storage.dfaFreeAgent(agentId);
      res.json({ success: true, message: `${agent.name} has been designated for assignment`, player: updated });
    } catch (error) {
      console.error("Error DFA-ing free agent:", error);
      res.status(500).json({ message: "Failed to DFA player" });
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
      const adminId = req.session.originalUserId || req.session.userId!;
      const targetUserId = req.params.id;
      const leagueId = req.query.leagueId ? Number(req.query.leagueId) : undefined;
      const { email, firstName, lastName, teamName, teamAbbreviation } = req.body;

      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (leagueId && Number.isFinite(leagueId)) {
        if (!await hasLeagueCommissionerAccess(adminId, leagueId)) {
          return res.status(403).json({ message: "Commissioner access required for this league" });
        }
        const targetMembership = await storage.getLeagueMember(leagueId, targetUserId);
        if (!targetMembership) {
          return res.status(404).json({ message: "Target user is not a member of this league" });
        }
      } else {
        const admin = await storage.getUser(adminId);
        if (!admin?.isCommissioner && !admin?.isSuperAdmin) {
          return res.status(403).json({ message: "Commissioner access required" });
        }
      }

      // If changing email, check it's not already taken
      if (email && email !== targetUser.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ message: "Email already in use by another user" });
        }
      }

      // User identity fields are global; league team identity fields are league-scoped.
      const updatedUser = await storage.updateUserDetails(targetUserId, {
        email,
        firstName,
        lastName,
        teamName: leagueId ? undefined : teamName,
        teamAbbreviation: leagueId ? undefined : teamAbbreviation,
      });

      let updatedMember: any = undefined;
      if (leagueId && Number.isFinite(leagueId) && (teamName !== undefined || teamAbbreviation !== undefined)) {
        updatedMember = await storage.updateLeagueMember(leagueId, targetUserId, {
          teamName,
          teamAbbreviation: teamAbbreviation?.toUpperCase().slice(0, 3),
        } as any);
      }

      res.json({
        ...updatedUser,
        teamName: updatedMember?.teamName ?? updatedUser?.teamName,
        teamAbbreviation: updatedMember?.teamAbbreviation ?? updatedUser?.teamAbbreviation,
      });
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

  const transferLeagueTeamOwnership = async (params: {
    leagueId: number;
    fromUserId: string;
    toUserId: string;
    teamName: string | null;
    teamAbbreviation: string | null;
  }) => {
    const {
      leagueId,
      fromUserId,
      toUserId,
      teamName,
      teamAbbreviation,
    } = params;

    await db.transaction(async (tx) => {
      const [toMembership] = await tx
        .select()
        .from(leagueMembers)
        .where(and(
          eq(leagueMembers.leagueId, leagueId),
          eq(leagueMembers.userId, toUserId),
        ));

      const leagueAuctionRows = await tx
        .select({ id: auctions.id })
        .from(auctions)
        .where(eq(auctions.leagueId, leagueId));
      const leagueAuctionIds = leagueAuctionRows.map((a) => a.id);

      const leagueDraftRows = await tx
        .select({ id: drafts.id })
        .from(drafts)
        .where(eq(drafts.leagueId, leagueId));
      const leagueDraftIds = leagueDraftRows.map((d) => d.id);

      // Roster data moves with the team identity.
      await tx
        .update(rosterPlayers)
        .set({ userId: toUserId, updatedAt: new Date() })
        .where(and(
          eq(rosterPlayers.leagueId, leagueId),
          eq(rosterPlayers.userId, fromUserId),
        ));

      await tx
        .update(leagueRosterAssignments)
        .set({ userId: toUserId })
        .where(and(
          eq(leagueRosterAssignments.leagueId, leagueId),
          eq(leagueRosterAssignments.userId, fromUserId),
        ));

      if (leagueAuctionIds.length > 0) {
        const existingToAuctionTeams = await tx
          .select({ auctionId: auctionTeams.auctionId })
          .from(auctionTeams)
          .where(and(
            inArray(auctionTeams.auctionId, leagueAuctionIds),
            eq(auctionTeams.userId, toUserId),
          ));
        const toAuctionSet = new Set(existingToAuctionTeams.map((r) => r.auctionId));
        const transferAuctionIds = leagueAuctionIds.filter((id) => !toAuctionSet.has(id));
        const deleteAuctionIds = leagueAuctionIds.filter((id) => toAuctionSet.has(id));

        if (transferAuctionIds.length > 0) {
          await tx
            .update(auctionTeams)
            .set({ userId: toUserId, updatedAt: new Date() })
            .where(and(
              inArray(auctionTeams.auctionId, transferAuctionIds),
              eq(auctionTeams.userId, fromUserId),
            ));
        }

        if (deleteAuctionIds.length > 0) {
          await tx
            .delete(auctionTeams)
            .where(and(
              inArray(auctionTeams.auctionId, deleteAuctionIds),
              eq(auctionTeams.userId, fromUserId),
            ));
        }
      }

      if (leagueDraftIds.length > 0) {
        await tx
          .update(draftOrder)
          .set({ userId: toUserId })
          .where(and(
            inArray(draftOrder.draftId, leagueDraftIds),
            eq(draftOrder.userId, fromUserId),
          ));

        await tx
          .update(draftPicks)
          .set({ userId: toUserId })
          .where(and(
            inArray(draftPicks.draftId, leagueDraftIds),
            eq(draftPicks.userId, fromUserId),
          ));

        await tx
          .update(autoDraftLists)
          .set({ userId: toUserId })
          .where(and(
            inArray(autoDraftLists.draftId, leagueDraftIds),
            eq(autoDraftLists.userId, fromUserId),
          ));
      }

      await tx
        .update(leagueMembers)
        .set({
          teamName: null,
          teamAbbreviation: null,
          updatedAt: new Date(),
        })
        .where(and(
          eq(leagueMembers.leagueId, leagueId),
          eq(leagueMembers.userId, fromUserId),
        ));

      if (toMembership) {
        await tx
          .update(leagueMembers)
          .set({
            role: "owner",
            teamName,
            teamAbbreviation: teamAbbreviation || null,
            isArchived: false,
            updatedAt: new Date(),
          })
          .where(and(
            eq(leagueMembers.leagueId, leagueId),
            eq(leagueMembers.userId, toUserId),
          ));
      } else {
        await tx.insert(leagueMembers).values({
          leagueId,
          userId: toUserId,
          role: "owner",
          teamName,
          teamAbbreviation: teamAbbreviation || null,
          isArchived: false,
        } as any);
      }
    });
  };

  // Commissioner: invite an email to assume ownership of a league team.
  app.post("/api/leagues/:id/team-invites", isAuthenticated, async (req: any, res) => {
    try {
      const leagueId = parseInt(req.params.id, 10);
      if (isNaN(leagueId)) return res.status(400).json({ message: "Invalid league ID" });

      const sessionUserId = req.session.originalUserId || req.session.userId!;
      if (!await hasLeagueCommissionerAccess(sessionUserId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const teamUserId = String(req.body?.teamUserId || "").trim();
      const invitedEmail = normalizeEmail(req.body?.email || "");
      if (!teamUserId) return res.status(400).json({ message: "teamUserId is required" });
      if (!invitedEmail) return res.status(400).json({ message: "email is required" });

      const [teamMember] = await db
        .select()
        .from(leagueMembers)
        .where(and(
          eq(leagueMembers.leagueId, leagueId),
          eq(leagueMembers.userId, teamUserId),
          eq(leagueMembers.isArchived, false),
        ));
      if (!teamMember) {
        return res.status(404).json({ message: "Team owner not found in this league" });
      }
      if (!teamMember.teamName && !teamMember.teamAbbreviation) {
        return res.status(400).json({ message: "Selected member does not have a team identity to transfer" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresDays = Number(req.body?.expiresDays) > 0 ? Number(req.body.expiresDays) : 7;
      const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

      const [invite] = await db.insert(teamOwnershipInvites).values({
        leagueId,
        teamUserId,
        invitedEmail,
        token,
        invitedByUserId: sessionUserId,
        status: "pending",
        expiresAt,
      } as any).returning();

      const protocol = req.headers["x-forwarded-proto"] || "http";
      const host = req.headers.host || "localhost:5000";
      const inviteUrl = `${protocol}://${host}/team-invite?token=${token}`;

      res.status(201).json({
        invite,
        inviteUrl,
      });
    } catch (error) {
      console.error("Error creating team ownership invite:", error);
      res.status(500).json({ message: "Failed to create invite" });
    }
  });

  app.get("/api/leagues/:id/team-invites", isAuthenticated, async (req: any, res) => {
    try {
      const leagueId = parseInt(req.params.id, 10);
      if (isNaN(leagueId)) return res.status(400).json({ message: "Invalid league ID" });

      const sessionUserId = req.session.originalUserId || req.session.userId!;
      if (!await hasLeagueCommissionerAccess(sessionUserId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      await db
        .update(teamOwnershipInvites)
        .set({ status: "expired" })
        .where(and(
          eq(teamOwnershipInvites.leagueId, leagueId),
          eq(teamOwnershipInvites.status, "pending"),
          sql`${teamOwnershipInvites.expiresAt} < now()`,
        ));

      const rows = await db
        .select({
          invite: teamOwnershipInvites,
          member: leagueMembers,
        })
        .from(teamOwnershipInvites)
        .leftJoin(leagueMembers, and(
          eq(leagueMembers.leagueId, teamOwnershipInvites.leagueId),
          eq(leagueMembers.userId, teamOwnershipInvites.teamUserId),
        ))
        .where(eq(teamOwnershipInvites.leagueId, leagueId))
        .orderBy(sql`${teamOwnershipInvites.createdAt} desc`);

      res.json(rows.map((r) => ({
        ...r.invite,
        teamName: r.member?.teamName || null,
        teamAbbreviation: r.member?.teamAbbreviation || null,
      })));
    } catch (error) {
      console.error("Error listing team ownership invites:", error);
      res.status(500).json({ message: "Failed to fetch invites" });
    }
  });

  app.delete("/api/leagues/:id/team-invites/:inviteId", isAuthenticated, async (req: any, res) => {
    try {
      const leagueId = parseInt(req.params.id, 10);
      const inviteId = parseInt(req.params.inviteId, 10);
      if (isNaN(leagueId) || isNaN(inviteId)) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const sessionUserId = req.session.originalUserId || req.session.userId!;
      if (!await hasLeagueCommissionerAccess(sessionUserId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const [updated] = await db
        .update(teamOwnershipInvites)
        .set({ status: "cancelled" })
        .where(and(
          eq(teamOwnershipInvites.id, inviteId),
          eq(teamOwnershipInvites.leagueId, leagueId),
          eq(teamOwnershipInvites.status, "pending"),
        ))
        .returning();

      if (!updated) return res.status(404).json({ message: "Pending invite not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error cancelling team invite:", error);
      res.status(500).json({ message: "Failed to cancel invite" });
    }
  });

  // Public: inspect invite token before login/accept.
  app.get("/api/team-invites/:token", async (req: any, res) => {
    try {
      const token = String(req.params.token || "").trim();
      if (!token) return res.status(400).json({ message: "Invalid token" });

      const [invite] = await db
        .select()
        .from(teamOwnershipInvites)
        .where(eq(teamOwnershipInvites.token, token));
      if (!invite) return res.status(404).json({ message: "Invite not found" });

      if (invite.status !== "pending") {
        return res.json({ invite, valid: false, reason: `Invite is ${invite.status}` });
      }
      if (new Date(invite.expiresAt) < new Date()) {
        await db.update(teamOwnershipInvites).set({ status: "expired" }).where(eq(teamOwnershipInvites.id, invite.id));
        return res.json({ invite: { ...invite, status: "expired" }, valid: false, reason: "Invite has expired" });
      }

      const [league] = await db.select().from(leagues).where(eq(leagues.id, invite.leagueId));
      const [teamMember] = await db
        .select()
        .from(leagueMembers)
        .where(and(
          eq(leagueMembers.leagueId, invite.leagueId),
          eq(leagueMembers.userId, invite.teamUserId),
        ));
      const invitedUser = await storage.getUserByEmail(invite.invitedEmail);

      res.json({
        valid: true,
        invite,
        leagueName: league?.name || null,
        teamName: teamMember?.teamName || null,
        teamAbbreviation: teamMember?.teamAbbreviation || null,
        invitedEmail: invite.invitedEmail,
        hasExistingAccount: !!invitedUser,
      });
    } catch (error) {
      console.error("Error validating team invite token:", error);
      res.status(500).json({ message: "Failed to validate invite" });
    }
  });

  // Existing user acceptance (must be logged in as invite email)
  app.post("/api/team-invites/:token/accept", isAuthenticated, async (req: any, res) => {
    try {
      const token = String(req.params.token || "").trim();
      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const sessionUser = await storage.getUser(sessionUserId);
      if (!sessionUser) return res.status(401).json({ message: "Unauthorized" });

      const [invite] = await db.select().from(teamOwnershipInvites).where(eq(teamOwnershipInvites.token, token));
      if (!invite) return res.status(404).json({ message: "Invite not found" });
      if (invite.status !== "pending") return res.status(400).json({ message: `Invite is ${invite.status}` });
      if (new Date(invite.expiresAt) < new Date()) {
        await db.update(teamOwnershipInvites).set({ status: "expired" }).where(eq(teamOwnershipInvites.id, invite.id));
        return res.status(400).json({ message: "Invite has expired" });
      }
      if (normalizeEmail(sessionUser.email) !== normalizeEmail(invite.invitedEmail)) {
        return res.status(403).json({ message: `You must sign in as ${invite.invitedEmail} to accept this invite` });
      }

      const [teamMember] = await db
        .select()
        .from(leagueMembers)
        .where(and(
          eq(leagueMembers.leagueId, invite.leagueId),
          eq(leagueMembers.userId, invite.teamUserId),
        ));
      if (!teamMember) return res.status(404).json({ message: "Source team is no longer available" });

      await transferLeagueTeamOwnership({
        leagueId: invite.leagueId,
        fromUserId: invite.teamUserId,
        toUserId: sessionUser.id,
        teamName: teamMember.teamName || null,
        teamAbbreviation: teamMember.teamAbbreviation || null,
      });

      await db
        .update(teamOwnershipInvites)
        .set({
          status: "accepted",
          acceptedByUserId: sessionUser.id,
          acceptedAt: new Date(),
        })
        .where(eq(teamOwnershipInvites.id, invite.id));

      res.json({ message: "Team ownership transferred successfully" });
    } catch (error) {
      console.error("Error accepting team invite:", error);
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  // New user registration + acceptance in one step
  app.post("/api/team-invites/:token/register", async (req: any, res) => {
    try {
      const token = String(req.params.token || "").trim();
      const firstName = String(req.body?.firstName || "").trim() || null;
      const lastName = String(req.body?.lastName || "").trim() || null;
      const password = String(req.body?.password || "");
      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const [invite] = await db.select().from(teamOwnershipInvites).where(eq(teamOwnershipInvites.token, token));
      if (!invite) return res.status(404).json({ message: "Invite not found" });
      if (invite.status !== "pending") return res.status(400).json({ message: `Invite is ${invite.status}` });
      if (new Date(invite.expiresAt) < new Date()) {
        await db.update(teamOwnershipInvites).set({ status: "expired" }).where(eq(teamOwnershipInvites.id, invite.id));
        return res.status(400).json({ message: "Invite has expired" });
      }

      const existing = await storage.getUserByEmail(invite.invitedEmail);
      if (existing) {
        return res.status(400).json({ message: "An account already exists for this email. Please sign in and accept the invite." });
      }

      const passwordHash = await hashPassword(password);
      const createdUser = await storage.createUserWithPassword({
        email: invite.invitedEmail,
        passwordHash,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        isCommissioner: false,
        mustResetPassword: false,
      });

      const [teamMember] = await db
        .select()
        .from(leagueMembers)
        .where(and(
          eq(leagueMembers.leagueId, invite.leagueId),
          eq(leagueMembers.userId, invite.teamUserId),
        ));
      if (!teamMember) return res.status(404).json({ message: "Source team is no longer available" });

      await transferLeagueTeamOwnership({
        leagueId: invite.leagueId,
        fromUserId: invite.teamUserId,
        toUserId: createdUser.id,
        teamName: teamMember.teamName || null,
        teamAbbreviation: teamMember.teamAbbreviation || null,
      });

      await db
        .update(teamOwnershipInvites)
        .set({
          status: "accepted",
          acceptedByUserId: createdUser.id,
          acceptedAt: new Date(),
        })
        .where(eq(teamOwnershipInvites.id, invite.id));

      req.session.regenerate((err: any) => {
        if (err) return res.status(500).json({ message: "Session error" });
        req.session.userId = createdUser.id;
        req.session.save((saveErr: any) => {
          if (saveErr) return res.status(500).json({ message: "Session error" });
          res.status(201).json({
            message: "Account created and invite accepted",
            user: {
              id: createdUser.id,
              email: createdUser.email,
              firstName: createdUser.firstName,
              lastName: createdUser.lastName,
            },
          });
        });
      });
    } catch (error) {
      console.error("Error registering from team invite:", error);
      res.status(500).json({ message: "Failed to register from invite" });
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

  // ==================== Draft Routes ====================

  // GET /api/drafts - Get all drafts for a league
  app.get("/api/drafts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const leagueId = parseInt(req.query.leagueId);
      if (isNaN(leagueId)) {
        return res.status(400).json({ message: "leagueId query parameter is required" });
      }

      const membership = await storage.getLeagueMember(leagueId, userId);
      const user = await storage.getUser(userId);
      if (!membership && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Not a member of this league" });
      }

      const allDrafts = await storage.getDraftsByLeague(leagueId);
      res.json(allDrafts);
    } catch (error) {
      console.error("Error fetching drafts:", error);
      res.status(500).json({ message: "Failed to fetch drafts" });
    }
  });

  // GET /api/drafts/:id - Get a specific draft with details
  app.get("/api/drafts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid draft ID" });
      }

      const draft = await storage.getDraft(id);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      const membership = await storage.getLeagueMember(draft.leagueId, userId);
      const user = await storage.getUser(userId);
      if (!membership && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Not a member of this league" });
      }

      res.json(draft);
    } catch (error) {
      console.error("Error fetching draft:", error);
      res.status(500).json({ message: "Failed to fetch draft" });
    }
  });

  // POST /api/drafts - Create a draft
  app.post("/api/drafts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const { name, leagueId, season, rounds, snake, pickDurationMinutes, teamDraftRound } = req.body;

      if (!name || !leagueId || !season) {
        return res.status(400).json({ message: "name, leagueId, and season are required" });
      }

      if (!await hasLeagueCommissionerAccess(userId, leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const draft = await storage.createDraft({
        name,
        leagueId,
        season,
        rounds: rounds || 1,
        snake: snake !== undefined ? snake : true,
        pickDurationMinutes: pickDurationMinutes || 30,
        teamDraftRound: teamDraftRound || null,
        status: "setup",
        createdBy: userId,
      });

      res.status(201).json(draft);
    } catch (error) {
      console.error("Error creating draft:", error);
      res.status(500).json({ message: "Failed to create draft" });
    }
  });

  // PATCH /api/drafts/:id - Update draft settings
  app.patch("/api/drafts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid draft ID" });
      }

      const draft = await storage.getDraft(id);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (draft.status !== "setup") {
        return res.status(400).json({ message: "Can only update drafts in setup status" });
      }

      if (!await hasLeagueCommissionerAccess(userId, draft.leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { name, rounds, snake, pickDurationMinutes, teamDraftRound } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (rounds !== undefined) updateData.rounds = rounds;
      if (snake !== undefined) updateData.snake = snake;
      if (pickDurationMinutes !== undefined) updateData.pickDurationMinutes = pickDurationMinutes;
      if (teamDraftRound !== undefined) updateData.teamDraftRound = teamDraftRound;

      const updated = await storage.updateDraft(id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating draft:", error);
      res.status(500).json({ message: "Failed to update draft" });
    }
  });

  // DELETE /api/drafts/:id - Delete a draft
  app.delete("/api/drafts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid draft ID" });
      }

      const draft = await storage.getDraft(id);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (draft.status !== "setup") {
        return res.status(400).json({ message: "Can only delete drafts in setup status" });
      }

      if (!await hasLeagueCommissionerAccess(userId, draft.leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      await storage.deleteDraft(id);
      res.json({ message: "Draft deleted successfully" });
    } catch (error) {
      console.error("Error deleting draft:", error);
      res.status(500).json({ message: "Failed to delete draft" });
    }
  });

  // POST /api/drafts/:id/start - Start the draft
  app.post("/api/drafts/:id/start", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid draft ID" });
      }

      const draft = await storage.getDraft(id);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (draft.status !== "setup") {
        return res.status(400).json({ message: "Draft is not in setup status" });
      }

      if (!await hasLeagueCommissionerAccess(userId, draft.leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const playerCount = await storage.getDraftPlayerCount(id);
      if (playerCount === 0) {
        return res.status(400).json({ message: "Draft must have players in the pool before starting" });
      }

      const order = await storage.getDraftOrder(id);
      if (order.length === 0) {
        return res.status(400).json({ message: "Draft order must be set before starting" });
      }

      const rounds = await storage.getDraftRounds(id);
      if (rounds.length === 0) {
        return res.status(400).json({ message: "Draft rounds must be configured before starting" });
      }
      const sortedRounds = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
      for (let i = 0; i < sortedRounds.length; i++) {
        const round = sortedRounds[i];
        if (!round.startTime) {
          return res.status(400).json({ message: `Round ${round.roundNumber} must have a start time` });
        }
        const roundOrder = await storage.getDraftOrder(id, round.roundNumber);
        if (roundOrder.length === 0) {
          return res.status(400).json({ message: `Draft order must be set for round ${round.roundNumber} before starting` });
        }

        if (i > 0) {
          const prevRound = sortedRounds[i - 1];
          const prevOrder = await storage.getDraftOrder(id, prevRound.roundNumber);
          const prevPickCount = prevOrder.length;
          const prevDurationMs = (prevRound.pickDurationMinutes || 30) * 60 * 1000;
          const prevEndMs = new Date(prevRound.startTime!).getTime() + prevPickCount * prevDurationMs;
          const thisStartMs = new Date(round.startTime).getTime();
          if (thisStartMs < prevEndMs) {
            const prevEndDate = new Date(prevEndMs);
            return res.status(400).json({
              message: `Round ${round.roundNumber} starts before Round ${prevRound.roundNumber} finishes. Round ${prevRound.roundNumber} ends at ${prevEndDate.toLocaleString("en-US", { timeZone: "America/Chicago" })} CT. Please adjust the start time.`,
            });
          }
        }
      }

      await storage.createDraftPickSlotsForAllRounds(id);

      const updated = await storage.updateDraft(id, {
        status: "active",
        currentRound: 1,
        currentPickIndex: 0,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error starting draft:", error);
      res.status(500).json({ message: "Failed to start draft" });
    }
  });

  // POST /api/drafts/:id/complete - Complete the draft manually
  app.post("/api/drafts/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid draft ID" });
      }

      const draft = await storage.getDraft(id);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (!await hasLeagueCommissionerAccess(userId, draft.leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const updated = await storage.updateDraft(id, { status: "completed" });
      res.json(updated);
    } catch (error) {
      console.error("Error completing draft:", error);
      res.status(500).json({ message: "Failed to complete draft" });
    }
  });

  // POST /api/drafts/:id/pause - Pause an active draft
  app.post("/api/drafts/:id/pause", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid draft ID" });
      }

      const draft = await storage.getDraft(id);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (draft.status !== "active") {
        return res.status(400).json({ message: "Draft must be active to pause" });
      }

      if (!await hasLeagueCommissionerAccess(userId, draft.leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const updated = await storage.updateDraft(id, { status: "paused" });
      res.json(updated);
    } catch (error) {
      console.error("Error pausing draft:", error);
      res.status(500).json({ message: "Failed to pause draft" });
    }
  });

  // POST /api/drafts/:id/resume - Resume a paused draft
  app.post("/api/drafts/:id/resume", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid draft ID" });
      }

      const draft = await storage.getDraft(id);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (draft.status !== "paused") {
        return res.status(400).json({ message: "Draft must be paused to resume" });
      }

      if (!await hasLeagueCommissionerAccess(userId, draft.leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const rounds = await storage.getDraftRounds(id);
      const allPicks = await storage.getDraftPicks(id);
      for (const round of rounds) {
        if (!round.startTime) continue;
        const roundStartMs = new Date(round.startTime).getTime();
        const pickDurationMs = (round.pickDurationMinutes || 30) * 60 * 1000;
        const roundPicks = allPicks
          .filter((p) => p.round === round.roundNumber)
          .sort((a, b) => a.roundPickIndex - b.roundPickIndex);
        for (const pick of roundPicks) {
          if (pick.madeAt) continue;
          const idx = pick.roundPickIndex;
          const scheduledAt = new Date(roundStartMs + idx * pickDurationMs);
          const deadlineAt = new Date(roundStartMs + (idx + 1) * pickDurationMs);
          await storage.updateDraftPick(pick.id, { scheduledAt, deadlineAt });
        }
      }

      const updated = await storage.updateDraft(id, { status: "active" });
      setTimeout(() => processAutoDraft(id, storage), 500);
      res.json(updated);
    } catch (error) {
      console.error("Error resuming draft:", error);
      res.status(500).json({ message: "Failed to resume draft" });
    }
  });

  // GET /api/drafts/:id/players - Get draft player pool
  app.get("/api/drafts/:id/players", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid draft ID" });
      }

      const draft = await storage.getDraft(id);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      const membership = await storage.getLeagueMember(draft.leagueId, userId);
      const user = await storage.getUser(userId);
      if (!membership && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Not a member of this league" });
      }

      const filters: { status?: string; search?: string } = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.search) filters.search = req.query.search;

      const players = await storage.getDraftPlayers(id, filters);
      res.json(players);
    } catch (error) {
      console.error("Error fetching draft players:", error);
      res.status(500).json({ message: "Failed to fetch draft players" });
    }
  });

  // POST /api/drafts/:id/players/upload - Upload MLB player IDs to draft pool
  app.post("/api/drafts/:id/players/upload", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid draft ID" });
      }

      const draft = await storage.getDraft(id);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (draft.status !== "setup") {
        return res.status(400).json({ message: "Can only add players when draft is in setup status" });
      }

      if (!await hasLeagueCommissionerAccess(userId, draft.leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { mlbIds, middleNamesByMlbId, minorLeagueStatusByMlbId, minorLeagueYearsByMlbId } = req.body;
      if (!Array.isArray(mlbIds) || mlbIds.length === 0) {
        return res.status(400).json({ message: "mlbIds array is required" });
      }

      const normalizeMinorLeagueStatus = (value: unknown): string | null => {
        const token = String(value || "").trim().toUpperCase();
        if (!token) return null;
        if (["MH", "MC", "FA"].includes(token)) return token;
        const slashMatch = /^([A-Z]{2,3})\s*\/\s*\d+$/.exec(token);
        if (slashMatch && ["MH", "MC", "FA"].includes(slashMatch[1])) return slashMatch[1];
        return null;
      };
      const normalizeMinorLeagueYears = (value: unknown): number | null => {
        if (value == null || value === "") return null;
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 0) return null;
        return parsed;
      };
      const parseStatusYearsToken = (value: unknown): { status: string | null; years: number | null } => {
        const token = String(value || "").trim().toUpperCase();
        const slashMatch = /^([A-Z]{2,3})\s*\/\s*(\d+)$/.exec(token);
        if (!slashMatch) return { status: normalizeMinorLeagueStatus(token), years: null };
        return {
          status: normalizeMinorLeagueStatus(slashMatch[1]),
          years: normalizeMinorLeagueYears(slashMatch[2]),
        };
      };

      const matchedIds: number[] = [];
      const notFound: number[] = [];
      const matchedMlbIdToInternalId = new Map<number, number>();

      for (const mlbId of mlbIds) {
        const player = await storage.getMlbPlayerByMlbId(mlbId);
        if (player) {
          matchedIds.push(player.id);
          matchedMlbIdToInternalId.set(Number(mlbId), player.id);
        } else {
          notFound.push(mlbId);
        }
      }

      const existingPlayers = await storage.getDraftPlayers(id);
      const existingMlbPlayerIds = new Set(existingPlayers.map(p => p.mlbPlayerId));
      const newIds = matchedIds.filter(pid => !existingMlbPlayerIds.has(pid));
      const alreadyInPool = matchedIds.length - newIds.length;

      const metadataByInternalId: Record<number, { minorLeagueStatus?: string | null; minorLeagueYears?: number | null }> = {};
      if (
        (minorLeagueStatusByMlbId && typeof minorLeagueStatusByMlbId === "object") ||
        (minorLeagueYearsByMlbId && typeof minorLeagueYearsByMlbId === "object")
      ) {
        for (const [mlbIdKey, internalId] of matchedMlbIdToInternalId.entries()) {
          const rawStatus = (minorLeagueStatusByMlbId as Record<string, unknown> | undefined)?.[String(mlbIdKey)];
          const rawYears = (minorLeagueYearsByMlbId as Record<string, unknown> | undefined)?.[String(mlbIdKey)];
          const parsedFromStatus = parseStatusYearsToken(rawStatus);
          const explicitStatus = normalizeMinorLeagueStatus(rawStatus);
          const explicitYears = normalizeMinorLeagueYears(rawYears);
          const normalizedStatus = explicitStatus ?? parsedFromStatus.status;
          const normalizedYears = explicitYears ?? parsedFromStatus.years;
          if (normalizedStatus || normalizedYears != null) {
            metadataByInternalId[internalId] = {
              minorLeagueStatus: normalizedStatus,
              minorLeagueYears: normalizedYears,
            };
          }
        }
      }

      let added = 0;
      if (newIds.length > 0) {
        added = await storage.addDraftPlayers(id, newIds, metadataByInternalId);
      }
      let middleNamesUpdated = 0;
      if (middleNamesByMlbId && typeof middleNamesByMlbId === "object") {
        const updates: Array<{ mlbId: number; middleName: string }> = [];
        for (const [key, value] of Object.entries(middleNamesByMlbId as Record<string, unknown>)) {
          const mlbId = Number.parseInt(key, 10);
          const middleName = typeof value === "string" ? value.trim() : "";
          if (!Number.isInteger(mlbId) || mlbId <= 0 || !middleName) continue;
          updates.push({ mlbId, middleName });
        }
        middleNamesUpdated = await storage.updateMlbPlayerMiddleNames(updates);
      }

      res.json({ added, notFound, alreadyInPool, middleNamesUpdated });
    } catch (error) {
      console.error("Error uploading draft players:", error);
      res.status(500).json({ message: "Failed to upload draft players" });
    }
  });

  // PATCH /api/drafts/:id/players/:mlbPlayerId - Update minor league status for a draft player
  app.patch("/api/drafts/:id/players/:mlbPlayerId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const draftId = parseInt(req.params.id);
      const mlbPlayerId = parseInt(req.params.mlbPlayerId);
      if (isNaN(draftId) || isNaN(mlbPlayerId)) {
        return res.status(400).json({ message: "Invalid draft or player ID" });
      }

      const draft = await storage.getDraft(draftId);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (!await hasLeagueCommissionerAccess(userId, draft.leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { minorLeagueStatus, minorLeagueYears } = req.body;
      const validStatuses = ["MH", "MC", "FA"];
      const normalizedStatus = typeof minorLeagueStatus === "string" && validStatuses.includes(minorLeagueStatus.toUpperCase())
        ? minorLeagueStatus.toUpperCase()
        : null;
      const normalizedYears = typeof minorLeagueYears === "number" && Number.isInteger(minorLeagueYears) && minorLeagueYears >= 0
        ? minorLeagueYears
        : null;

      await storage.updateDraftPlayerMinorLeague(draftId, mlbPlayerId, normalizedStatus, normalizedYears);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating draft player:", error);
      res.status(500).json({ message: "Failed to update draft player" });
    }
  });

  // DELETE /api/drafts/:id/players - Clear draft player pool
  app.delete("/api/drafts/:id/players", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid draft ID" });
      }

      const draft = await storage.getDraft(id);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (draft.status !== "setup") {
        return res.status(400).json({ message: "Can only clear players when draft is in setup status" });
      }

      if (!await hasLeagueCommissionerAccess(userId, draft.leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const removed = await storage.clearDraftPlayers(id);
      res.json({ removed });
    } catch (error) {
      console.error("Error clearing draft players:", error);
      res.status(500).json({ message: "Failed to clear draft players" });
    }
  });

  // GET /api/drafts/:id/rounds - Get draft round configuration
  app.get("/api/drafts/:id/rounds", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid draft ID" });

      const draft = await storage.getDraft(id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });

      const membership = await storage.getLeagueMember(draft.leagueId, userId);
      const user = await storage.getUser(userId);
      if (!membership && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Not a member of this league" });
      }

      const rounds = await storage.getDraftRounds(id);
      res.json(rounds);
    } catch (error) {
      console.error("Error fetching draft rounds:", error);
      res.status(500).json({ message: "Failed to fetch draft rounds" });
    }
  });

  // PATCH /api/drafts/:id/rounds/:roundId - Update a draft round (name, isTeamDraft)
  app.patch("/api/drafts/:id/rounds/:roundId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(id) || isNaN(roundId)) return res.status(400).json({ message: "Invalid ID" });

      const draft = await storage.getDraft(id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      if (draft.status === "completed") return res.status(400).json({ message: "Cannot edit rounds for a completed draft" });
      if (!await hasLeagueCommissionerAccess(userId, draft.leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { name, isTeamDraft, startTime, pickDurationMinutes } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (isTeamDraft !== undefined) updateData.isTeamDraft = isTeamDraft;
      if (startTime !== undefined) {
        updateData.startTime = startTime ? parseCSTTime(String(startTime)) : new Date();
      }
      if (pickDurationMinutes !== undefined) updateData.pickDurationMinutes = parseInt(pickDurationMinutes) || 30;

      const updated = await storage.updateDraftRound(roundId, updateData);

      if (updated && (updateData.startTime !== undefined || updateData.pickDurationMinutes !== undefined)) {
        const roundStartMs = new Date(updated.startTime!).getTime();
        const pickDurationMs = (updated.pickDurationMinutes || 30) * 60 * 1000;
        const allPicks = await storage.getDraftPicks(id);
        const roundPicks = allPicks
          .filter((p) => p.round === updated.roundNumber)
          .sort((a, b) => a.roundPickIndex - b.roundPickIndex);
        for (const pick of roundPicks) {
          if (pick.madeAt) continue;
          const idx = pick.roundPickIndex;
          const scheduledAt = new Date(roundStartMs + idx * pickDurationMs);
          const deadlineAt = new Date(roundStartMs + (idx + 1) * pickDurationMs);
          await storage.updateDraftPick(pick.id, { scheduledAt, deadlineAt });
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating draft round:", error);
      res.status(500).json({ message: "Failed to update draft round" });
    }
  });

  // DELETE /api/drafts/:id/rounds/:roundId - Delete a draft round
  app.delete("/api/drafts/:id/rounds/:roundId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(id) || isNaN(roundId)) return res.status(400).json({ message: "Invalid ID" });

      const draft = await storage.getDraft(id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      if (draft.status !== "setup") return res.status(400).json({ message: "Draft must be in setup status" });
      if (!await hasLeagueCommissionerAccess(userId, draft.leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const rounds = await storage.getDraftRounds(id);
      if (rounds.length <= 1) {
        return res.status(400).json({ message: "Cannot delete the last round" });
      }

      await storage.deleteDraftRound(roundId);
      res.json({ message: "Round deleted" });
    } catch (error) {
      console.error("Error deleting draft round:", error);
      res.status(500).json({ message: "Failed to delete draft round" });
    }
  });

  // GET /api/drafts/:id/order - Get draft order (optionally filtered by round)
  app.get("/api/drafts/:id/order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid draft ID" });

      const draft = await storage.getDraft(id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });

      const membership = await storage.getLeagueMember(draft.leagueId, userId);
      const user = await storage.getUser(userId);
      if (!membership && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Not a member of this league" });
      }

      const roundNumber = req.query.roundNumber ? parseInt(req.query.roundNumber) : undefined;
      const order = await storage.getDraftOrder(id, roundNumber);
      res.json(order);
    } catch (error) {
      console.error("Error fetching draft order:", error);
      res.status(500).json({ message: "Failed to fetch draft order" });
    }
  });

  // POST /api/drafts/:id/order/upload-csv - Upload CSV to set draft order and rounds
  app.post("/api/drafts/:id/order/upload-csv", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid draft ID" });

      const draft = await storage.getDraft(id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      if (draft.status !== "setup") return res.status(400).json({ message: "Draft must be in setup status" });
      if (!await hasLeagueCommissionerAccess(userId, draft.leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { csvData } = req.body;
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ message: "csvData string is required" });
      }

      const lines = csvData.trim().split("\n").map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        return res.status(400).json({ message: "CSV must have a header row and at least one pick row" });
      }

      const headers = lines[0].split(",").map(h => h.trim());
      const numRounds = headers.length;

      const members = await storage.getLeagueMembers(draft.leagueId);
      const abbrMap = new Map<string, string>();
      for (const m of members) {
        if (m.teamAbbreviation) {
          abbrMap.set(m.teamAbbreviation.toUpperCase(), m.userId);
        }
      }

      let startTimesRow: string[] | null = null;
      let dataStartIdx = 1;
      if (lines.length >= 2) {
        const firstDataCells = lines[1].split(",").map(c => c.trim());
        const looksLikeTimes = firstDataCells.every(c => !c || /\d{4}[-/]\d{1,2}[-/]\d{1,2}|^\d{1,2}[:/]\d{2}\s*(am|pm|AM|PM)?$/i.test(c) || /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/i.test(c));
        if (looksLikeTimes && firstDataCells.some(c => c.length > 0)) {
          startTimesRow = firstDataCells;
          dataStartIdx = 2;
        }
      }

      const orderEntries: { userId: string; orderIndex: number; roundNumber: number }[] = [];
      const unknownAbbrs: string[] = [];

      for (let rowIdx = dataStartIdx; rowIdx < lines.length; rowIdx++) {
        const cells = lines[rowIdx].split(",").map(c => c.trim());
        const pickIndex = rowIdx - dataStartIdx;

        for (let colIdx = 0; colIdx < numRounds; colIdx++) {
          const abbr = (cells[colIdx] || "").toUpperCase();
          if (!abbr) continue;

          const mappedUserId = abbrMap.get(abbr);
          if (!mappedUserId) {
            if (!unknownAbbrs.includes(abbr)) unknownAbbrs.push(abbr);
            continue;
          }

          orderEntries.push({
            userId: mappedUserId,
            orderIndex: pickIndex,
            roundNumber: colIdx + 1,
          });
        }
      }

      if (unknownAbbrs.length > 0) {
        return res.status(400).json({
          message: `Unknown team abbreviations: ${unknownAbbrs.join(", ")}. Make sure all team owners have their team abbreviation set.`,
          unknownAbbrs,
        });
      }

      const draftPickDuration = draft.pickDurationMinutes || 30;
      const roundConfigs = headers.map((name, idx) => {
        let startTime = new Date();
        if (startTimesRow && startTimesRow[idx]) {
          try {
            startTime = parseCSTTime(startTimesRow[idx]);
          } catch {
            // fall back to current time if parsing fails
          }
        }
        return {
          roundNumber: idx + 1,
          name: name || `Round ${idx + 1}`,
          isTeamDraft: false,
          startTime,
          pickDurationMinutes: draftPickDuration,
        };
      });

      await storage.setDraftRounds(id, roundConfigs);
      await storage.setDraftOrder(id, orderEntries);
      await storage.updateDraft(id, { rounds: numRounds });

      const rounds = await storage.getDraftRounds(id);
      const order = await storage.getDraftOrder(id);

      res.json({
        message: "Draft order uploaded successfully",
        rounds: rounds.length,
        totalEntries: orderEntries.length,
        picksPerRound: lines.length - dataStartIdx,
        roundConfigs: rounds,
        startTimesDetected: !!startTimesRow,
      });
    } catch (error) {
      console.error("Error uploading draft order CSV:", error);
      res.status(500).json({ message: "Failed to upload draft order CSV" });
    }
  });

  // POST /api/drafts/:id/order - Set draft order (legacy manual)
  app.post("/api/drafts/:id/order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid draft ID" });

      const draft = await storage.getDraft(id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      if (draft.status !== "setup") return res.status(400).json({ message: "Can only set order when draft is in setup status" });
      if (!await hasLeagueCommissionerAccess(userId, draft.leagueId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { order } = req.body;
      if (!Array.isArray(order)) {
        return res.status(400).json({ message: "order array is required" });
      }

      await storage.setDraftOrder(id, order.map((o: any) => ({ ...o, roundNumber: o.roundNumber || 1 })));
      const updatedOrder = await storage.getDraftOrder(id);
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error setting draft order:", error);
      res.status(500).json({ message: "Failed to set draft order" });
    }
  });

  // GET /api/drafts/:id/picks - Get all picks made in the draft
  app.get("/api/drafts/:id/picks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid draft ID" });
      }

      const draft = await storage.getDraft(id);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      const membership = await storage.getLeagueMember(draft.leagueId, userId);
      const user = await storage.getUser(userId);
      if (!membership && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Not a member of this league" });
      }

      const picks = await storage.getDraftPicks(id);
      res.json(picks);
    } catch (error) {
      console.error("Error fetching draft picks:", error);
      res.status(500).json({ message: "Failed to fetch draft picks" });
    }
  });

  // GET /api/drafts/:id/timing - Get timing info for current round
  app.get("/api/drafts/:id/timing", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid draft ID" });

      const draft = await storage.getDraft(id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });

      const now = new Date();
      const slots = await storage.getDraftPicks(id);

      const unmadeSlots = slots
        .filter((slot) => !slot.madeAt)
        .sort((a, b) => a.overallPickNumber - b.overallPickNumber);

      const currentSlot = unmadeSlots.find(slot => !slot.skippedAt) || null;

      const openSlots = unmadeSlots
        .filter((slot) => new Date(slot.scheduledAt).getTime() <= now.getTime());

      const skippedOpenSlots = openSlots.filter(slot => !!slot.skippedAt);
      const eligiblePickerIds = Array.from(new Set([
        ...(currentSlot ? [currentSlot.userId] : []),
        ...skippedOpenSlots.map(slot => slot.userId),
      ]));

      const skippedTeamMap = new Map<string, string>();
      for (const slot of skippedOpenSlots) {
        if (!skippedTeamMap.has(slot.userId)) {
          skippedTeamMap.set(slot.userId, slot.user?.teamName || `${slot.user?.firstName || ""} ${slot.user?.lastName || ""}`.trim() || slot.userId);
        }
      }
      const skippedTeams = Array.from(skippedTeamMap.entries()).map(([userId, teamName]) => ({ userId, teamName }));

      res.json({
        hasTiming: slots.length > 0,
        now: now.toISOString(),
        currentSlot,
        eligiblePickerIds,
        openSlotCount: openSlots.filter(s => !s.skippedAt).length + skippedOpenSlots.length,
        skippedTeams,
      });
    } catch (error) {
      console.error("Error fetching draft timing:", error);
      res.status(500).json({ message: "Failed to fetch draft timing" });
    }
  });

  // POST /api/drafts/:id/skip-pick - Commissioner skips the current pick
  app.post("/api/drafts/:id/skip-pick", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid draft ID" });

      const draft = await storage.getDraft(id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });

      const commUser = await storage.getUser(userId);
      const membership = await storage.getLeagueMember(draft.leagueId, userId);
      if (membership?.role !== "commissioner" && !commUser?.isSuperAdmin) {
        return res.status(403).json({ message: "Only commissioners can skip picks" });
      }

      if (draft.status !== "active") {
        return res.status(400).json({ message: "Draft is not active" });
      }

      const { slotId } = req.body;
      if (!slotId) return res.status(400).json({ message: "slotId is required" });

      const picks = await storage.getDraftPicks(id);
      const slot = picks.find(p => p.id === slotId);
      if (!slot) return res.status(404).json({ message: "Pick slot not found" });
      if (slot.madeAt) return res.status(400).json({ message: "This pick has already been made" });
      if (slot.skippedAt) return res.status(400).json({ message: "This pick has already been skipped" });

      const currentOnClock = picks
        .filter(p => !p.madeAt && !p.skippedAt)
        .sort((a, b) => a.overallPickNumber - b.overallPickNumber)[0];
      if (!currentOnClock || currentOnClock.id !== slotId) {
        return res.status(400).json({ message: "Can only skip the current on-the-clock pick" });
      }

      await db.update(draftPicks)
        .set({ skippedAt: new Date(), skippedByUserId: userId })
        .where(eq(draftPicks.id, slotId));

      setTimeout(() => processAutoDraft(id, storage), 500);

      res.json({ message: "Pick skipped successfully" });
    } catch (error) {
      console.error("Error skipping pick:", error);
      res.status(500).json({ message: "Failed to skip pick" });
    }
  });

  // POST /api/drafts/:id/pick - Make a pick (supports regular and team draft rounds)
  app.post("/api/drafts/:id/pick", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const commissionerUserId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid draft ID" });

      const draft = await storage.getDraft(id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      if (draft.status !== "active") return res.status(400).json({ message: "Draft is not active" });
      const isCommissioner = await hasLeagueCommissionerAccess(commissionerUserId, draft.leagueId);
      const targetUserId = isCommissioner && req.body?.userId ? String(req.body.userId) : userId;
      const now = new Date();
      const slot = await storage.getOldestEligibleOpenSlotForUser(id, targetUserId, now);
      if (!slot) {
        return res.status(403).json({ message: "No eligible open pick slot for this user" });
      }

      const allSlots = await storage.getDraftPicks(id);
      const previousUnmade = allSlots.find((s) => s.overallPickNumber < slot.overallPickNumber && !s.madeAt && !s.skippedAt);
      if (previousUnmade && !slot.skippedAt) {
        return res.status(400).json({ message: "Previous picks must be completed before making this pick" });
      }

      const rounds = await storage.getDraftRounds(id);
      const currentRoundConfig = rounds.find((r) => r.roundNumber === slot.round);
      const isTeamDraftRound = currentRoundConfig?.isTeamDraft === true;
      let pickResponse: any;

      if (isTeamDraftRound) {
        const selectedOrgName = req.body?.selectedOrgName || req.body?.parentOrgName;
        const selectedOrgId = req.body?.selectedOrgId ? parseInt(req.body.selectedOrgId) : null;
        const rosterType = (req.body?.rosterType || "milb") as "mlb" | "milb";
        if (!selectedOrgName) {
          return res.status(400).json({ message: "selectedOrgName is required for team draft rounds" });
        }
        if (rosterType !== "mlb" && rosterType !== "milb") {
          return res.status(400).json({ message: "rosterType must be 'mlb' or 'milb'" });
        }

        const result = await storage.fillSlotWithOrg(slot.id, targetUserId, selectedOrgName, selectedOrgId, rosterType, now);
        pickResponse = {
          teamDraft: true,
          slot: result.slot,
          orgName: selectedOrgName,
          playersDrafted: result.draftedPlayerIds.length,
          draftedMlbPlayerIds: result.draftedPlayerIds,
        };
      } else {
        const { mlbPlayerId, rosterType } = req.body;
        if (!mlbPlayerId || !rosterType) {
          return res.status(400).json({ message: "mlbPlayerId and rosterType are required" });
        }
        if (rosterType !== "mlb" && rosterType !== "milb") {
          return res.status(400).json({ message: "rosterType must be 'mlb' or 'milb'" });
        }

        pickResponse = await storage.fillSlotWithPlayer(
          slot.id,
          targetUserId,
          parseInt(mlbPlayerId),
          rosterType,
          now,
        );
      }

      if (allSlots.length > 0 && allSlots.filter((s) => s.id !== slot.id).every((s) => !!s.madeAt || !!s.skippedAt)) {
        await storage.updateDraft(id, { status: "completed" });
      } else {
        setTimeout(() => processAutoDraft(id, storage), 500);
      }

      checkAndSendRoundSummaryEmail(id, slot.round, storage).catch(() => {});

      res.status(201).json(pickResponse);
    } catch (error) {
      console.error("Error making draft pick:", error);
      const message = error instanceof Error ? error.message : "Failed to make draft pick";
      if (
        message.includes("not found") ||
        message.includes("already") ||
        message.includes("available") ||
        message.includes("open slot") ||
        message.includes("not open yet") ||
        message.includes("Previous picks")
      ) {
        return res.status(400).json({ message });
      }
      res.status(500).json({ message: "Failed to make draft pick" });
    }
  });

  // POST /api/drafts/:id/commissioner-pick - Commissioner makes a pick on behalf of a team
  app.post("/api/drafts/:id/commissioner-pick", isAuthenticated, async (req: any, res) => {
    try {
      const commissionerUserId = req.session.originalUserId || req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid draft ID" });

      const draft = await storage.getDraft(id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      if (draft.status !== "active") return res.status(400).json({ message: "Draft is not active" });

      const isCommissioner = await hasLeagueCommissionerAccess(commissionerUserId, draft.leagueId);
      if (!isCommissioner) return res.status(403).json({ message: "Commissioner access required" });

      const targetUserId = String(req.body?.userId || "");
      if (!targetUserId) {
        return res.status(400).json({ message: "userId is required" });
      }

      const now = new Date();
      const slot = await storage.getOldestEligibleOpenSlotForUser(id, targetUserId, now);
      if (!slot) return res.status(400).json({ message: "No eligible open slot for target user" });

      const rounds = await storage.getDraftRounds(id);
      const slotRound = rounds.find((r) => r.roundNumber === slot.round);
      const isTeamDraftRound = slotRound?.isTeamDraft === true;

      if (isTeamDraftRound) {
        const selectedOrgName = req.body?.selectedOrgName || req.body?.parentOrgName;
        const selectedOrgId = req.body?.selectedOrgId ? parseInt(req.body.selectedOrgId) : null;
        const rosterType = (req.body?.rosterType || "milb") as "mlb" | "milb";
        if (!selectedOrgName) {
          return res.status(400).json({ message: "selectedOrgName is required for team-draft round" });
        }
        if (rosterType !== "mlb" && rosterType !== "milb") {
          return res.status(400).json({ message: "rosterType must be 'mlb' or 'milb'" });
        }
        const result = await storage.fillSlotWithOrg(slot.id, targetUserId, selectedOrgName, selectedOrgId, rosterType, now);
        const allSlots = await storage.getDraftPicks(id);
        if (allSlots.length > 0 && allSlots.every((s) => !!s.madeAt || !!s.skippedAt)) {
          await storage.updateDraft(id, { status: "completed" });
        }
        checkAndSendRoundSummaryEmail(id, slot.round, storage).catch(() => {});
        return res.status(201).json({
          teamDraft: true,
          slot: result.slot,
          orgName: selectedOrgName,
          playersDrafted: result.draftedPlayerIds.length,
          draftedMlbPlayerIds: result.draftedPlayerIds,
        });
      }

      const mlbPlayerId = parseInt(req.body?.mlbPlayerId);
      const rosterType = req.body?.rosterType as "mlb" | "milb";
      if (!mlbPlayerId || !rosterType) {
        return res.status(400).json({ message: "mlbPlayerId and rosterType are required" });
      }
      if (rosterType !== "mlb" && rosterType !== "milb") {
        return res.status(400).json({ message: "rosterType must be 'mlb' or 'milb'" });
      }

      const updatedSlot = await storage.fillSlotWithPlayer(slot.id, targetUserId, mlbPlayerId, rosterType, now);
      const allSlots = await storage.getDraftPicks(id);
      if (allSlots.length > 0 && allSlots.every((s) => !!s.madeAt || !!s.skippedAt)) {
        await storage.updateDraft(id, { status: "completed" });
      } else {
        setTimeout(() => processAutoDraft(id, storage), 500);
      }
      checkAndSendRoundSummaryEmail(id, slot.round, storage).catch(() => {});
      res.status(201).json(updatedSlot);
    } catch (error) {
      console.error("Error making commissioner pick:", error);
      const message = error instanceof Error ? error.message : "Failed to make commissioner pick";
      if (
        message.includes("not found") ||
        message.includes("already") ||
        message.includes("available") ||
        message.includes("open slot") ||
        message.includes("not open yet")
      ) {
        return res.status(400).json({ message });
      }
      res.status(500).json({ message: "Failed to make commissioner pick" });
    }
  });

  // DELETE /api/drafts/:id/picks/:pickId - Commissioner nullifies a pick (undoes it)
  app.delete("/api/drafts/:id/picks/:pickId", isAuthenticated, async (req: any, res) => {
    try {
      const commissionerUserId = req.session.originalUserId || req.session.userId!;
      const draftId = parseInt(req.params.id);
      const pickId = parseInt(req.params.pickId);
      if (isNaN(draftId) || isNaN(pickId)) return res.status(400).json({ message: "Invalid IDs" });

      const draft = await storage.getDraft(draftId);
      if (!draft) return res.status(404).json({ message: "Draft not found" });

      const isCommissioner = await hasLeagueCommissionerAccess(commissionerUserId, draft.leagueId);
      if (!isCommissioner) return res.status(403).json({ message: "Commissioner access required" });

      const pick = await storage.getDraftPickById(pickId);
      if (!pick) return res.status(404).json({ message: "Pick not found" });
      if (pick.draftId !== draftId) return res.status(400).json({ message: "Pick does not belong to this draft" });
      if (!pick.madeAt) return res.status(400).json({ message: "Slot is not filled" });

      if (pick.mlbPlayerId) {
        await storage.updateDraftPlayerStatus(draftId, pick.mlbPlayerId, "available");
        await storage.removeRosterAssignmentByPlayer(draft.leagueId, pick.userId, pick.mlbPlayerId, draft.season);
      }

      if (Array.isArray(pick.selectedOrgPlayerIds) && pick.selectedOrgPlayerIds.length > 0) {
        for (const mlbPlayerId of pick.selectedOrgPlayerIds) {
          await storage.updateDraftPlayerStatus(draftId, mlbPlayerId, "available");
          await storage.removeRosterAssignmentByPlayer(draft.leagueId, pick.userId, mlbPlayerId, draft.season);
        }
      }

      await storage.clearDraftSlot(pickId);
      await storage.updateDraft(draftId, { status: "active" });

      res.json({ message: "Pick nullified successfully" });
    } catch (error) {
      console.error("Error nullifying draft pick:", error);
      res.status(500).json({ message: "Failed to nullify pick" });
    }
  });

  // GET /api/drafts/:id/auto-draft-list - Get user's auto-draft list
  app.get("/api/drafts/:id/auto-draft-list", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid draft ID" });

      const draft = await storage.getDraft(id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });

      const list = await storage.getAutoDraftList(id, userId);
      res.json(list);
    } catch (error) {
      console.error("Error fetching auto-draft list:", error);
      res.status(500).json({ message: "Failed to fetch auto-draft list" });
    }
  });

  // POST /api/drafts/:id/auto-draft-list - Add a player to auto-draft list
  app.post("/api/drafts/:id/auto-draft-list", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid draft ID" });

      const { mlbPlayerId, rosterType } = req.body;
      if (!mlbPlayerId) return res.status(400).json({ message: "mlbPlayerId is required" });

      const draft = await storage.getDraft(id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });

      const existing = await storage.getAutoDraftList(id, userId);
      if (existing.some(item => item.mlbPlayerId === mlbPlayerId)) {
        return res.status(400).json({ message: "Player is already in your auto-draft list" });
      }

      const item = await storage.addAutoDraftItem(id, userId, mlbPlayerId, rosterType || "milb");
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding to auto-draft list:", error);
      res.status(500).json({ message: "Failed to add to auto-draft list" });
    }
  });

  // DELETE /api/drafts/:id/auto-draft-list/:itemId - Remove from auto-draft list
  app.delete("/api/drafts/:id/auto-draft-list/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const draftId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId) || isNaN(draftId)) return res.status(400).json({ message: "Invalid ID" });

      const item = await storage.getAutoDraftItem(itemId);
      if (!item || item.draftId !== draftId || item.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.removeAutoDraftItem(itemId);
      res.json({ message: "Removed from auto-draft list" });
    } catch (error) {
      console.error("Error removing from auto-draft list:", error);
      res.status(500).json({ message: "Failed to remove from auto-draft list" });
    }
  });

  // PUT /api/drafts/:id/auto-draft-list/reorder - Reorder auto-draft list
  app.put("/api/drafts/:id/auto-draft-list/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid draft ID" });

      const { orderedIds } = req.body;
      if (!orderedIds || !Array.isArray(orderedIds)) {
        return res.status(400).json({ message: "orderedIds array is required" });
      }

      await storage.reorderAutoDraftList(id, userId, orderedIds);
      res.json({ message: "Auto-draft list reordered" });
    } catch (error) {
      console.error("Error reordering auto-draft list:", error);
      res.status(500).json({ message: "Failed to reorder auto-draft list" });
    }
  });

  // PUT /api/drafts/:id/auto-draft-list/:itemId - Update roster type for an auto-draft item
  app.put("/api/drafts/:id/auto-draft-list/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const draftId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId) || isNaN(draftId)) return res.status(400).json({ message: "Invalid ID" });

      const { rosterType } = req.body;
      if (!rosterType || (rosterType !== "mlb" && rosterType !== "milb")) {
        return res.status(400).json({ message: "rosterType must be 'mlb' or 'milb'" });
      }

      const item = await storage.getAutoDraftItem(itemId);
      if (!item || item.draftId !== draftId || item.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.updateAutoDraftItemRosterType(itemId, rosterType);
      res.json({ message: "Updated" });
    } catch (error) {
      console.error("Error updating auto-draft item:", error);
      res.status(500).json({ message: "Failed to update auto-draft item" });
    }
  });

  // GET /api/drafts/:id/team-auto-draft-list - Get user's team auto-draft list
  app.get("/api/drafts/:id/team-auto-draft-list", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ message: "Invalid draft ID" });
      const list = await storage.getTeamAutoDraftList(draftId, userId);
      res.json(list);
    } catch (error) {
      console.error("Error fetching team auto-draft list:", error);
      res.status(500).json({ message: "Failed to fetch team auto-draft list" });
    }
  });

  // POST /api/drafts/:id/team-auto-draft-list - Add an org to team auto-draft list
  app.post("/api/drafts/:id/team-auto-draft-list", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ message: "Invalid draft ID" });
      const { orgName, rosterType } = req.body;
      if (!orgName) return res.status(400).json({ message: "orgName is required" });
      const existing = await storage.getTeamAutoDraftList(draftId, userId);
      if (existing.some(item => item.orgName === orgName)) {
        return res.status(400).json({ message: "Organization is already in your team auto-draft list" });
      }
      const item = await storage.addTeamAutoDraftItem(draftId, userId, orgName, rosterType || "milb");
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding to team auto-draft list:", error);
      res.status(500).json({ message: "Failed to add to team auto-draft list" });
    }
  });

  // DELETE /api/drafts/:id/team-auto-draft-list/:itemId - Remove from team auto-draft list
  app.delete("/api/drafts/:id/team-auto-draft-list/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const draftId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId) || isNaN(draftId)) return res.status(400).json({ message: "Invalid ID" });
      const list = await storage.getTeamAutoDraftList(draftId, userId);
      const item = list.find(i => i.id === itemId);
      if (!item) return res.status(403).json({ message: "Not authorized" });
      await storage.removeTeamAutoDraftItem(itemId);
      res.json({ message: "Removed from team auto-draft list" });
    } catch (error) {
      console.error("Error removing from team auto-draft list:", error);
      res.status(500).json({ message: "Failed to remove from team auto-draft list" });
    }
  });

  // PUT /api/drafts/:id/team-auto-draft-list/reorder - Reorder team auto-draft list
  app.put("/api/drafts/:id/team-auto-draft-list/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ message: "Invalid draft ID" });
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) return res.status(400).json({ message: "orderedIds must be an array" });
      await storage.reorderTeamAutoDraftList(draftId, userId, orderedIds);
      res.json({ message: "Team auto-draft list reordered" });
    } catch (error) {
      console.error("Error reordering team auto-draft list:", error);
      res.status(500).json({ message: "Failed to reorder team auto-draft list" });
    }
  });

  // DELETE /api/drafts/:id/team-auto-draft-list - Clear entire team auto-draft list
  app.delete("/api/drafts/:id/team-auto-draft-list", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ message: "Invalid draft ID" });
      await storage.clearTeamAutoDraftList(draftId, userId);
      res.json({ message: "Team auto-draft list cleared" });
    } catch (error) {
      console.error("Error clearing team auto-draft list:", error);
      res.status(500).json({ message: "Failed to clear team auto-draft list" });
    }
  });

  // GET /api/drafts/:id/email-opt-out - Check if user has opted out of draft round summary emails
  app.get("/api/drafts/:id/email-opt-out", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid draft ID" });
      const optedOut = await storage.getDraftEmailOptOut(id, userId);
      res.json({ optedOut });
    } catch (error) {
      console.error("Error checking draft email opt-out:", error);
      res.status(500).json({ message: "Failed to check email preference" });
    }
  });

  // PUT /api/drafts/:id/email-opt-out - Toggle draft round summary email opt-out
  app.put("/api/drafts/:id/email-opt-out", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid draft ID" });
      const { optedOut } = req.body;
      if (typeof optedOut !== "boolean") return res.status(400).json({ message: "optedOut must be a boolean" });
      await storage.setDraftEmailOptOut(id, userId, optedOut);
      res.json({ optedOut });
    } catch (error) {
      console.error("Error updating draft email opt-out:", error);
      res.status(500).json({ message: "Failed to update email preference" });
    }
  });

  return httpServer;
}

const sentRoundEmails = new Set<string>();

async function checkAndSendRoundSummaryEmail(draftId: number, completedPickRound: number, storage: any): Promise<void> {
  try {
    const emailKey = `${draftId}-${completedPickRound}`;
    if (sentRoundEmails.has(emailKey)) return;

    const allSlots = await storage.getDraftPicks(draftId);
    const roundSlots = allSlots.filter((s: any) => s.round === completedPickRound);
    const allRoundComplete = roundSlots.length > 0 && roundSlots.every((s: any) => !!s.madeAt || !!s.skippedAt);
    if (!allRoundComplete) return;

    sentRoundEmails.add(emailKey);

    const draft = await storage.getDraft(draftId);
    if (!draft) return;

    const isDev = process.env.NODE_ENV === "development";

    let recipients: Array<{ email: string; firstName: string | null; userId: string }> = [];
    if (isDev) {
      const superAdmin = await storage.getSuperAdmin();
      if (superAdmin?.email) {
        recipients = [{ email: superAdmin.email, firstName: superAdmin.firstName, userId: superAdmin.id }];
      }
    } else {
      const allMembers = await storage.getLeagueMembersEmails(draft.leagueId);
      const optedOut = await storage.getDraftOptedOutUserIds(draftId);
      const optedOutSet = new Set(optedOut);
      recipients = allMembers.filter((m: any) => !optedOutSet.has(m.userId));
    }

    if (recipients.length === 0) return;

    const picks = roundSlots
      .sort((a: any, b: any) => a.overallPickNumber - b.overallPickNumber)
      .map((s: any) => ({
        overallPickNumber: s.overallPickNumber,
        playerName: s.player?.fullName || "Unknown",
        position: s.player?.primaryPosition || "-",
        mlbTeam: s.player?.parentOrgName || "-",
        ownerTeamName: s.user?.teamName || `${s.user?.firstName || ""} ${s.user?.lastName || ""}`.trim() || "Unknown",
        ownerName: `${s.user?.firstName || ""} ${s.user?.lastName || ""}`.trim() || "Unknown",
        rosterType: s.rosterType || "milb",
        isOrgPick: !!s.selectedOrgName,
        orgName: s.selectedOrgName || undefined,
      }));

    console.log(`[DraftEmail] Round ${completedPickRound} of draft ${draftId} complete. Sending summary to ${recipients.length} recipient(s)${isDev ? " (dev mode - super admin only)" : ""}`);

    for (const recipient of recipients) {
      const name = recipient.firstName || "Owner";
      await sendDraftRoundSummaryEmail(recipient.email, name, draft.name, completedPickRound, picks);
    }
  } catch (error) {
    console.error("[DraftEmail] Error sending round summary email:", error);
  }
}

async function processAutoDraft(draftId: number, storage: any): Promise<boolean> {
  try {
    const draft = await storage.getDraft(draftId);
    if (!draft || draft.status !== "active") return false;

    const now = new Date();
    const slots = await storage.getDraftPicks(draftId);
    const rounds = await storage.getDraftRounds(draftId);
    const sortedOpen = slots
      .filter((s: any) => !s.madeAt && !s.skippedAt)
      .sort((a: any, b: any) => a.overallPickNumber - b.overallPickNumber);
    if (sortedOpen.length === 0) return false;
    const nextSlot = sortedOpen[0];
    const roundConfig = rounds.find((r: any) => r.roundNumber === nextSlot.round);
    const slot = nextSlot;

    if (roundConfig?.isTeamDraft) {
      const claimedOrgs = new Set(
        slots.filter((s: any) => !!s.selectedOrgName).map((s: any) => s.selectedOrgName as string)
      );
      const topTeamPick = await storage.getTopAvailableTeamAutoDraftPick(draftId, slot.userId, claimedOrgs);
      if (!topTeamPick) return false;

      await storage.fillSlotWithOrg(slot.id, slot.userId, topTeamPick.orgName, null, topTeamPick.rosterType as "mlb" | "milb", now);

      const updatedSlots = await storage.getDraftPicks(draftId);
      if (updatedSlots.length > 0 && updatedSlots.every((s: any) => !!s.madeAt || !!s.skippedAt)) {
        await storage.updateDraft(draftId, { status: "completed" });
      } else {
        setTimeout(() => processAutoDraft(draftId, storage), 500);
      }

      checkAndSendRoundSummaryEmail(draftId, slot.round, storage).catch(() => {});
      console.log(`[AutoDraft] Auto-drafted org "${topTeamPick.orgName}" for user ${slot.userId} in draft ${draftId}`);
      return true;
    }

    const topPick = await storage.getTopAvailableAutoDraftPick(draftId, slot.userId);
    if (!topPick) return false;

    await storage.fillSlotWithPlayer(slot.id, slot.userId, topPick.mlbPlayerId, topPick.rosterType, now);

    const updatedSlots = await storage.getDraftPicks(draftId);
    if (updatedSlots.length > 0 && updatedSlots.every((s: any) => !!s.madeAt || !!s.skippedAt)) {
      await storage.updateDraft(draftId, { status: "completed" });
    } else {
      setTimeout(() => processAutoDraft(draftId, storage), 500);
    }

    checkAndSendRoundSummaryEmail(draftId, slot.round, storage).catch(() => {});

    console.log(`[AutoDraft] Auto-drafted player ${topPick.mlbPlayerId} for user ${slot.userId} in draft ${draftId}`);
    return true;
  } catch (error) {
    console.error("[AutoDraft] Error processing auto-draft:", error);
    return false;
  }
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
        
        // RACE CONDITION FIX: Re-verify the current high bid hasn't changed before placing
        const verifyHighBid = await storage.getHighestBidForAgent(agentId);
        if (verifyHighBid && verifyHighBid.totalValue >= bidTotalValue) {
          console.log(`[UnifiedAutoBid] Race condition detected: high bid changed to ${verifyHighBid.totalValue}, our bid ${bidTotalValue} no longer wins. Recalculating...`);
          // High bid changed - need to recalculate, break and let next iteration handle it
          madeChange = true; // Force another iteration
          break;
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
          
          // RACE CONDITION FIX: Re-verify the current high bid hasn't changed before placing
          const verifyHighBid = await storage.getHighestBidForAgent(agentId);
          if (verifyHighBid && verifyHighBid.totalValue >= bidTotalValue) {
            console.log(`[UnifiedAutoBid] Race condition detected for bundle: high bid changed to ${verifyHighBid.totalValue}, our bid ${bidTotalValue} no longer wins. Recalculating...`);
            // High bid changed - need to recalculate, break and let next iteration handle it
            madeChange = true; // Force another iteration
            break;
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
  if (agent.auctionStartTime && new Date(agent.auctionStartTime) > new Date()) {
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

