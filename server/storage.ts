import {
  users,
  leagueSettings,
  freeAgents,
  bids,
  autoBids,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, lt, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserCommissioner(id: string, isCommissioner: boolean): Promise<User | undefined>;
  
  // League settings
  getSettings(): Promise<LeagueSettings>;
  updateSettings(settings: Partial<InsertLeagueSettings>): Promise<LeagueSettings>;
  
  // Free agents
  getFreeAgent(id: number): Promise<FreeAgent | undefined>;
  getAllFreeAgents(): Promise<FreeAgentWithBids[]>;
  getActiveFreeAgents(): Promise<FreeAgentWithBids[]>;
  getClosedFreeAgents(): Promise<FreeAgentWithBids[]>;
  createFreeAgent(agent: InsertFreeAgent): Promise<FreeAgent>;
  createFreeAgentsBulk(agents: InsertFreeAgent[]): Promise<FreeAgent[]>;
  updateFreeAgentWinner(id: number, winnerId: string, winningBidId: number): Promise<void>;
  
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
    endingSoon: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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

  async getAllFreeAgents(): Promise<FreeAgentWithBids[]> {
    const agents = await db.select().from(freeAgents).orderBy(desc(freeAgents.auctionEndTime));
    return this.enrichFreeAgentsWithBids(agents);
  }

  async getActiveFreeAgents(): Promise<FreeAgentWithBids[]> {
    const now = new Date();
    const agents = await db
      .select()
      .from(freeAgents)
      .where(and(eq(freeAgents.isActive, true), sql`${freeAgents.auctionEndTime} > ${now}`))
      .orderBy(freeAgents.auctionEndTime);
    return this.enrichFreeAgentsWithBids(agents);
  }

  async getClosedFreeAgents(): Promise<FreeAgentWithBids[]> {
    const now = new Date();
    const agents = await db
      .select()
      .from(freeAgents)
      .where(sql`${freeAgents.auctionEndTime} <= ${now}`)
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
    endingSoon: number;
  }> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    
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
    
    // Auctions ending within 1 hour
    const endingSoon = await db
      .select({ count: sql<number>`count(*)` })
      .from(freeAgents)
      .where(
        and(
          eq(freeAgents.isActive, true),
          sql`${freeAgents.auctionEndTime} > ${now}`,
          sql`${freeAgents.auctionEndTime} <= ${oneHourFromNow}`
        )
      );
    
    return {
      totalActive: Number(activeAuctions[0]?.count || 0),
      myActiveBids: activeWinningBids.length,
      myWins: Number(wonPlayers[0]?.count || 0),
      endingSoon: Number(endingSoon[0]?.count || 0),
    };
  }

  // Budget management
  async getUserBudgetInfo(userId: string): Promise<{
    budget: number;
    spent: number;
    committed: number;
    available: number;
  }> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const allAgents = await this.getAllFreeAgents();
    const now = new Date();
    
    // Calculate spent (won auctions)
    let spent = 0;
    const closedAgents = allAgents.filter((a: FreeAgentWithBids) => new Date(a.auctionEndTime) <= now);
    for (const agent of closedAgents) {
      if (agent.highBidder?.id === userId && agent.currentBid) {
        spent += agent.currentBid.totalValue;
      }
    }
    
    // Calculate committed (current high bids on open auctions)
    let committed = 0;
    const openAgents = allAgents.filter((a: FreeAgentWithBids) => new Date(a.auctionEndTime) > now);
    for (const agent of openAgents) {
      if (agent.highBidder?.id === userId && agent.currentBid) {
        committed += agent.currentBid.totalValue;
      }
    }
    
    const available = user.budget - spent - committed;
    
    return {
      budget: user.budget,
      spent,
      committed,
      available,
    };
  }

  async updateUserBudget(userId: string, budget: number): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ budget, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async resetAllBudgets(amount: number): Promise<void> {
    await db
      .update(users)
      .set({ budget: amount, updatedAt: new Date() });
  }
}

export const storage = new DatabaseStorage();
