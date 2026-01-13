import {
  users,
  leagueSettings,
  freeAgents,
  bids,
  autoBids,
  passwordResetTokens,
  auctions,
  auctionTeams,
  bidBundles,
  bidBundleItems,
  leagues,
  leagueMembers,
  rosterPlayers,
  emailOptOuts,
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
  type OutbidPlayer,
  type BidWithUser,
  type PasswordResetToken,
  type Auction,
  type InsertAuction,
  type AuctionTeam,
  type InsertAuctionTeam,
  type BidBundle,
  type InsertBidBundle,
  type BidBundleItem,
  type InsertBidBundleItem,
  type BidBundleWithItems,
  type League,
  type InsertLeague,
  type LeagueMember,
  type InsertLeagueMember,
  type RosterPlayer,
  type InsertRosterPlayer,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, lt, sql, isNull, inArray, or } from "drizzle-orm";

// Extended type for bundle items with freeAgent attached
export type BidBundleItemWithAgent = BidBundleItem & { freeAgent: FreeAgent };

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
  updateFreeAgentAuctionEndTime(id: number, auctionEndTime: Date): Promise<FreeAgent | undefined>;
  updateFreeAgentStats(id: number, stats: Record<string, number | null>): Promise<FreeAgent | undefined>;
  relistFreeAgent(id: number, minimumBid: number, minimumYears: number, auctionEndTime: Date): Promise<FreeAgent>;
  deleteFreeAgent(id: number): Promise<void>;
  
  // Bids
  getBid(id: number): Promise<Bid | undefined>;
  getBidsForAgent(agentId: number): Promise<BidWithUser[]>;
  getHighestBidForAgent(agentId: number): Promise<Bid | undefined>;
  getUserBids(userId: string, auctionId?: number): Promise<FreeAgentWithBids[]>;
  createBid(bid: InsertBid): Promise<Bid>;
  
  // Auto bids
  getAutoBid(agentId: number, userId: string): Promise<AutoBid | undefined>;
  getAutoBidsForAgent(agentId: number): Promise<AutoBid[]>;
  getUserAutoBids(userId: string, auctionId?: number): Promise<(AutoBid & { freeAgent: FreeAgent })[]>;
  getUserOutbidPlayers(userId: string, auctionId?: number): Promise<OutbidPlayer[]>;
  createOrUpdateAutoBid(autoBid: InsertAutoBid): Promise<AutoBid>;
  
  // Stats
  getUserStats(userId: string, auctionId?: number): Promise<{
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
    rosterCommitted: number;
    rosterAvailable: number | null;
    ipLimit: number | null;
    ipUsed: number;
    ipCommitted: number;
    ipAvailable: number | null;
    paLimit: number | null;
    paUsed: number;
    paCommitted: number;
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
  getActiveAuction(leagueId?: number): Promise<Auction | undefined>;
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
  finalizeClosedAuctions(): Promise<{ 
    finalized: number; 
    errors: string[];
    activatedBundleItems: Array<{ bundleId: number; itemId: number; freeAgentId: number; userId: string; auctionId: number }>;
  }>;
  
  // Get pending auto-bids on players whose auctions just started (for background job)
  getPendingAutoBidsForStartedAuctions(): Promise<Array<{
    autoBidId: number;
    freeAgentId: number;
    userId: string;
    maxAmount: number;
    years: number;
    auctionId: number;
  }>>;
  
  // Admin operations
  getSuperAdmin(): Promise<User | undefined>;
  getRecentlyClosedAuctions(hoursAgo: number): Promise<{
    withBids: Array<{
      agent: FreeAgent;
      winningBid: Bid;
      winner: User;
      auctionName: string;
      auctionId: number;
      emailNotifications: string;
      leagueId: number | null;
    }>;
    noBids: Array<{
      agent: FreeAgent;
      auctionName: string;
      auctionId: number;
      emailNotifications: string;
      leagueId: number | null;
    }>;
  }>;
  getLeagueMembersEmails(leagueId: number): Promise<Array<{ email: string; firstName: string | null; userId: string }>>;
  getLeagueCommissionerEmail(leagueId: number): Promise<{ email: string; firstName: string | null } | null>;
  
  // Email opt-outs
  getEmailOptOut(auctionId: number, userId: string): Promise<boolean>;
  setEmailOptOut(auctionId: number, userId: string, optedOut: boolean): Promise<void>;
  getOptedOutUserIds(auctionId: number): Promise<string[]>;
  getBidderEmailsForFreeAgents(freeAgentIds: number[]): Promise<Array<{ email: string; firstName: string | null; userId: string }>>;
  
  // Bid bundles
  getBidBundle(id: number): Promise<BidBundleWithItems | undefined>;
  getUserBidBundles(userId: string, auctionId?: number): Promise<BidBundleWithItems[]>;
  createBidBundle(bundle: InsertBidBundle, items: Omit<InsertBidBundleItem, 'bundleId'>[]): Promise<BidBundleWithItems>;
  updateBidBundle(id: number, data: Partial<InsertBidBundle>): Promise<BidBundle>;
  updateBidBundleItem(id: number, data: Partial<InsertBidBundleItem>): Promise<BidBundleItem>;
  updateBidBundleWithItems(id: number, data: Partial<InsertBidBundle>, items: Omit<InsertBidBundleItem, 'bundleId'>[]): Promise<BidBundleWithItems>;
  deleteBidBundle(id: number): Promise<void>;
  getActiveBundleItemForAgent(freeAgentId: number, userId: string): Promise<(BidBundleItem & { bundle: BidBundle }) | undefined>;
  getAllDeployedBundleItemsForAgent(freeAgentId: number): Promise<(BidBundleItem & { bundle: BidBundle })[]>;
  activateNextBundleItem(bundleId: number): Promise<BidBundleItemWithAgent | null>;
  
  // League operations
  getLeague(id: number): Promise<League | undefined>;
  getLeagueBySlug(slug: string): Promise<League | undefined>;
  getAllLeagues(): Promise<League[]>;
  createLeague(data: InsertLeague): Promise<League>;
  updateLeague(id: number, data: Partial<InsertLeague>): Promise<League | undefined>;
  getUserLeagues(userId: string): Promise<League[]>;
  getAuctionsByLeague(leagueId: number): Promise<Auction[]>;
  
  // League member operations
  getLeagueMembers(leagueId: number): Promise<(LeagueMember & { user: User })[]>;
  getLeagueMember(leagueId: number, userId: string): Promise<LeagueMember | undefined>;
  addLeagueMember(data: InsertLeagueMember): Promise<LeagueMember>;
  updateLeagueMember(leagueId: number, userId: string, data: Partial<InsertLeagueMember>): Promise<LeagueMember | undefined>;
  removeLeagueMember(leagueId: number, userId: string): Promise<void>;
  isLeagueCommissioner(leagueId: number, userId: string): Promise<boolean>;
  getLeagueIdFromAuction(auctionId: number): Promise<number | null>;
  
  // Roster player operations
  getRosterPlayers(leagueId: number, userId?: string): Promise<(RosterPlayer & { user: User })[]>;
  createRosterPlayer(data: InsertRosterPlayer): Promise<RosterPlayer>;
  createRosterPlayersBulk(players: InsertRosterPlayer[]): Promise<RosterPlayer[]>;
  updateRosterPlayer(id: number, data: Partial<InsertRosterPlayer>): Promise<RosterPlayer | undefined>;
  deleteRosterPlayer(id: number): Promise<void>;
  deleteAllRosterPlayers(leagueId: number, userId?: string): Promise<number>;
  
  // Roster cap calculations - calculates used amounts from roster players
  getTeamRosterUsage(leagueId: number, userId: string): Promise<{
    salaryUsed: number;
    ipUsed: number;
    paUsed: number;
    playerCount: number;
  }>;
  getAllTeamsRosterUsage(leagueId: number): Promise<{
    userId: string;
    user: User;
    salaryUsed: number;
    ipUsed: number;
    paUsed: number;
    playerCount: number;
  }[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email.toLowerCase()));
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
    if (agents.length === 0) return [];
    
    const agentIds = agents.map(a => a.id);
    
    // Batch query 1: Get all bid counts in one query
    const bidCountsResult = await db
      .select({
        freeAgentId: bids.freeAgentId,
        count: sql<number>`count(*)::int`,
      })
      .from(bids)
      .where(inArray(bids.freeAgentId, agentIds))
      .groupBy(bids.freeAgentId);
    
    const bidCountMap = new Map<number, number>();
    for (const row of bidCountsResult) {
      bidCountMap.set(row.freeAgentId, row.count);
    }
    
    // Batch query 2: Get highest bids for all agents using DISTINCT ON
    const highestBidsResult = await db.execute(sql`
      SELECT DISTINCT ON (free_agent_id) *
      FROM bids
      WHERE free_agent_id IN (${sql.join(agentIds.map(id => sql`${id}`), sql`, `)})
      ORDER BY free_agent_id, total_value DESC
    `);
    
    const highestBidMap = new Map<number, Bid>();
    const bidderIds = new Set<string>();
    for (const row of highestBidsResult.rows as any[]) {
      const bid: Bid = {
        id: row.id,
        freeAgentId: row.free_agent_id,
        userId: row.user_id,
        amount: row.amount,
        years: row.years,
        totalValue: row.total_value,
        isAutoBid: row.is_auto_bid,
        createdAt: row.created_at,
      };
      highestBidMap.set(row.free_agent_id, bid);
      bidderIds.add(row.user_id);
    }
    
    // Batch query 3: Get all bidders in one query
    const bidderMap = new Map<string, User>();
    if (bidderIds.size > 0) {
      const bidderIdsArray = Array.from(bidderIds);
      const biddersResult = await db
        .select()
        .from(users)
        .where(inArray(users.id, bidderIdsArray));
      
      for (const bidder of biddersResult) {
        bidderMap.set(bidder.id, bidder);
      }
    }
    
    // Assemble the enriched results
    return agents.map(agent => ({
      ...agent,
      currentBid: highestBidMap.get(agent.id) || null,
      highBidder: highestBidMap.has(agent.id) 
        ? bidderMap.get(highestBidMap.get(agent.id)!.userId) || null 
        : null,
      bidCount: bidCountMap.get(agent.id) || 0,
    }));
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

  async getFreeAgentsByNameAndAuction(names: string[], auctionId: number): Promise<FreeAgent[]> {
    if (names.length === 0) return [];
    const lowerNames = names.map(n => n.toLowerCase().trim());
    const agents = await db
      .select()
      .from(freeAgents)
      .where(and(
        eq(freeAgents.auctionId, auctionId),
        inArray(sql`LOWER(${freeAgents.name})`, lowerNames)
      ));
    return agents;
  }

  async updateFreeAgent(id: number, updates: Partial<InsertFreeAgent>): Promise<FreeAgent | undefined> {
    const [updated] = await db
      .update(freeAgents)
      .set(updates)
      .where(eq(freeAgents.id, id))
      .returning();
    return updated;
  }

  async updateFreeAgentWinner(id: number, winnerId: string, winningBidId: number): Promise<void> {
    await db
      .update(freeAgents)
      .set({ winnerId, winningBidId, isActive: false })
      .where(eq(freeAgents.id, id));
  }

  async updateFreeAgentAuctionEndTime(id: number, auctionEndTime: Date): Promise<FreeAgent | undefined> {
    const [updated] = await db
      .update(freeAgents)
      .set({ auctionEndTime })
      .where(eq(freeAgents.id, id))
      .returning();
    return updated;
  }

  async updateFreeAgentStats(id: number, stats: Record<string, number | null>): Promise<FreeAgent | undefined> {
    const [updated] = await db
      .update(freeAgents)
      .set(stats)
      .where(eq(freeAgents.id, id))
      .returning();
    return updated;
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

  async getUserBids(userId: string, auctionId?: number): Promise<FreeAgentWithBids[]> {
    const userBidAgentIds = await db
      .selectDistinct({ agentId: bids.freeAgentId })
      .from(bids)
      .where(eq(bids.userId, userId));
    
    const result: FreeAgentWithBids[] = [];
    for (const { agentId } of userBidAgentIds) {
      const [agent] = await db.select().from(freeAgents).where(eq(freeAgents.id, agentId));
      if (agent) {
        // Filter by auctionId if provided
        if (auctionId !== undefined && agent.auctionId !== auctionId) {
          continue;
        }
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

  async getUserOutbidPlayers(userId: string, auctionId?: number): Promise<OutbidPlayer[]> {
    const userBidAgentIds = await db
      .selectDistinct({ agentId: bids.freeAgentId })
      .from(bids)
      .where(eq(bids.userId, userId));
    
    const result: OutbidPlayer[] = [];
    for (const { agentId } of userBidAgentIds) {
      const [agent] = await db.select().from(freeAgents).where(eq(freeAgents.id, agentId));
      if (agent) {
        // Filter by auctionId if provided
        if (auctionId !== undefined && agent.auctionId !== auctionId) {
          continue;
        }
        const highestBid = await this.getHighestBidForAgent(agent.id);
        if (highestBid && highestBid.userId !== userId) {
          let highBidder: User | null = null;
          const [bidder] = await db.select().from(users).where(eq(users.id, highestBid.userId));
          highBidder = bidder || null;
          
          const [userHighestBid] = await db
            .select()
            .from(bids)
            .where(and(eq(bids.freeAgentId, agent.id), eq(bids.userId, userId)))
            .orderBy(desc(bids.totalValue))
            .limit(1);
          
          const bidCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(bids)
            .where(eq(bids.freeAgentId, agent.id));
          
          result.push({
            ...agent,
            currentBid: highestBid,
            highBidder,
            bidCount: Number(bidCount[0]?.count || 0),
            userHighestBid: userHighestBid || null,
          });
        }
      }
    }
    return result;
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

  async getUserAutoBids(userId: string, auctionId?: number): Promise<(AutoBid & { freeAgent: FreeAgent })[]> {
    const userAutoBids = await db
      .select()
      .from(autoBids)
      .where(eq(autoBids.userId, userId));
    
    const result: (AutoBid & { freeAgent: FreeAgent })[] = [];
    for (const autoBid of userAutoBids) {
      const [agent] = await db.select().from(freeAgents).where(eq(freeAgents.id, autoBid.freeAgentId));
      if (agent) {
        // Filter by auctionId if provided
        if (auctionId !== undefined && agent.auctionId !== auctionId) {
          continue;
        }
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
  async getUserStats(userId: string, auctionId?: number): Promise<{
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
    
    // Build base conditions - optionally filter by auctionId
    const baseConditions = auctionId 
      ? and(eq(freeAgents.isActive, true), eq(freeAgents.auctionId, auctionId), sql`${freeAgents.auctionEndTime} > ${now}`)
      : and(eq(freeAgents.isActive, true), sql`${freeAgents.auctionEndTime} > ${now}`);
    
    // Total active auctions for this auction (or all if no auctionId)
    const activeAuctions = await db
      .select({ count: sql<number>`count(*)` })
      .from(freeAgents)
      .where(baseConditions);
    
    // User's winning bids on active auctions (filtered by auctionId if provided)
    const userWinningBids = await this.getUserBids(userId);
    const activeWinningBids = userWinningBids.filter(
      (b) => new Date(b.auctionEndTime) > now && (!auctionId || b.auctionId === auctionId)
    );
    
    // User's won players (closed auctions, filtered by auctionId if provided)
    const wonPlayersConditions = auctionId
      ? and(eq(freeAgents.winnerId, userId), eq(freeAgents.auctionId, auctionId))
      : eq(freeAgents.winnerId, userId);
    const wonPlayers = await db
      .select({ count: sql<number>`count(*)` })
      .from(freeAgents)
      .where(wonPlayersConditions);
    
    // Auctions ending today (before midnight Eastern), filtered by auctionId if provided
    const endingTodayConditions = auctionId
      ? and(
          eq(freeAgents.isActive, true),
          eq(freeAgents.auctionId, auctionId),
          sql`${freeAgents.auctionEndTime} > ${now}`,
          sql`${freeAgents.auctionEndTime} <= ${midnightEastern}`
        )
      : and(
          eq(freeAgents.isActive, true),
          sql`${freeAgents.auctionEndTime} > ${now}`,
          sql`${freeAgents.auctionEndTime} <= ${midnightEastern}`
        );
    const endingToday = await db
      .select({ count: sql<number>`count(*)` })
      .from(freeAgents)
      .where(endingTodayConditions);
    
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
    rosterCommitted: number;
    rosterAvailable: number | null;
    ipLimit: number | null;
    ipUsed: number;
    ipCommitted: number;
    ipAvailable: number | null;
    paLimit: number | null;
    paUsed: number;
    paCommitted: number;
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
    
    // Get active auctions where user is high bidder (committed but not yet won)
    const allAgents = await this.getActiveFreeAgents(auctionId);
    const pendingHighBids = allAgents.filter(a => a.highBidder?.id === userId);
    
    // Calculate roster used (number of players won)
    const rosterUsed = wonAgents.length;
    const rosterCommitted = pendingHighBids.length;
    
    // Calculate IP used and committed
    let ipUsed = 0;
    let ipCommitted = 0;
    for (const agent of wonAgents) {
      if (agent.playerType === 'pitcher' && agent.ip) {
        ipUsed += agent.ip;
      }
    }
    for (const agent of pendingHighBids) {
      if (agent.playerType === 'pitcher' && agent.ip) {
        ipCommitted += agent.ip;
      }
    }
    
    // Calculate PA used and committed
    let paUsed = 0;
    let paCommitted = 0;
    for (const agent of wonAgents) {
      if (agent.playerType === 'hitter' && agent.pa) {
        paUsed += agent.pa;
      }
    }
    for (const agent of pendingHighBids) {
      if (agent.playerType === 'hitter' && agent.pa) {
        paCommitted += agent.pa;
      }
    }
    
    return {
      rosterLimit,
      rosterUsed,
      rosterCommitted,
      rosterAvailable: rosterLimit !== null ? rosterLimit - rosterUsed - rosterCommitted : null,
      ipLimit,
      ipUsed,
      ipCommitted,
      ipAvailable: ipLimit !== null ? ipLimit - ipUsed - ipCommitted : null,
      paLimit,
      paUsed,
      paCommitted,
      paAvailable: paLimit !== null ? paLimit - paUsed - paCommitted : null,
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

  async getActiveAuction(leagueId?: number): Promise<Auction | undefined> {
    const conditions = [eq(auctions.status, "active"), eq(auctions.isDeleted, false)];
    if (leagueId) {
      conditions.push(eq(auctions.leagueId, leagueId));
    }
    const [auction] = await db
      .select()
      .from(auctions)
      .where(and(...conditions))
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
  // Also deactivates auto-bids and updates bundle items for closed players
  async finalizeClosedAuctions(): Promise<{ 
    finalized: number; 
    errors: string[];
    activatedBundleItems: Array<{ bundleId: number; itemId: number; freeAgentId: number; userId: string; auctionId: number }>;
  }> {
    const now = new Date();
    const errors: string[] = [];
    let finalized = 0;
    const activatedBundleItems: Array<{ bundleId: number; itemId: number; freeAgentId: number; userId: string; auctionId: number }> = [];
    
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
        
        // Deactivate all auto-bids for this player
        await db
          .update(autoBids)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(autoBids.freeAgentId, agent.id));
        console.log(`[Auction Job] Deactivated auto-bids for ${agent.name}`);
        
        // Find all bundle items targeting this player that are deployed/active
        const bundleItemsForAgent = await db
          .select({
            item: bidBundleItems,
            bundle: bidBundles,
          })
          .from(bidBundleItems)
          .innerJoin(bidBundles, eq(bidBundleItems.bundleId, bidBundles.id))
          .where(
            and(
              eq(bidBundleItems.freeAgentId, agent.id),
              inArray(bidBundleItems.status, ['deployed', 'active'])
            )
          );
        
        for (const { item, bundle } of bundleItemsForAgent) {
          // Determine the outcome for this bundle item
          const userWon = highestBid && highestBid.userId === bundle.userId;
          const newStatus = userWon ? 'won' : (highestBid ? 'outbid' : 'skipped');
          
          // Update the bundle item status
          await db
            .update(bidBundleItems)
            .set({ status: newStatus })
            .where(eq(bidBundleItems.id, item.id));
          console.log(`[Auction Job] Bundle item ${item.id} for ${agent.name}: ${newStatus}`);
          
          // If user lost or no bids, activate next item in bundle
          if (!userWon) {
            const nextItem = await this.activateNextBundleItem(bundle.id);
            if (nextItem) {
              console.log(`[Auction Job] Activated next bundle item ${nextItem.id} (agent ${nextItem.freeAgentId}) for bundle ${bundle.id}`);
              activatedBundleItems.push({
                bundleId: bundle.id,
                itemId: nextItem.id,
                freeAgentId: nextItem.freeAgentId,
                userId: bundle.userId,
                auctionId: bundle.auctionId,
              });
            }
          } else {
            // User won - mark bundle as completed
            await db
              .update(bidBundles)
              .set({ status: 'completed', updatedAt: new Date() })
              .where(eq(bidBundles.id, bundle.id));
            console.log(`[Auction Job] Bundle ${bundle.id} completed (user won)`);
          }
        }
      } catch (error) {
        const message = `Failed to finalize ${agent.name} (ID: ${agent.id}): ${error}`;
        errors.push(message);
        console.error(`[Auction Job] ${message}`);
      }
    }
    
    return { finalized, errors, activatedBundleItems };
  }

  async getPendingAutoBidsForStartedAuctions(): Promise<Array<{
    autoBidId: number;
    freeAgentId: number;
    userId: string;
    maxAmount: number;
    years: number;
    auctionId: number;
  }>> {
    const now = new Date();
    
    // Find active auto-bids on players where:
    // 1. The auction has started (auctionStartTime <= now OR auctionStartTime is null)
    // 2. The auction has not ended (auctionEndTime > now)
    // 3. No bid has been placed yet by this user on this player
    const results = await db
      .select({
        autoBidId: autoBids.id,
        freeAgentId: autoBids.freeAgentId,
        userId: autoBids.userId,
        maxAmount: autoBids.maxAmount,
        years: autoBids.years,
        auctionId: freeAgents.auctionId,
      })
      .from(autoBids)
      .innerJoin(freeAgents, eq(autoBids.freeAgentId, freeAgents.id))
      .where(
        and(
          eq(autoBids.isActive, true),
          // Auction has started (null means immediately available)
          or(
            isNull(freeAgents.auctionStartTime),
            sql`${freeAgents.auctionStartTime} <= ${now}`
          ),
          // Auction has not ended
          sql`${freeAgents.auctionEndTime} > ${now}`,
          // Player is still active (no winner yet)
          isNull(freeAgents.winnerId)
        )
      );
    
    // Filter out auto-bids where the user has already placed a bid
    const pendingAutoBids: Array<{
      autoBidId: number;
      freeAgentId: number;
      userId: string;
      maxAmount: number;
      years: number;
      auctionId: number;
    }> = [];
    
    for (const result of results) {
      // Check if this user has already placed a bid on this player
      const existingBid = await db
        .select({ id: bids.id })
        .from(bids)
        .where(
          and(
            eq(bids.freeAgentId, result.freeAgentId),
            eq(bids.userId, result.userId)
          )
        )
        .limit(1);
      
      if (existingBid.length === 0 && result.auctionId) {
        pendingAutoBids.push({
          autoBidId: result.autoBidId,
          freeAgentId: result.freeAgentId,
          userId: result.userId,
          maxAmount: result.maxAmount,
          years: result.years,
          auctionId: result.auctionId,
        });
      }
    }
    
    return pendingAutoBids;
  }

  async getSuperAdmin(): Promise<User | undefined> {
    const [superAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.isSuperAdmin, true))
      .limit(1);
    return superAdmin;
  }

  async getRecentlyClosedAuctions(hoursAgo: number): Promise<{
    withBids: Array<{
      agent: FreeAgent;
      winningBid: Bid;
      winner: User;
      auctionName: string;
      auctionId: number;
      emailNotifications: string;
      leagueId: number | null;
    }>;
    noBids: Array<{
      agent: FreeAgent;
      auctionName: string;
      auctionId: number;
      emailNotifications: string;
      leagueId: number | null;
    }>;
  }> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    
    // Get all auctions that closed in the time window
    const closedAgents = await db
      .select()
      .from(freeAgents)
      .where(
        and(
          sql`${freeAgents.auctionEndTime} <= ${now}`,
          sql`${freeAgents.auctionEndTime} > ${cutoff}`
        )
      );
    
    const withBids: Array<{
      agent: FreeAgent;
      winningBid: Bid;
      winner: User;
      auctionName: string;
      auctionId: number;
      emailNotifications: string;
      leagueId: number | null;
    }> = [];
    
    const noBids: Array<{
      agent: FreeAgent;
      auctionName: string;
      auctionId: number;
      emailNotifications: string;
      leagueId: number | null;
    }> = [];
    
    for (const agent of closedAgents) {
      // Get auction info
      const auction = await this.getAuction(agent.auctionId);
      const auctionName = auction?.name || "Unknown Auction";
      const auctionId = agent.auctionId!;
      const emailNotifications = auction?.emailNotifications || "none";
      const leagueId = auction?.leagueId || null;
      
      if (agent.winnerId && agent.winningBidId) {
        // Has a winner
        const winningBid = await this.getBid(agent.winningBidId);
        const winner = await this.getUser(agent.winnerId);
        
        if (winningBid && winner) {
          withBids.push({ agent, winningBid, winner, auctionName, auctionId, emailNotifications, leagueId });
        }
      } else {
        // No bids
        noBids.push({ agent, auctionName, auctionId, emailNotifications, leagueId });
      }
    }
    
    return { withBids, noBids };
  }

  async getLeagueMembersEmails(leagueId: number): Promise<Array<{ email: string; firstName: string | null; userId: string }>> {
    const members = await db
      .select({
        email: users.email,
        firstName: users.firstName,
        odataId: users.id,
      })
      .from(leagueMembers)
      .innerJoin(users, eq(leagueMembers.userId, users.id))
      .where(and(
        eq(leagueMembers.leagueId, leagueId),
        eq(leagueMembers.isArchived, false)
      ));
    return members.map(m => ({ email: m.email, firstName: m.firstName, userId: m.odataId }));
  }

  async getLeagueCommissionerEmail(leagueId: number): Promise<{ email: string; firstName: string | null } | null> {
    const [commissioner] = await db
      .select({
        email: users.email,
        firstName: users.firstName,
      })
      .from(leagueMembers)
      .innerJoin(users, eq(leagueMembers.userId, users.id))
      .where(and(
        eq(leagueMembers.leagueId, leagueId),
        eq(leagueMembers.role, 'commissioner')
      ))
      .limit(1);
    return commissioner || null;
  }

  // Email opt-out operations
  async getEmailOptOut(auctionId: number, userId: string): Promise<boolean> {
    const [optOut] = await db
      .select()
      .from(emailOptOuts)
      .where(and(
        eq(emailOptOuts.auctionId, auctionId),
        eq(emailOptOuts.userId, userId)
      ))
      .limit(1);
    return !!optOut;
  }

  async setEmailOptOut(auctionId: number, userId: string, optedOut: boolean): Promise<void> {
    if (optedOut) {
      // Check if already opted out
      const existing = await this.getEmailOptOut(auctionId, userId);
      if (!existing) {
        await db.insert(emailOptOuts).values({ auctionId, userId });
      }
    } else {
      // Remove opt-out
      await db.delete(emailOptOuts).where(and(
        eq(emailOptOuts.auctionId, auctionId),
        eq(emailOptOuts.userId, userId)
      ));
    }
  }

  async getOptedOutUserIds(auctionId: number): Promise<string[]> {
    const optOuts = await db
      .select({ userId: emailOptOuts.userId })
      .from(emailOptOuts)
      .where(eq(emailOptOuts.auctionId, auctionId));
    return optOuts.map(o => o.userId);
  }

  async getBidderEmailsForFreeAgents(freeAgentIds: number[]): Promise<Array<{ email: string; firstName: string | null; userId: string }>> {
    if (freeAgentIds.length === 0) return [];
    
    const bidders = await db
      .selectDistinct({
        email: users.email,
        firstName: users.firstName,
        odataId: users.id,
      })
      .from(bids)
      .innerJoin(users, eq(bids.userId, users.id))
      .where(inArray(bids.freeAgentId, freeAgentIds));
    
    return bidders.map(b => ({ email: b.email, firstName: b.firstName, userId: b.odataId }));
  }

  private async getBid(bidId: number): Promise<Bid | undefined> {
    const [bid] = await db.select().from(bids).where(eq(bids.id, bidId));
    return bid;
  }

  // Bid bundle operations
  async getBidBundle(id: number): Promise<BidBundleWithItems | undefined> {
    const [bundle] = await db
      .select()
      .from(bidBundles)
      .where(eq(bidBundles.id, id));
    
    if (!bundle) return undefined;

    const items = await db
      .select({
        item: bidBundleItems,
        freeAgent: freeAgents,
      })
      .from(bidBundleItems)
      .innerJoin(freeAgents, eq(bidBundleItems.freeAgentId, freeAgents.id))
      .where(eq(bidBundleItems.bundleId, id))
      .orderBy(bidBundleItems.priority);

    return {
      ...bundle,
      items: items.map(row => ({
        ...row.item,
        freeAgent: row.freeAgent,
      })),
    };
  }

  async getUserBidBundles(userId: string, auctionId?: number): Promise<BidBundleWithItems[]> {
    const conditions = [eq(bidBundles.userId, userId)];
    if (auctionId !== undefined) {
      conditions.push(eq(bidBundles.auctionId, auctionId));
    }

    const bundles = await db
      .select()
      .from(bidBundles)
      .where(and(...conditions))
      .orderBy(desc(bidBundles.createdAt));

    const result: BidBundleWithItems[] = [];
    for (const bundle of bundles) {
      const items = await db
        .select({
          item: bidBundleItems,
          freeAgent: freeAgents,
        })
        .from(bidBundleItems)
        .innerJoin(freeAgents, eq(bidBundleItems.freeAgentId, freeAgents.id))
        .where(eq(bidBundleItems.bundleId, bundle.id))
        .orderBy(bidBundleItems.priority);

      result.push({
        ...bundle,
        items: items.map(row => ({
          ...row.item,
          freeAgent: row.freeAgent,
        })),
      });
    }

    return result;
  }

  async createBidBundle(
    bundle: InsertBidBundle, 
    items: Omit<InsertBidBundleItem, 'bundleId'>[]
  ): Promise<BidBundleWithItems> {
    // Create the bundle first
    const [newBundle] = await db
      .insert(bidBundles)
      .values(bundle)
      .returning();

    // Create all bundle items with the first one as 'active'
    const itemsToInsert = items.map((item, index) => ({
      ...item,
      bundleId: newBundle.id,
      status: index === 0 ? 'active' : 'pending',
      activatedAt: index === 0 ? new Date() : null,
    }));

    await db.insert(bidBundleItems).values(itemsToInsert);

    // Return the full bundle with items
    return this.getBidBundle(newBundle.id) as Promise<BidBundleWithItems>;
  }

  async updateBidBundle(id: number, data: Partial<InsertBidBundle>): Promise<BidBundle> {
    const [updated] = await db
      .update(bidBundles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bidBundles.id, id))
      .returning();
    return updated;
  }

  async updateBidBundleItem(id: number, data: Partial<InsertBidBundleItem>): Promise<BidBundleItem> {
    const [updated] = await db
      .update(bidBundleItems)
      .set(data)
      .where(eq(bidBundleItems.id, id))
      .returning();
    return updated;
  }

  async updateBidBundleWithItems(
    id: number, 
    data: Partial<InsertBidBundle>, 
    items: Omit<InsertBidBundleItem, 'bundleId'>[]
  ): Promise<BidBundleWithItems> {
    // Update the bundle name and reset the active item priority
    await db
      .update(bidBundles)
      .set({ 
        ...data, 
        activeItemPriority: items[0]?.priority || 1,
        updatedAt: new Date() 
      })
      .where(eq(bidBundles.id, id));

    // Delete existing items
    await db.delete(bidBundleItems).where(eq(bidBundleItems.bundleId, id));

    // Create new items with the first one as 'active'
    const itemsToInsert = items.map((item, index) => ({
      ...item,
      bundleId: id,
      status: index === 0 ? 'active' : 'pending',
      activatedAt: index === 0 ? new Date() : null,
    }));

    await db.insert(bidBundleItems).values(itemsToInsert);

    // Return the full bundle with items
    return this.getBidBundle(id) as Promise<BidBundleWithItems>;
  }

  async deleteBidBundle(id: number): Promise<void> {
    // Delete items first (foreign key constraint)
    await db.delete(bidBundleItems).where(eq(bidBundleItems.bundleId, id));
    await db.delete(bidBundles).where(eq(bidBundles.id, id));
  }

  async getActiveBundleItemForAgent(
    freeAgentId: number, 
    userId: string
  ): Promise<(BidBundleItem & { bundle: BidBundle }) | undefined> {
    // Find any active or deployed bundle item for this agent owned by this user
    // 'active' = item is active but no bid placed yet
    // 'deployed' = item is active and bid has been placed
    const results = await db
      .select({
        item: bidBundleItems,
        bundle: bidBundles,
      })
      .from(bidBundleItems)
      .innerJoin(bidBundles, eq(bidBundleItems.bundleId, bidBundles.id))
      .where(
        and(
          eq(bidBundleItems.freeAgentId, freeAgentId),
          eq(bidBundles.userId, userId),
          or(
            eq(bidBundleItems.status, 'active'),
            eq(bidBundleItems.status, 'deployed')
          ),
          eq(bidBundles.status, 'active')
        )
      )
      .limit(1);

    if (results.length === 0) return undefined;

    return {
      ...results[0].item,
      bundle: results[0].bundle,
    };
  }

  async getAllDeployedBundleItemsForAgent(
    freeAgentId: number
  ): Promise<(BidBundleItem & { bundle: BidBundle })[]> {
    // Find ALL deployed bundle items for this player (from any user)
    const results = await db
      .select({
        item: bidBundleItems,
        bundle: bidBundles,
      })
      .from(bidBundleItems)
      .innerJoin(bidBundles, eq(bidBundleItems.bundleId, bidBundles.id))
      .where(
        and(
          eq(bidBundleItems.freeAgentId, freeAgentId),
          eq(bidBundleItems.status, 'deployed'),
          eq(bidBundles.status, 'active')
        )
      );

    return results.map(r => ({
      ...r.item,
      bundle: r.bundle,
    }));
  }

  async activateNextBundleItem(bundleId: number): Promise<BidBundleItemWithAgent | null> {
    const bundle = await this.getBidBundle(bundleId);
    if (!bundle || bundle.status !== 'active') return null;

    // Find the next pending item in priority order
    const pendingItems = bundle.items
      .filter(item => item.status === 'pending')
      .sort((a, b) => a.priority - b.priority);

    if (pendingItems.length === 0) {
      // No more items - mark bundle as completed
      await this.updateBidBundle(bundleId, { status: 'completed' });
      return null;
    }

    const nextItem = pendingItems[0];
    
    // Check if the auction is still open
    const agent = nextItem.freeAgent;
    if (!agent || new Date(agent.auctionEndTime) <= new Date()) {
      // Auction closed or no agent, skip this item and try the next
      await this.updateBidBundleItem(nextItem.id, { status: 'skipped' });
      return this.activateNextBundleItem(bundleId);
    }

    // Mark any earlier items for the same player as 'outbid' (for same-player ladder support)
    const earlierSamePlayerItems = bundle.items.filter(
      item => item.freeAgentId === nextItem.freeAgentId && 
              item.priority < nextItem.priority &&
              (item.status === 'active' || item.status === 'deployed')
    );
    for (const earlierItem of earlierSamePlayerItems) {
      await this.updateBidBundleItem(earlierItem.id, { status: 'outbid' });
    }
    
    // Deactivate any existing auto-bid for the same player (to prevent conflicts with new bundle item)
    if (earlierSamePlayerItems.length > 0) {
      const existingAutoBid = await this.getAutoBid(nextItem.freeAgentId, bundle.userId);
      if (existingAutoBid && existingAutoBid.isActive) {
        await this.createOrUpdateAutoBid({
          freeAgentId: nextItem.freeAgentId,
          userId: bundle.userId,
          maxAmount: existingAutoBid.maxAmount,
          years: existingAutoBid.years,
          isActive: false,
        });
      }
    }

    // Activate the next item
    const updatedItem = await this.updateBidBundleItem(nextItem.id, {
      status: 'active',
      activatedAt: new Date(),
    });

    // Update bundle's active item priority
    await this.updateBidBundle(bundleId, { activeItemPriority: nextItem.priority });

    // Return the item with freeAgent attached for use by deployBundleItemBid
    return {
      ...updatedItem,
      freeAgent: agent,
    };
  }

  // League operations
  async getLeague(id: number): Promise<League | undefined> {
    const [league] = await db.select().from(leagues).where(eq(leagues.id, id));
    return league;
  }

  async getLeagueBySlug(slug: string): Promise<League | undefined> {
    const [league] = await db.select().from(leagues).where(eq(leagues.slug, slug));
    return league;
  }

  async getAllLeagues(): Promise<League[]> {
    return db.select().from(leagues).orderBy(leagues.name);
  }

  async createLeague(data: InsertLeague): Promise<League> {
    const [league] = await db.insert(leagues).values(data).returning();
    return league;
  }

  async updateLeague(id: number, data: Partial<InsertLeague>): Promise<League | undefined> {
    const [league] = await db
      .update(leagues)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leagues.id, id))
      .returning();
    return league;
  }

  async getUserLeagues(userId: string): Promise<League[]> {
    // Get all leagues where user is a member
    const memberLeagues = await db
      .select({ league: leagues })
      .from(leagueMembers)
      .innerJoin(leagues, eq(leagueMembers.leagueId, leagues.id))
      .where(and(
        eq(leagueMembers.userId, userId),
        eq(leagueMembers.isArchived, false)
      ));
    return memberLeagues.map(r => r.league);
  }

  async getAuctionsByLeague(leagueId: number): Promise<Auction[]> {
    return db
      .select()
      .from(auctions)
      .where(and(
        eq(auctions.leagueId, leagueId),
        eq(auctions.isDeleted, false)
      ))
      .orderBy(desc(auctions.createdAt));
  }

  // League member operations
  async getLeagueMembers(leagueId: number): Promise<(LeagueMember & { user: User })[]> {
    const results = await db
      .select({
        member: leagueMembers,
        user: users,
      })
      .from(leagueMembers)
      .innerJoin(users, eq(leagueMembers.userId, users.id))
      .where(eq(leagueMembers.leagueId, leagueId));
    
    return results.map(r => ({
      ...r.member,
      user: r.user,
    }));
  }

  async getLeagueMember(leagueId: number, userId: string): Promise<LeagueMember | undefined> {
    const [member] = await db
      .select()
      .from(leagueMembers)
      .where(and(
        eq(leagueMembers.leagueId, leagueId),
        eq(leagueMembers.userId, userId)
      ));
    return member;
  }

  async addLeagueMember(data: InsertLeagueMember): Promise<LeagueMember> {
    const [member] = await db.insert(leagueMembers).values(data).returning();
    return member;
  }

  async updateLeagueMember(leagueId: number, userId: string, data: Partial<InsertLeagueMember>): Promise<LeagueMember | undefined> {
    const [member] = await db
      .update(leagueMembers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(leagueMembers.leagueId, leagueId),
        eq(leagueMembers.userId, userId)
      ))
      .returning();
    return member;
  }

  async removeLeagueMember(leagueId: number, userId: string): Promise<void> {
    await db
      .delete(leagueMembers)
      .where(and(
        eq(leagueMembers.leagueId, leagueId),
        eq(leagueMembers.userId, userId)
      ));
  }

  async isLeagueCommissioner(leagueId: number, userId: string): Promise<boolean> {
    const member = await this.getLeagueMember(leagueId, userId);
    return member?.role === 'commissioner';
  }

  async getLeagueIdFromAuction(auctionId: number): Promise<number | null> {
    const [auction] = await db
      .select({ leagueId: auctions.leagueId })
      .from(auctions)
      .where(eq(auctions.id, auctionId));
    return auction?.leagueId ?? null;
  }

  // Roster player operations
  async getRosterPlayers(leagueId: number, userId?: string): Promise<(RosterPlayer & { user: User })[]> {
    const conditions = [eq(rosterPlayers.leagueId, leagueId)];
    if (userId) {
      conditions.push(eq(rosterPlayers.userId, userId));
    }
    
    const results = await db
      .select({
        player: rosterPlayers,
        user: users,
      })
      .from(rosterPlayers)
      .innerJoin(users, eq(rosterPlayers.userId, users.id))
      .where(and(...conditions))
      .orderBy(rosterPlayers.playerName);
    
    return results.map(r => ({
      ...r.player,
      user: r.user,
    }));
  }

  async createRosterPlayer(data: InsertRosterPlayer): Promise<RosterPlayer> {
    const [player] = await db.insert(rosterPlayers).values(data).returning();
    return player;
  }

  async createRosterPlayersBulk(players: InsertRosterPlayer[]): Promise<RosterPlayer[]> {
    if (players.length === 0) return [];
    const result = await db.insert(rosterPlayers).values(players).returning();
    return result;
  }

  async updateRosterPlayer(id: number, data: Partial<InsertRosterPlayer>): Promise<RosterPlayer | undefined> {
    const [player] = await db
      .update(rosterPlayers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rosterPlayers.id, id))
      .returning();
    return player;
  }

  async deleteRosterPlayer(id: number): Promise<void> {
    await db.delete(rosterPlayers).where(eq(rosterPlayers.id, id));
  }

  async deleteAllRosterPlayers(leagueId: number, userId?: string): Promise<number> {
    const conditions = [eq(rosterPlayers.leagueId, leagueId)];
    if (userId) {
      conditions.push(eq(rosterPlayers.userId, userId));
    }
    const result = await db.delete(rosterPlayers).where(and(...conditions)).returning();
    return result.length;
  }

  async getTeamRosterUsage(leagueId: number, userId: string): Promise<{
    salaryUsed: number;
    ipUsed: number;
    paUsed: number;
    playerCount: number;
  }> {
    const players = await db
      .select()
      .from(rosterPlayers)
      .where(and(
        eq(rosterPlayers.leagueId, leagueId),
        eq(rosterPlayers.userId, userId)
      ));
    
    let salaryUsed = 0;
    let ipUsed = 0;
    let paUsed = 0;
    
    for (const player of players) {
      salaryUsed += player.salary || 0;
      if (player.playerType === 'pitcher' && player.ip) {
        ipUsed += player.ip;
      }
      if (player.playerType === 'hitter' && player.pa) {
        paUsed += player.pa;
      }
    }
    
    return {
      salaryUsed,
      ipUsed,
      paUsed,
      playerCount: players.length,
    };
  }

  async getAllTeamsRosterUsage(leagueId: number): Promise<{
    userId: string;
    user: User;
    salaryUsed: number;
    ipUsed: number;
    paUsed: number;
    playerCount: number;
  }[]> {
    // Get all league members
    const members = await this.getLeagueMembers(leagueId);
    
    // Get all roster players for this league
    const allPlayers = await db
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.leagueId, leagueId));
    
    // Group players by user and calculate usage
    const usageByUser = new Map<string, { salaryUsed: number; ipUsed: number; paUsed: number; playerCount: number }>();
    
    for (const player of allPlayers) {
      const current = usageByUser.get(player.userId) || { salaryUsed: 0, ipUsed: 0, paUsed: 0, playerCount: 0 };
      current.salaryUsed += player.salary || 0;
      if (player.playerType === 'pitcher' && player.ip) {
        current.ipUsed += player.ip;
      }
      if (player.playerType === 'hitter' && player.pa) {
        current.paUsed += player.pa;
      }
      current.playerCount += 1;
      usageByUser.set(player.userId, current);
    }
    
    // Return usage for all members (including those with no roster players)
    return members.map(member => ({
      userId: member.userId,
      user: member.user,
      ...(usageByUser.get(member.userId) || { salaryUsed: 0, ipUsed: 0, paUsed: 0, playerCount: 0 }),
    }));
  }

  // Sync auction team limits from roster usage (calculate available = league cap - roster usage)
  async syncAuctionLimitsFromRoster(auctionId: number): Promise<{ updated: number; teams: { userId: string; budget: number; ipLimit: number | null; paLimit: number | null }[] }> {
    // Get the auction and its league
    const auction = await this.getAuction(auctionId);
    if (!auction || !auction.leagueId) {
      throw new Error("Auction or league not found");
    }

    // Get the league to access caps
    const league = await this.getLeague(auction.leagueId);
    if (!league) {
      throw new Error("League not found");
    }

    // Get roster usage for all teams
    const rosterUsage = await this.getAllTeamsRosterUsage(auction.leagueId);

    // Get all auction teams
    const teams = await db
      .select()
      .from(auctionTeams)
      .where(eq(auctionTeams.auctionId, auctionId));

    const updatedTeams: { userId: string; budget: number; ipLimit: number | null; paLimit: number | null }[] = [];

    // Update each team's limits based on available capacity
    for (const team of teams) {
      const usage = rosterUsage.find(u => u.userId === team.userId);
      // Default to zero usage if team has no roster data
      const salaryUsed = usage?.salaryUsed ?? 0;
      const ipUsed = usage?.ipUsed ?? 0;
      const paUsed = usage?.paUsed ?? 0;
      
      // Calculate available = cap - used
      // If cap is set, use cap minus used; otherwise use auction default (for budget) or null (for IP/PA)
      const availableBudget = league.budgetCap !== null 
        ? Math.max(0, league.budgetCap - salaryUsed) 
        : auction.defaultBudget;
      
      const availableIp = league.ipCap !== null 
        ? Math.max(0, league.ipCap - ipUsed) 
        : null;
      
      const availablePa = league.paCap !== null 
        ? Math.max(0, league.paCap - paUsed) 
        : null;

      await db
        .update(auctionTeams)
        .set({
          budget: availableBudget,
          ipLimit: availableIp,
          paLimit: availablePa,
          updatedAt: new Date(),
        })
        .where(eq(auctionTeams.id, team.id));

      updatedTeams.push({
        userId: team.userId,
        budget: availableBudget,
        ipLimit: availableIp,
        paLimit: availablePa,
      });
    }

    return { updated: updatedTeams.length, teams: updatedTeams };
  }
}

export const storage = new DatabaseStorage();
