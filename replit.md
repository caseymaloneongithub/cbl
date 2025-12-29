# CBL Auctions Platform

## Overview
The CBL Auctions Platform is a fantasy baseball league management system focused on free agent auctions. It enables automated bidding, supports multi-year contracts with configurable multipliers, and provides real-time updates. The platform is designed to allow team owners to bid on free agents, with features for both manual and automated bidding, and offers extensive commissioner controls for league management. Its primary purpose is to streamline the free agent acquisition process in fantasy baseball leagues.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Vite.
- **UI Component System**: shadcn/ui (Radix UI-based) with a Material Design aesthetic, prioritizing data clarity, information density, and a professional sports look (Roboto font).
- **Styling**: Tailwind CSS with custom CSS variables for theming, supporting light/dark modes.
- **State Management**: TanStack Query for server state management with aggressive caching.
- **Routing**: Wouter, handling Landing, Home, My Bids, Results, Commissioner, and SuperAdmin pages.
  - **SuperAdmin page**: Super-admin only; league CRUD, member management, user creation
  - **Commissioner page**: Per-league; auction management, team management, free agent uploads, exports
- **Key Design Decisions**: Component co-location, path aliases, React Hook Form with Zod for validation, real-time countdowns.

### Backend
- **Server Framework**: Express.js with TypeScript on Node.js.
- **Build Strategy**: esbuild for production bundling into a single `dist/index.cjs`.
- **API Design**: RESTful JSON API, organized by resource (e.g., `/api/auth`, `/api/free-agents`).
- **Session Management**: Express sessions with `connect-pg-simple` for PostgreSQL-backed persistent storage (7-day duration, secure, httpOnly cookies).
- **Development Server**: Vite integrated with Express for HMR.

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL.
- **Schema**: Centralized in `shared/schema.ts`, using Drizzle-Zod for runtime validation.
- **Core Tables**: `users`, `auctions`, `auctionTeams`, `leagueSettings`, `freeAgents`, `bids`, `autoBids`, `sessions`.
- **Storage Abstraction**: `server/storage.ts` for database operations encapsulation.
- **Migrations**: Drizzle Kit for schema changes, stored in `/migrations`.
- **User Table**: Stores only basic account info: email, firstName, lastName, teamName, isCommissioner, isSuperAdmin. No budget or limits.
- **AuctionTeams Table**: Per-auction team participation with budget, rosterLimit, ipLimit, paLimit. Teams must be enrolled to participate.
- **Query Optimization**: `enrichFreeAgentsWithBids` uses batch queries (GROUP BY, DISTINCT ON, IN clauses) instead of N+1 queries for fast free agent loading.

### Authentication & Authorization
- **Authentication**: Email/password with bcrypt hashing (cost 12).
- **Authorization**: Multi-tier role-based system:
  - **Super Admin**: Global access to all leagues, can manage leagues and assign commissioners
  - **League Commissioner**: Per-league role stored in `leagueMembers.role` column. A user can be commissioner in one league and regular owner in another.
  - **Owner**: Regular team owner who participates in auctions within their leagues
- **Per-League Commissioner Checks**: All commissioner operations now use league-scoped checks:
  - `hasLeagueCommissionerAccess(userId, leagueId)`: Check if user is commissioner of a specific league
  - `hasAuctionCommissionerAccess(userId, auctionId)`: Check if user is commissioner of the auction's parent league
- **Session Flow**: Standard login, session creation, protected routes via middleware, logout.
- **User Management**: League commissioners can upload users via CSV, auto-generated passwords, `mustResetPassword` flag.
- **Password Reset Flow**: Forces users with `mustResetPassword=true` to set a new password upon login.

### Key Features & System Design
- **Auction Platform**: Comprehensive bidding system with configurable bid increment, auto-bids, real-time countdowns.
- **Per-Auction Settings**: Year multipliers (yearFactor1-5), defaultBudget, enforceBudget, and bidIncrement are stored per-auction in the `auctions` table.
  - Bid calculations use per-auction year factors: Total Value = Annual Salary × yearFactor[years]
  - Budget enforcement is per-auction: auction.enforceBudget flag controls whether budget limits are enforced
  - Commissioner can configure each auction's settings via Settings dialog in Auction Management
- **Optional Auction Features** (configurable per auction via Settings dialog):
  - `allowAutoBidding` (default: true): When disabled, users cannot create auto-bids for this auction
  - `allowBundledBids` (default: true): When disabled, users cannot create bid bundles for this auction
  - `extendAuctionOnBid` (default: false): When enabled, bids placed within 24 hours of auction end time automatically extend the end time by 24 hours
  - Server-side validation enforces these restrictions; frontend hides UI elements when features are disabled
- **Commissioner Dashboard**: CSV uploads for free agents, user management, and roster management; auction control (create, rename, activate, reset, delete).
- **Roster Management**: Track existing player contracts (player name, team abbreviation, player type, IP, PA, salary, contract years) and calculate available budgets for auctions based on league caps.
  - League-level caps (budgetCap, ipCap, paCap) stored in `leagues` table
  - `rosterPlayers` table stores existing contracts by team
  - CSV upload supports flexible column headers (case-insensitive, multiple name variants)
  - Roster usage calculated by summing IP/PA/salary from rosterPlayers per team
  - API routes: `GET /api/leagues/:id/roster-usage`, `POST /api/leagues/:id/roster/upload`, `PATCH /api/leagues/:id/caps`, `DELETE /api/leagues/:id/roster`
- **Auction Limit Source**: Auctions can derive team limits from rosters or use manually uploaded/entered values.
  - `limitSource` field in auctions table: "manual" (default) or "roster"
  - "Sync from Roster" button calculates available = league cap - roster usage for each team
  - Teams with no roster data get full league cap values
  - API route: `POST /api/auctions/:id/sync-from-roster`
- **Budget System**: Per-auction team budgets stored in `auctionTeams` table, tracking dollar amount of bids per auction.
  - Budget calculations scope to specific auctions via `?auctionId=X` parameter
  - Home page automatically uses the active auction's ID for budget display
- **Bid Validation**: Ensures bids meet minimum increment and respect player `minimumBid` and `minimumYears`.
  - Limit checks (roster/IP/PA) now use per-auction settings from `auctionTeams` table
- **Relist Feature**: Allows commissioners to relist players with no bids.
- **Player Type System**: Classifies players as "Hitter" or "Pitcher" with specific sortable stats.
- **Team Limits**: Per-auction roster, IP, and PA limits stored in `auctionTeams` table.
  - API: `GET /api/limits?auctionId=X`, `PATCH /api/auctions/:id/teams/:userId/limits`
  - Bid validation uses player's `auctionId` to determine which limits apply
- **Super Admin & Impersonation**: Super admin can impersonate any user, with UI indicators and dedicated API endpoints.
- **Commissioner Role Management**: Super admin-only assignment, one active commissioner at a time, transactional updates.
- **Team Deletion**: Allows deletion of inactive teams (no bids, no won players, etc.).
- **Multi-Auction Support**: Only one auction can be active at a time for bidding; commissioners and users can review archived/completed auctions.
  - Results page has auction selector to filter by specific auction
  - Home page shows the currently active auction name and filters data by active auction
  - Commissioners can create, rename, activate, reset (with password), and delete (with password) auctions
  - API supports `?auctionId=X` query parameter for filtering free agents, results, budget, and limits
  - Free agents are required to be associated with an auction when created (via auction selector in Commissioner page)
- **Background Jobs**:
  - Auction Finalization (every minute): Automatically sets winnerId and winningBidId for closed auctions based on highest bid
  - Hourly Email Summary: Sends email to super admin with auction results (won players and no-bid players) if any auctions closed in the past hour
  - "Ending Today" calculation uses Eastern Time for midnight boundary
- **Email Notifications**: Resend integration for password reset, new user credentials, and hourly auction summaries

## External Dependencies

- **Authentication**: `bcryptjs`, `express-session`, `connect-pg-simple`.
- **Database**: PostgreSQL (`pg` library for pooling).
- **UI Libraries**: Radix UI, Lucide React, date-fns, Embla Carousel.
- **Development Tools**: Vite, TypeScript, ESBuild.
- **Environment Variables**: `DATABASE_URL`, `SESSION_SECRET`.