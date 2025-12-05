import {
  users,
  leagueSettings,
  freeAgents,
  bids,
  autoBids,
  passwordResetTokens,
  auctions,
  auctionTeams,
  type User,
  type UpsertUser,
  type LeagueSettings,
  type InsertLeagueSettings,
  type FreeAgent,
  type InsertFreeAgent,
  type Bid,
  type InsertBid,
  type AutoBid,
  type InsertAutoBid,
  type FreeAgentWithBids,
  type BidWithUser,
  type PasswordResetToken,
  type Auction,
  type InsertAuction,
  type AuctionTeam,
  type InsertAuctionTeam,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, lt, sql, isNull } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserCommissioner(id: string, isCommissioner: boolean): Promise<User | undefined>;
  setSoleCommissioner(userId: string | null): Promise<User | null>;
  updateUserPassword(id: string, passwordHash: string, mustResetPassword: boolean): Promise<User | undefined>;
  updateUserDetails(id: string, details: { email?: string; firstName?: string; lastName?: string; teamName?: string; teamAbbreviation?: string }): Promise<User | undefined>;
  createUserWithPassword(userData: { email: string; passwordHash: string; firstName?: string; lastName?: string; teamName?: string; teamAbbreviation?: string; isCommissioner?: boolean; mustResetPassword?: boolean }): Promise<User>;
  
  // League settings
  getSettings(): Promise<LeagueSettings>;
  updateSettings(settings: Partial<InsertLeagueSettings>): Promise<LeagueSettings>;
  
  // Free agents
  getFreeAgent(id: number): Promise<FreeAgent | undefined>;
  getFreeAgentWithBids(id: number): Promise<FreeAgentWithBids | undefined>;
  getAllFreeAgents(): Promise<FreeAgentWithBids[]>;
  getActiveFreeAgents(auctionId?: number): Promise<FreeAgentWithBids[]>;
  getClosedFreeAgents(auctionId?: number): Promise<FreeAgentWithBids[]>;
  getExpiredFreeAgentsNoBids(auctionId: number): Promise<FreeAgentWithBids[]>;
  getFreeAgentsByAuction(auctionId: number): Promise<FreeAgentWithBids[]>;
  createFreeAgent(agent: InsertFreeAgent): Promise<FreeAgent>;
  createFreeAgentsBulk(agents: InsertFreeAgent[]): Promise<FreeAgent[]>;
  updateFreeAgentWinner(id: number, winnerId: string, winningBidId: number): Promise<void>;
  relistFreeAgent(id: number, minimumBid: number, minimumYears: number, auctionEndTime: Date): Promise<FreeAgent>;
  deleteFreeAgent(id: number): Promise<void>;
  
  // Bids
  getBid(id: number): Promise<Bid | undefined>;
  getBidsForAgent(agentId: number): Promise<BidWithUser[]>;
  getHighestBidForAgent(agentId: number): Promise<Bid | undefined>;
  getUserBids(userId: string): Promise<FreeAgentWithBids[]>;
  createBid(bid: InsertBid): Promise<Bid>;
  
  // Auto bids
  getAutoBid(agentId: number, userId: string): Promise<AutoBid | undefined>;
  getAutoBidsForAgent(agentId: number): Promise<AutoBid[]>;
  getUserAutoBids(userId: string): Promise<(AutoBid & { freeAgent: FreeAgent })[]>;
  createOrUpdateAutoBid(autoBid: InsertAutoBid): Promise<AutoBid>;
  
  // Stats
  getUserStats(userId: string): Promise<{
    totalActive: number;
    myActiveBids: number;
    myWins: number;
    endingToday: number;
  }>;
  
  // Budget management (per-auction only - budgets are stored in auctionTeams)
  getUserBudgetInfo(userId: string, auctionId: number): Promise<{
    budget: number;
    spent: number;
    committed: number;
    available: number;
  }>;
  getAuctionTeamBudget(auctionId: number, userId: string): Promise<number>;
  updateAuctionTeamBudget(auctionId: number, userId: string, budget: number): Promise<AuctionTeam>;
  resetAuctionBudgets(auctionId: number, amount: number): Promise<void>;
  
  // Team limits management (per-auction only - limits are stored in auctionTeams)
  updateAuctionTeamLimits(auctionId: number, userId: string, limits: { rosterLimit?: number | null; ipLimit?: number | null; paLimit?: number | null }): Promise<AuctionTeam>;
  getUserLimitsInfo(userId: string, auctionId: number): Promise<{
    rosterLimit: number | null;
    rosterUsed: number;
    rosterAvailable: number | null;
    ipLimit: number | null;
    ipUsed: number;
    ipAvailable: number | null;
    paLimit: number | null;
    paUsed: number;
    paAvailable: number | null;
  }>;
  canUserBidOnPlayer(userId: string, playerId: number): Promise<{
    canBid: boolean;
    reason?: string;
  }>;
  
  // Password reset tokens
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: number): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
  
  // Auctions
  getAuction(id: number): Promise<Auction | undefined>;
  getAllAuctions(): Promise<Auction[]>;
  getActiveAuction(): Promise<Auction | undefined>;
  createAuction(auction: InsertAuction): Promise<Auction>;
  updateAuction(id: number, data: Partial<InsertAuction>): Promise<Auction>;
  deleteAuction(id: number): Promise<void>;
  resetAuction(id: number): Promise<void>;
  
  // Auction teams
  getAuctionTeams(auctionId: number): Promise<(AuctionTeam & { user: User })[]>;
  setAuctionTeamActive(auctionId: number, userId: string, isActive: boolean): Promise<AuctionTeam>;
  enrollTeamsInAuction(
    auctionId: number, 
    userIds: string[], 
    defaultBudget: number,
    rosterLimit?: number | null,
    ipLimit?: number | null,
    paLimit?: number | null
  ): Promise<AuctionTeam[]>;
  enrollTeamsInAuctionBulk(
    auctionId: number,
    teams: { userId: string; budget: number; rosterLimit: number | null; ipLimit: number | null; paLimit: number | null }[]
  ): Promise<AuctionTeam[]>;
  removeTeamFromAuction(auctionId: number, userId: string): Promise<boolean>;
  getTeamsNotInAuction(auctionId: number): Promise<User[]>;
  
  // Team deletion
  canDeleteUser(userId: string): Promise<{ canDelete: boolean; reason?: string }>;
  deleteUser(userId: string): Promise<void>;
  
  // Auction finalization (background job)
  finalizeClosedAuctions(): Promise<{ finalized: number; errors: string[] }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateUserCommissioner(id: string, isCommissioner: boolean): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ isCommissioner, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async setSoleCommissioner(userId: string | null): Promise<User | null> {
    return await db.transaction(async (tx) => {
      if (userId !== null) {
        const [targetUser] = await tx.select().from(users).where(eq(users.id, userId));
        if (!targetUser) {
          throw new Error("Target user not found");
        }
      }
      
      await tx
        .update(users)
        .set({ isCommissioner: false, updatedAt: new Date() })
        .where(eq(users.isCommissioner, true));
      
      if (userId === null) {
        return null;
      }
      
      const [user] = await tx
        .update(users)
        .set({ isCommissioner: true, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      return user || null;
    });
  }

  async updateUserPassword(id: string, passwordHash: string, mustResetPassword: boolean): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ passwordHash, mustResetPassword, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserDetails(id: string, details: { email?: string; firstName?: string; lastName?: string; teamName?: string; teamAbbreviation?: string }): Promise<User | undefined> {
    const updateData: any = { updatedAt: new Date() };
    if (details.email !== undefined) updateData.email = details.email;
    if (details.firstName !== undefined) updateData.firstName = details.firstName;
    if (details.lastName !== undefined) updateData.lastName = details.lastName;
    if (details.teamName !== undefined) updateData.teamName = details.teamName;
    if (details.teamAbbreviation !== undefined) updateData.teamAbbreviation = details.teamAbbreviation?.toUpperCase().slice(0, 3);
    
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async createUserWithPassword(userData: { 
    email: string; 
    passwordHash: string; 
    firstName?: string; 
    lastName?: string; 
    teamName?: string; 
    teamAbbreviation?: string;
    isCommissioner?: boolean; 
    mustResetPassword?: boolean;
  }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: userData.email,
        passwordHash: userData.passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        teamName: userData.teamName,
        teamAbbreviation: userData.teamAbbreviation,
        isCommissioner: userData.isCommissioner ?? false,
        mustResetPassword: userData.mustResetPassword ?? true,
      })
      .returning();
    return user;
  }

  // League settings
  async getSettings(): Promise<LeagueSettings> {
    const [settings] = await db.select().from(leagueSettings).where(eq(leagueSettings.id, 1));
    if (!settings) {
      const [newSettings] = await db.insert(leagueSettings).values({ id: 1 }).returning();
      return newSettings;
    }
    return settings;
  }

  async updateSettings(settingsData: Partial<InsertLeagueSettings>): Promise<LeagueSettings> {
    const [settings] = await db
      .update(leagueSettings)
      .set({ ...settingsData, updatedAt: new Date() })
      .where(eq(leagueSettings.id, 1))
      .returning();
    return settings;
  }

  // Free agents
  async getFreeAgent(id: number): Promise<FreeAgent | undefined> {
    const [agent] = await db.select().from(freeAgents).where(eq(freeAgents.id, id));
    return agent;
  }

  async getFreeAgentWithBids(id: number): Promise<FreeAgentWithBids | undefined> {
    const [agent] = await db.select().from(freeAgents).where(eq(freeAgents.id, id));
    if (!agent) return undefined;
    const [enriched] = await this.enrichFreeAgentsWithBids([agent]);
    return enriched;
  }

  async getAllFreeAgents(): Promise<FreeAgentWithBids[]> {
    const agents = await db.select().from(freeAgents).orderBy(desc(freeAgents.auctionEndTime));
    return this.enrichFreeAgentsWithBids(agents);
  }

  async getActiveFreeAgents(auctionId?: number): Promise<FreeAgentWithBids[]> {
    const now = new Date();
    const conditions = [
      eq(freeAgents.isActive, true),
      sql`${freeAgents.auctionEndTime} > ${now}`
    ];
    
    if (auctionId !== undefined) {
      conditions.push(eq(freeAgents.auctionId, auctionId));
    }
    
    const agents = await db
      .select()
      .from(freeAgents)
      .where(and(...conditions))
      .orderBy(freeAgents.auctionEndTime);
    return this.enrichFreeAgentsWithBids(agents);
  }

  async getClosedFreeAgents(auctionId?: number): Promise<FreeAgentWithBids[]> {
    const now = new Date();
    const conditions = [sql`${freeAgents.auctionEndTime} <= ${now}`];
    
    if (auctionId !== undefined) {
      conditions.push(eq(freeAgents.auctionId, auctionId));
    }
    
    const agents = await db
      .select()
      .from(freeAgents)
      .where(and(...conditions))
      .orderBy(desc(freeAgents.auctionEndTime));
    return this.enrichFreeAgentsWithBids(agents);
  }

  async getExpiredFreeAgentsNoBids(auctionId: number): Promise<FreeAgentWithBids[]> {
    const now = new Date();
    
    // Get expired players for this auction
    const expiredAgents = await db
      .select()
      .from(freeAgents)
      .where(and(
        eq(freeAgents.auctionId, auctionId),
        sql`${freeAgents.auctionEndTime} <= ${now}`,
        eq(freeAgents.isActive, true)
      ))
      .orderBy(freeAgents.name);
    
    // Filter to only those with no bids
    const agentsNoBids: FreeAgent[] = [];
    for (const agent of expiredAgents) {
      const bidCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(bids)
        .where(eq(bids.freeAgentId, agent.id));
      
      if (Number(bidCount[0]?.count || 0) === 0) {
        agentsNoBids.push(agent);
      }
    }
    
    return this.enrichFreeAgentsWithBids(agentsNoBids);
  }
  
  async getFreeAgentsByAuction(auctionId: number): Promise<FreeAgentWithBids[]> {
    const agents = await db
      .select()
      .from(freeAgents)
      .where(eq(freeAgents.auctionId, auctionId))
      .orderBy(desc(freeAgents.auctionEndTime));
    return this.enrichFreeAgentsWithBids(agents);
  }

  private async enrichFreeAgentsWithBids(agents: FreeAgent[]): Promise<FreeAgentWithBids[]> {
    const enriched: FreeAgentWithBids[] = [];
    
    for (const agent of agents) {
      const highestBid = await this.getHighestBidForAgent(agent.id);
      const bidCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(bids)
        .where(eq(bids.freeAgentId, agent.id));
      
      let highBidder: User | null = null;
      if (highestBid) {
        const [bidder] = await db.select().from(users).where(eq(users.id, highestBid.userId));
        highBidder = bidder || null;
      }
      
      enriched.push({
        ...agent,
        currentBid: highestBid || null,
        highBidder,
        bidCount: Number(bidCount[0]?.count || 0),
      });
    }
    
    return enriched;
  }

  async createFreeAgent(agent: InsertFreeAgent): Promise<FreeAgent> {
    const [newAgent] = await db.insert(freeAgents).values(agent).returning();
    return newAgent;
  }

  async createFreeAgentsBulk(agents: InsertFreeAgent[]): Promise<FreeAgent[]> {
    if (agents.length === 0) return [];
    const newAgents = await db.insert(freeAgents).values(agents).returning();
    return newAgents;
  }

  async updateFreeAgentWinner(id: number, winnerId: string, winningBidId: number): Promise<void> {
    await db
      .update(freeAgents)
      .set({ winnerId, winningBidId, isActive: false })
      .where(eq(freeAgents.id, id));
  }

  async relistFreeAgent(id: number, minimumBid: number, minimumYears: number, auctionEndTime: Date): Promise<FreeAgent> {
    const [updated] = await db
      .update(freeAgents)
      .set({ 
        minimumBid, 
        minimumYears,
        auctionEndTime, 
        isActive: true,
        winnerId: null,
        winningBidId: null
      })
      .where(eq(freeAgents.id, id))
      .returning();
    return updated;
  }

  async deleteFreeAgent(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(bids).where(eq(bids.freeAgentId, id));
      await tx.delete(autoBids).where(eq(autoBids.freeAgentId, id));
      await tx.delete(freeAgents).where(eq(freeAgents.id, id));
    });
  }

  // Bids
  async getBid(id: number): Promise<Bid | undefined> {
    const [bid] = await db.select().from(bids).where(eq(bids.id, id));
    return bid;
  }

  async getBidsForAgent(agentId: number): Promise<BidWithUser[]> {
    const agentBids = await db
      .select()
      .from(bids)
      .where(eq(bids.freeAgentId, agentId))
      .orderBy(desc(bids.totalValue));
    
    const result: BidWithUser[] = [];
    for (const bid of agentBids) {
      const [user] = await db.select().from(users).where(eq(users.id, bid.userId));
      if (user) {
        result.push({ ...bid, user });
      }
    }
    return result;
  }

  async getHighestBidForAgent(agentId: number): Promise<Bid | undefined> {
    const [bid] = await db
      .select()
      .from(bids)
      .where(eq(bids.freeAgentId, agentId))
      .orderBy(desc(bids.totalValue))
      .limit(1);
    return bid;
  }

  async getUserBids(userId: string): Promise<FreeAgentWithBids[]> {
    const userBidAgentIds = await db
      .selectDistinct({ agentId: bids.freeAgentId })
      .from(bids)
      .where(eq(bids.userId, userId));
    
    const result: FreeAgentWithBids[] = [];
    for (const { agentId } of userBidAgentIds) {
      const [agent] = await db.select().from(freeAgents).where(eq(freeAgents.id, agentId));
      if (agent) {
        const highestBid = await this.getHighestBidForAgent(agent.id);
        if (highestBid && highestBid.userId === userId) {
          let highBidder: User | null = null;
          const [bidder] = await db.select().from(users).where(eq(users.id, userId));
          highBidder = bidder || null;
          
          const bidCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(bids)
            .where(eq(bids.freeAgentId, agent.id));
          
          result.push({
            ...agent,
            currentBid: highestBid,
            highBidder,
            bidCount: Number(bidCount[0]?.count || 0),
          });
        }
      }
    }
    return result;
  }

  async createBid(bid: InsertBid): Promise<Bid> {
    const [newBid] = await db.insert(bids).values(bid).returning();
    return newBid;
  }

  // Auto bids
  async getAutoBid(agentId: number, userId: string): Promise<AutoBid | undefined> {
    const [autoBid] = await db
      .select()
      .from(autoBids)
      .where(and(eq(autoBids.freeAgentId, agentId), eq(autoBids.userId, userId)));
    return autoBid;
  }

  async getAutoBidsForAgent(agentId: number): Promise<AutoBid[]> {
    return db
      .select()
      .from(autoBids)
      .where(and(eq(autoBids.freeAgentId, agentId), eq(autoBids.isActive, true)))
      .orderBy(desc(autoBids.maxAmount));
  }

  async getUserAutoBids(userId: string): Promise<(AutoBid & { freeAgent: FreeAgent })[]> {
    const userAutoBids = await db
      .select()
      .from(autoBids)
      .where(eq(autoBids.userId, userId));
    
    const result: (AutoBid & { freeAgent: FreeAgent })[] = [];
    for (const autoBid of userAutoBids) {
      const [agent] = await db.select().from(freeAgents).where(eq(freeAgents.id, autoBid.freeAgentId));
      if (agent) {
        result.push({ ...autoBid, freeAgent: agent });
      }
    }
    return result;
  }

  async createOrUpdateAutoBid(autoBidData: InsertAutoBid): Promise<AutoBid> {
    const existing = await this.getAutoBid(autoBidData.freeAgentId, autoBidData.userId);
    
    if (existing) {
      const [updated] = await db
        .update(autoBids)
        .set({
          maxAmount: autoBidData.maxAmount,
          years: autoBidData.years,
          isActive: autoBidData.isActive,
          updatedAt: new Date(),
        })
        .where(eq(autoBids.id, existing.id))
        .returning();
      return updated;
    }
    
    const [newAutoBid] = await db.insert(autoBids).values(autoBidData).returning();
    return newAutoBid;
  }

  // Stats
  async getUserStats(userId: string): Promise<{
    totalActive: number;
    myActiveBids: number;
    myWins: number;
    endingToday: number;
  }> {
    const now = new Date();
    // Get midnight tonight in Eastern Time, then convert to UTC for comparison
    // Create a date string for today in Eastern Time, then get end of that day
    const easternFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const easternDateStr = easternFormatter.format(now); // "MM/DD/YYYY"
    const [month, day, year] = easternDateStr.split('/');
    // Midnight Eastern = 5 AM UTC (or 4 AM during DST)
    // Create end of day in Eastern: 11:59:59 PM Eastern
    const midnightEastern = new Date(`${year}-${month}-${day}T23:59:59-05:00`);
    
    // Total active auctions
    const activeAuctions = await db
      .select({ count: sql<number>`count(*)` })
      .from(freeAgents)
      .where(and(eq(freeAgents.isActive, true), sql`${freeAgents.auctionEndTime} > ${now}`));
    
    // User's winning bids on active auctions
    const userWinningBids = await this.getUserBids(userId);
    const activeWinningBids = userWinningBids.filter(
      (b) => new Date(b.auctionEndTime) > now
    );
    
    // User's won players (closed auctions)
    const wonPlayers = await db
      .select({ count: sql<number>`count(*)` })
      .from(freeAgents)
      .where(eq(freeAgents.winnerId, userId));
    
    // Auctions ending today (before midnight Eastern)
    const endingToday = await db
      .select({ count: sql<number>`count(*)` })
      .from(freeAgents)
      .where(
        and(
          eq(freeAgents.isActive, true),
          sql`${freeAgents.auctionEndTime} > ${now}`,
          sql`${freeAgents.auctionEndTime} <= ${midnightEastern}`
        )
      );
    
    return {
      totalActive: Number(activeAuctions[0]?.count || 0),
      myActiveBids: activeWinningBids.length,
      myWins: Number(wonPlayers[0]?.count || 0),
      endingToday: Number(endingToday[0]?.count || 0),
    };
  }

  // Budget management (per-auction only)
  async getUserBudgetInfo(userId: string, auctionId: number): Promise<{
    budget: number;
    spent: number;
    committed: number;
    available: number;
  }> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get budget from auction team settings (required)
    const [auctionTeam] = await db
      .select()
      .from(auctionTeams)
      .where(and(eq(auctionTeams.auctionId, auctionId), eq(auctionTeams.userId, userId)));
    
    if (!auctionTeam) {
      throw new Error("Team not enrolled in this auction");
    }
    
    const budget = auctionTeam.budget;

    // Get agents for this auction
    const allAgents = await this.getFreeAgentsByAuction(auctionId);
    const now = new Date();
    
    // Calculate spent (won auctions) - tracks bid AMOUNT, not total value
    let spent = 0;
    const closedAgents = allAgents.filter((a: FreeAgentWithBids) => new Date(a.auctionEndTime) <= now);
    for (const agent of closedAgents) {
      if (agent.highBidder?.id === userId && agent.currentBid) {
        spent += agent.currentBid.amount;
      }
    }
    
    // Calculate committed (current high bids on open auctions) - tracks bid AMOUNT, not total value
    let committed = 0;
    const openAgents = allAgents.filter((a: FreeAgentWithBids) => new Date(a.auctionEndTime) > now);
    for (const agent of openAgents) {
      if (agent.highBidder?.id === userId && agent.currentBid) {
        committed += agent.currentBid.amount;
      }
    }
    
    const available = budget - spent - committed;
    
    return {
      budget,
      spent,
      committed,
      available,
    };
  }

  async getAuctionTeamBudget(auctionId: number, userId: string): Promise<number> {
    const [auctionTeam] = await db
      .select()
      .from(auctionTeams)
      .where(and(eq(auctionTeams.auctionId, auctionId), eq(auctionTeams.userId, userId)));
    
    if (!auctionTeam) {
      throw new Error("Team not enrolled in this auction");
    }
    
    return auctionTeam.budget;
  }

  async updateAuctionTeamBudget(auctionId: number, userId: string, budget: number): Promise<AuctionTeam> {
    const [existing] = await db
      .select()
      .from(auctionTeams)
      .where(and(eq(auctionTeams.auctionId, auctionId), eq(auctionTeams.userId, userId)));
    
    if (!existing) {
      throw new Error("Team not enrolled in this auction");
    }
    
    const [updated] = await db
      .update(auctionTeams)
      .set({ budget, updatedAt: new Date() })
      .where(eq(auctionTeams.id, existing.id))
      .returning();
    return updated;
  }

  async resetAuctionBudgets(auctionId: number, amount: number): Promise<void> {
    await db
      .update(auctionTeams)
      .set({ budget: amount, updatedAt: new Date() })
      .where(eq(auctionTeams.auctionId, auctionId));
  }

  // Team limits management (per-auction only)
  async updateAuctionTeamLimits(auctionId: number, userId: string, limits: { rosterLimit?: number | null; ipLimit?: number | null; paLimit?: number | null }): Promise<AuctionTeam> {
    const [existing] = await db
      .select()
      .from(auctionTeams)
      .where(and(eq(auctionTeams.auctionId, auctionId), eq(auctionTeams.userId, userId)));
    
    if (!existing) {
      throw new Error("Team not enrolled in this auction");
    }
    
    const [updated] = await db
      .update(auctionTeams)
      .set({ 
        rosterLimit: limits.rosterLimit,
        ipLimit: limits.ipLimit,
        paLimit: limits.paLimit,
        updatedAt: new Date() 
      })
      .where(eq(auctionTeams.id, existing.id))
      .returning();
    return updated;
  }

  async getUserLimitsInfo(userId: string, auctionId: number): Promise<{
    rosterLimit: number | null;
    rosterUsed: number;
    rosterAvailable: number | null;
    ipLimit: number | null;
    ipUsed: number;
    ipAvailable: number | null;
    paLimit: number | null;
    paUsed: number;
    paAvailable: number | null;
  }> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get limits from auction team settings (required)
    const [auctionTeam] = await db
      .select()
      .from(auctionTeams)
      .where(and(eq(auctionTeams.auctionId, auctionId), eq(auctionTeams.userId, userId)));
    
    if (!auctionTeam) {
      throw new Error("Team not enrolled in this auction");
    }
    
    const rosterLimit = auctionTeam.rosterLimit;
    const ipLimit = auctionTeam.ipLimit;
    const paLimit = auctionTeam.paLimit;

    const now = new Date();
    
    // Get closed auctions won by this user in this auction
    const wonAgents = await db
      .select()
      .from(freeAgents)
      .where(and(
        eq(freeAgents.winnerId, userId),
        sql`${freeAgents.auctionEndTime} <= ${now}`,
        eq(freeAgents.auctionId, auctionId)
      ));
    
    // Calculate roster used (number of players won)
    const rosterUsed = wonAgents.length;
    
    // Calculate IP used (sum of IP for pitchers won)
    let ipUsed = 0;
    for (const agent of wonAgents) {
      if (agent.playerType === 'pitcher' && agent.ip) {
        ipUsed += agent.ip;
      }
    }
    
    // Calculate PA used (sum of PA for hitters won)
    let paUsed = 0;
    for (const agent of wonAgents) {
      if (agent.playerType === 'hitter' && agent.pa) {
        paUsed += agent.pa;
      }
    }
    
    return {
      rosterLimit,
      rosterUsed,
      rosterAvailable: rosterLimit !== null ? rosterLimit - rosterUsed : null,
      ipLimit,
      ipUsed,
      ipAvailable: ipLimit !== null ? ipLimit - ipUsed : null,
      paLimit,
      paUsed,
      paAvailable: paLimit !== null ? paLimit - paUsed : null,
    };
  }

  // Check if user can bid on a player based on limits (includes pending high bids)
  // Uses per-auction limits - team must be enrolled in the player's auction
  async canUserBidOnPlayer(userId: string, playerId: number): Promise<{
    canBid: boolean;
    reason?: string;
  }> {
    const user = await this.getUser(userId);
    if (!user) {
      return { canBid: false, reason: "User not found" };
    }

    const player = await this.getFreeAgent(playerId);
    if (!player) {
      return { canBid: false, reason: "Player not found" };
    }

    const auctionId = player.auctionId;
    if (!auctionId) {
      return { canBid: false, reason: "Player not associated with an auction" };
    }

    // Get limits from auction team settings (required)
    const [auctionTeam] = await db
      .select()
      .from(auctionTeams)
      .where(and(eq(auctionTeams.auctionId, auctionId), eq(auctionTeams.userId, userId)));
    
    if (!auctionTeam) {
      return { canBid: false, reason: "Team not enrolled in this auction" };
    }
    
    const rosterLimit = auctionTeam.rosterLimit;
    const ipLimit = auctionTeam.ipLimit;
    const paLimit = auctionTeam.paLimit;

    const now = new Date();
    
    // Get won players in this auction
    const wonAgents = await db
      .select()
      .from(freeAgents)
      .where(and(
        eq(freeAgents.winnerId, userId),
        sql`${freeAgents.auctionEndTime} <= ${now}`,
        eq(freeAgents.auctionId, auctionId)
      ));
    
    // Get active auctions where user is high bidder in this auction
    const allAgents = await this.getActiveFreeAgents(auctionId);
    const pendingHighBids = allAgents.filter(a => 
      a.highBidder?.id === userId && a.id !== playerId
    );
    
    // Calculate current usage including pending
    const rosterUsed = wonAgents.length + pendingHighBids.length;
    
    let ipUsed = 0;
    let paUsed = 0;
    
    // Add won players
    for (const agent of wonAgents) {
      if (agent.playerType === 'pitcher' && agent.ip) {
        ipUsed += agent.ip;
      }
      if (agent.playerType === 'hitter' && agent.pa) {
        paUsed += agent.pa;
      }
    }
    
    // Add pending high bids
    for (const agent of pendingHighBids) {
      if (agent.playerType === 'pitcher' && agent.ip) {
        ipUsed += agent.ip;
      }
      if (agent.playerType === 'hitter' && agent.pa) {
        paUsed += agent.pa;
      }
    }
    
    // Check roster limit
    if (rosterLimit !== null) {
      if (rosterUsed >= rosterLimit) {
        return { canBid: false, reason: `Roster limit reached (${rosterLimit} players)` };
      }
    }
    
    // Check IP limit for pitchers
    if (player.playerType === 'pitcher' && ipLimit !== null && player.ip) {
      if (ipUsed + player.ip > ipLimit) {
        return { canBid: false, reason: `Would exceed IP limit (${ipUsed + player.ip} / ${ipLimit})` };
      }
    }
    
    // Check PA limit for hitters
    if (player.playerType === 'hitter' && paLimit !== null && player.pa) {
      if (paUsed + player.pa > paLimit) {
        return { canBid: false, reason: `Would exceed PA limit (${paUsed + player.pa} / ${paLimit})` };
      }
    }
    
    return { canBid: true };
  }

  // Password reset tokens
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [resetToken] = await db
      .insert(passwordResetTokens)
      .values({ userId, token, expiresAt })
      .returning();
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return resetToken;
  }

  async markPasswordResetTokenUsed(id: number): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id));
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    const now = new Date();
    await db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, now));
  }

  // Auctions
  async getAuction(id: number): Promise<Auction | undefined> {
    const [auction] = await db
      .select()
      .from(auctions)
      .where(and(eq(auctions.id, id), eq(auctions.isDeleted, false)));
    return auction;
  }

  async getAllAuctions(): Promise<Auction[]> {
    return db
      .select()
      .from(auctions)
      .where(eq(auctions.isDeleted, false))
      .orderBy(desc(auctions.createdAt));
  }

  async getActiveAuction(): Promise<Auction | undefined> {
    const [auction] = await db
      .select()
      .from(auctions)
      .where(and(eq(auctions.status, "active"), eq(auctions.isDeleted, false)))
      .limit(1);
    return auction;
  }

  async createAuction(auctionData: InsertAuction): Promise<Auction> {
    const [auction] = await db
      .insert(auctions)
      .values(auctionData)
      .returning();
    return auction;
  }

  async updateAuction(id: number, data: Partial<InsertAuction>): Promise<Auction> {
    const [auction] = await db
      .update(auctions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(auctions.id, id))
      .returning();
    return auction;
  }

  async deleteAuction(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      // Get all free agents for this auction
      const agents = await tx
        .select({ id: freeAgents.id })
        .from(freeAgents)
        .where(eq(freeAgents.auctionId, id));
      
      const agentIds = agents.map(a => a.id);
      
      if (agentIds.length > 0) {
        // Delete all bids for these agents
        for (const agentId of agentIds) {
          await tx.delete(bids).where(eq(bids.freeAgentId, agentId));
          await tx.delete(autoBids).where(eq(autoBids.freeAgentId, agentId));
        }
        
        // Delete all free agents for this auction
        await tx.delete(freeAgents).where(eq(freeAgents.auctionId, id));
      }
      
      // Delete auction teams
      await tx.delete(auctionTeams).where(eq(auctionTeams.auctionId, id));
      
      // Soft delete the auction
      await tx
        .update(auctions)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(eq(auctions.id, id));
    });
  }

  async resetAuction(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      // Get all free agents for this auction
      const agents = await tx
        .select({ id: freeAgents.id })
        .from(freeAgents)
        .where(eq(freeAgents.auctionId, id));
      
      const agentIds = agents.map(a => a.id);
      
      if (agentIds.length > 0) {
        // Delete all bids for these agents
        for (const agentId of agentIds) {
          await tx.delete(bids).where(eq(bids.freeAgentId, agentId));
          await tx.delete(autoBids).where(eq(autoBids.freeAgentId, agentId));
        }
        
        // Reset all free agents - clear winners and reactivate
        await tx
          .update(freeAgents)
          .set({ 
            winnerId: null, 
            winningBidId: null, 
            isActive: true 
          })
          .where(eq(freeAgents.auctionId, id));
      }
    });
  }

  // Auction teams
  async getAuctionTeams(auctionId: number): Promise<(AuctionTeam & { user: User })[]> {
    const teams = await db
      .select()
      .from(auctionTeams)
      .where(eq(auctionTeams.auctionId, auctionId));
    
    const result: (AuctionTeam & { user: User })[] = [];
    for (const team of teams) {
      const [user] = await db.select().from(users).where(eq(users.id, team.userId));
      if (user) {
        result.push({ ...team, user });
      }
    }
    return result;
  }

  async setAuctionTeamActive(auctionId: number, userId: string, isActive: boolean): Promise<AuctionTeam> {
    const [existing] = await db
      .select()
      .from(auctionTeams)
      .where(and(eq(auctionTeams.auctionId, auctionId), eq(auctionTeams.userId, userId)));
    
    if (!existing) {
      throw new Error("Team not enrolled in this auction");
    }
    
    const [updated] = await db
      .update(auctionTeams)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(auctionTeams.id, existing.id))
      .returning();
    return updated;
  }

  async enrollTeamsInAuction(
    auctionId: number, 
    userIds: string[], 
    defaultBudget: number,
    rosterLimit?: number | null,
    ipLimit?: number | null,
    paLimit?: number | null
  ): Promise<AuctionTeam[]> {
    const enrolledTeams: AuctionTeam[] = [];
    
    for (const userId of userIds) {
      // Check if already enrolled
      const [existing] = await db
        .select()
        .from(auctionTeams)
        .where(and(eq(auctionTeams.auctionId, auctionId), eq(auctionTeams.userId, userId)));
      
      if (!existing) {
        const [team] = await db
          .insert(auctionTeams)
          .values({ 
            auctionId, 
            userId, 
            budget: defaultBudget,
            rosterLimit: rosterLimit ?? null,
            ipLimit: ipLimit ?? null,
            paLimit: paLimit ?? null,
            isActive: true 
          })
          .returning();
        enrolledTeams.push(team);
      } else {
        enrolledTeams.push(existing);
      }
    }
    
    return enrolledTeams;
  }

  async enrollTeamsInAuctionBulk(
    auctionId: number,
    teams: { userId: string; budget: number; rosterLimit: number | null; ipLimit: number | null; paLimit: number | null }[]
  ): Promise<AuctionTeam[]> {
    const enrolledTeams: AuctionTeam[] = [];
    
    for (const teamData of teams) {
      // Check if already enrolled
      const [existing] = await db
        .select()
        .from(auctionTeams)
        .where(and(eq(auctionTeams.auctionId, auctionId), eq(auctionTeams.userId, teamData.userId)));
      
      if (!existing) {
        const [team] = await db
          .insert(auctionTeams)
          .values({ 
            auctionId, 
            userId: teamData.userId, 
            budget: teamData.budget,
            rosterLimit: teamData.rosterLimit,
            ipLimit: teamData.ipLimit,
            paLimit: teamData.paLimit,
            isActive: true 
          })
          .returning();
        enrolledTeams.push(team);
      } else {
        // Update existing team's settings
        const [updated] = await db
          .update(auctionTeams)
          .set({
            budget: teamData.budget,
            rosterLimit: teamData.rosterLimit,
            ipLimit: teamData.ipLimit,
            paLimit: teamData.paLimit,
            updatedAt: new Date(),
          })
          .where(and(eq(auctionTeams.auctionId, auctionId), eq(auctionTeams.userId, teamData.userId)))
          .returning();
        enrolledTeams.push(updated);
      }
    }
    
    return enrolledTeams;
  }

  async removeTeamFromAuction(auctionId: number, userId: string): Promise<boolean> {
    // Check if team exists in this auction
    const [existing] = await db
      .select()
      .from(auctionTeams)
      .where(and(eq(auctionTeams.auctionId, auctionId), eq(auctionTeams.userId, userId)));
    
    if (!existing) {
      return false;
    }
    
    // Check if team has any bids in this auction
    const auctionAgents = await db
      .select()
      .from(freeAgents)
      .where(eq(freeAgents.auctionId, auctionId));
    
    const agentIds = auctionAgents.map(a => a.id);
    
    if (agentIds.length > 0) {
      const teamBids = await db
        .select()
        .from(bids)
        .where(and(
          eq(bids.userId, userId),
          sql`${bids.freeAgentId} IN (${sql.join(agentIds.map(id => sql`${id}`), sql`, `)})`
        ));
      
      if (teamBids.length > 0) {
        throw new Error("Cannot remove team - they have bids in this auction");
      }
      
      // Check for won players
      const wonPlayers = auctionAgents.filter(a => a.winnerId === userId);
      if (wonPlayers.length > 0) {
        throw new Error("Cannot remove team - they have won players in this auction");
      }
    }
    
    // Remove the team from this auction
    await db
      .delete(auctionTeams)
      .where(and(eq(auctionTeams.auctionId, auctionId), eq(auctionTeams.userId, userId)));
    
    return true;
  }

  async getTeamsNotInAuction(auctionId: number): Promise<User[]> {
    // Get all non-archived users (including commissioners and super admins)
    const allUsers = await db
      .select()
      .from(users)
      .where(eq(users.isArchived, false));
    
    // Get users already enrolled in this auction
    const enrolledTeams = await db
      .select()
      .from(auctionTeams)
      .where(eq(auctionTeams.auctionId, auctionId));
    
    const enrolledUserIds = new Set(enrolledTeams.map(t => t.userId));
    
    // Return users not enrolled
    return allUsers.filter(u => !enrolledUserIds.has(u.id));
  }

  async getUserEnrolledAuctions(userId: string): Promise<Auction[]> {
    // Get all auction IDs where the user is enrolled
    const enrollments = await db
      .select({ auctionId: auctionTeams.auctionId })
      .from(auctionTeams)
      .where(eq(auctionTeams.userId, userId));
    
    if (enrollments.length === 0) {
      return [];
    }
    
    const auctionIds = enrollments.map(e => e.auctionId);
    
    // Get the auction details
    const enrolledAuctions = await db
      .select()
      .from(auctions)
      .where(sql`${auctions.id} IN (${sql.join(auctionIds.map(id => sql`${id}`), sql`, `)})`);
    
    return enrolledAuctions;
  }

  async isUserEnrolledInAuction(userId: string, auctionId: number): Promise<boolean> {
    const [enrollment] = await db
      .select()
      .from(auctionTeams)
      .where(and(eq(auctionTeams.auctionId, auctionId), eq(auctionTeams.userId, userId)));
    
    return !!enrollment;
  }

  // Team deletion
  async canDeleteUser(userId: string): Promise<{ canDelete: boolean; reason?: string }> {
    // Check if user is a commissioner or super admin - cannot delete them
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return { canDelete: false, reason: "User not found" };
    }
    if (user.isSuperAdmin) {
      return { canDelete: false, reason: "Cannot delete super admin" };
    }
    if (user.isCommissioner) {
      return { canDelete: false, reason: "Cannot delete commissioner. Remove commissioner role first." };
    }

    // Check if user has any bids
    const userBids = await db.select().from(bids).where(eq(bids.userId, userId));
    if (userBids.length > 0) {
      return { canDelete: false, reason: "Team has bids in existing auctions" };
    }

    // Check if user has any auto-bids
    const userAutoBids = await db.select().from(autoBids).where(eq(autoBids.userId, userId));
    if (userAutoBids.length > 0) {
      return { canDelete: false, reason: "Team has auto-bids in existing auctions" };
    }

    // Check if user has won any free agents
    const wonAgents = await db.select().from(freeAgents).where(eq(freeAgents.winnerId, userId));
    if (wonAgents.length > 0) {
      return { canDelete: false, reason: "Team has won players in existing auctions" };
    }

    // Check if user is enrolled in any auctions
    const enrollments = await db.select().from(auctionTeams).where(eq(auctionTeams.userId, userId));
    if (enrollments.length > 0) {
      return { canDelete: false, reason: "Team is enrolled in existing auctions" };
    }

    return { canDelete: true };
  }

  async deleteUser(userId: string): Promise<void> {
    // First verify the user can be deleted
    const { canDelete, reason } = await this.canDeleteUser(userId);
    if (!canDelete) {
      throw new Error(reason || "Cannot delete user");
    }

    // Delete the user
    await db.delete(users).where(eq(users.id, userId));
  }

  async setUserArchived(userId: string, isArchived: boolean): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ isArchived, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updated) {
      throw new Error("User not found");
    }
    
    return updated;
  }
  
  // Finalize closed auctions - set winner for auctions that have ended
  async finalizeClosedAuctions(): Promise<{ finalized: number; errors: string[] }> {
    const now = new Date();
    const errors: string[] = [];
    let finalized = 0;
    
    // Find all free agents that have closed but don't have a winner set
    const closedWithoutWinner = await db
      .select()
      .from(freeAgents)
      .where(
        and(
          sql`${freeAgents.auctionEndTime} <= ${now}`,
          isNull(freeAgents.winnerId)
        )
      );
    
    for (const agent of closedWithoutWinner) {
      try {
        // Get the highest bid for this agent
        const highestBid = await this.getHighestBidForAgent(agent.id);
        
        if (highestBid) {
          // Set the winner
          await this.updateFreeAgentWinner(agent.id, highestBid.userId, highestBid.id);
          finalized++;
          console.log(`[Auction Job] Finalized: ${agent.name} won by user ${highestBid.userId} with $${highestBid.amount} x ${highestBid.years}yr`);
        }
        // If no bids, leave winnerId as null (commissioner can relist)
      } catch (error) {
        const message = `Failed to finalize ${agent.name} (ID: ${agent.id}): ${error}`;
        errors.push(message);
        console.error(`[Auction Job] ${message}`);
      }
    }
    
    return { finalized, errors };
  }
}

export const storage = new DatabaseStorage();
