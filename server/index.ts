import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, deployBundleItemAsAutoBid, processAllAutoBidsUntilStable, processAutoDraft } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { sendAuctionResultsSummaryEmail } from "./email";

import { Pool } from "pg";

const app = express();
const httpServer = createServer(app);
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || "100mb";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: REQUEST_BODY_LIMIT,
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));

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

async function runPendingMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: rosterSlotCheck } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'league_roster_assignments' AND column_name = 'roster_slot'`
    );
    if (rosterSlotCheck.length === 0) {
      log("Applying migration 0017: add roster_slot column", "migration");
      await pool.query(`ALTER TABLE league_roster_assignments ADD COLUMN IF NOT EXISTS roster_slot varchar(10)`);
      log("Migration 0017 applied", "migration");
    }

    const { rows: statsSeasonCheck } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'mlb_players' AND column_name = 'stats_season'`
    );
    if (statsSeasonCheck.length === 0) {
      log("Applying migration 0018: add stats_season column", "migration");
      await pool.query(`ALTER TABLE mlb_players ADD COLUMN IF NOT EXISTS stats_season integer`);
      log("Migration 0018 applied", "migration");
    }

    const { rows: statsTableCheck } = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'mlb_player_stats'`
    );
    if (statsTableCheck.length === 0) {
      log("Applying migration 0019: create mlb_player_stats table", "migration");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS mlb_player_stats (
          id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          mlb_player_id integer NOT NULL REFERENCES mlb_players(id),
          season integer NOT NULL,
          sport_level text,
          had_hitting_stats boolean DEFAULT false,
          had_pitching_stats boolean DEFAULT false,
          hitting_at_bats integer DEFAULT 0,
          hitting_walks integer DEFAULT 0,
          hitting_singles integer DEFAULT 0,
          hitting_doubles integer DEFAULT 0,
          hitting_triples integer DEFAULT 0,
          hitting_home_runs integer DEFAULT 0,
          hitting_avg real,
          hitting_obp real,
          hitting_slg real,
          hitting_ops real,
          pitching_games integer DEFAULT 0,
          pitching_games_started integer DEFAULT 0,
          pitching_strikeouts integer DEFAULT 0,
          pitching_walks integer DEFAULT 0,
          pitching_hits integer DEFAULT 0,
          pitching_home_runs integer DEFAULT 0,
          pitching_era real,
          pitching_innings_pitched real DEFAULT 0,
          hitting_games_started integer DEFAULT 0,
          hitting_plate_appearances integer DEFAULT 0,
          is_two_way_qualified boolean DEFAULT false
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_mlb_player_stats_player_season ON mlb_player_stats(mlb_player_id, season)`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_mlb_player_stats_unique ON mlb_player_stats(mlb_player_id, season)`);
      await pool.query(`
        INSERT INTO mlb_player_stats (
          mlb_player_id, season, sport_level,
          had_hitting_stats, had_pitching_stats,
          hitting_at_bats, hitting_walks, hitting_singles, hitting_doubles, hitting_triples, hitting_home_runs,
          hitting_avg, hitting_obp, hitting_slg, hitting_ops,
          pitching_games, pitching_games_started, pitching_strikeouts, pitching_walks, pitching_hits, pitching_home_runs,
          pitching_era, pitching_innings_pitched,
          hitting_games_started, hitting_plate_appearances,
          is_two_way_qualified
        )
        SELECT
          id, COALESCE(stats_season, season), sport_level,
          had_hitting_stats, had_pitching_stats,
          hitting_at_bats, hitting_walks, hitting_singles, hitting_doubles, hitting_triples, hitting_home_runs,
          hitting_avg, hitting_obp, hitting_slg, hitting_ops,
          pitching_games, pitching_games_started, pitching_strikeouts, pitching_walks, pitching_hits, pitching_home_runs,
          pitching_era, pitching_innings_pitched,
          hitting_games_started, hitting_plate_appearances,
          is_two_way_qualified
        FROM mlb_players
        WHERE had_hitting_stats = true OR had_pitching_stats = true
        ON CONFLICT DO NOTHING
      `);
      const { rows: countRows } = await pool.query(`SELECT COUNT(*) as cnt FROM mlb_player_stats`);
      log(`Migration 0019 applied: ${countRows[0].cnt} stat rows migrated`, "migration");
    }

    const { rows: tradesTableCheck } = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'trades'`
    );
    if (tradesTableCheck.length === 0) {
      log("Applying migration 0021: create trades tables", "migration");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS trades (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          league_id INTEGER NOT NULL REFERENCES leagues(id),
          proposing_user_id VARCHAR NOT NULL REFERENCES users(id),
          partner_user_id VARCHAR NOT NULL REFERENCES users(id),
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          notes TEXT,
          season INTEGER NOT NULL,
          proposed_at TIMESTAMP DEFAULT NOW() NOT NULL,
          responded_at TIMESTAMP
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_trades_league ON trades(league_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS trade_items (
          id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          trade_id INTEGER NOT NULL REFERENCES trades(id),
          from_user_id VARCHAR NOT NULL REFERENCES users(id),
          mlb_player_id INTEGER NOT NULL REFERENCES mlb_players(id),
          roster_type VARCHAR(10) NOT NULL
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_trade_items_trade ON trade_items(trade_id)`);
      log("Migration 0021 applied", "migration");
    }

    const { rows: wrcPlusCheck } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'mlb_player_stats' AND column_name = 'hitting_wrc_plus'`
    );
    if (wrcPlusCheck.length === 0) {
      log("Applying migration 0022: add hitting_wrc_plus column", "migration");
      await pool.query(`ALTER TABLE mlb_player_stats ADD COLUMN IF NOT EXISTS hitting_wrc_plus real`);
      log("Migration 0022 applied", "migration");
    }

    log("All migrations up to date", "migration");
  } catch (error) {
    log(`Migration error: ${error}`, "migration");
    throw error;
  } finally {
    await pool.end();
  }
}

(async () => {
  await runPendingMigrations();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const isPayloadTooLarge = status === 413 || err?.type === "entity.too.large";
    const message = isPayloadTooLarge
      ? `Request too large. Reduce CSV size or raise REQUEST_BODY_LIMIT (current: ${REQUEST_BODY_LIMIT}).`
      : (err.message || "Internal Server Error");

    console.error("[express-error]", {
      status,
      type: err?.type || null,
      message: err?.message || null,
    });
    res.status(status).json({ message });
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
      
      // Start the draft deadline job - runs every minute
      startDraftDeadlineJob();
      
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
    
    // Deploy pending bundle items for auctions that just started
    await deployPendingBundleItems();
    
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

// Deploy bundle items whose auctions have just started
async function deployPendingBundleItems() {
  try {
    const pendingItems = await storage.getPendingBundleItemsForStartedAuctions();
    
    if (pendingItems.length === 0) {
      return;
    }
    
    log(`Deploying ${pendingItems.length} pending bundle item(s) for started auctions`, "auction-job");
    
    for (const pending of pendingItems) {
      try {
        // Get the full bundle with items
        const bundle = await storage.getBidBundle(pending.bundleId);
        if (!bundle) {
          log(`Bundle ${pending.bundleId} not found`, "auction-job");
          continue;
        }
        
        // Find the item in the bundle
        const item = bundle.items.find(i => i.id === pending.itemId);
        if (!item) {
          log(`Bundle item ${pending.itemId} not found in bundle`, "auction-job");
          continue;
        }
        
        // Deploy the bundle item as an auto-bid
        const deployed = await deployBundleItemAsAutoBid(item, bundle);
        if (deployed) {
          log(`Deployed bundle item ${pending.itemId} for player (agent ID ${pending.freeAgentId})`, "auction-job");
        }
      } catch (error) {
        log(`Error deploying bundle item ${pending.itemId}: ${error}`, "auction-job");
      }
    }
  } catch (error) {
    log(`Error in deployPendingBundleItems: ${error}`, "auction-job");
  }
}

// Background job to process draft deadlines every minute
function startDraftDeadlineJob() {
  const INTERVAL_MS = 60 * 1000;

  log("Draft deadline job started (runs every minute)", "draft-job");

  runDraftDeadlineCheck();

  setInterval(runDraftDeadlineCheck, INTERVAL_MS);
}

async function runDraftDeadlineCheck() {
  try {
    const activeDraftIds = await storage.getActiveDraftIds();
    for (const draftId of activeDraftIds) {
      await processAutoDraft(draftId, storage);
    }
  } catch (error) {
    log(`Draft deadline check error: ${error}`, "draft-job");
  }
}

// Background job to send hourly summary email based on auction settings
function startHourlySummaryEmailJob() {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  
  log("Hourly summary email job started", "email-job");
  
  // Run once after a short delay on startup to catch any pending emails
  // This ensures emails aren't missed if server restarts during an active auction period
  setTimeout(() => {
    log("Running initial email check after startup", "email-job");
    runHourlySummaryEmail();
  }, 30 * 1000); // 30 second delay to let system settle
  
  // Then run every hour
  setInterval(runHourlySummaryEmail, INTERVAL_MS);
}

async function runHourlySummaryEmail() {
  try {
    // Get all closed auctions that haven't been emailed yet
    // This ensures we never miss any auctions, regardless of timing issues
    const recentResults = await storage.getUnemailedClosedAuctions();
    
    const totalClosed = recentResults.withBids.length + recentResults.noBids.length;
    
    // Only send emails if there are results
    if (totalClosed === 0) {
      log("No unemailed closed auctions found, skipping", "email-job");
      return;
    }
    
    // Collect all free agent IDs to mark as emailed after processing
    const allFreeAgentIds: number[] = [
      ...recentResults.withBids.map(r => r.agent.id),
      ...recentResults.noBids.map(r => r.agent.id),
    ];
    
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
      
      // Send email to each recipient with rate limiting (Resend allows 2 requests/second)
      log(`Auction ${auctionId}: Sending emails to ${recipients.length} recipients`, "email-job");
      let successCount = 0;
      let failCount = 0;
      
      for (const recipient of recipients) {
        const recipientName = recipient.firstName || "Team Owner";
        const emailResult = await sendAuctionResultsSummaryEmail(
          recipient.email,
          recipientName,
          results,
          optOutLink
        );
        
        if (emailResult.success) {
          successCount++;
        } else {
          failCount++;
          log(`Failed to send email to ${recipient.email}: ${emailResult.error}`, "email-job");
        }
        
        // Rate limit: wait 600ms between emails to stay under Resend's 2 requests/second limit
        if (recipients.indexOf(recipient) < recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 600));
        }
      }
      
      log(`Auction ${auctionId}: Sent ${successCount}/${recipients.length} emails (${failCount} failed)`, "email-job");
    }
    
    // Mark all processed free agents as emailed (even if some emails failed)
    // This prevents re-processing the same auctions on next run
    await storage.markFreeAgentsAsEmailed(allFreeAgentIds);
    log(`Marked ${allFreeAgentIds.length} free agents as emailed`, "email-job");
    
    log(`Processed ${auctionGroups.size} auctions for email notifications`, "email-job");
  } catch (error) {
    log(`Hourly summary email job error: ${error}`, "email-job");
  }
}
