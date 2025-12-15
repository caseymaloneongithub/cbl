import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, hashPassword, generateRandomPassword } from "./auth";
import { insertBidSchema, insertAutoBidSchema } from "@shared/schema";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { parse, isValid } from "date-fns";

const EASTERN_TIMEZONE = "America/New_York";

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

      // Validate and sanitize player data
      const invalidPlayers: string[] = [];
      const agentsToCreate = players.map((p: any, index: number) => {
        const name = p.name?.trim();
        if (!name) {
          invalidPlayers.push(`Row ${index + 2}: Missing player name`);
        }
        
        // Validate minimumBid: must be a valid number >= 1
        let minimumBid = 1;
        if (p.minimumBid !== undefined && p.minimumBid !== null && p.minimumBid !== "") {
          const parsedBid = Number(p.minimumBid);
          if (isNaN(parsedBid) || parsedBid < 1) {
            invalidPlayers.push(`Row ${index + 2} (${name || "unknown"}): Invalid minimum bid "${p.minimumBid}" - must be a number >= 1`);
          } else {
            minimumBid = parsedBid;
          }
        }
        
        // Validate minimumYears: must be a valid number 1-5
        let minimumYears = 1;
        if (p.minimumYears !== undefined && p.minimumYears !== null && p.minimumYears !== "") {
          const parsedYears = Number(p.minimumYears);
          if (isNaN(parsedYears) || parsedYears < 1 || parsedYears > 5) {
            invalidPlayers.push(`Row ${index + 2} (${name || "unknown"}): Invalid minimum years "${p.minimumYears}" - must be 1-5`);
          } else {
            minimumYears = Math.floor(parsedYears);
          }
        }
        
        // Determine player type - accepts "pitcher" or "hitter" (default to hitter)
        const rawType = (p.playerType || p.type || "hitter").toLowerCase().trim();
        const playerType = rawType === "pitcher" || rawType === "p" ? "pitcher" : "hitter";

        // Parse stats (all optional)
        const parseNum = (val: any): number | null => {
          if (val === undefined || val === null || val === "") return null;
          const num = Number(val);
          return isNaN(num) ? null : num;
        };

        return {
          name: name || `Unknown Player ${index}`,
          team: p.team || null,
          playerType,
          minimumBid,
          minimumYears,
          auctionEndTime: p.auctionEndTime ? parseEasternTime(p.auctionEndTime) : defaultEndTime,
          isActive: true,
          auctionId: targetAuctionId,
          // Hitter stats
          avg: parseNum(p.avg),
          hr: parseNum(p.hr) !== null ? Math.floor(parseNum(p.hr)!) : null,
          rbi: parseNum(p.rbi) !== null ? Math.floor(parseNum(p.rbi)!) : null,
          runs: parseNum(p.runs) !== null ? Math.floor(parseNum(p.runs)!) : null,
          sb: parseNum(p.sb) !== null ? Math.floor(parseNum(p.sb)!) : null,
          ops: parseNum(p.ops),
          pa: parseNum(p.pa) !== null ? Math.floor(parseNum(p.pa)!) : null, // Plate appearances for limit tracking
          // Pitcher stats
          wins: parseNum(p.wins) !== null ? Math.floor(parseNum(p.wins)!) : null,
          losses: parseNum(p.losses) !== null ? Math.floor(parseNum(p.losses)!) : null,
          era: parseNum(p.era),
          whip: parseNum(p.whip),
          strikeouts: parseNum(p.strikeouts) !== null ? Math.floor(parseNum(p.strikeouts)!) : null,
          ip: parseNum(p.ip),
        };
      });
      
      // If there are validation errors, reject the entire upload
      if (invalidPlayers.length > 0) {
        return res.status(400).json({ 
          message: `CSV validation failed:\n${invalidPlayers.slice(0, 5).join('\n')}${invalidPlayers.length > 5 ? `\n... and ${invalidPlayers.length - 5} more errors` : ''}` 
        });
      }

      const newAgents = await storage.createFreeAgentsBulk(agentsToCreate);
      res.json(newAgents);
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

      // Process all auto-bids (regular + bundle items) until stable
      const autoBidsTriggered = await processAllAutoBidsUntilStable(agentId, userId, auction);

      res.json({ ...bid, autoBidsTriggered });
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

      const { maxAmount, years, isActive } = req.body;
      
      // Check if auto-bid meets minimum years requirement
      const minimumYears = agent.minimumYears || 1;
      if (years < minimumYears) {
        return res.status(400).json({ 
          message: `This player requires at least a ${minimumYears}-year contract` 
        });
      }
      
      const autoBid = await storage.createOrUpdateAutoBid({
        freeAgentId: agentId,
        userId,
        maxAmount,
        years,
        isActive,
      });

      // If auto-bid is active, try to place an auto-bid immediately
      if (isActive && agent.auctionId) {
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

  // My bids
  app.get("/api/my-bids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const bids = await storage.getUserBids(userId);
      res.json(bids);
    } catch (error) {
      console.error("Error fetching user bids:", error);
      res.status(500).json({ message: "Failed to fetch bids" });
    }
  });

  app.get("/api/my-outbid", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const outbidPlayers = await storage.getUserOutbidPlayers(userId);
      res.json(outbidPlayers);
    } catch (error) {
      console.error("Error fetching outbid players:", error);
      res.status(500).json({ message: "Failed to fetch outbid players" });
    }
  });

  app.get("/api/my-auto-bids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const autoBids = await storage.getUserAutoBids(userId);
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

      // Verify all players exist and auctions are open
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
      let currentItem = bundle.items.find(i => i.status === 'active');
      while (currentItem) {
        const success = await deployBundleItemAsAutoBid(currentItem, bundle);
        if (success) {
          break; // Successfully deployed a bid
        }
        // Failed - try to activate next item
        const nextItem = await storage.activateNextBundleItem(bundle.id);
        currentItem = nextItem;
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

      // Verify all players exist and auctions are open
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
      let currentItem = updatedBundle.items.find(i => i.status === 'active');
      while (currentItem) {
        const success = await deployBundleItemAsAutoBid(currentItem, updatedBundle);
        if (success) {
          break; // Successfully deployed a bid
        }
        // Failed - try to activate next item
        const nextItem = await storage.activateNextBundleItem(updatedBundle.id);
        currentItem = nextItem;
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
      const stats = await storage.getUserStats(userId);
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
  app.get("/api/limits", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const auctionId = req.query.auctionId ? parseInt(req.query.auctionId) : undefined;
      
      if (!auctionId || isNaN(auctionId)) {
        return res.status(400).json({ message: "auctionId is required" });
      }
      
      const limitsInfo = await storage.getUserLimitsInfo(userId, auctionId);
      res.json(limitsInfo);
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
        "Player ID",
        "Player Name", 
        "Type",
        "Team",
        "Auction End Time",
        "Winning Bid ($/yr)",
        "Contract Years",
        "Total Contract Value",
        "Bid Count",
        "Winner Name",
        "Winner Email",
        "Winner Team Abbr"
      ];

      const rows = results.map(agent => [
        agent.id,
        `"${agent.name.replace(/"/g, '""')}"`,
        agent.playerType === "pitcher" ? "Pitcher" : "Hitter",
        agent.team ? `"${agent.team.replace(/"/g, '""')}"` : "",
        new Date(agent.auctionEndTime).toISOString(),
        agent.currentBid?.amount || 0,
        agent.currentBid?.years || 0,
        agent.currentBid?.totalValue || 0,
        agent.bidCount,
        agent.highBidder ? `"${agent.highBidder.firstName || ''} ${agent.highBidder.lastName || ''}".trim()` : "",
        agent.highBidder?.email ? `"${agent.highBidder.email}"` : "",
        agent.highBidder?.teamAbbreviation || ""
      ]);

      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=auction-results.csv");
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
            `"${(owner?.firstName || '') + ' ' + (owner?.lastName || '')}".trim()`,
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
    })).min(1, "At least one user is required").max(500, "Maximum 500 users per upload"),
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

      const { users: usersData } = validation.data;

      const results: { email: string; password: string; success: boolean; error?: string }[] = [];

      for (const userData of usersData) {
        const email = userData.email.trim();
        try {
          // Check if user already exists
          const existing = await storage.getUserByEmail(email);
          if (existing) {
            results.push({ email, password: "", success: false, error: "User already exists" });
            continue;
          }

          const tempPassword = generateRandomPassword();
          const passwordHash = await hashPassword(tempPassword);

          await storage.createUserWithPassword({
            email,
            passwordHash,
            firstName: userData.firstName?.trim(),
            lastName: userData.lastName?.trim(),
            teamName: userData.teamName?.trim(),
            teamAbbreviation: userData.teamAbbreviation?.trim().toUpperCase().slice(0, 3),
            isCommissioner: false,
            mustResetPassword: true,
          });

          results.push({ email, password: tempPassword, success: true });
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
      const activeAuction = await storage.getActiveAuction();
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
        extendAuctionOnBid
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

  // Update per-auction team limits
  app.patch("/api/auctions/:id/teams/:userId/limits", isAuthenticated, async (req: any, res) => {
    try {
      const sessionUserId = req.session.originalUserId || req.session.userId!;
      const auctionId = parseInt(req.params.id);
      
      // Check commissioner access for this auction's league
      if (!await hasAuctionCommissionerAccess(sessionUserId, auctionId)) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const targetUserId = req.params.userId;
      const { rosterLimit, ipLimit, paLimit } = req.body;

      const team = await storage.updateAuctionTeamLimits(auctionId, targetUserId, {
        rosterLimit: rosterLimit ?? null,
        ipLimit: ipLimit ?? null,
        paLimit: paLimit ?? null,
      });
      res.json(team);
    } catch (error) {
      console.error("Error updating auction team limits:", error);
      res.status(500).json({ message: "Failed to update auction team limits" });
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

  // ================== LEAGUE MANAGEMENT ROUTES ==================

  // Get all leagues for the current user (or all leagues for super admin)
  app.get("/api/leagues", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Super admin sees all leagues, regular users see their leagues
      let allLeagues;
      if (user.isSuperAdmin) {
        // For super admin, get all leagues
        const leaguesList = await storage.getAllLeagues();
        allLeagues = leaguesList;
      } else {
        allLeagues = await storage.getUserLeagues(userId);
      }
      
      res.json(allLeagues);
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

      const { userId: targetUserId, role, teamName, teamAbbreviation } = req.body;
      
      if (!targetUserId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Check if user exists
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user is already a member
      const existingMember = await storage.getLeagueMember(leagueId, targetUserId);
      if (existingMember) {
        return res.status(400).json({ message: "User is already a member of this league" });
      }

      const member = await storage.addLeagueMember({
        leagueId,
        userId: targetUserId,
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
  const agent = await storage.getFreeAgent(agentId);
  if (!agent) return false;
  
  // Check if auction is still open
  if (new Date(agent.auctionEndTime) <= new Date()) return false;
  
  const yearFactors = auction ? [
    auction.yearFactor1,
    auction.yearFactor2,
    auction.yearFactor3,
    auction.yearFactor4,
    auction.yearFactor5,
  ] : [1.0, 1.25, 1.33, 1.43, 1.55];
  
  const bidIncrement = auction?.bidIncrement ?? 0.10;
  const enforceBudget = auction?.enforceBudget ?? true;
  
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
    if (!highestBid) break; // No bids to respond to
    
    const currentHighUserId = highestBid.userId;
    const currentTotalValue = highestBid.totalValue;
    const requiredTotalValue = currentTotalValue * (1 + bidIncrement);
    
    // Get all regular auto-bids for this player
    const autoBids = await storage.getAutoBidsForAgent(agentId);
    
    // Get all deployed bundle items for this player
    const deployedBundleItems = await storage.getAllDeployedBundleItemsForAgent(agentId);
    
    // Process regular auto-bids first
    for (const autoBid of autoBids) {
      // Skip if this user is already winning or just placed the last bid
      if (autoBid.userId === currentHighUserId || autoBid.userId === lastBidderId || !autoBid.isActive) continue;
      
      const factor = yearFactors[autoBid.years - 1];
      const maxTotalValue = autoBid.maxAmount * factor;
      
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
    } else {
      passesWithNoChange++;
    }
  }
  
  if (iterations >= maxIterations) {
    console.error(`[UnifiedAutoBid] Hit max iterations (${maxIterations}) for agent ${agentId}`);
  }
  
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
  
  // Check if auction is still open
  if (new Date(agent.auctionEndTime) <= new Date()) {
    await storage.updateBidBundleItem(item.id, { status: 'skipped' });
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
