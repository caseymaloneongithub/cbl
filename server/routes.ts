import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertBidSchema, insertAutoBidSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { id } = req.params;
      const { isCommissioner } = req.body;
      const updatedUser = await storage.updateUserCommissioner(id, isCommissioner);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating commissioner:", error);
      res.status(500).json({ message: "Failed to update commissioner status" });
    }
  });

  // Free agents routes
  app.get("/api/free-agents", isAuthenticated, async (req, res) => {
    try {
      const agents = await storage.getActiveFreeAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching free agents:", error);
      res.status(500).json({ message: "Failed to fetch free agents" });
    }
  });

  app.get("/api/results", isAuthenticated, async (req, res) => {
    try {
      const agents = await storage.getClosedFreeAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching results:", error);
      res.status(500).json({ message: "Failed to fetch results" });
    }
  });

  app.post("/api/free-agents/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { players } = req.body;
      
      if (!Array.isArray(players) || players.length === 0) {
        return res.status(400).json({ message: "No players provided" });
      }

      const defaultEndTime = new Date();
      defaultEndTime.setDate(defaultEndTime.getDate() + 7);

      const agentsToCreate = players.map((p: any) => ({
        name: p.name,
        position: p.position || "UTIL",
        team: p.team || null,
        auctionEndTime: p.auctionEndTime ? new Date(p.auctionEndTime) : defaultEndTime,
        isActive: true,
      }));

      const newAgents = await storage.createFreeAgentsBulk(agentsToCreate);
      res.json(newAgents);
    } catch (error) {
      console.error("Error uploading free agents:", error);
      res.status(500).json({ message: "Failed to upload free agents" });
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
      const userId = req.user.claims.sub;
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

      // Get settings for year factors
      const settings = await storage.getSettings();
      const yearFactors = [
        settings.yearFactor1,
        settings.yearFactor2,
        settings.yearFactor3,
        settings.yearFactor4,
        settings.yearFactor5,
      ];
      
      const totalValue = amount * yearFactors[years - 1];

      // Check if bid beats current high bid by 10%
      const currentHighBid = await storage.getHighestBidForAgent(agentId);
      if (currentHighBid) {
        const minRequired = currentHighBid.totalValue * 1.1;
        if (totalValue < minRequired) {
          return res.status(400).json({ 
            message: `Bid must be at least 10% higher than current bid. Minimum total value: $${Math.ceil(minRequired)}` 
          });
        }
      }

      // Check budget if enforcement is enabled
      if (settings.enforceBudget) {
        const budgetInfo = await storage.getUserBudgetInfo(userId);
        
        // Calculate available budget for this bid
        // If user is already high bidder on this auction, that amount is freed up
        let availableForThisBid = budgetInfo.available;
        if (currentHighBid?.userId === userId) {
          availableForThisBid += currentHighBid.totalValue;
        }
        
        if (totalValue > availableForThisBid) {
          return res.status(400).json({ 
            message: `Bid exceeds your available budget. Available: $${Math.floor(availableForThisBid)}, Bid total: $${Math.ceil(totalValue)}` 
          });
        }
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
      await processAutoBids(agentId, userId, totalValue, settings);

      res.json(bid);
    } catch (error) {
      console.error("Error placing bid:", error);
      res.status(500).json({ message: "Failed to place bid" });
    }
  });

  // Auto-bid routes
  app.get("/api/free-agents/:id/auto-bid", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const agentId = parseInt(req.params.id);
      
      const agent = await storage.getFreeAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Free agent not found" });
      }

      if (new Date(agent.auctionEndTime) <= new Date()) {
        return res.status(400).json({ message: "Auction has ended" });
      }

      const { maxAmount, years, isActive } = req.body;
      
      const autoBid = await storage.createOrUpdateAutoBid({
        freeAgentId: agentId,
        userId,
        maxAmount,
        years,
        isActive,
      });

      // If auto-bid is active, try to place an auto-bid immediately
      if (isActive) {
        const settings = await storage.getSettings();
        const currentHighBid = await storage.getHighestBidForAgent(agentId);
        
        if (currentHighBid && currentHighBid.userId !== userId) {
          // Try to beat the current bid
          const yearFactors = [
            settings.yearFactor1,
            settings.yearFactor2,
            settings.yearFactor3,
            settings.yearFactor4,
            settings.yearFactor5,
          ];
          
          const factor = yearFactors[years - 1];
          const maxTotalValue = maxAmount * factor;
          const requiredTotalValue = currentHighBid.totalValue * 1.1;
          
          if (maxTotalValue >= requiredTotalValue) {
            const bidAmount = Math.ceil(requiredTotalValue / factor);
            const bidTotalValue = bidAmount * factor;
            
            await storage.createBid({
              freeAgentId: agentId,
              userId,
              amount: bidAmount,
              years,
              totalValue: bidTotalValue,
              isAutoBid: true,
            });
          }
        } else if (!currentHighBid) {
          // No current bid, place minimum bid
          const yearFactors = [
            settings.yearFactor1,
            settings.yearFactor2,
            settings.yearFactor3,
            settings.yearFactor4,
            settings.yearFactor5,
          ];
          const factor = yearFactors[years - 1];
          
          await storage.createBid({
            freeAgentId: agentId,
            userId,
            amount: 1,
            years,
            totalValue: 1 * factor,
            isAutoBid: true,
          });
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
      const userId = req.user.claims.sub;
      const bids = await storage.getUserBids(userId);
      res.json(bids);
    } catch (error) {
      console.error("Error fetching user bids:", error);
      res.status(500).json({ message: "Failed to fetch bids" });
    }
  });

  app.get("/api/my-auto-bids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Budget
  app.get("/api/budget", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const budgetInfo = await storage.getUserBudgetInfo(userId);
      res.json(budgetInfo);
    } catch (error) {
      console.error("Error fetching budget:", error);
      res.status(500).json({ message: "Failed to fetch budget" });
    }
  });

  // Commissioner: Update user budget
  app.patch("/api/users/:userId/budget", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const admin = await storage.getUser(adminId);
      
      if (!admin?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const { userId } = req.params;
      const { budget } = req.body;

      if (typeof budget !== "number" || budget < 0) {
        return res.status(400).json({ message: "Invalid budget value" });
      }

      const updated = await storage.updateUserBudget(userId, budget);
      res.json(updated);
    } catch (error) {
      console.error("Error updating user budget:", error);
      res.status(500).json({ message: "Failed to update budget" });
    }
  });

  // Commissioner: Reset all budgets
  app.post("/api/users/reset-budgets", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const admin = await storage.getUser(adminId);
      
      if (!admin?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const settings = await storage.getSettings();
      await storage.resetAllBudgets(settings.defaultBudget);
      res.json({ success: true, budget: settings.defaultBudget });
    } catch (error) {
      console.error("Error resetting budgets:", error);
      res.status(500).json({ message: "Failed to reset budgets" });
    }
  });

  // CSV Export - Auction Results
  app.get("/api/exports/auction-results.csv", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const results = await storage.getClosedFreeAgents();
      
      const headers = [
        "Player ID",
        "Player Name", 
        "Position",
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
        agent.position,
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isCommissioner) {
        return res.status(403).json({ message: "Commissioner access required" });
      }

      const results = await storage.getClosedFreeAgents();
      const allUsers = await storage.getAllUsers();
      
      const headers = [
        "Owner Name",
        "Owner Email",
        "Team Name",
        "Player ID",
        "Player Name",
        "Position",
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
            agent.position,
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

  return httpServer;
}

// Helper function to process auto-bids after a manual bid
async function processAutoBids(
  agentId: number,
  excludeUserId: string,
  currentTotalValue: number,
  settings: any
): Promise<void> {
  const autoBids = await storage.getAutoBidsForAgent(agentId);
  const yearFactors = [
    settings.yearFactor1,
    settings.yearFactor2,
    settings.yearFactor3,
    settings.yearFactor4,
    settings.yearFactor5,
  ];

  for (const autoBid of autoBids) {
    if (autoBid.userId === excludeUserId || !autoBid.isActive) continue;

    const factor = yearFactors[autoBid.years - 1];
    const maxTotalValue = autoBid.maxAmount * factor;
    const requiredTotalValue = currentTotalValue * 1.1;

    if (maxTotalValue >= requiredTotalValue) {
      const bidAmount = Math.ceil(requiredTotalValue / factor);
      const bidTotalValue = bidAmount * factor;

      // Check budget if enforcement is enabled
      if (settings.enforceBudget) {
        try {
          const budgetInfo = await storage.getUserBudgetInfo(autoBid.userId);
          
          // For auto-bids, check if user has enough available budget
          if (bidTotalValue > budgetInfo.available) {
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
      await processAutoBids(agentId, autoBid.userId, bidTotalValue, settings);
      break; // Only one auto-bid can win per cycle
    }
  }
}
