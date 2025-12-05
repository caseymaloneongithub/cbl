import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, hashPassword, generateRandomPassword } from "./auth";
import { insertBidSchema, insertAutoBidSchema } from "@shared/schema";
import { z } from "zod";

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
      
      if (!user?.isCommissioner && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Commissioner or Super Admin access required" });
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
      
      // Allow commissioner or super admin access
      if (!user?.isCommissioner && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Commissioner or Super Admin access required" });
      }

      const owners = await storage.getAllUsers();
      res.json(owners);
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

  // Check if a team can be deleted
  app.get("/api/owners/:id/can-delete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Commissioner or Super Admin access required" });
      }

      const { id } = req.params;
      const result = await storage.canDeleteUser(id);
      res.json(result);
    } catch (error) {
      console.error("Error checking if user can be deleted:", error);
      res.status(500).json({ message: "Failed to check delete status" });
    }
  });

  // Delete a team (only if not in any auctions)
  app.delete("/api/owners/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Commissioner or Super Admin access required" });
      }

      const { id } = req.params;
      
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

  app.post("/api/free-agents/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

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
          auctionEndTime: p.auctionEndTime ? new Date(p.auctionEndTime) : defaultEndTime,
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
    } catch (error) {
      console.error("Error uploading free agents:", error);
      res.status(500).json({ message: "Failed to upload free agents" });
    }
  });

  // Commissioner: Relist a player with no bids (new minimum bid and end time)
  app.post("/api/free-agents/:id/relist", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const agentId = parseInt(req.params.id);
      const agent = await storage.getFreeAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ message: "Free agent not found" });
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

      const newEndTime = new Date(auctionEndTime);
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

  // Create a single free agent (commissioner or super admin only)
  app.post("/api/free-agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Commissioner or super admin access required" });
      }

      const { name, playerType, team, minimumBid, minimumYears, auctionEndTime, auctionId,
              avg, hr, rbi, runs, sb, ops, pa, wins, losses, era, whip, strikeouts, ip } = req.body;
      
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
      
      const endTime = new Date(auctionEndTime);
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
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Commissioner or super admin access required" });
      }

      const agentId = parseInt(req.params.id);
      const agent = await storage.getFreeAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ message: "Free agent not found" });
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
      if (enforceBudget) {
        const budgetInfo = await storage.getUserBudgetInfo(userId, agent.auctionId ?? undefined);
        
        // Calculate available budget for this bid
        // If user is already high bidder on this auction, that amount is freed up
        let availableForThisBid = budgetInfo.available;
        if (currentHighBid?.userId === userId) {
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

      // Process auto-bids from other users
      await processAutoBids(agentId, userId, totalValue, auction, bidIncrement);

      res.json(bid);
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
      if (isActive) {
        // Get auction for per-auction settings
        const auction = agent.auctionId ? await storage.getAuction(agent.auctionId) : null;
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
          const budgetInfo = await storage.getUserBudgetInfo(userId, agent.auctionId ?? undefined);
          availableBudget = budgetInfo.available;
          // If already high bidder, that amount is freed
          if (currentHighBid?.userId === userId) {
            availableBudget += currentHighBid.amount;
          }
        }
        
        if (currentHighBid && currentHighBid.userId !== userId) {
          // Get the auction's bid increment (default 10%)
          const bidIncrement = auction?.bidIncrement ?? 0.10;
          
          // Try to beat the current bid
          const maxTotalValue = maxAmount * factor;
          const requiredTotalValue = currentHighBid.totalValue * (1 + bidIncrement);
          
          if (maxTotalValue >= requiredTotalValue) {
            // Calculate bid amount, ensuring it meets the player's minimum bid
            let bidAmount = Math.ceil(requiredTotalValue / factor);
            bidAmount = Math.max(bidAmount, agent.minimumBid);
            const bidTotalValue = bidAmount * factor;
            
            // Check max amount and budget before placing bid
            if (bidAmount <= maxAmount && bidAmount <= availableBudget) {
              await storage.createBid({
                freeAgentId: agentId,
                userId,
                amount: bidAmount,
                years,
                totalValue: bidTotalValue,
                isAutoBid: true,
              });
            }
          }
        } else if (!currentHighBid) {
          // No current bid, place minimum bid (player's minimum or $1)
          const startingBid = Math.max(agent.minimumBid, 1);
          
          // Check max amount and budget before placing bid
          if (maxAmount >= startingBid && startingBid <= availableBudget) {
            await storage.createBid({
              freeAgentId: agentId,
              userId,
              amount: startingBid,
              years,
              totalValue: startingBid * factor,
              isAutoBid: true,
            });
          }
        }
      }

      res.json(autoBid);
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
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      // Support optional auction filtering
      let results = await storage.getClosedFreeAgents();
      if (req.query.auctionId) {
        const auctionId = parseInt(req.query.auctionId);
        if (!isNaN(auctionId)) {
          results = results.filter(agent => agent.auctionId === auctionId);
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
        "Winner Email"
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
        agent.highBidder?.email ? `"${agent.highBidder.email}"` : ""
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
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      // Support optional auction filtering
      let results = await storage.getClosedFreeAgents();
      if (req.query.auctionId) {
        const auctionId = parseInt(req.query.auctionId);
        if (!isNaN(auctionId)) {
          results = results.filter(agent => agent.auctionId === auctionId);
        }
      }
      const allUsers = await storage.getAllUsers();
      
      const headers = [
        "Owner Name",
        "Owner Email",
        "Team Name",
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
      
      if (!admin?.isCommissioner) {
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
    })).min(1, "At least one user is required").max(500, "Maximum 500 users per upload"),
  });

  // Commissioner: Bulk create users/teams via CSV
  app.post("/api/users/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.session.userId!;
      const admin = await storage.getUser(adminId);
      
      if (!admin?.isCommissioner) {
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

  // Auction routes
  app.get("/api/auctions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.originalUserId || req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Commissioner or Super Admin access required" });
      }

      const allAuctions = await storage.getAllAuctions();
      res.json(allAuctions);
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
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { name } = req.body;
      
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Auction name is required" });
      }

      const auction = await storage.createAuction({
        name: name.trim(),
        status: "draft",
        createdBy: userId,
      });

      res.json(auction);
    } catch (error) {
      console.error("Error creating auction:", error);
      res.status(500).json({ message: "Failed to create auction" });
    }
  });

  app.patch("/api/auctions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const auctionId = parseInt(req.params.id);
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

  // Delete auction (requires password confirmation)
  app.delete("/api/auctions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: "Password confirmation required" });
      }

      // Verify password using bcrypt
      const bcrypt = await import("bcryptjs");
      const isValidPassword = await bcrypt.compare(password, user.passwordHash || "");
      
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid password" });
      }

      const auctionId = parseInt(req.params.id);
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
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: "Password confirmation required" });
      }

      // Verify password using bcrypt
      const bcrypt = await import("bcryptjs");
      const isValidPassword = await bcrypt.compare(password, user.passwordHash || "");
      
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid password" });
      }

      const auctionId = parseInt(req.params.id);
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
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Commissioner or Super Admin access required" });
      }

      const auctionId = parseInt(req.params.id);
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
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Commissioner or Super Admin access required" });
      }

      const auctionId = parseInt(req.params.id);
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
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const auctionId = parseInt(req.params.id);
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

  // Remove a team from an auction
  app.delete("/api/auctions/:id/teams/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const sessionUserId = req.session.userId!;
      const user = await storage.getUser(sessionUserId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const auctionId = parseInt(req.params.id);
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
      const sessionUserId = req.session.userId!;
      const user = await storage.getUser(sessionUserId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const auctionId = parseInt(req.params.id);
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
      const sessionUserId = req.session.userId!;
      const user = await storage.getUser(sessionUserId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const auctionId = parseInt(req.params.id);
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
      const sessionUserId = req.session.userId!;
      const user = await storage.getUser(sessionUserId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const auctionId = parseInt(req.params.id);
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
      const sessionUserId = req.session.userId!;
      const user = await storage.getUser(sessionUserId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const auctionId = parseInt(req.params.id);
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

  return httpServer;
}

// Helper function to process auto-bids after a manual bid
async function processAutoBids(
  agentId: number,
  excludeUserId: string,
  currentTotalValue: number,
  auction: any,
  bidIncrement: number = 0.10
): Promise<void> {
  const autoBids = await storage.getAutoBidsForAgent(agentId);
  const agent = await storage.getFreeAgent(agentId);
  
  if (!agent) return;
  
  // Use per-auction year factors
  const yearFactors = auction ? [
    auction.yearFactor1,
    auction.yearFactor2,
    auction.yearFactor3,
    auction.yearFactor4,
    auction.yearFactor5,
  ] : [1.0, 1.25, 1.33, 1.43, 1.55]; // Fallback defaults

  for (const autoBid of autoBids) {
    if (autoBid.userId === excludeUserId || !autoBid.isActive) continue;

    const factor = yearFactors[autoBid.years - 1];
    const maxTotalValue = autoBid.maxAmount * factor;
    const requiredTotalValue = currentTotalValue * (1 + bidIncrement);

    if (maxTotalValue >= requiredTotalValue) {
      // Calculate bid amount, ensuring it meets the player's minimum bid
      let bidAmount = Math.ceil(requiredTotalValue / factor);
      bidAmount = Math.max(bidAmount, agent.minimumBid);
      const bidTotalValue = bidAmount * factor;
      
      // Check if bid still fits within max amount after enforcing minimum
      if (bidAmount > autoBid.maxAmount) {
        continue; // Skip if minimum bid exceeds user's max amount
      }

      // Check budget if enforcement is enabled (per-auction setting)
      // Budget tracks bid AMOUNT, not total value
      const enforceBudget = auction?.enforceBudget ?? true;
      if (enforceBudget) {
        try {
          // Recalculate budget before each auto-bid placement
          const budgetInfo = await storage.getUserBudgetInfo(autoBid.userId, agent.auctionId ?? undefined);
          
          // For auto-bids, check if user has enough available budget for the AMOUNT
          if (bidAmount > budgetInfo.available) {
            // Skip this auto-bid, user doesn't have enough budget
            continue;
          }
        } catch (error) {
          console.error("Error checking budget for auto-bid:", error);
          continue;
        }
      }

      await storage.createBid({
        freeAgentId: agentId,
        userId: autoBid.userId,
        amount: bidAmount,
        years: autoBid.years,
        totalValue: bidTotalValue,
        isAutoBid: true,
      });

      // Recursively process auto-bids (including original bidder's auto-bid if they have one)
      await processAutoBids(agentId, autoBid.userId, bidTotalValue, auction, bidIncrement);
      break; // Only one auto-bid can win per cycle
    }
  }
}
