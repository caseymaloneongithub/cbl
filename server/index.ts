import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
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
  } catch (error) {
    log(`Finalization job error: ${error}`, "auction-job");
  }
}

// Background job to send hourly summary email to super admin
function startHourlySummaryEmailJob() {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  
  log("Hourly summary email job started", "email-job");
  
  // Run every hour (not immediately on startup to avoid spam during development)
  setInterval(runHourlySummaryEmail, INTERVAL_MS);
}

async function runHourlySummaryEmail() {
  try {
    // Get the super admin
    const superAdmin = await storage.getSuperAdmin();
    if (!superAdmin) {
      log("No super admin found, skipping hourly summary email", "email-job");
      return;
    }
    
    // Get auctions that closed in the last hour
    const recentResults = await storage.getRecentlyClosedAuctions(1);
    
    const totalClosed = recentResults.withBids.length + recentResults.noBids.length;
    
    // Only send email if there are results
    if (totalClosed === 0) {
      log("No auctions closed in the last hour, skipping email", "email-job");
      return;
    }
    
    // Format results for email
    const results = [
      ...recentResults.withBids.map(r => ({
        playerName: r.agent.name,
        team: r.agent.team || "N/A",
        auctionName: r.auctionName,
        winnerName: `${r.winner.firstName} ${r.winner.lastName}`,
        winnerTeam: r.winner.teamName || "Unknown",
        amount: r.winningBid.amount,
        years: r.winningBid.years,
        noBids: false,
      })),
      ...recentResults.noBids.map(r => ({
        playerName: r.agent.name,
        team: r.agent.team || "N/A",
        auctionName: r.auctionName,
        noBids: true,
      })),
    ];
    
    // Send email
    const adminName = superAdmin.firstName || "Admin";
    const emailResult = await sendAuctionResultsSummaryEmail(
      superAdmin.email,
      adminName,
      results
    );
    
    if (emailResult.success) {
      log(`Hourly summary email sent to ${superAdmin.email} (${totalClosed} auctions)`, "email-job");
    } else {
      log(`Failed to send hourly summary email: ${emailResult.error}`, "email-job");
    }
  } catch (error) {
    log(`Hourly summary email job error: ${error}`, "email-job");
  }
}
