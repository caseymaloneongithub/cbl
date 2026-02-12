import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  real,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Leagues table - each league is an independent tenant
export const leagues = pgTable("leagues", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(), // URL-friendly identifier
  timezone: varchar("timezone", { length: 50 }).default("America/New_York").notNull(),
  // League-wide caps for roster management
  budgetCap: real("budget_cap"),
  ipCap: real("ip_cap"),
  paCap: integer("pa_cap"),
  mlRosterLimit: integer("ml_roster_limit").default(40),
  milbRosterLimit: integer("milb_roster_limit").default(125),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leaguesRelations = relations(leagues, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [leagues.createdById],
    references: [users.id],
  }),
  members: many(leagueMembers),
  auctions: many(auctions),
}));

// League members table - tracks which users belong to which leagues and their roles
export const leagueMembers = pgTable("league_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  leagueId: integer("league_id").references(() => leagues.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: varchar("role", { length: 20 }).default("owner").notNull(), // 'owner', 'commissioner'
  teamName: varchar("team_name"),
  teamAbbreviation: varchar("team_abbreviation", { length: 3 }),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leagueMembersRelations = relations(leagueMembers, ({ one }) => ({
  league: one(leagues, {
    fields: [leagueMembers.leagueId],
    references: [leagues.id],
  }),
  user: one(users, {
    fields: [leagueMembers.userId],
    references: [users.id],
  }),
}));

// Roster players table - tracks existing player contracts for each team in a league
export const rosterPlayers = pgTable("roster_players", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  leagueId: integer("league_id").references(() => leagues.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(), // Team owner
  playerName: varchar("player_name", { length: 255 }).notNull(),
  playerType: varchar("player_type", { length: 10 }).notNull(), // 'hitter' or 'pitcher'
  ip: real("ip"), // Innings pitched (for pitchers)
  pa: integer("pa"), // Plate appearances (for hitters)
  salary: real("salary").default(0).notNull(), // Annual salary
  contractYears: integer("contract_years").default(1), // Years remaining on contract
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const rosterPlayersRelations = relations(rosterPlayers, ({ one }) => ({
  league: one(leagues, {
    fields: [rosterPlayers.leagueId],
    references: [leagues.id],
  }),
  user: one(users, {
    fields: [rosterPlayers.userId],
    references: [users.id],
  }),
}));

// Users table - supports owners, commissioners, and super admins
// Note: Budget and limits are per-auction, stored in auctionTeams table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isCommissioner: boolean("is_commissioner").default(false).notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  teamName: varchar("team_name"),
  teamAbbreviation: varchar("team_abbreviation", { length: 3 }),
  mustResetPassword: boolean("must_reset_password").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  bids: many(bids),
  autoBids: many(autoBids),
}));

// Auctions table - stores named auctions with all auction-level settings
export const auctions = pgTable("auctions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  leagueId: integer("league_id").references(() => leagues.id),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(), // 'draft', 'active', 'closed'
  bidIncrement: real("bid_increment").default(0.05).notNull(), // Minimum bid increment as decimal (0.05 = 5%)
  // Year multiplier factors for contract calculations
  yearFactor1: real("year_factor_1").default(1.0).notNull(),
  yearFactor2: real("year_factor_2").default(1.25).notNull(),
  yearFactor3: real("year_factor_3").default(1.33).notNull(),
  yearFactor4: real("year_factor_4").default(1.43).notNull(),
  yearFactor5: real("year_factor_5").default(1.55).notNull(),
  // Budget settings
  defaultBudget: real("default_budget").default(260).notNull(),
  enforceBudget: boolean("enforce_budget").default(true).notNull(),
  // Optional bidding features
  allowAutoBidding: boolean("allow_auto_bidding").default(true).notNull(),
  allowBundledBids: boolean("allow_bundled_bids").default(true).notNull(),
  extendAuctionOnBid: boolean("extend_auction_on_bid").default(false).notNull(), // Push back end time 24h when bid placed within 24h
  // Limit source: 'manual' = use uploaded/entered limits, 'roster' = derive from league caps minus roster usage
  limitSource: varchar("limit_source", { length: 20 }).default("manual").notNull(),
  // Email notification setting: 'none' = no emails, 'commissioner' = commissioner only, 'bidders' = only teams who bid, 'league' = all league members
  emailNotifications: varchar("email_notifications", { length: 20 }).default("bidders").notNull(),
  createdById: varchar("created_by_id").references(() => users.id),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const auctionsRelations = relations(auctions, ({ one, many }) => ({
  league: one(leagues, {
    fields: [auctions.leagueId],
    references: [leagues.id],
  }),
  createdBy: one(users, {
    fields: [auctions.createdById],
    references: [users.id],
  }),
  freeAgents: many(freeAgents),
  auctionTeams: many(auctionTeams),
}));

// Auction teams table - tracks which teams participate in each auction with their budget/limits
// This is the source of truth for all per-auction team settings
export const auctionTeams = pgTable("auction_teams", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  auctionId: integer("auction_id").references(() => auctions.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  budget: real("budget").notNull(), // Team's budget for this auction
  rosterLimit: integer("roster_limit"), // Max players team can have (null = unlimited)
  ipLimit: real("ip_limit"), // Max pitcher innings pitched limit (null = unlimited)
  paLimit: integer("pa_limit"), // Max hitter plate appearances limit (null = unlimited)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const auctionTeamsRelations = relations(auctionTeams, ({ one }) => ({
  auction: one(auctions, {
    fields: [auctionTeams.auctionId],
    references: [auctions.id],
  }),
  user: one(users, {
    fields: [auctionTeams.userId],
    references: [users.id],
  }),
}));

// League settings table - stores year multiplier factors
export const leagueSettings = pgTable("league_settings", {
  id: integer("id").primaryKey().default(1),
  yearFactor1: real("year_factor_1").default(1.0).notNull(),
  yearFactor2: real("year_factor_2").default(1.25).notNull(),
  yearFactor3: real("year_factor_3").default(1.33).notNull(),
  yearFactor4: real("year_factor_4").default(1.43).notNull(),
  yearFactor5: real("year_factor_5").default(1.55).notNull(),
  defaultBudget: real("default_budget").default(260).notNull(),
  enforceBudget: boolean("enforce_budget").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Free agents table - players available for bidding
export const freeAgents = pgTable("free_agents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  auctionId: integer("auction_id").references(() => auctions.id),
  name: varchar("name", { length: 255 }).notNull(),
  team: varchar("team", { length: 100 }),
  playerType: varchar("player_type", { length: 20 }).default("hitter").notNull(), // 'pitcher' or 'hitter'
  minimumBid: real("minimum_bid").default(1).notNull(),
  minimumYears: integer("minimum_years").default(1).notNull(),
  auctionStartTime: timestamp("auction_start_time"), // When bidding opens (null = immediately available)
  auctionEndTime: timestamp("auction_end_time").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  winnerId: varchar("winner_id").references(() => users.id),
  winningBidId: integer("winning_bid_id"),
  createdAt: timestamp("created_at").defaultNow(),
  // Hitter stats
  avg: real("avg"),           // Batting average (e.g., 0.285)
  hr: integer("hr"),          // Home runs
  rbi: integer("rbi"),        // Runs batted in
  runs: integer("runs"),      // Runs scored
  sb: integer("sb"),          // Stolen bases
  ops: real("ops"),           // On-base plus slugging
  pa: integer("pa"),          // Plate appearances (used for team limit tracking)
  // Pitcher stats
  wins: integer("wins"),      // Wins
  losses: integer("losses"),  // Losses
  era: real("era"),           // Earned run average
  whip: real("whip"),         // Walks + hits per inning pitched
  strikeouts: integer("strikeouts"), // Strikeouts
  ip: real("ip"),             // Innings pitched
  resultEmailedAt: timestamp("result_emailed_at"), // When the result email was sent (null = not yet emailed)
});

export const freeAgentsRelations = relations(freeAgents, ({ one, many }) => ({
  auction: one(auctions, {
    fields: [freeAgents.auctionId],
    references: [auctions.id],
  }),
  winner: one(users, {
    fields: [freeAgents.winnerId],
    references: [users.id],
  }),
  bids: many(bids),
  autoBids: many(autoBids),
}));

// Bids table - all bids placed on free agents
export const bids = pgTable("bids", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  freeAgentId: integer("free_agent_id").references(() => freeAgents.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: real("amount").notNull(),
  years: integer("years").notNull(),
  totalValue: real("total_value").notNull(),
  isAutoBid: boolean("is_auto_bid").default(false).notNull(),
  isImportedInitial: boolean("is_imported_initial").default(false).notNull(), // True for bids imported via CSV
  createdAt: timestamp("created_at").defaultNow(),
});

export const bidsRelations = relations(bids, ({ one }) => ({
  freeAgent: one(freeAgents, {
    fields: [bids.freeAgentId],
    references: [freeAgents.id],
  }),
  user: one(users, {
    fields: [bids.userId],
    references: [users.id],
  }),
}));

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: varchar("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

// Auto-bids table - stores maximum bid settings per user per player
export const autoBids = pgTable("auto_bids", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  freeAgentId: integer("free_agent_id").references(() => freeAgents.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  maxAmount: real("max_amount").notNull(),
  years: integer("years").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const autoBidsRelations = relations(autoBids, ({ one }) => ({
  freeAgent: one(freeAgents, {
    fields: [autoBids.freeAgentId],
    references: [freeAgents.id],
  }),
  user: one(users, {
    fields: [autoBids.userId],
    references: [users.id],
  }),
}));

// Bid bundles table - groups of conditional bids that deploy sequentially when outbid
export const bidBundles = pgTable("bid_bundles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  auctionId: integer("auction_id").references(() => auctions.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: varchar("name", { length: 100 }),
  status: varchar("status", { length: 20 }).default("active").notNull(), // 'active', 'completed', 'cancelled'
  activeItemPriority: integer("active_item_priority").default(1).notNull(), // Which priority item is currently active
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bidBundlesRelations = relations(bidBundles, ({ one, many }) => ({
  auction: one(auctions, {
    fields: [bidBundles.auctionId],
    references: [auctions.id],
  }),
  user: one(users, {
    fields: [bidBundles.userId],
    references: [users.id],
  }),
  items: many(bidBundleItems),
}));

// Bid bundle items table - individual bids within a bundle
export const bidBundleItems = pgTable("bid_bundle_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  bundleId: integer("bundle_id").references(() => bidBundles.id).notNull(),
  freeAgentId: integer("free_agent_id").references(() => freeAgents.id).notNull(),
  priority: integer("priority").notNull(), // 1-5, lower = higher priority
  amount: real("amount").notNull(),
  years: integer("years").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // 'pending', 'active', 'deployed', 'outbid', 'skipped', 'won'
  bidId: integer("bid_id").references(() => bids.id), // Link to actual bid when deployed
  activatedAt: timestamp("activated_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bidBundleItemsRelations = relations(bidBundleItems, ({ one }) => ({
  bundle: one(bidBundles, {
    fields: [bidBundleItems.bundleId],
    references: [bidBundles.id],
  }),
  freeAgent: one(freeAgents, {
    fields: [bidBundleItems.freeAgentId],
    references: [freeAgents.id],
  }),
  bid: one(bids, {
    fields: [bidBundleItems.bidId],
    references: [bids.id],
  }),
}));

// Email opt-outs table - tracks users who have opted out of email notifications per auction
export const emailOptOuts = pgTable("email_opt_outs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  auctionId: integer("auction_id").references(() => auctions.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailOptOutsRelations = relations(emailOptOuts, ({ one }) => ({
  auction: one(auctions, {
    fields: [emailOptOuts.auctionId],
    references: [auctions.id],
  }),
  user: one(users, {
    fields: [emailOptOuts.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertLeagueSchema = createInsertSchema(leagues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeagueMemberSchema = createInsertSchema(leagueMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRosterPlayerSchema = createInsertSchema(rosterPlayers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuctionSchema = createInsertSchema(auctions).omit({
  id: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuctionTeamSchema = createInsertSchema(auctionTeams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeagueSettingsSchema = createInsertSchema(leagueSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertFreeAgentSchema = createInsertSchema(freeAgents).omit({
  id: true,
  winnerId: true,
  winningBidId: true,
  createdAt: true,
});

export const insertBidSchema = createInsertSchema(bids).omit({
  id: true,
  createdAt: true,
});

export const insertAutoBidSchema = createInsertSchema(autoBids).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export const insertBidBundleSchema = createInsertSchema(bidBundles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBidBundleItemSchema = createInsertSchema(bidBundleItems).omit({
  id: true,
  bidId: true,
  activatedAt: true,
  createdAt: true,
});

export const insertEmailOptOutSchema = createInsertSchema(emailOptOuts).omit({
  id: true,
  createdAt: true,
});

// Drafts - league-scoped draft events
export const drafts = pgTable("drafts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  leagueId: integer("league_id").references(() => leagues.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  season: integer("season").notNull(),
  rounds: integer("rounds").notNull().default(1),
  snake: boolean("snake").notNull().default(true),
  status: varchar("status", { length: 20 }).notNull().default("setup"), // 'setup', 'active', 'completed'
  currentRound: integer("current_round").notNull().default(1),
  currentPickIndex: integer("current_pick_index").notNull().default(0),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_drafts_league").on(table.leagueId),
]);

export const insertDraftSchema = createInsertSchema(drafts).omit({
  id: true,
  createdAt: true,
  currentRound: true,
  currentPickIndex: true,
});

// Draft players - pool of players eligible for a draft
export const draftPlayers = pgTable("draft_players", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  draftId: integer("draft_id").references(() => drafts.id, { onDelete: "cascade" }).notNull(),
  mlbPlayerId: integer("mlb_player_id").references(() => mlbPlayers.id).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("available"), // 'available', 'drafted'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_draft_players_draft").on(table.draftId),
  index("idx_draft_players_mlb").on(table.mlbPlayerId),
]);

export const insertDraftPlayerSchema = createInsertSchema(draftPlayers).omit({
  id: true,
  createdAt: true,
  status: true,
});

// Draft order - defines pick order for each draft
export const draftOrder = pgTable("draft_order", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  draftId: integer("draft_id").references(() => drafts.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  orderIndex: integer("order_index").notNull(),
}, (table) => [
  index("idx_draft_order_draft").on(table.draftId),
]);

export const insertDraftOrderSchema = createInsertSchema(draftOrder).omit({
  id: true,
});

// Draft picks - records of each pick made
export const draftPicks = pgTable("draft_picks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  draftId: integer("draft_id").references(() => drafts.id, { onDelete: "cascade" }).notNull(),
  round: integer("round").notNull(),
  pickNumber: integer("pick_number").notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  mlbPlayerId: integer("mlb_player_id").references(() => mlbPlayers.id).notNull(),
  rosterType: varchar("roster_type", { length: 10 }).notNull(), // 'mlb' or 'milb'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_draft_picks_draft").on(table.draftId),
]);

export const insertDraftPickSchema = createInsertSchema(draftPicks).omit({
  id: true,
  createdAt: true,
});

// League roster assignments - links MLB players to league teams
export const leagueRosterAssignments = pgTable("league_roster_assignments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  leagueId: integer("league_id").references(() => leagues.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  mlbPlayerId: integer("mlb_player_id").references(() => mlbPlayers.id).notNull(),
  rosterType: varchar("roster_type", { length: 10 }).notNull(), // 'mlb', 'milb', 'draft'
  season: integer("season").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_roster_assignments_league_season").on(table.leagueId, table.season),
  index("idx_roster_assignments_user").on(table.userId),
]);

export const insertLeagueRosterAssignmentSchema = createInsertSchema(leagueRosterAssignments).omit({
  id: true,
  createdAt: true,
});

// MLB Players reference table - stores all affiliated baseball players
export const mlbPlayers = pgTable("mlb_players", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  mlbId: integer("mlb_id").unique().notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 128 }),
  lastName: varchar("last_name", { length: 128 }),
  primaryPosition: varchar("primary_position", { length: 10 }),
  positionName: varchar("position_name", { length: 50 }),
  positionType: varchar("position_type", { length: 20 }),
  batSide: varchar("bat_side", { length: 5 }),
  throwHand: varchar("throw_hand", { length: 5 }),
  currentTeamId: integer("current_team_id"),
  currentTeamName: varchar("current_team_name", { length: 255 }),
  parentOrgId: integer("parent_org_id"),
  parentOrgName: varchar("parent_org_name", { length: 255 }),
  sportId: integer("sport_id").notNull(),
  sportLevel: varchar("sport_level", { length: 20 }).notNull(),
  birthDate: varchar("birth_date", { length: 20 }),
  age: integer("age"),
  isActive: boolean("is_active").default(true),
  hadHittingStats: boolean("had_hitting_stats").default(false),
  hadPitchingStats: boolean("had_pitching_stats").default(false),
  season: integer("season").notNull(),
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
}, (table) => [
  index("idx_mlb_players_mlb_id").on(table.mlbId),
  index("idx_mlb_players_name").on(table.fullName),
  index("idx_mlb_players_sport_level").on(table.sportLevel),
]);

export const insertMlbPlayerSchema = createInsertSchema(mlbPlayers).omit({
  id: true,
  lastSyncedAt: true,
});

// Types
export type League = typeof leagues.$inferSelect;
export type InsertLeague = z.infer<typeof insertLeagueSchema>;

export type LeagueMember = typeof leagueMembers.$inferSelect;
export type InsertLeagueMember = z.infer<typeof insertLeagueMemberSchema>;

export type RosterPlayer = typeof rosterPlayers.$inferSelect;
export type InsertRosterPlayer = z.infer<typeof insertRosterPlayerSchema>;

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Auction = typeof auctions.$inferSelect;
export type InsertAuction = z.infer<typeof insertAuctionSchema>;

export type AuctionTeam = typeof auctionTeams.$inferSelect;
export type InsertAuctionTeam = z.infer<typeof insertAuctionTeamSchema>;

export type LeagueSettings = typeof leagueSettings.$inferSelect;
export type InsertLeagueSettings = z.infer<typeof insertLeagueSettingsSchema>;

export type FreeAgent = typeof freeAgents.$inferSelect;
export type InsertFreeAgent = z.infer<typeof insertFreeAgentSchema>;

export type Bid = typeof bids.$inferSelect;
export type InsertBid = z.infer<typeof insertBidSchema>;

export type AutoBid = typeof autoBids.$inferSelect;
export type InsertAutoBid = z.infer<typeof insertAutoBidSchema>;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

export type BidBundle = typeof bidBundles.$inferSelect;
export type InsertBidBundle = z.infer<typeof insertBidBundleSchema>;

export type BidBundleItem = typeof bidBundleItems.$inferSelect;
export type InsertBidBundleItem = z.infer<typeof insertBidBundleItemSchema>;

export type EmailOptOut = typeof emailOptOuts.$inferSelect;
export type InsertEmailOptOut = z.infer<typeof insertEmailOptOutSchema>;

export type MlbPlayer = typeof mlbPlayers.$inferSelect;
export type InsertMlbPlayer = z.infer<typeof insertMlbPlayerSchema>;

export type LeagueRosterAssignment = typeof leagueRosterAssignments.$inferSelect;
export type InsertLeagueRosterAssignment = z.infer<typeof insertLeagueRosterAssignmentSchema>;

export type Draft = typeof drafts.$inferSelect;
export type InsertDraft = z.infer<typeof insertDraftSchema>;

export type DraftPlayer = typeof draftPlayers.$inferSelect;
export type InsertDraftPlayer = z.infer<typeof insertDraftPlayerSchema>;

export type DraftOrder = typeof draftOrder.$inferSelect;
export type InsertDraftOrder = z.infer<typeof insertDraftOrderSchema>;

export type DraftPick = typeof draftPicks.$inferSelect;
export type InsertDraftPick = z.infer<typeof insertDraftPickSchema>;

export type DraftPlayerWithDetails = DraftPlayer & {
  player: MlbPlayer;
};

export type DraftPickWithDetails = DraftPick & {
  player: MlbPlayer;
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'teamName'>;
};

export type DraftWithDetails = Draft & {
  playerCount: number;
  pickCount: number;
  teamCount: number;
};

// Extended types for frontend use
export type FreeAgentWithBids = FreeAgent & {
  currentBid: Bid | null;
  highBidder: User | null;
  bidCount: number;
};

export type OutbidPlayer = FreeAgentWithBids & {
  userHighestBid: Bid | null;
};

export type BidWithUser = Bid & {
  user: User;
};

export type UserWithStats = User & {
  activeBids: number;
  wonPlayers: number;
};

export type BidBundleItemWithAgent = BidBundleItem & {
  freeAgent: FreeAgent;
};

export type BidBundleWithItems = BidBundle & {
  items: BidBundleItemWithAgent[];
};
