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
  mlbPlayers,
  mlbPlayerStats,
  type MlbPlayer,
  type InsertMlbPlayer,
  type MlbPlayerStat,
  type InsertMlbPlayerStat,
  leagueRosterAssignments,
  type LeagueRosterAssignment,
  type InsertLeagueRosterAssignment,
  drafts,
  draftPlayers,
  draftRounds,
  draftOrder,
  draftPicks,
  autoDraftLists,
  type Draft,
  type InsertDraft,
  type DraftPlayer,
  type DraftPlayerWithDetails,
  type DraftRound,
  type DraftOrder,
  type DraftPick,
  type InsertDraftPick,
  type DraftPickWithDetails,
  type DraftWithDetails,
  type AutoDraftList,
  type AutoDraftListWithPlayer,
  draftEmailOptOuts,
  teamAutoDraftLists,
  type TeamAutoDraftList,
  draftUserSettings,
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
  dfaFreeAgent(id: number): Promise<FreeAgent | undefined>;
  deleteFreeAgent(id: number): Promise<void>;
  
  // Bids
  getBid(id: number): Promise<Bid | undefined>;
  getBidsForAgent(agentId: number): Promise<BidWithUser[]>;
  getHighestBidForAgent(agentId: number): Promise<Bid | undefined>;
  getUserBids(userId: string, auctionId?: number): Promise<FreeAgentWithBids[]>;
  getUserBidsRaw(userId: string, auctionId?: number): Promise<(Bid & { freeAgent: FreeAgent })[]>;
  createBid(bid: InsertBid): Promise<Bid>;
  deleteBid(bidId: number): Promise<void>;
  
  // Auto bids
  getAutoBid(agentId: number, userId: string): Promise<AutoBid | undefined>;
  getAutoBidsForAgent(agentId: number): Promise<AutoBid[]>;
  getUserAutoBids(userId: string, auctionId?: number): Promise<(AutoBid & { freeAgent: FreeAgent })[]>;
  getUserOutbidPlayers(userId: string, auctionId?: number): Promise<OutbidPlayer[]>;
  createOrUpdateAutoBid(autoBid: InsertAutoBid): Promise<AutoBid>;
  deleteAutoBid(autoBidId: number): Promise<void>;
  
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
    warnings?: string[];
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
  
  getPendingBundleItemsForStartedAuctions(): Promise<Array<{
    itemId: number;
    bundleId: number;
    freeAgentId: number;
    userId: string;
  }>>;
  
  // Admin operations
  getSuperAdmin(): Promise<User | undefined>;
  getAllSuperAdmins(): Promise<User[]>;
  getUnemailedClosedAuctions(): Promise<{
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
  markFreeAgentsAsEmailed(freeAgentIds: number[]): Promise<void>;
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
  getBidBundleItem(id: number): Promise<BidBundleItem | undefined>;
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
  
  // MLB Players reference database
  upsertMlbPlayers(players: InsertMlbPlayer[]): Promise<number>;
  upsertMlbPlayerStats(stats: InsertMlbPlayerStat[]): Promise<number>;
  upsertMlbPlayerStatsFromSync(players: InsertMlbPlayer[]): Promise<number>;
  getMlbPlayers(filters?: { sportLevel?: string; search?: string; limit?: number; offset?: number; currentTeamName?: string; parentOrgName?: string; season?: number; sortBy?: string; sortDir?: string; statsSeason?: number }): Promise<(MlbPlayer & { stats: MlbPlayerStat | null })[]>;
  getMlbPlayerCount(filters?: { sportLevel?: string; search?: string; positionType?: string; positionTypeNot?: string; hadHittingStats?: boolean; hadPitchingStats?: boolean; isTwoWayQualified?: boolean; currentTeamName?: string; parentOrgName?: string; season?: number }): Promise<number>;
  getMlbPlayerTeams(season?: number, sportLevel?: string): Promise<string[]>;
  getMlbPlayerByMlbId(mlbId: number): Promise<MlbPlayer | undefined>;
  getMlbPlayersByMlbIds(mlbIds: number[], season?: number): Promise<MlbPlayer[]>;
  getMlbPlayersByMlbIdsWithSeasonFallback(mlbIds: number[], season: number): Promise<MlbPlayer[]>;
  updateMlbPlayerMiddleNames(updates: Array<{ mlbId: number; middleName: string }>): Promise<number>;
  clearMlbPlayers(): Promise<number>;
  
  // League Roster Assignments
  getLeagueRosterAssignments(leagueId: number, season?: number, filters?: { userId?: string; rosterType?: string }): Promise<(LeagueRosterAssignment & { player: MlbPlayer })[]>;
  getRosterAssignmentCounts(leagueId: number, season?: number): Promise<{ userId: string; rosterType: string; count: number }[]>;
  assignPlayerToRoster(assignment: InsertLeagueRosterAssignment): Promise<LeagueRosterAssignment>;
  deleteAllRosterAssignments(leagueId: number): Promise<number>;
  deleteRosterAssignmentsByType(leagueId: number, rosterType: string): Promise<number>;
  updateRosterAssignment(id: number, updates: { rosterType?: string; userId?: string; rosterSlot?: string | null }): Promise<LeagueRosterAssignment | undefined>;
  executeRosterTrade(params: {
    leagueId: number;
    season: number;
    teamAUserId: string;
    teamBUserId: string;
    teamAAssignmentIds: number[];
    teamBAssignmentIds: number[];
  }): Promise<{ movedFromA: number; movedFromB: number }>;
  removeRosterAssignment(id: number): Promise<void>;
  removeAllRosterAssignments(leagueId: number, season: number): Promise<number>;
  getUnassignedPlayers(leagueId: number, season?: number, filters?: { search?: string; sportLevel?: string; limit?: number; offset?: number }): Promise<MlbPlayer[]>;
  getUnassignedPlayerCount(leagueId: number, season?: number, filters?: { search?: string; sportLevel?: string }): Promise<number>;
  bulkAssignPlayers(assignments: InsertLeagueRosterAssignment[]): Promise<number>;
  
  // Draft operations
  getDraft(id: number): Promise<Draft | undefined>;
  getActiveDraftIds(): Promise<number[]>;
  getDraftsByLeague(leagueId: number): Promise<DraftWithDetails[]>;
  createDraft(data: InsertDraft): Promise<Draft>;
  updateDraft(id: number, data: Partial<Draft>): Promise<Draft | undefined>;
  deleteDraft(id: number): Promise<void>;
  
  // Draft players
  getDraftPlayers(draftId: number, filters?: { status?: string; search?: string }): Promise<DraftPlayerWithDetails[]>;
  getDraftPlayerCount(draftId: number, status?: string): Promise<number>;
  addDraftPlayers(
    draftId: number,
    mlbPlayerIds: number[],
    metadataByMlbPlayerId?: Record<number, { minorLeagueStatus?: string | null; minorLeagueYears?: number | null }>
  ): Promise<number>;
  clearDraftPlayers(draftId: number): Promise<number>;
  updateDraftPlayerStatus(draftId: number, mlbPlayerId: number, status: string): Promise<void>;
  updateDraftPlayerMinorLeague(draftId: number, mlbPlayerId: number, minorLeagueStatus: string | null, minorLeagueYears: number | null): Promise<void>;
  
  // Draft rounds
  getDraftRounds(draftId: number): Promise<DraftRound[]>;
  setDraftRounds(draftId: number, rounds: { roundNumber: number; name: string; isTeamDraft: boolean }[]): Promise<void>;
  deleteDraftRound(id: number): Promise<void>;
  updateDraftRound(id: number, data: Partial<DraftRound>): Promise<DraftRound | undefined>;

  // Draft order
  getDraftOrder(draftId: number, roundNumber?: number): Promise<(DraftOrder & { user: User })[]>;
  setDraftOrder(draftId: number, order: { userId: string; orderIndex: number; roundNumber: number }[]): Promise<void>;
  clearDraftOrder(draftId: number): Promise<void>;
  
  // Draft picks
  getDraftPicks(draftId: number): Promise<DraftPickWithDetails[]>;
  getDraftPickById(pickId: number): Promise<DraftPick | undefined>;
  createDraftPickSlotsForAllRounds(draftId: number): Promise<number>;
  getOldestEligibleOpenSlotForUser(draftId: number, userId: string, now: Date): Promise<DraftPick | undefined>;
  fillSlotWithPlayer(slotId: number, userId: string, playerId: number, rosterType: "mlb" | "milb", now: Date): Promise<DraftPick>;
  fillSlotWithOrg(slotId: number, userId: string, selectedOrgName: string, selectedOrgId: number | null, rosterType: "mlb" | "milb", now: Date): Promise<{ slot: DraftPick; draftedPlayerIds: number[] }>;
  clearDraftSlot(slotId: number): Promise<void>;
  clearDraftSlotSkip(slotId: number): Promise<void>;
  getDraftPlayersByParentOrg(draftId: number, parentOrgName: string): Promise<DraftPlayerWithDetails[]>;
  removeRosterAssignmentByPlayer(leagueId: number, userId: string, mlbPlayerId: number, season: number): Promise<void>;

  // Auto-draft lists
  getAutoDraftList(draftId: number, userId: string): Promise<AutoDraftListWithPlayer[]>;
  getAutoDraftItem(id: number): Promise<AutoDraftList | undefined>;
  addAutoDraftItem(draftId: number, userId: string, mlbPlayerId: number, rosterType: string): Promise<AutoDraftList>;
  removeAutoDraftItem(id: number): Promise<void>;
  updateAutoDraftItemRosterType(id: number, rosterType: string): Promise<void>;
  reorderAutoDraftList(draftId: number, userId: string, orderedIds: number[]): Promise<void>;
  getTopAvailableAutoDraftPick(draftId: number, userId: string): Promise<AutoDraftList | undefined>;
  clearAutoDraftItem(draftId: number, mlbPlayerId: number): Promise<void>;
  clearAutoDraftList(draftId: number, userId: string): Promise<number>;

  // Team auto-draft lists (for team draft rounds)
  getTeamAutoDraftList(draftId: number, userId: string): Promise<TeamAutoDraftList[]>;
  addTeamAutoDraftItem(draftId: number, userId: string, orgName: string, rosterType: string): Promise<TeamAutoDraftList>;
  removeTeamAutoDraftItem(id: number): Promise<void>;
  reorderTeamAutoDraftList(draftId: number, userId: string, orderedIds: number[]): Promise<void>;
  getTopAvailableTeamAutoDraftPick(draftId: number, userId: string, claimedOrgs: Set<string>): Promise<TeamAutoDraftList | undefined>;
  clearTeamAutoDraftList(draftId: number, userId: string): Promise<void>;

  // Draft user settings
  getDraftUserSettings(draftId: number, userId: string): Promise<{ autoDraftMode: string }>;
  setDraftUserSettings(draftId: number, userId: string, autoDraftMode: string): Promise<void>;

  // Draft email opt-outs
  getDraftEmailOptOut(draftId: number, userId: string): Promise<boolean>;
  setDraftEmailOptOut(draftId: number, userId: string, optedOut: boolean): Promise<void>;
  getDraftOptedOutUserIds(draftId: number): Promise<string[]>;
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
    
    // Get expired players for this auction that have no winner
    const expiredAgents = await db
      .select()
      .from(freeAgents)
      .where(and(
        eq(freeAgents.auctionId, auctionId),
        sql`${freeAgents.auctionEndTime} <= ${now}`,
        eq(freeAgents.isActive, true),
        isNull(freeAgents.winnerId)
      ))
      .orderBy(freeAgents.name);
    
    // Get names of players that have been won in this auction (to exclude duplicates)
    const wonPlayerNames = await db
      .select({ name: freeAgents.name })
      .from(freeAgents)
      .where(and(
        eq(freeAgents.auctionId, auctionId),
        sql`${freeAgents.winnerId} IS NOT NULL`
      ));
    const wonNamesSet = new Set(wonPlayerNames.map(p => p.name.toLowerCase()));
    
    // Filter to only those with no bids AND no "won" duplicate with the same name
    const agentsNoBids: FreeAgent[] = [];
    for (const agent of expiredAgents) {
      // Skip if a player with the same name has already been won
      if (wonNamesSet.has(agent.name.toLowerCase())) {
        continue;
      }
      
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
        isImportedInitial: row.is_imported_initial ?? false,
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
    
    // Batch query 4: Get league-specific team names for bidders
    // First, get the unique auction IDs to look up their leagues
    const auctionIds = [...new Set(agents.map(a => a.auctionId).filter((id): id is number => id !== null))];
    const leagueIdsByAuction = new Map<number, number>();
    if (auctionIds.length > 0) {
      const auctionsResult = await db
        .select({ id: auctions.id, leagueId: auctions.leagueId })
        .from(auctions)
        .where(inArray(auctions.id, auctionIds));
      for (const a of auctionsResult) {
        if (a.leagueId !== null) {
          leagueIdsByAuction.set(a.id, a.leagueId);
        }
      }
    }
    
    // Now get league members for all bidder+league combinations
    const leagueMemberMap = new Map<string, { teamName: string | null; teamAbbreviation: string | null }>();
    if (bidderIds.size > 0 && leagueIdsByAuction.size > 0) {
      const uniqueLeagueIds = [...new Set(leagueIdsByAuction.values())];
      const bidderIdsArray = Array.from(bidderIds);
      const membersResult = await db
        .select({
          userId: leagueMembers.userId,
          leagueId: leagueMembers.leagueId,
          teamName: leagueMembers.teamName,
          teamAbbreviation: leagueMembers.teamAbbreviation,
        })
        .from(leagueMembers)
        .where(and(
          inArray(leagueMembers.userId, bidderIdsArray),
          inArray(leagueMembers.leagueId, uniqueLeagueIds)
        ));
      
      for (const m of membersResult) {
        // Key by "userId-leagueId" to handle users in multiple leagues
        leagueMemberMap.set(`${m.userId}-${m.leagueId}`, {
          teamName: m.teamName,
          teamAbbreviation: m.teamAbbreviation,
        });
      }
    }
    
    // Assemble the enriched results with league-specific team info
    return agents.map(agent => {
      const currentBid = highestBidMap.get(agent.id) || null;
      let highBidder = currentBid ? bidderMap.get(currentBid.userId) || null : null;
      
      // Override with league-specific team info if available
      if (highBidder && currentBid) {
        if (agent.auctionId === null) {
          return {
            ...agent,
            currentBid,
            highBidder,
            bidCount: bidCountMap.get(agent.id) || 0,
          };
        }
        const leagueId = leagueIdsByAuction.get(agent.auctionId);
        if (leagueId) {
          const leagueMember = leagueMemberMap.get(`${currentBid.userId}-${leagueId}`);
          if (leagueMember) {
            highBidder = {
              ...highBidder,
              teamName: leagueMember.teamName || highBidder.teamName,
              teamAbbreviation: leagueMember.teamAbbreviation ?? highBidder.teamAbbreviation,
            };
          }
        }
      }
      
      return {
        ...agent,
        currentBid,
        highBidder,
        bidCount: bidCountMap.get(agent.id) || 0,
      };
    });
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

  async dfaFreeAgent(id: number): Promise<FreeAgent | undefined> {
    const [updated] = await db
      .update(freeAgents)
      .set({
        winnerId: null,
        winningBidId: null,
        isActive: false,
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
    // First get the free agent to determine its auction and league
    const [agent] = await db.select().from(freeAgents).where(eq(freeAgents.id, agentId));
    if (!agent) return [];
    
    // Get the auction to find the league
    const [auction] = agent.auctionId 
      ? await db.select().from(auctions).where(eq(auctions.id, agent.auctionId))
      : [null];
    const leagueId = auction?.leagueId;
    
    const agentBids = await db
      .select()
      .from(bids)
      .where(eq(bids.freeAgentId, agentId))
      .orderBy(desc(bids.totalValue));
    
    const result: BidWithUser[] = [];
    for (const bid of agentBids) {
      const [user] = await db.select().from(users).where(eq(users.id, bid.userId));
      if (user) {
        // Get league-specific team info if we have a leagueId
        if (leagueId) {
          const [member] = await db
            .select()
            .from(leagueMembers)
            .where(and(
              eq(leagueMembers.leagueId, leagueId),
              eq(leagueMembers.userId, bid.userId)
            ));
          if (member) {
            // Override user-level team info with league-specific info
            user.teamName = member.teamName || user.teamName;
            if (member.teamAbbreviation) user.teamAbbreviation = member.teamAbbreviation;
          }
        }
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

  async deleteBid(bidId: number): Promise<void> {
    await db.delete(bids).where(eq(bids.id, bidId));
  }

  async getUserBidsRaw(userId: string, auctionId?: number): Promise<(Bid & { freeAgent: FreeAgent })[]> {
    const userBids = await db
      .select()
      .from(bids)
      .where(eq(bids.userId, userId));
    
    const result: (Bid & { freeAgent: FreeAgent })[] = [];
    for (const bid of userBids) {
      const [agent] = await db.select().from(freeAgents).where(eq(freeAgents.id, bid.freeAgentId));
      if (agent) {
        // Filter by auctionId if provided
        if (auctionId !== undefined && agent.auctionId !== auctionId) {
          continue;
        }
        result.push({ ...bid, freeAgent: agent });
      }
    }
    return result;
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

  async deleteAutoBid(autoBidId: number): Promise<void> {
    await db.delete(autoBids).where(eq(autoBids.id, autoBidId));
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
    warnings?: string[];
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
    
    const rosterLimit = 41;
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
    
    // Free agency uses hard limits.
    if (rosterUsed >= rosterLimit) {
      return { canBid: false, reason: `Roster limit reached (${rosterLimit} players)` };
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
  async getAuctionTeams(auctionId: number): Promise<(AuctionTeam & { user: User & { leagueTeamName?: string } })[]> {
    // First get the auction to find its leagueId
    const [auction] = await db.select().from(auctions).where(eq(auctions.id, auctionId));
    const leagueId = auction?.leagueId;
    
    const teams = await db
      .select()
      .from(auctionTeams)
      .where(eq(auctionTeams.auctionId, auctionId));
    
    const result: (AuctionTeam & { user: User & { leagueTeamName?: string } })[] = [];
    for (const team of teams) {
      const [user] = await db.select().from(users).where(eq(users.id, team.userId));
      if (user) {
        // Get league-specific team name if auction has a league
        let leagueTeamName: string | undefined;
        if (leagueId) {
          const [leagueMember] = await db
            .select()
            .from(leagueMembers)
            .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, team.userId)));
          leagueTeamName = leagueMember?.teamName ?? undefined;
        }
        result.push({ ...team, user: { ...user, leagueTeamName } });
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
    // Get the auction to find its leagueId
    const [auction] = await db
      .select({ leagueId: auctions.leagueId })
      .from(auctions)
      .where(eq(auctions.id, auctionId));
    
    if (!auction) {
      return [];
    }
    if (auction.leagueId === null) {
      return [];
    }
    
    // Get all league members with their league-specific team info
    const members = await db
      .select({
        userId: leagueMembers.userId,
        teamName: leagueMembers.teamName,
        teamAbbreviation: leagueMembers.teamAbbreviation,
      })
      .from(leagueMembers)
      .where(eq(leagueMembers.leagueId, auction.leagueId));
    
    if (members.length === 0) {
      return [];
    }
    
    // Get users already enrolled in this auction
    const enrolledTeams = await db
      .select()
      .from(auctionTeams)
      .where(eq(auctionTeams.auctionId, auctionId));
    
    const enrolledUserIds = new Set(enrolledTeams.map(t => t.userId));
    
    // Get non-enrolled member user IDs
    const notEnrolledMemberIds = members
      .filter(m => !enrolledUserIds.has(m.userId))
      .map(m => m.userId);
    
    if (notEnrolledMemberIds.length === 0) {
      return [];
    }
    
    // Get user details for non-enrolled members
    const memberUsers = await db
      .select()
      .from(users)
      .where(and(
        inArray(users.id, notEnrolledMemberIds),
        eq(users.isArchived, false)
      ));
    
    // Create a map of league-specific team info
    const leagueTeamInfo = new Map(members.map(m => [m.userId, { 
      teamName: m.teamName, 
      teamAbbreviation: m.teamAbbreviation 
    }]));
    
    // Return users with their league-specific team info
    return memberUsers.map(u => {
      const leagueInfo = leagueTeamInfo.get(u.id);
      return {
        ...u,
        teamName: leagueInfo?.teamName || u.teamName,
        teamAbbreviation: leagueInfo?.teamAbbreviation ?? null,
      };
    });
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
  
  async getPendingBundleItemsForStartedAuctions(): Promise<Array<{
    itemId: number;
    bundleId: number;
    freeAgentId: number;
    userId: string;
  }>> {
    const now = new Date();
    
    // Find active bundle items where:
    // 1. The bundle is active
    // 2. The item is active (waiting to be deployed)
    // 3. The auction has started (auctionStartTime <= now OR auctionStartTime is null)
    // 4. The auction has not ended (auctionEndTime > now)
    // 5. Player is still active (no winner yet)
    const results = await db
      .select({
        itemId: bidBundleItems.id,
        bundleId: bidBundleItems.bundleId,
        freeAgentId: bidBundleItems.freeAgentId,
        userId: bidBundles.userId,
      })
      .from(bidBundleItems)
      .innerJoin(bidBundles, eq(bidBundleItems.bundleId, bidBundles.id))
      .innerJoin(freeAgents, eq(bidBundleItems.freeAgentId, freeAgents.id))
      .where(
        and(
          eq(bidBundles.status, 'active'),
          eq(bidBundleItems.status, 'active'),
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
    
    return results;
  }

  async getSuperAdmin(): Promise<User | undefined> {
    const [superAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.isSuperAdmin, true))
      .limit(1);
    return superAdmin;
  }

  async getAllSuperAdmins(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(eq(users.isSuperAdmin, true));
  }

  async getUnemailedClosedAuctions(): Promise<{
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
    
    // Get all auctions that have closed and haven't been emailed yet
    // This ensures we never miss any auctions, regardless of timing issues
    const closedAgents = await db
      .select()
      .from(freeAgents)
      .where(
        and(
          sql`${freeAgents.auctionEndTime} <= ${now}`,
          isNull(freeAgents.resultEmailedAt)
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
      if (agent.auctionId === null) {
        continue;
      }
      // Get auction info
      const auction = await this.getAuction(agent.auctionId);
      const auctionName = auction?.name || "Unknown Auction";
      const auctionId = agent.auctionId;
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

  async markFreeAgentsAsEmailed(freeAgentIds: number[]): Promise<void> {
    if (freeAgentIds.length === 0) return;
    
    await db
      .update(freeAgents)
      .set({ resultEmailedAt: new Date() })
      .where(inArray(freeAgents.id, freeAgentIds));
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
    items: Array<{
      freeAgentId: number;
      priority: number;
      amount: number;
      years: number;
    }>
  ): Promise<BidBundleWithItems> {
    // Create the bundle first
    const [newBundle] = await db
      .insert(bidBundles)
      .values(bundle)
      .returning();

    // Create all bundle items with the first one as 'active'
    const itemsToInsert = items.map((item, index): InsertBidBundleItem => ({
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

  async getBidBundleItem(id: number): Promise<BidBundleItem | undefined> {
    const [item] = await db
      .select()
      .from(bidBundleItems)
      .where(eq(bidBundleItems.id, id));
    return item;
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
    items: Array<{
      freeAgentId: number;
      priority: number;
      amount: number;
      years: number;
    }>
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
    const itemsToInsert = items.map((item, index): InsertBidBundleItem => ({
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
    if (!agent) {
      // No agent found, skip this item and try the next
      await this.updateBidBundleItem(nextItem.id, { status: 'skipped' });
      return this.activateNextBundleItem(bundleId);
    }
    
    if (new Date(agent.auctionEndTime) <= new Date()) {
      // Auction has ended, skip this item and try the next
      await this.updateBidBundleItem(nextItem.id, { status: 'skipped' });
      return this.activateNextBundleItem(bundleId);
    }
    
    // If auction hasn't started yet, still activate the item - it will be deployed when auction starts
    if (agent.auctionStartTime && new Date(agent.auctionStartTime) > new Date()) {
      console.log(`[Bundle] Item for ${agent.name}: auction hasn't started yet, activating but not deploying`);
      // Continue to activate the item - the background job will deploy it when the auction starts
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

    const members = results.map(r => ({
      ...r.member,
      user: r.user,
    }));

    // Keep league team displays predictable across the app.
    members.sort((a, b) => {
      const aKey = (a.teamName || a.teamAbbreviation || `${a.user.firstName || ""} ${a.user.lastName || ""}`.trim() || a.user.email || a.userId).toLowerCase();
      const bKey = (b.teamName || b.teamAbbreviation || `${b.user.firstName || ""} ${b.user.lastName || ""}`.trim() || b.user.email || b.userId).toLowerCase();
      return aKey.localeCompare(bKey);
    });

    return members;
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
    // Override user's team info with league-specific values
    return members.map(member => ({
      userId: member.userId,
      user: {
        ...member.user,
        teamName: member.teamName || member.user.teamName,
        teamAbbreviation: member.teamAbbreviation,
      },
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

  // MLB Players reference database
  async upsertMlbPlayers(players: InsertMlbPlayer[]): Promise<number> {
    if (players.length === 0) return 0;
    
    const BATCH_SIZE = 100;
    let totalUpserted = 0;
    
    for (let i = 0; i < players.length; i += BATCH_SIZE) {
      const batch = players.slice(i, i + BATCH_SIZE).map(p => {
        const hasActivity = (p.hittingPlateAppearances ?? 0) > 0 || (p.pitchingGames ?? 0) > 0 ||
          (p.pitchingInningsPitched ?? 0) > 0 || p.hadHittingStats || p.hadPitchingStats;
        const enriched = { ...p };
        if (enriched.lastPlayedSeason == null && hasActivity && p.season) enriched.lastPlayedSeason = p.season;
        if (enriched.lastPlayedLevel == null && hasActivity && p.sportLevel) enriched.lastPlayedLevel = p.sportLevel;
        return enriched;
      });
      await db.insert(mlbPlayers)
        .values(batch)
        .onConflictDoUpdate({
          target: mlbPlayers.mlbId,
          set: {
            fullName: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.full_name ELSE ${mlbPlayers.fullName} END`,
            fullFmlName: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN COALESCE(NULLIF(TRIM(EXCLUDED.full_fml_name), ''), ${mlbPlayers.fullFmlName}) ELSE ${mlbPlayers.fullFmlName} END`,
            firstName: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.first_name ELSE ${mlbPlayers.firstName} END`,
            middleName: sql`COALESCE(NULLIF(TRIM(${mlbPlayers.middleName}), ''), EXCLUDED.middle_name)`,
            lastName: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.last_name ELSE ${mlbPlayers.lastName} END`,
            primaryPosition: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.primary_position ELSE ${mlbPlayers.primaryPosition} END`,
            positionName: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.position_name ELSE ${mlbPlayers.positionName} END`,
            positionType: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.position_type ELSE ${mlbPlayers.positionType} END`,
            batSide: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.bat_side ELSE ${mlbPlayers.batSide} END`,
            throwHand: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.throw_hand ELSE ${mlbPlayers.throwHand} END`,
            currentTeamId: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.current_team_id ELSE ${mlbPlayers.currentTeamId} END`,
            currentTeamName: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.current_team_name ELSE ${mlbPlayers.currentTeamName} END`,
            parentOrgId: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.parent_org_id ELSE ${mlbPlayers.parentOrgId} END`,
            parentOrgName: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.parent_org_name ELSE ${mlbPlayers.parentOrgName} END`,
            sportId: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.sport_id ELSE ${mlbPlayers.sportId} END`,
            sportLevel: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.sport_level ELSE ${mlbPlayers.sportLevel} END`,
            birthDate: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.birth_date ELSE ${mlbPlayers.birthDate} END`,
            age: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.age ELSE ${mlbPlayers.age} END`,
            isActive: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.is_active ELSE ${mlbPlayers.isActive} END`,
            hadHittingStats: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.had_hitting_stats ELSE ${mlbPlayers.hadHittingStats} END`,
            hadPitchingStats: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.had_pitching_stats ELSE ${mlbPlayers.hadPitchingStats} END`,
            hittingAtBats: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.hitting_at_bats ELSE ${mlbPlayers.hittingAtBats} END`,
            hittingWalks: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.hitting_walks ELSE ${mlbPlayers.hittingWalks} END`,
            hittingSingles: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.hitting_singles ELSE ${mlbPlayers.hittingSingles} END`,
            hittingDoubles: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.hitting_doubles ELSE ${mlbPlayers.hittingDoubles} END`,
            hittingTriples: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.hitting_triples ELSE ${mlbPlayers.hittingTriples} END`,
            hittingHomeRuns: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.hitting_home_runs ELSE ${mlbPlayers.hittingHomeRuns} END`,
            hittingAvg: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.hitting_avg ELSE ${mlbPlayers.hittingAvg} END`,
            hittingObp: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.hitting_obp ELSE ${mlbPlayers.hittingObp} END`,
            hittingSlg: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.hitting_slg ELSE ${mlbPlayers.hittingSlg} END`,
            hittingOps: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.hitting_ops ELSE ${mlbPlayers.hittingOps} END`,
            pitchingGames: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.pitching_games ELSE ${mlbPlayers.pitchingGames} END`,
            pitchingGamesStarted: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.pitching_games_started ELSE ${mlbPlayers.pitchingGamesStarted} END`,
            pitchingStrikeouts: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.pitching_strikeouts ELSE ${mlbPlayers.pitchingStrikeouts} END`,
            pitchingWalks: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.pitching_walks ELSE ${mlbPlayers.pitchingWalks} END`,
            pitchingHits: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.pitching_hits ELSE ${mlbPlayers.pitchingHits} END`,
            pitchingHomeRuns: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.pitching_home_runs ELSE ${mlbPlayers.pitchingHomeRuns} END`,
            pitchingEra: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.pitching_era ELSE ${mlbPlayers.pitchingEra} END`,
            pitchingInningsPitched: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.pitching_innings_pitched ELSE ${mlbPlayers.pitchingInningsPitched} END`,
            hittingGamesStarted: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.hitting_games_started ELSE ${mlbPlayers.hittingGamesStarted} END`,
            hittingPlateAppearances: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.hitting_plate_appearances ELSE ${mlbPlayers.hittingPlateAppearances} END`,
            isTwoWayQualified: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.is_two_way_qualified ELSE ${mlbPlayers.isTwoWayQualified} END`,
            statsSeason: sql`CASE WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.season}, 0) THEN EXCLUDED.stats_season ELSE ${mlbPlayers.statsSeason} END`,
            season: sql`GREATEST(COALESCE(${mlbPlayers.season}, 0), EXCLUDED.season)`,
            lastPlayedSeason: sql`CASE
              WHEN COALESCE(EXCLUDED.hitting_plate_appearances, 0) > 0
                OR COALESCE(EXCLUDED.pitching_games, 0) > 0
                OR COALESCE(EXCLUDED.pitching_innings_pitched, 0) > 0
                OR COALESCE(EXCLUDED.had_hitting_stats, false) = true
                OR COALESCE(EXCLUDED.had_pitching_stats, false) = true
              THEN GREATEST(COALESCE(${mlbPlayers.lastPlayedSeason}, 0), EXCLUDED.season)
              ELSE ${mlbPlayers.lastPlayedSeason}
            END`,
            lastPlayedLevel: sql`CASE
              WHEN COALESCE(EXCLUDED.hitting_plate_appearances, 0) > 0
                OR COALESCE(EXCLUDED.pitching_games, 0) > 0
                OR COALESCE(EXCLUDED.pitching_innings_pitched, 0) > 0
                OR COALESCE(EXCLUDED.had_hitting_stats, false) = true
                OR COALESCE(EXCLUDED.had_pitching_stats, false) = true
              THEN CASE
                WHEN EXCLUDED.season >= COALESCE(${mlbPlayers.lastPlayedSeason}, 0)
                  THEN COALESCE(EXCLUDED.last_played_level, EXCLUDED.sport_level)
                  ELSE COALESCE(${mlbPlayers.lastPlayedLevel}, EXCLUDED.last_played_level, EXCLUDED.sport_level)
                END
              ELSE ${mlbPlayers.lastPlayedLevel}
            END`,
            lastSyncedAt: new Date(),
          },
        });
      totalUpserted += batch.length;
    }
    
    return totalUpserted;
  }

  async upsertMlbPlayerStats(stats: InsertMlbPlayerStat[]): Promise<number> {
    if (stats.length === 0) return 0;

    const BATCH_SIZE = 100;
    let totalUpserted = 0;

    for (let i = 0; i < stats.length; i += BATCH_SIZE) {
      const batch = stats.slice(i, i + BATCH_SIZE);
      await db.insert(mlbPlayerStats)
        .values(batch)
        .onConflictDoUpdate({
          target: [mlbPlayerStats.mlbPlayerId, mlbPlayerStats.season],
          set: {
            sportLevel: sql`EXCLUDED.sport_level`,
            hadHittingStats: sql`EXCLUDED.had_hitting_stats`,
            hadPitchingStats: sql`EXCLUDED.had_pitching_stats`,
            hittingAtBats: sql`EXCLUDED.hitting_at_bats`,
            hittingWalks: sql`EXCLUDED.hitting_walks`,
            hittingSingles: sql`EXCLUDED.hitting_singles`,
            hittingDoubles: sql`EXCLUDED.hitting_doubles`,
            hittingTriples: sql`EXCLUDED.hitting_triples`,
            hittingHomeRuns: sql`EXCLUDED.hitting_home_runs`,
            hittingAvg: sql`EXCLUDED.hitting_avg`,
            hittingObp: sql`EXCLUDED.hitting_obp`,
            hittingSlg: sql`EXCLUDED.hitting_slg`,
            hittingOps: sql`EXCLUDED.hitting_ops`,
            pitchingGames: sql`EXCLUDED.pitching_games`,
            pitchingGamesStarted: sql`EXCLUDED.pitching_games_started`,
            pitchingStrikeouts: sql`EXCLUDED.pitching_strikeouts`,
            pitchingWalks: sql`EXCLUDED.pitching_walks`,
            pitchingHits: sql`EXCLUDED.pitching_hits`,
            pitchingHomeRuns: sql`EXCLUDED.pitching_home_runs`,
            pitchingEra: sql`EXCLUDED.pitching_era`,
            pitchingInningsPitched: sql`EXCLUDED.pitching_innings_pitched`,
            hittingGamesStarted: sql`EXCLUDED.hitting_games_started`,
            hittingPlateAppearances: sql`EXCLUDED.hitting_plate_appearances`,
            isTwoWayQualified: sql`EXCLUDED.is_two_way_qualified`,
          },
        });
      totalUpserted += batch.length;
    }

    return totalUpserted;
  }

  async upsertMlbPlayerStatsFromSync(players: InsertMlbPlayer[]): Promise<number> {
    if (players.length === 0) return 0;

    const mlbIds = players.map(p => p.mlbId);
    const LOOKUP_BATCH = 500;
    const idMap = new Map<number, number>();

    for (let i = 0; i < mlbIds.length; i += LOOKUP_BATCH) {
      const batchIds = mlbIds.slice(i, i + LOOKUP_BATCH);
      const rows = await db.select({ id: mlbPlayers.id, mlbId: mlbPlayers.mlbId })
        .from(mlbPlayers)
        .where(inArray(mlbPlayers.mlbId, batchIds));
      for (const row of rows) {
        idMap.set(row.mlbId, row.id);
      }
    }

    const statsToInsert: InsertMlbPlayerStat[] = [];
    for (const p of players) {
      const dbId = idMap.get(p.mlbId);
      if (!dbId) continue;
      const hasStats = p.hadHittingStats || p.hadPitchingStats ||
        (p.hittingPlateAppearances ?? 0) > 0 || (p.pitchingGames ?? 0) > 0;
      if (!hasStats) continue;

      statsToInsert.push({
        mlbPlayerId: dbId,
        season: p.season,
        sportLevel: p.sportLevel ?? null,
        hadHittingStats: p.hadHittingStats ?? false,
        hadPitchingStats: p.hadPitchingStats ?? false,
        hittingAtBats: p.hittingAtBats ?? 0,
        hittingWalks: p.hittingWalks ?? 0,
        hittingSingles: p.hittingSingles ?? 0,
        hittingDoubles: p.hittingDoubles ?? 0,
        hittingTriples: p.hittingTriples ?? 0,
        hittingHomeRuns: p.hittingHomeRuns ?? 0,
        hittingAvg: p.hittingAvg ?? null,
        hittingObp: p.hittingObp ?? null,
        hittingSlg: p.hittingSlg ?? null,
        hittingOps: p.hittingOps ?? null,
        pitchingGames: p.pitchingGames ?? 0,
        pitchingGamesStarted: p.pitchingGamesStarted ?? 0,
        pitchingStrikeouts: p.pitchingStrikeouts ?? 0,
        pitchingWalks: p.pitchingWalks ?? 0,
        pitchingHits: p.pitchingHits ?? 0,
        pitchingHomeRuns: p.pitchingHomeRuns ?? 0,
        pitchingEra: p.pitchingEra ?? null,
        pitchingInningsPitched: p.pitchingInningsPitched ?? 0,
        hittingGamesStarted: p.hittingGamesStarted ?? 0,
        hittingPlateAppearances: p.hittingPlateAppearances ?? 0,
        isTwoWayQualified: p.isTwoWayQualified ?? false,
      });
    }

    return this.upsertMlbPlayerStats(statsToInsert);
  }

  async getMlbPlayers(filters?: { sportLevel?: string; search?: string; limit?: number; offset?: number; currentTeamName?: string; parentOrgName?: string; season?: number; sortBy?: string; sortDir?: string; statsSeason?: number }): Promise<(MlbPlayer & { stats: MlbPlayerStat | null })[]> {
    const conditions = [];
    if (filters?.sportLevel) {
      if (filters.sportLevel === 'MLB') {
        conditions.push(eq(mlbPlayers.sportLevel, 'MLB'));
      } else if (filters.sportLevel === 'minors') {
        conditions.push(sql`${mlbPlayers.sportLevel} != 'MLB'`);
      } else {
        conditions.push(eq(mlbPlayers.sportLevel, filters.sportLevel));
      }
    }
    if (filters?.search) {
      conditions.push(sql`LOWER(unaccent(${mlbPlayers.fullName})) LIKE LOWER(unaccent(${'%' + filters.search + '%'}))`);
    }
    if (filters?.currentTeamName) {
      conditions.push(eq(mlbPlayers.currentTeamName, filters.currentTeamName));
    }
    if (filters?.parentOrgName) {
      conditions.push(eq(mlbPlayers.parentOrgName, filters.parentOrgName));
    }
    const statsSeasonVal = filters?.statsSeason ?? (filters?.season ? filters.season : new Date().getFullYear() - 1);

    const query = db.select()
      .from(mlbPlayers)
      .leftJoin(mlbPlayerStats, and(
        eq(mlbPlayerStats.mlbPlayerId, mlbPlayers.id),
        eq(mlbPlayerStats.season, statsSeasonVal),
      ));
    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    const sortCol = filters?.sortBy;
    const dir = filters?.sortDir === 'desc' ? 'DESC' : 'ASC';
    if (sortCol === 'age') {
      query.orderBy(dir === 'DESC' ? sql`${mlbPlayers.age} DESC NULLS LAST` : sql`${mlbPlayers.age} ASC NULLS LAST`);
    } else if (sortCol === 'position') {
      query.orderBy(dir === 'DESC' ? sql`${mlbPlayers.primaryPosition} DESC NULLS LAST` : sql`${mlbPlayers.primaryPosition} ASC NULLS LAST`);
    } else if (sortCol === 'team') {
      const isMinors = filters?.sportLevel === 'minors';
      const teamSortCol = isMinors ? mlbPlayers.parentOrgName : mlbPlayers.currentTeamName;
      query.orderBy(dir === 'DESC' ? sql`${teamSortCol} DESC NULLS LAST` : sql`${teamSortCol} ASC NULLS LAST`);
    } else {
      query.orderBy(dir === 'DESC' ? sql`${mlbPlayers.fullName} DESC` : mlbPlayers.fullName);
    }

    if (filters?.limit) {
      query.limit(filters.limit);
    }
    if (filters?.offset) {
      query.offset(filters.offset);
    }
    
    const rows = await query;
    return rows.map(r => ({ ...r.mlb_players, stats: r.mlb_player_stats }));
  }

  async getMlbPlayerCount(filters?: { sportLevel?: string; search?: string; positionType?: string; positionTypeNot?: string; hadHittingStats?: boolean; hadPitchingStats?: boolean; isTwoWayQualified?: boolean; currentTeamName?: string; parentOrgName?: string; season?: number }): Promise<number> {
    const conditions = [];
    if (filters?.sportLevel) {
      if (filters.sportLevel === 'MLB') {
        conditions.push(eq(mlbPlayers.sportLevel, 'MLB'));
      } else if (filters.sportLevel === 'minors') {
        conditions.push(sql`${mlbPlayers.sportLevel} != 'MLB'`);
      } else {
        conditions.push(eq(mlbPlayers.sportLevel, filters.sportLevel));
      }
    }
    if (filters?.search) {
      conditions.push(sql`LOWER(unaccent(${mlbPlayers.fullName})) LIKE LOWER(unaccent(${'%' + filters.search + '%'}))`);
    }
    if (filters?.positionType) {
      conditions.push(eq(mlbPlayers.positionType, filters.positionType));
    }
    if (filters?.positionTypeNot) {
      conditions.push(sql`${mlbPlayers.positionType} != ${filters.positionTypeNot}`);
    }
    if (filters?.hadHittingStats !== undefined) {
      conditions.push(eq(mlbPlayers.hadHittingStats, filters.hadHittingStats));
    }
    if (filters?.hadPitchingStats !== undefined) {
      conditions.push(eq(mlbPlayers.hadPitchingStats, filters.hadPitchingStats));
    }
    if (filters?.isTwoWayQualified !== undefined) {
      conditions.push(eq(mlbPlayers.isTwoWayQualified, filters.isTwoWayQualified));
    }
    if (filters?.currentTeamName) {
      conditions.push(eq(mlbPlayers.currentTeamName, filters.currentTeamName));
    }
    if (filters?.parentOrgName) {
      conditions.push(eq(mlbPlayers.parentOrgName, filters.parentOrgName));
    }
    
    const query = db.select({ count: sql<number>`COUNT(*)` }).from(mlbPlayers);
    if (conditions.length > 0) {
      query.where(and(...conditions));
    }
    
    const result = await query;
    return Number(result[0]?.count || 0);
  }

  async getMlbPlayerTeams(season?: number, sportLevel?: string): Promise<string[]> {
    const useParentOrg = sportLevel === 'minors';
    const teamCol = useParentOrg ? mlbPlayers.parentOrgName : mlbPlayers.currentTeamName;
    const conditions = [sql`${teamCol} IS NOT NULL`];
    if (sportLevel) {
      if (sportLevel === 'MLB') {
        conditions.push(eq(mlbPlayers.sportLevel, 'MLB'));
      } else if (sportLevel === 'minors') {
        conditions.push(sql`${mlbPlayers.sportLevel} != 'MLB'`);
      } else {
        conditions.push(eq(mlbPlayers.sportLevel, sportLevel));
      }
    }
    const rows = await db.selectDistinct({ team: teamCol })
      .from(mlbPlayers)
      .where(and(...conditions))
      .orderBy(teamCol);
    return rows.map(r => r.team!).filter(Boolean);
  }

  async getMlbPlayerByMlbId(mlbId: number): Promise<MlbPlayer | undefined> {
    const [player] = await db.select().from(mlbPlayers).where(eq(mlbPlayers.mlbId, mlbId));
    return player;
  }

  async getMlbPlayersByMlbIds(mlbIds: number[], season?: number): Promise<MlbPlayer[]> {
    if (mlbIds.length === 0) return [];
    return db.select().from(mlbPlayers).where(
      inArray(mlbPlayers.mlbId, mlbIds),
    );
  }

  async getMlbPlayersByMlbIdsWithSeasonFallback(mlbIds: number[], season: number): Promise<MlbPlayer[]> {
    if (mlbIds.length === 0) return [];
    return db.select().from(mlbPlayers).where(
      inArray(mlbPlayers.mlbId, mlbIds),
    );
  }

  async updateMlbPlayerMiddleNames(updates: Array<{ mlbId: number; middleName: string }>): Promise<number> {
    if (updates.length === 0) return 0;
    let updated = 0;
    for (const row of updates) {
      const normalized = row.middleName.trim();
      if (!normalized) continue;
      const result = await db
        .update(mlbPlayers)
        .set({ middleName: normalized })
        .where(eq(mlbPlayers.mlbId, row.mlbId));
      updated += result.rowCount || 0;
    }
    return updated;
  }

  async clearMlbPlayers(): Promise<number> {
    const result = await db.delete(mlbPlayers);
    return result.rowCount || 0;
  }

  async getLeagueRosterAssignments(leagueId: number, season?: number, filters?: { userId?: string; rosterType?: string; statsSeason?: number }): Promise<(LeagueRosterAssignment & { player: MlbPlayer; stats: MlbPlayerStat | null })[]> {
    const conditions = [
      eq(leagueRosterAssignments.leagueId, leagueId),
    ];
    if (season) {
      conditions.push(eq(leagueRosterAssignments.season, season));
    }
    if (filters?.userId) {
      conditions.push(eq(leagueRosterAssignments.userId, filters.userId));
    }
    if (filters?.rosterType) {
      conditions.push(eq(leagueRosterAssignments.rosterType, filters.rosterType));
    }

    const statsSeasonVal = filters?.statsSeason ?? (season ? season - 1 : new Date().getFullYear() - 1);

    const rows = await db
      .select()
      .from(leagueRosterAssignments)
      .innerJoin(mlbPlayers, eq(leagueRosterAssignments.mlbPlayerId, mlbPlayers.id))
      .leftJoin(mlbPlayerStats, and(
        eq(mlbPlayerStats.mlbPlayerId, mlbPlayers.id),
        eq(mlbPlayerStats.season, statsSeasonVal),
      ))
      .where(and(...conditions))
      .orderBy(mlbPlayers.fullName);
    return rows.map(r => ({ ...r.league_roster_assignments, player: r.mlb_players, stats: r.mlb_player_stats }));
  }

  async getRosterAssignmentCounts(leagueId: number, season?: number): Promise<{ userId: string; rosterType: string; count: number }[]> {
    const conditions = [eq(leagueRosterAssignments.leagueId, leagueId)];
    if (season) {
      conditions.push(eq(leagueRosterAssignments.season, season));
    }
    const rows = await db
      .select({
        userId: leagueRosterAssignments.userId,
        rosterType: leagueRosterAssignments.rosterType,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(leagueRosterAssignments)
      .where(and(...conditions))
      .groupBy(leagueRosterAssignments.userId, leagueRosterAssignments.rosterType);
    return rows;
  }

  async assignPlayerToRoster(assignment: InsertLeagueRosterAssignment): Promise<LeagueRosterAssignment> {
    const [result] = await db.insert(leagueRosterAssignments).values(assignment).returning();
    return result;
  }

  async deleteAllRosterAssignments(leagueId: number): Promise<number> {
    const result = await db.delete(leagueRosterAssignments).where(eq(leagueRosterAssignments.leagueId, leagueId)).returning();
    return result.length;
  }

  async deleteRosterAssignmentsByType(leagueId: number, rosterType: string): Promise<number> {
    const result = await db.delete(leagueRosterAssignments).where(
      and(eq(leagueRosterAssignments.leagueId, leagueId), eq(leagueRosterAssignments.rosterType, rosterType))
    ).returning();
    return result.length;
  }

  async updateRosterAssignment(id: number, updates: { rosterType?: string; userId?: string; rosterSlot?: string | null }): Promise<LeagueRosterAssignment | undefined> {
    const setObj: any = {};
    if (updates.rosterType) setObj.rosterType = updates.rosterType;
    if (updates.userId) setObj.userId = updates.userId;
    if (updates.rosterSlot !== undefined) setObj.rosterSlot = updates.rosterSlot;
    const [result] = await db.update(leagueRosterAssignments).set(setObj).where(eq(leagueRosterAssignments.id, id)).returning();
    return result;
  }

  async executeRosterTrade(params: {
    leagueId: number;
    season: number;
    teamAUserId: string;
    teamBUserId: string;
    teamAAssignmentIds: number[];
    teamBAssignmentIds: number[];
  }): Promise<{ movedFromA: number; movedFromB: number }> {
    const allIds = Array.from(new Set([...params.teamAAssignmentIds, ...params.teamBAssignmentIds]));
    if (allIds.length === 0) return { movedFromA: 0, movedFromB: 0 };

    return await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(leagueRosterAssignments)
        .where(and(
          eq(leagueRosterAssignments.leagueId, params.leagueId),
          eq(leagueRosterAssignments.season, params.season),
          inArray(leagueRosterAssignments.id, allIds),
        ));

      const rowById = new Map(rows.map((r) => [r.id, r]));
      for (const id of params.teamAAssignmentIds) {
        const row = rowById.get(id);
        if (!row) throw new Error(`Assignment ${id} not found in league/season`);
        if (row.userId !== params.teamAUserId) throw new Error(`Assignment ${id} is not on Team A`);
      }
      for (const id of params.teamBAssignmentIds) {
        const row = rowById.get(id);
        if (!row) throw new Error(`Assignment ${id} not found in league/season`);
        if (row.userId !== params.teamBUserId) throw new Error(`Assignment ${id} is not on Team B`);
      }

      for (const id of params.teamAAssignmentIds) {
        await tx
          .update(leagueRosterAssignments)
          .set({ userId: params.teamBUserId })
          .where(eq(leagueRosterAssignments.id, id));
      }
      for (const id of params.teamBAssignmentIds) {
        await tx
          .update(leagueRosterAssignments)
          .set({ userId: params.teamAUserId })
          .where(eq(leagueRosterAssignments.id, id));
      }

      return { movedFromA: params.teamAAssignmentIds.length, movedFromB: params.teamBAssignmentIds.length };
    });
  }

  async removeRosterAssignment(id: number): Promise<void> {
    await db.delete(leagueRosterAssignments).where(eq(leagueRosterAssignments.id, id));
  }

  async removeAllRosterAssignments(leagueId: number, season: number): Promise<number> {
    const result = await db.delete(leagueRosterAssignments).where(
      and(eq(leagueRosterAssignments.leagueId, leagueId), eq(leagueRosterAssignments.season, season))
    );
    return result.rowCount || 0;
  }

  async getUnassignedPlayers(leagueId: number, season?: number, filters?: { search?: string; sportLevel?: string; limit?: number; offset?: number }): Promise<MlbPlayer[]> {
    const conditions: any[] = [
      sql`NOT EXISTS (SELECT 1 FROM league_roster_assignments lra WHERE lra.mlb_player_id = ${mlbPlayers.id} AND lra.league_id = ${leagueId})`,
    ];
    if (filters?.search) {
      conditions.push(sql`LOWER(unaccent(${mlbPlayers.fullName})) LIKE LOWER(unaccent(${'%' + filters.search + '%'}))`);
    }
    if (filters?.sportLevel) {
      if (filters.sportLevel === 'MLB') {
        conditions.push(eq(mlbPlayers.sportLevel, 'MLB'));
      } else if (filters.sportLevel === 'MiLB') {
        conditions.push(sql`${mlbPlayers.sportLevel} != 'MLB'`);
      } else {
        conditions.push(eq(mlbPlayers.sportLevel, filters.sportLevel));
      }
    }
    
    let query = db.select().from(mlbPlayers).where(and(...conditions)).orderBy(mlbPlayers.fullName);
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }
    return await query;
  }

  async getUnassignedPlayerCount(leagueId: number, season?: number, filters?: { search?: string; sportLevel?: string }): Promise<number> {
    const conditions: any[] = [
      sql`NOT EXISTS (SELECT 1 FROM league_roster_assignments lra WHERE lra.mlb_player_id = ${mlbPlayers.id} AND lra.league_id = ${leagueId})`,
    ];
    if (filters?.search) {
      conditions.push(sql`LOWER(unaccent(${mlbPlayers.fullName})) LIKE LOWER(unaccent(${'%' + filters.search + '%'}))`);
    }
    if (filters?.sportLevel) {
      if (filters.sportLevel === 'MLB') {
        conditions.push(eq(mlbPlayers.sportLevel, 'MLB'));
      } else if (filters.sportLevel === 'MiLB') {
        conditions.push(sql`${mlbPlayers.sportLevel} != 'MLB'`);
      } else {
        conditions.push(eq(mlbPlayers.sportLevel, filters.sportLevel));
      }
    }
    
    const [result] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(mlbPlayers).where(and(...conditions));
    return result?.count || 0;
  }

  async bulkAssignPlayers(assignments: InsertLeagueRosterAssignment[]): Promise<number> {
    if (assignments.length === 0) return 0;
    const BATCH_SIZE = 100;
    let total = 0;
    for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
      const batch = assignments.slice(i, i + BATCH_SIZE);
      await db.insert(leagueRosterAssignments).values(batch);
      total += batch.length;
    }
    return total;
  }

  // Draft operations
  async getDraft(id: number): Promise<Draft | undefined> {
    const [draft] = await db.select().from(drafts).where(eq(drafts.id, id));
    return draft;
  }

  async getActiveDraftIds(): Promise<number[]> {
    const rows = await db.select({ id: drafts.id }).from(drafts).where(eq(drafts.status, "active"));
    return rows.map(r => r.id);
  }

  async getDraftsByLeague(leagueId: number): Promise<DraftWithDetails[]> {
    const allDrafts = await db.select().from(drafts)
      .where(eq(drafts.leagueId, leagueId))
      .orderBy(desc(drafts.createdAt));
    
    const result: DraftWithDetails[] = [];
    for (const draft of allDrafts) {
      const [playerCount] = await db.select({ count: sql<number>`COUNT(*)::int` })
        .from(draftPlayers).where(eq(draftPlayers.draftId, draft.id));
      const [pickCount] = await db.select({ count: sql<number>`COUNT(*)::int` })
        .from(draftPicks).where(eq(draftPicks.draftId, draft.id));
      const [teamCount] = await db.select({ count: sql<number>`COUNT(*)::int` })
        .from(draftOrder).where(eq(draftOrder.draftId, draft.id));
      result.push({
        ...draft,
        playerCount: playerCount?.count || 0,
        pickCount: pickCount?.count || 0,
        teamCount: teamCount?.count || 0,
      });
    }
    return result;
  }

  async createDraft(data: InsertDraft): Promise<Draft> {
    const [draft] = await db.insert(drafts).values(data).returning();
    return draft;
  }

  async updateDraft(id: number, data: Partial<Draft>): Promise<Draft | undefined> {
    const { id: _, ...updateData } = data as any;
    const [draft] = await db.update(drafts).set(updateData).where(eq(drafts.id, id)).returning();
    return draft;
  }

  async deleteDraft(id: number): Promise<void> {
    await db.delete(drafts).where(eq(drafts.id, id));
  }

  // Draft players
  async getDraftPlayers(draftId: number, filters?: { status?: string; search?: string }): Promise<DraftPlayerWithDetails[]> {
    const conditions = [eq(draftPlayers.draftId, draftId)];
    if (filters?.status) {
      conditions.push(eq(draftPlayers.status, filters.status));
    }
    if (filters?.search) {
      const searchPattern = '%' + filters.search + '%';
      conditions.push(sql`LOWER(unaccent(${mlbPlayers.fullName})) LIKE LOWER(unaccent(${searchPattern}))`);
    }
    const rows = await db.select({
      draftPlayer: draftPlayers,
      player: mlbPlayers,
    })
      .from(draftPlayers)
      .innerJoin(mlbPlayers, eq(draftPlayers.mlbPlayerId, mlbPlayers.id))
      .where(and(...conditions))
      .orderBy(mlbPlayers.fullName);
    
    return rows.map(r => ({ ...r.draftPlayer, player: r.player }));
  }

  async getDraftPlayerCount(draftId: number, status?: string): Promise<number> {
    const conditions = [eq(draftPlayers.draftId, draftId)];
    if (status) conditions.push(eq(draftPlayers.status, status));
    const [result] = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(draftPlayers).where(and(...conditions));
    return result?.count || 0;
  }

  async addDraftPlayers(
    draftId: number,
    mlbPlayerIds: number[],
    metadataByMlbPlayerId?: Record<number, { minorLeagueStatus?: string | null; minorLeagueYears?: number | null }>
  ): Promise<number> {
    if (mlbPlayerIds.length === 0) return 0;
    const existing = await db.select({ mlbPlayerId: draftPlayers.mlbPlayerId })
      .from(draftPlayers).where(eq(draftPlayers.draftId, draftId));
    const existingSet = new Set(existing.map(e => e.mlbPlayerId));
    const newIds = mlbPlayerIds.filter(id => !existingSet.has(id));
    if (newIds.length === 0) return 0;
    const values = newIds.map(mlbPlayerId => {
      const meta = metadataByMlbPlayerId?.[mlbPlayerId];
      const normalizedStatus = String(meta?.minorLeagueStatus || "").trim().toUpperCase();
      const minorLeagueStatus = ["MH", "MC", "FA"].includes(normalizedStatus) ? normalizedStatus : null;
      const parsedYears = Number(meta?.minorLeagueYears);
      const minorLeagueYears = Number.isInteger(parsedYears) && parsedYears >= 0 ? parsedYears : null;
      return {
        draftId,
        mlbPlayerId,
        minorLeagueStatus,
        minorLeagueYears,
      };
    });
    const BATCH_SIZE = 100;
    let total = 0;
    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      const batch = values.slice(i, i + BATCH_SIZE);
      await db.insert(draftPlayers).values(batch);
      total += batch.length;
    }
    return total;
  }

  async clearDraftPlayers(draftId: number): Promise<number> {
    const result = await db.delete(draftPlayers).where(eq(draftPlayers.draftId, draftId));
    return result.rowCount || 0;
  }

  async updateDraftPlayerStatus(draftId: number, mlbPlayerId: number, status: string): Promise<void> {
    await db.update(draftPlayers).set({ status })
      .where(and(eq(draftPlayers.draftId, draftId), eq(draftPlayers.mlbPlayerId, mlbPlayerId)));
  }

  async updateDraftPlayerMinorLeague(draftId: number, mlbPlayerId: number, minorLeagueStatus: string | null, minorLeagueYears: number | null): Promise<void> {
    await db.update(draftPlayers).set({ minorLeagueStatus, minorLeagueYears })
      .where(and(eq(draftPlayers.draftId, draftId), eq(draftPlayers.mlbPlayerId, mlbPlayerId)));
  }

  // Draft rounds
  async getDraftRounds(draftId: number): Promise<DraftRound[]> {
    return await db.select().from(draftRounds)
      .where(eq(draftRounds.draftId, draftId))
      .orderBy(draftRounds.roundNumber);
  }

  async setDraftRounds(draftId: number, rounds: { roundNumber: number; name: string; isTeamDraft: boolean; startTime?: Date; pickDurationMinutes?: number }[]): Promise<void> {
    await db.delete(draftRounds).where(eq(draftRounds.draftId, draftId));
    if (rounds.length > 0) {
      await db.insert(draftRounds).values(
        rounds.map(r => ({
          draftId,
          roundNumber: r.roundNumber,
          name: r.name,
          isTeamDraft: r.isTeamDraft,
          startTime: r.startTime ?? new Date(),
          pickDurationMinutes: r.pickDurationMinutes ?? 30,
        })),
      );
    }
  }

  async deleteDraftRound(id: number): Promise<void> {
    const [round] = await db.select().from(draftRounds).where(eq(draftRounds.id, id));
    if (!round) return;
    await db.delete(draftOrder).where(
      and(eq(draftOrder.draftId, round.draftId), eq(draftOrder.roundNumber, round.roundNumber))
    );
    await db.delete(draftRounds).where(eq(draftRounds.id, id));
    const remaining = await db.select().from(draftRounds)
      .where(eq(draftRounds.draftId, round.draftId))
      .orderBy(draftRounds.roundNumber);
    for (let i = 0; i < remaining.length; i++) {
      const newNum = i + 1;
      if (remaining[i].roundNumber !== newNum) {
        await db.update(draftOrder).set({ roundNumber: newNum })
          .where(and(eq(draftOrder.draftId, round.draftId), eq(draftOrder.roundNumber, remaining[i].roundNumber)));
        await db.update(draftRounds).set({ roundNumber: newNum })
          .where(eq(draftRounds.id, remaining[i].id));
      }
    }
    const totalRounds = remaining.length;
    await db.update(drafts).set({ rounds: totalRounds }).where(eq(drafts.id, round.draftId));
  }

  async updateDraftRound(id: number, data: Partial<DraftRound>): Promise<DraftRound | undefined> {
    const { id: _id, ...updateData } = data as any;
    const [result] = await db.update(draftRounds).set(updateData).where(eq(draftRounds.id, id)).returning();
    return result;
  }

  // Draft order
  async getDraftOrder(draftId: number, roundNumber?: number): Promise<(DraftOrder & { user: User })[]> {
    const draft = await this.getDraft(draftId);
    const conditions = [eq(draftOrder.draftId, draftId)];
    if (roundNumber !== undefined) {
      conditions.push(eq(draftOrder.roundNumber, roundNumber));
    }
    const rows = await db.select({
      order: draftOrder,
      user: users,
      member: leagueMembers,
    })
      .from(draftOrder)
      .innerJoin(users, eq(draftOrder.userId, users.id))
      .leftJoin(leagueMembers, and(
        eq(leagueMembers.userId, draftOrder.userId),
        eq(leagueMembers.leagueId, draft?.leagueId ?? 0)
      ))
      .where(and(...conditions))
      .orderBy(draftOrder.roundNumber, draftOrder.orderIndex);
    return rows.map(r => ({
      ...r.order,
      user: {
        ...r.user,
        teamName: r.member?.teamName || r.user.teamName,
        teamAbbreviation: r.member?.teamAbbreviation || null,
      },
    }));
  }

  async setDraftOrder(draftId: number, order: { userId: string; orderIndex: number; roundNumber: number }[]): Promise<void> {
    await db.delete(draftOrder).where(eq(draftOrder.draftId, draftId));
    if (order.length > 0) {
      const BATCH_SIZE = 200;
      for (let i = 0; i < order.length; i += BATCH_SIZE) {
        const batch = order.slice(i, i + BATCH_SIZE);
        await db.insert(draftOrder).values(batch.map(o => ({ draftId, ...o })));
      }
    }
  }

  async clearDraftOrder(draftId: number): Promise<void> {
    await db.delete(draftOrder).where(eq(draftOrder.draftId, draftId));
  }

  // Draft picks
  async getDraftPicks(draftId: number): Promise<DraftPickWithDetails[]> {
    const draft = await this.getDraft(draftId);
    const rows = await db.select({
      pick: draftPicks,
      player: mlbPlayers,
      user: users,
      member: leagueMembers,
    })
      .from(draftPicks)
      .leftJoin(mlbPlayers, eq(draftPicks.mlbPlayerId, mlbPlayers.id))
      .innerJoin(users, eq(draftPicks.userId, users.id))
      .leftJoin(leagueMembers, and(
        eq(leagueMembers.userId, draftPicks.userId),
        eq(leagueMembers.leagueId, draft?.leagueId ?? 0)
      ))
      .where(eq(draftPicks.draftId, draftId))
      .orderBy(draftPicks.overallPickNumber);
    
    return rows.map(r => ({
      ...r.pick,
      player: r.player ?? null,
      user: {
        id: r.user.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        teamName: r.member?.teamName || r.user.teamName,
        teamAbbreviation: r.member?.teamAbbreviation || null,
      },
    }));
  }

  async createDraftPickSlotsForAllRounds(draftId: number): Promise<number> {
    await db.delete(draftPicks).where(eq(draftPicks.draftId, draftId));

    const rounds = await this.getDraftRounds(draftId);
    if (rounds.length === 0) return 0;

    const values: InsertDraftPick[] = [];
    let overallPickNumber = 0;

    for (const round of rounds) {
      const order = await this.getDraftOrder(draftId, round.roundNumber);
      if (order.length === 0) {
        throw new Error(`Draft order missing for round ${round.roundNumber}`);
      }
      if (!round.startTime) {
        throw new Error(`Round ${round.roundNumber} missing start time`);
      }

      const sorted = [...order].sort((a, b) => a.orderIndex - b.orderIndex);
      const roundStartMs = new Date(round.startTime).getTime();
      const pickDurationMs = (round.pickDurationMinutes || 30) * 60 * 1000;

      for (const [idx, entry] of sorted.entries()) {
        overallPickNumber += 1;
        const scheduledAt = new Date(roundStartMs + idx * pickDurationMs);
        const deadlineAt = new Date(roundStartMs + (idx + 1) * pickDurationMs);
        values.push({
          draftId,
          round: round.roundNumber,
          roundPickIndex: idx,
          overallPickNumber,
          userId: entry.userId,
          scheduledAt,
          deadlineAt,
        } as InsertDraftPick);
      }
    }

    const BATCH_SIZE = 500;
    let inserted = 0;
    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      const batch = values.slice(i, i + BATCH_SIZE);
      await db.insert(draftPicks).values(batch);
      inserted += batch.length;
    }
    return inserted;
  }

  async getDraftPickById(pickId: number): Promise<DraftPick | undefined> {
    const [result] = await db.select().from(draftPicks).where(eq(draftPicks.id, pickId));
    return result;
  }

  async updateDraftPick(pickId: number, data: Partial<{ scheduledAt: Date; deadlineAt: Date }>): Promise<void> {
    await db.update(draftPicks).set(data).where(eq(draftPicks.id, pickId));
  }

  async getOldestEligibleOpenSlotForUser(draftId: number, userId: string, now: Date): Promise<DraftPick | undefined> {
    const [slot] = await db.select().from(draftPicks).where(and(
      eq(draftPicks.draftId, draftId),
      eq(draftPicks.userId, userId),
      isNull(draftPicks.madeAt),
    )).orderBy(draftPicks.overallPickNumber).limit(1);
    return slot;
  }

  async fillSlotWithPlayer(slotId: number, userId: string, playerId: number, rosterType: "mlb" | "milb", now: Date): Promise<DraftPick> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM draft_picks WHERE id = ${slotId} FOR UPDATE`);

      const [slot] = await tx.select().from(draftPicks).where(eq(draftPicks.id, slotId));
      if (!slot) throw new Error("Draft slot not found");
      if (slot.userId !== userId) throw new Error("Slot does not belong to user");
      if (slot.madeAt) throw new Error("Draft slot already filled");

      await tx.execute(sql`SELECT id FROM draft_players WHERE draft_id = ${slot.draftId} AND mlb_player_id = ${playerId} FOR UPDATE`);
      const [poolRow] = await tx.select().from(draftPlayers).where(and(
        eq(draftPlayers.draftId, slot.draftId),
        eq(draftPlayers.mlbPlayerId, playerId),
      ));
      if (!poolRow || poolRow.status !== "available") {
        throw new Error("Player is not available in draft pool");
      }

      const [alreadyTaken] = await tx
        .select({ id: draftPicks.id })
        .from(draftPicks)
        .where(and(
          eq(draftPicks.draftId, slot.draftId),
          eq(draftPicks.mlbPlayerId, playerId),
          sql`${draftPicks.madeAt} IS NOT NULL`,
        ))
        .limit(1);
      if (alreadyTaken) {
        throw new Error("Player already drafted in this draft");
      }

      const [draft] = await tx.select().from(drafts).where(eq(drafts.id, slot.draftId));
      if (!draft) throw new Error("Draft not found");

      await tx.update(draftPlayers).set({ status: "drafted" }).where(and(
        eq(draftPlayers.draftId, slot.draftId),
        eq(draftPlayers.mlbPlayerId, playerId),
      ));

      const [updatedSlot] = await tx.update(draftPicks).set({
        mlbPlayerId: playerId,
        rosterType,
        selectedOrgId: null,
        selectedOrgName: null,
        selectedOrgPlayerIds: [],
        madeAt: now,
        madeByUserId: userId,
        skippedAt: null,
        skippedByUserId: null,
      }).where(eq(draftPicks.id, slotId)).returning();

      return updatedSlot;
    });
  }

  async fillSlotWithOrg(slotId: number, userId: string, selectedOrgName: string, selectedOrgId: number | null, rosterType: "mlb" | "milb", now: Date): Promise<{ slot: DraftPick; draftedPlayerIds: number[] }> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM draft_picks WHERE id = ${slotId} FOR UPDATE`);
      const [slot] = await tx.select().from(draftPicks).where(eq(draftPicks.id, slotId));
      if (!slot) throw new Error("Draft slot not found");
      if (slot.userId !== userId) throw new Error("Slot does not belong to user");
      if (slot.madeAt) throw new Error("Draft slot already filled");

      const [alreadyClaimed] = await tx
        .select({ id: draftPicks.id })
        .from(draftPicks)
        .where(and(
          eq(draftPicks.draftId, slot.draftId),
          eq(draftPicks.selectedOrgName, selectedOrgName),
          sql`${draftPicks.madeAt} IS NOT NULL`,
        ))
        .limit(1);
      if (alreadyClaimed) {
        throw new Error("Organization already claimed in this draft");
      }

      await tx.execute(sql`
        SELECT dp.id
        FROM draft_players dp
        JOIN mlb_players mp ON mp.id = dp.mlb_player_id
        WHERE dp.draft_id = ${slot.draftId}
          AND dp.status = 'available'
          AND mp.parent_org_name = ${selectedOrgName}
        FOR UPDATE
      `);

      const orgRows = await tx.select({
        mlbPlayerId: draftPlayers.mlbPlayerId,
        minorLeagueStatus: draftPlayers.minorLeagueStatus,
        minorLeagueYears: draftPlayers.minorLeagueYears,
      }).from(draftPlayers).innerJoin(mlbPlayers, eq(draftPlayers.mlbPlayerId, mlbPlayers.id)).where(and(
        eq(draftPlayers.draftId, slot.draftId),
        eq(draftPlayers.status, "available"),
        eq(mlbPlayers.parentOrgName, selectedOrgName),
      ));
      const draftedPlayerIds = orgRows.map((r) => r.mlbPlayerId);
      if (draftedPlayerIds.length === 0) {
        throw new Error(`No available players found for organization: ${selectedOrgName}`);
      }

      const [draft] = await tx.select().from(drafts).where(eq(drafts.id, slot.draftId));
      if (!draft) throw new Error("Draft not found");

      await tx.update(draftPlayers).set({ status: "drafted" }).where(and(
        eq(draftPlayers.draftId, slot.draftId),
        inArray(draftPlayers.mlbPlayerId, draftedPlayerIds),
      ));

      const [updatedSlot] = await tx.update(draftPicks).set({
        mlbPlayerId: null,
        rosterType,
        selectedOrgName,
        selectedOrgId,
        selectedOrgPlayerIds: draftedPlayerIds,
        madeAt: now,
        madeByUserId: userId,
        skippedAt: null,
        skippedByUserId: null,
      }).where(eq(draftPicks.id, slotId)).returning();

      return { slot: updatedSlot, draftedPlayerIds };
    });
  }

  async clearDraftSlot(slotId: number): Promise<void> {
    await db.update(draftPicks).set({
      mlbPlayerId: null,
      rosterType: null,
      selectedOrgName: null,
      selectedOrgId: null,
      selectedOrgPlayerIds: [],
      madeAt: null,
      madeByUserId: null,
    }).where(eq(draftPicks.id, slotId));
  }

  async clearDraftSlotSkip(slotId: number): Promise<void> {
    await db.update(draftPicks).set({
      skippedAt: null,
      skippedByUserId: null,
    }).where(eq(draftPicks.id, slotId));
  }

  async removeRosterAssignmentByPlayer(leagueId: number, userId: string, mlbPlayerId: number, season: number): Promise<void> {
    await db.delete(leagueRosterAssignments).where(and(
      eq(leagueRosterAssignments.leagueId, leagueId),
      eq(leagueRosterAssignments.userId, userId),
      eq(leagueRosterAssignments.mlbPlayerId, mlbPlayerId),
      eq(leagueRosterAssignments.season, season),
    ));
  }

  async getDraftPlayersByParentOrg(draftId: number, parentOrgName: string): Promise<DraftPlayerWithDetails[]> {
    const rows = await db.select({
      dp: draftPlayers,
      player: mlbPlayers,
    })
      .from(draftPlayers)
      .innerJoin(mlbPlayers, eq(draftPlayers.mlbPlayerId, mlbPlayers.id))
      .where(and(
        eq(draftPlayers.draftId, draftId),
        eq(draftPlayers.status, "available"),
        eq(mlbPlayers.parentOrgName, parentOrgName),
      ));
    return rows.map(r => ({ ...r.dp, player: r.player }));
  }

  async getAutoDraftList(draftId: number, userId: string): Promise<AutoDraftListWithPlayer[]> {
    const rows = await db.select({
      item: autoDraftLists,
      player: mlbPlayers,
    })
      .from(autoDraftLists)
      .innerJoin(mlbPlayers, eq(autoDraftLists.mlbPlayerId, mlbPlayers.id))
      .where(and(
        eq(autoDraftLists.draftId, draftId),
        eq(autoDraftLists.userId, userId),
      ))
      .orderBy(autoDraftLists.rank);
    return rows.map(r => ({ ...r.item, player: r.player }));
  }

  async getAutoDraftItem(id: number): Promise<AutoDraftList | undefined> {
    const [item] = await db.select().from(autoDraftLists).where(eq(autoDraftLists.id, id));
    return item;
  }

  async addAutoDraftItem(draftId: number, userId: string, mlbPlayerId: number, rosterType: string): Promise<AutoDraftList> {
    const existing = await db.select()
      .from(autoDraftLists)
      .where(and(
        eq(autoDraftLists.draftId, draftId),
        eq(autoDraftLists.userId, userId),
      ))
      .orderBy(desc(autoDraftLists.rank));
    const nextRank = existing.length > 0 ? existing[0].rank + 1 : 1;
    const [item] = await db.insert(autoDraftLists).values({
      draftId,
      userId,
      mlbPlayerId,
      rank: nextRank,
      rosterType,
    }).returning();
    return item;
  }

  async removeAutoDraftItem(id: number): Promise<void> {
    await db.delete(autoDraftLists).where(eq(autoDraftLists.id, id));
  }

  async updateAutoDraftItemRosterType(id: number, rosterType: string): Promise<void> {
    await db.update(autoDraftLists).set({ rosterType }).where(eq(autoDraftLists.id, id));
  }

  async reorderAutoDraftList(draftId: number, userId: string, orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(autoDraftLists)
        .set({ rank: i + 1 })
        .where(and(
          eq(autoDraftLists.id, orderedIds[i]),
          eq(autoDraftLists.draftId, draftId),
          eq(autoDraftLists.userId, userId),
        ));
    }
  }

  async getTopAvailableAutoDraftPick(draftId: number, userId: string): Promise<AutoDraftList | undefined> {
    const rows = await db.select({
      item: autoDraftLists,
      dpStatus: draftPlayers.status,
    })
      .from(autoDraftLists)
      .innerJoin(draftPlayers, and(
        eq(draftPlayers.draftId, autoDraftLists.draftId),
        eq(draftPlayers.mlbPlayerId, autoDraftLists.mlbPlayerId),
      ))
      .where(and(
        eq(autoDraftLists.draftId, draftId),
        eq(autoDraftLists.userId, userId),
        eq(draftPlayers.status, "available"),
      ))
      .orderBy(autoDraftLists.rank)
      .limit(1);
    return rows.length > 0 ? rows[0].item : undefined;
  }

  async clearAutoDraftItem(draftId: number, mlbPlayerId: number): Promise<void> {
    await db.delete(autoDraftLists).where(and(
      eq(autoDraftLists.draftId, draftId),
      eq(autoDraftLists.mlbPlayerId, mlbPlayerId),
    ));
  }

  async clearAutoDraftList(draftId: number, userId: string): Promise<number> {
    const result = await db.delete(autoDraftLists).where(and(
      eq(autoDraftLists.draftId, draftId),
      eq(autoDraftLists.userId, userId),
    )).returning();
    return result.length;
  }

  async getTeamAutoDraftList(draftId: number, userId: string): Promise<TeamAutoDraftList[]> {
    return db.select()
      .from(teamAutoDraftLists)
      .where(and(
        eq(teamAutoDraftLists.draftId, draftId),
        eq(teamAutoDraftLists.userId, userId),
      ))
      .orderBy(teamAutoDraftLists.rank);
  }

  async addTeamAutoDraftItem(draftId: number, userId: string, orgName: string, rosterType: string): Promise<TeamAutoDraftList> {
    const existing = await db.select()
      .from(teamAutoDraftLists)
      .where(and(
        eq(teamAutoDraftLists.draftId, draftId),
        eq(teamAutoDraftLists.userId, userId),
      ))
      .orderBy(desc(teamAutoDraftLists.rank));
    const nextRank = existing.length > 0 ? existing[0].rank + 1 : 1;
    const [item] = await db.insert(teamAutoDraftLists).values({
      draftId,
      userId,
      orgName,
      rank: nextRank,
      rosterType,
    }).returning();
    return item;
  }

  async removeTeamAutoDraftItem(id: number): Promise<void> {
    await db.delete(teamAutoDraftLists).where(eq(teamAutoDraftLists.id, id));
  }

  async reorderTeamAutoDraftList(draftId: number, userId: string, orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(teamAutoDraftLists)
        .set({ rank: i + 1 })
        .where(and(
          eq(teamAutoDraftLists.id, orderedIds[i]),
          eq(teamAutoDraftLists.draftId, draftId),
          eq(teamAutoDraftLists.userId, userId),
        ));
    }
  }

  async getTopAvailableTeamAutoDraftPick(draftId: number, userId: string, claimedOrgs: Set<string>): Promise<TeamAutoDraftList | undefined> {
    const list = await db.select()
      .from(teamAutoDraftLists)
      .where(and(
        eq(teamAutoDraftLists.draftId, draftId),
        eq(teamAutoDraftLists.userId, userId),
      ))
      .orderBy(teamAutoDraftLists.rank);

    for (const item of list) {
      if (claimedOrgs.has(item.orgName)) continue;
      const [hasPlayers] = await db.select({ id: draftPlayers.id })
        .from(draftPlayers)
        .innerJoin(mlbPlayers, eq(draftPlayers.mlbPlayerId, mlbPlayers.id))
        .where(and(
          eq(draftPlayers.draftId, draftId),
          eq(draftPlayers.status, "available"),
          eq(mlbPlayers.parentOrgName, item.orgName),
        ))
        .limit(1);
      if (hasPlayers) return item;
    }
    return undefined;
  }

  async clearTeamAutoDraftList(draftId: number, userId: string): Promise<void> {
    await db.delete(teamAutoDraftLists).where(and(
      eq(teamAutoDraftLists.draftId, draftId),
      eq(teamAutoDraftLists.userId, userId),
    ));
  }

  async getDraftUserSettings(draftId: number, userId: string): Promise<{ autoDraftMode: string }> {
    const [row] = await db
      .select()
      .from(draftUserSettings)
      .where(and(
        eq(draftUserSettings.draftId, draftId),
        eq(draftUserSettings.userId, userId)
      ));
    return { autoDraftMode: row?.autoDraftMode ?? "immediate" };
  }

  async setDraftUserSettings(draftId: number, userId: string, autoDraftMode: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(draftUserSettings)
      .where(and(
        eq(draftUserSettings.draftId, draftId),
        eq(draftUserSettings.userId, userId)
      ));
    if (existing) {
      await db.update(draftUserSettings)
        .set({ autoDraftMode })
        .where(eq(draftUserSettings.id, existing.id));
    } else {
      await db.insert(draftUserSettings).values({ draftId, userId, autoDraftMode });
    }
  }

  async getDraftEmailOptOut(draftId: number, userId: string): Promise<boolean> {
    const [optOut] = await db
      .select()
      .from(draftEmailOptOuts)
      .where(and(
        eq(draftEmailOptOuts.draftId, draftId),
        eq(draftEmailOptOuts.userId, userId)
      ))
      .limit(1);
    return !!optOut;
  }

  async setDraftEmailOptOut(draftId: number, userId: string, optedOut: boolean): Promise<void> {
    if (optedOut) {
      const existing = await this.getDraftEmailOptOut(draftId, userId);
      if (!existing) {
        await db.insert(draftEmailOptOuts).values({ draftId, userId });
      }
    } else {
      await db.delete(draftEmailOptOuts).where(and(
        eq(draftEmailOptOuts.draftId, draftId),
        eq(draftEmailOptOuts.userId, userId)
      ));
    }
  }

  async getDraftOptedOutUserIds(draftId: number): Promise<string[]> {
    const optOuts = await db
      .select({ userId: draftEmailOptOuts.userId })
      .from(draftEmailOptOuts)
      .where(eq(draftEmailOptOuts.draftId, draftId));
    return optOuts.map(o => o.userId);
  }
}

export const storage = new DatabaseStorage();
