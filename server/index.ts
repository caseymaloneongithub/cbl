import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, deployBundleItemAsAutoBid, processAllAutoBidsUntilStable } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { sendAuctionResultsSummaryEmail } from "./email";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      // Start the auction finalization job - runs every minute
      startAuctionFinalizationJob();
      
      // Start the hourly email summary job
      startHourlySummaryEmailJob();
    },
  );
})();

// Background job to finalize closed auctions every minute
function startAuctionFinalizationJob() {
  const INTERVAL_MS = 60 * 1000; // 1 minute
  
  log("Auction finalization job started (runs every minute)", "auction-job");
  
  // Run immediately on startup to catch any missed auctions
  runFinalization();
  
  // Then run every minute
  setInterval(runFinalization, INTERVAL_MS);
}

async function runFinalization() {
  try {
    const result = await storage.finalizeClosedAuctions();
    if (result.finalized > 0) {
      log(`Finalized ${result.finalized} auction(s)`, "auction-job");
    }
    if (result.errors.length > 0) {
      log(`Errors: ${result.errors.join(", ")}`, "auction-job");
    }
    
    // Process activated bundle items - deploy auto-bids for next items in bundles
    if (result.activatedBundleItems.length > 0) {
      log(`Processing ${result.activatedBundleItems.length} activated bundle item(s)`, "auction-job");
      
      for (const activatedItem of result.activatedBundleItems) {
        try {
          // Get the full bundle with items
          const bundle = await storage.getBidBundle(activatedItem.bundleId);
          if (!bundle) {
            log(`Bundle ${activatedItem.bundleId} not found`, "auction-job");
            continue;
          }
          
          // Find the activated item in the bundle
          const item = bundle.items.find(i => i.id === activatedItem.itemId);
          if (!item) {
            log(`Bundle item ${activatedItem.itemId} not found in bundle`, "auction-job");
            continue;
          }
          
          // Deploy the bundle item as an auto-bid
          const deployed = await deployBundleItemAsAutoBid(item, bundle);
          if (deployed) {
            log(`Deployed bundle item ${activatedItem.itemId} for player ${activatedItem.freeAgentId}`, "auction-job");
          }
        } catch (error) {
          log(`Error deploying bundle item ${activatedItem.itemId}: ${error}`, "auction-job");
        }
      }
    }
    
    // Deploy pending auto-bids for auctions that just started
    await deployPendingAutoBids();
    
  } catch (error) {
    log(`Finalization job error: ${error}`, "auction-job");
  }
}

// Deploy auto-bids on players whose auctions have just started
async function deployPendingAutoBids() {
  try {
    const pendingAutoBids = await storage.getPendingAutoBidsForStartedAuctions();
    
    if (pendingAutoBids.length === 0) {
      return;
    }
    
    log(`Deploying ${pendingAutoBids.length} pending auto-bid(s) for started auctions`, "auction-job");
    
    for (const pending of pendingAutoBids) {
      try {
        // Get the free agent details
        const agent = await storage.getFreeAgent(pending.freeAgentId);
        if (!agent) {
          log(`Free agent ${pending.freeAgentId} not found`, "auction-job");
          continue;
        }
        
        // Get auction for per-auction settings
        const auction = await storage.getAuction(pending.auctionId);
        if (!auction) {
          log(`Auction ${pending.auctionId} not found`, "auction-job");
          continue;
        }
        
        // Get current highest bid
        const currentHighBid = await storage.getHighestBidForAgent(pending.freeAgentId);
        
        const yearFactors = [
          auction.yearFactor1,
          auction.yearFactor2,
          auction.yearFactor3,
          auction.yearFactor4,
          auction.yearFactor5,
        ];
        
        // Calculate the bid amount to place
        let bidAmount: number;
        if (!currentHighBid) {
          // No bids yet - place opening bid at minimum
          bidAmount = agent.minimumBid || 1;
        } else {
          // Outbid the current high bid
          const minIncrement = auction.bidIncrement || 0.05;
          const increment = Math.max(1, Math.ceil(currentHighBid.amount * minIncrement));
          bidAmount = currentHighBid.amount + increment;
        }
        
        // Check if our max is enough
        if (bidAmount > pending.maxAmount) {
          log(`Auto-bid for ${agent.name} skipped: required $${bidAmount} exceeds max $${pending.maxAmount}`, "auction-job");
          continue;
        }
        
        // Check if user is enrolled in the auction
        const canBidResult = await storage.canUserBidOnPlayer(pending.userId, pending.freeAgentId);
        if (!canBidResult.canBid) {
          log(`Auto-bid for ${agent.name} skipped: ${canBidResult.reason}`, "auction-job");
          continue;
        }
        
        // Calculate total value
        const yearFactor = yearFactors[pending.years - 1] || 1;
        const totalValue = bidAmount * yearFactor;
        
        // Place the bid
        await storage.createBid({
          freeAgentId: pending.freeAgentId,
          userId: pending.userId,
          amount: bidAmount,
          years: pending.years,
          totalValue,
          isAutoBid: true,
        });
        
        log(`Deployed auto-bid for ${agent.name}: $${bidAmount} x ${pending.years}yr by user ${pending.userId}`, "auction-job");
        
        // Trigger auto-bid competition so other auto-bids can outbid this one
        const competitionResult = await processAllAutoBidsUntilStable(pending.freeAgentId, pending.userId, auction);
        if (competitionResult) {
          log(`Auto-bid competition triggered for ${agent.name}`, "auction-job");
        }
        
      } catch (error) {
        log(`Error deploying auto-bid ${pending.autoBidId}: ${error}`, "auction-job");
      }
    }
  } catch (error) {
    log(`Error in deployPendingAutoBids: ${error}`, "auction-job");
  }
}

// Background job to send hourly summary email based on auction settings
function startHourlySummaryEmailJob() {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  
  log("Hourly summary email job started", "email-job");
  
  // Run every hour (not immediately on startup to avoid spam during development)
  setInterval(runHourlySummaryEmail, INTERVAL_MS);
}

async function runHourlySummaryEmail() {
  try {
    // Get auctions that closed in the last hour
    const recentResults = await storage.getRecentlyClosedAuctions(1);
    
    const totalClosed = recentResults.withBids.length + recentResults.noBids.length;
    
    // Only send emails if there are results
    if (totalClosed === 0) {
      log("No auctions closed in the last hour, skipping email", "email-job");
      return;
    }
    
    // Group results by auction and email notification setting
    const auctionGroups = new Map<number, {
      auctionName: string;
      emailNotifications: string;
      leagueId: number | null;
      withBids: typeof recentResults.withBids;
      noBids: typeof recentResults.noBids;
    }>();
    
    for (const result of recentResults.withBids) {
      if (!auctionGroups.has(result.auctionId)) {
        auctionGroups.set(result.auctionId, {
          auctionName: result.auctionName,
          emailNotifications: result.emailNotifications,
          leagueId: result.leagueId,
          withBids: [],
          noBids: [],
        });
      }
      auctionGroups.get(result.auctionId)!.withBids.push(result);
    }
    
    for (const result of recentResults.noBids) {
      if (!auctionGroups.has(result.auctionId)) {
        auctionGroups.set(result.auctionId, {
          auctionName: result.auctionName,
          emailNotifications: result.emailNotifications,
          leagueId: result.leagueId,
          withBids: [],
          noBids: [],
        });
      }
      auctionGroups.get(result.auctionId)!.noBids.push(result);
    }
    
    // Get super admin for fallback notifications
    const superAdmin = await storage.getSuperAdmin();
    if (!superAdmin) {
      log("WARN: No super admin found - fallback notifications will be unavailable", "email-job");
    }
    
    // Process each auction's email settings
    const auctionEntries = Array.from(auctionGroups.entries());
    for (const [auctionId, group] of auctionEntries) {
      // Auctions with "none" notifications or no league get sent to super admin only
      const sendToSuperAdminOnly = group.emailNotifications === "none" || !group.leagueId;
      
      // Format results for email
      const results = [
        ...group.withBids.map((r: typeof recentResults.withBids[0]) => ({
          playerName: r.agent.name,
          team: r.agent.team || "N/A",
          auctionName: r.auctionName,
          winnerName: `${r.winner.firstName} ${r.winner.lastName}`,
          winnerTeam: r.winner.teamName || "Unknown",
          amount: r.winningBid.amount,
          years: r.winningBid.years,
          noBids: false,
        })),
        ...group.noBids.map((r: typeof recentResults.noBids[0]) => ({
          playerName: r.agent.name,
          team: r.agent.team || "N/A",
          auctionName: r.auctionName,
          noBids: true,
        })),
      ];
      
      // Get recipients based on emailNotifications setting
      let recipients: Array<{ email: string; firstName: string | null; userId?: string }> = [];
      
      if (sendToSuperAdminOnly) {
        // Fallback to super admin for auctions with "none" or no league
        if (superAdmin) {
          recipients = [{ email: superAdmin.email, firstName: superAdmin.firstName }];
          log(`Auction ${auctionId} using super admin fallback (setting: ${group.emailNotifications}, leagueId: ${group.leagueId})`, "email-job");
        }
      } else if (group.emailNotifications === "commissioner") {
        const commissioner = await storage.getLeagueCommissionerEmail(group.leagueId!);
        if (commissioner) {
          recipients = [commissioner];
        } else if (superAdmin) {
          // Secondary fallback to super admin if no commissioner found
          recipients = [{ email: superAdmin.email, firstName: superAdmin.firstName }];
          log(`Auction ${auctionId} no commissioner found, using super admin fallback`, "email-job");
        }
      } else if (group.emailNotifications === "league") {
        const allMembers = await storage.getLeagueMembersEmails(group.leagueId!);
        // Filter out users who have opted out of emails for this auction
        const optedOutUserIds = await storage.getOptedOutUserIds(auctionId);
        const filteredMembers = allMembers.filter(m => !optedOutUserIds.includes(m.userId));
        recipients = filteredMembers;
        
        if (optedOutUserIds.length > 0) {
          log(`Auction ${auctionId}: ${optedOutUserIds.length} users opted out of emails`, "email-job");
        }
        
        if (recipients.length === 0 && superAdmin) {
          // Secondary fallback to super admin if no league members found (after opt-outs)
          recipients = [{ email: superAdmin.email, firstName: superAdmin.firstName, userId: superAdmin.id }];
          log(`Auction ${auctionId} no league members found (after opt-outs), using super admin fallback`, "email-job");
        }
      } else if (group.emailNotifications === "bidders") {
        // Get unique bidders across all closing free agents in this auction
        const closingFreeAgentIds = [
          ...group.withBids.map(r => r.agent.id),
          ...group.noBids.map(r => r.agent.id),
        ];
        const bidders = await storage.getBidderEmailsForFreeAgents(closingFreeAgentIds);
        recipients = bidders;
        log(`Auction ${auctionId}: Found ${bidders.length} unique bidders for ${closingFreeAgentIds.length} closing auctions`, "email-job");
        
        if (recipients.length === 0 && superAdmin) {
          // Fallback to super admin if no bidders found
          recipients = [{ email: superAdmin.email, firstName: superAdmin.firstName, userId: superAdmin.id }];
          log(`Auction ${auctionId} no bidders found, using super admin fallback`, "email-job");
        }
      }
      
      if (recipients.length === 0) {
        log(`WARN: No recipients found for auction ${auctionId} (${group.emailNotifications}) and no super admin fallback available`, "email-job");
        continue;
      }
      
      // Build opt-out link for league-wide notifications
      const appUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : process.env.REPLIT_DEPLOYMENT_DOMAIN 
          ? `https://${process.env.REPLIT_DEPLOYMENT_DOMAIN}`
          : 'https://cbl-auctions.replit.app';
      const optOutLink = group.emailNotifications === "league" ? `${appUrl}` : undefined;
      
      // Send email to each recipient
      for (const recipient of recipients) {
        const recipientName = recipient.firstName || "Team Owner";
        const emailResult = await sendAuctionResultsSummaryEmail(
          recipient.email,
          recipientName,
          results,
          optOutLink
        );
        
        if (emailResult.success) {
          log(`Email sent to ${recipient.email} for auction ${auctionId} (${results.length} results)`, "email-job");
        } else {
          log(`Failed to send email to ${recipient.email}: ${emailResult.error}`, "email-job");
        }
      }
    }
    
    log(`Processed ${auctionGroups.size} auctions for email notifications`, "email-job");
  } catch (error) {
    log(`Hourly summary email job error: ${error}`, "email-job");
  }
}
