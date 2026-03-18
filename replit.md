# CBL Auctions Platform

## Overview
The CBL Auctions Platform is a fantasy baseball league management system specifically designed for free agent auctions. It automates the bidding process, supports multi-year contracts with customizable multipliers, and delivers real-time updates. The platform provides tools for both manual and automated bidding by team owners and offers extensive commissioner controls for comprehensive league management, aiming to streamline the free agent acquisition process in fantasy baseball leagues.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, utilizing Vite.
- **UI/UX**: shadcn/ui (Radix UI-based) with a Material Design aesthetic, emphasizing data clarity, density, and a professional sports appearance (Roboto font). Supports light/dark modes using Tailwind CSS with custom CSS variables.
- **State Management**: TanStack Query for server state management with aggressive caching.
- **Routing**: Wouter, supporting core pages (Landing, Home, My Bids, Results) and comprehensive Commissioner and SuperAdmin sub-pages.
- **Design Decisions**: Component co-location, path aliases, React Hook Form with Zod for validation, and real-time countdowns.

### Backend
- **Server**: Express.js with TypeScript on Node.js, bundled with esbuild into a single CJS module.
- **API**: RESTful JSON API.
- **Session Management**: Express sessions with `connect-pg-simple` for PostgreSQL-backed persistent storage.

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL.
- **Schema**: Centralized in `shared/schema.ts` with Drizzle-Zod for runtime validation.
- **Core Tables**: `users`, `auctions`, `auctionTeams`, `leagueSettings`, `freeAgents`, `bids`, `autoBids`, `sessions`, `drafts`, `draftPlayers`, `draftPicks`, `draftOrder`, `leagueRosterAssignments`, `teamOwnershipInvites`, `mlbPlayerStats`, `trades`, `tradeItems`.
- **Storage**: `server/storage.ts` encapsulates database operations.
- **Migrations**: SQL migration files in `migrations/` directory (0001-0019), applied manually via `psql`. Drizzle Kit used for schema introspection.
- **Query Optimization**: Employs batch queries to prevent N+1 issues, particularly for free agent loading.

### Authentication & Authorization
- **Authentication**: Email/password with bcrypt hashing.
- **Authorization**: Multi-tier role-based system including Super Admin, League Commissioner (per-league), and Owner.
- **Security**: League-scoped commissioner checks and secure session management.
- **User Management**: Commissioners can upload users via CSV, with auto-generated passwords and forced password resets.
- **Team Ownership Invites**: Commissioners can invite users via email to take ownership of a league team, with token-based acceptance flow.

### Key Features
- **Auction System**: Comprehensive bidding with configurable increments, auto-bids, real-time countdowns, and per-auction settings for year multipliers, budget enforcement, and optional features like bundled bids or auction extensions.
- **Commissioner Dashboard**: Tools for free agent and user management via CSV, roster management, reconciliation tools, and full auction lifecycle control (create, activate, reset, delete).
- **Roster Management**: Tracks existing player contracts, calculates available budgets based on league caps, and supports flexible CSV uploads. Includes roster onboarding workflow with progress tracking per league.
- **Budget System**: Per-auction team budgets stored in `auctionTeams`, influencing bid validation and real-time budget displays.
- **Free Agent Claims**: Owners can instantly claim unassigned MLB-level free agents directly from the Players page (first come, first served). Claims are tracked with `acquired = "FA {season}"`. Email notifications are sent to commissioners and super admins on each claim (fire-and-forget after response).
- **Player Management**: Relist feature for unsold players, player type classification (Hitter/Pitcher), and per-auction team limits (roster, IP, PA).
- **Super Admin**: Impersonation capabilities and role management for commissioners.
- **Multi-Auction Support**: Manages multiple auctions, with only one active for bidding at a time; supports filtering for historical auctions.
- **Background Jobs**: Automated auction finalization, auto-bid deployment, hourly email summaries, and draft deadline processing (auto-draft/auto-skip on expired deadlines every 60s).
- **MLB Stats Integration**: Commissioners can sync player statistics from MLB's official Stats API, supporting fuzzy name matching, selective stat updates, batch processing, two-way player detection (pitcher/hitter), counting stats (HR, SB, W, SV, IP, PA), wRC+ (from sabermetrics endpoint, MLB-level only), full FML name tracking, and `lastPlayedSeason` auto-population on sync. The `mlb_players` table is a **rolling player directory** — one row per player, with metadata (name, position, team, etc.) only updated when syncing a season equal to or newer than the existing `season` column (i.e. syncing 2021 after 2025 adds stats but won't overwrite 2025 metadata). Stats are stored per-season in a separate `mlb_player_stats` table keyed by `(mlb_player_id, season)` with `sport_level` per row; roster and player queries left-join stats for the appropriate card year (season-1). Season management (badges, delete) is based on `mlb_player_stats` seasons, not the player directory. Sync operations (single-season and range) run in the background with real-time progress tracking via `GET /api/admin/mlb-players/sync-status` (polled every 1.5s by the frontend). The MLB Players page (`/players/mlb`) filters to only show players with MLB-level stats in the card year; the "Unassigned" filter additionally excludes rostered players server-side.
- **Email Notifications**: Integrated with Resend for password resets, new user credentials, and hourly auction summaries with configurable notification settings (none, commissioner, bidders, league) and individual opt-out options.
- **Draft System**: Full draft management with separate detail pages per draft (`/commissioner/drafts/:draftId`), CSV-based order configuration, customizable rounds, "Team Draft" functionality, commissioner pick-on-behalf and nullify/undo pick capabilities (including unskip), time-based pick scheduling with early-pick support, and ranked auto-draft lists (similar to auto-bidding) with configurable auto-draft mode (immediate or deadline-only via `draftUserSettings` table). Draft timing rules: Round 1 picks are sequential (all previous must be made/skipped); Round 2+ picks unlock when previous pick's deadline passes; skipped/deadline-passed picks can be made at any time. Concurrency-safe with per-draft locking.
- **League Roster Assignments**: Tracks MLB players assigned to league teams per season, supporting configurable ML (default 40) and MiLB (default 150) roster limits per league, contract fields, minor league status/years tracking, 60-day IL designation (`rosterSlot` column — players on 60-day IL remain on MLB roster but don't count toward the 40-man limit), and dynamically identifying unassigned players as free agents. Includes duplicate assignment prevention via database trigger. CSV upload supports `roster` column (values: `40` or `60`).
- **Reconciliation**: Commissioner tools for reconciling roster data, with scoped reconciliation views. Name matching includes sport-level scoring bonus (MLB/MiLB alignment), extensive nickname mappings (including Spanish baseball names), and uncarded-player warnings at import time. N-1 season convention documented: card year is always one year behind the CBL game season. CSV uploads pass `acquired` column through to roster assignments; draft assign-picks sets `acquired = "D {season}"` automatically.
- **Trade System**: Owners can propose trades to other league members, selecting players from both rosters (MLB/MiLB). Trade partner receives email notification. Partner can accept (roster swap executes immediately) or reject. Accepted trades trigger league-wide email notifications. Proposer can cancel pending trades. Trade history tracked in database (`trades` + `trade_items` tables). Pages: Submit Trade (`/submit-trade`), Trades (`/trades`).
- **Transactions Page**: Unified view of all league transactions at `/transactions` — includes trades, auction signings, free agent claims, and draft picks. Filterable by type, CBL team, and year. Searchable by player name.
- **Player Carding**: Utility for generating player card displays (`client/src/lib/playerCarding.ts`).
- **Team Display**: Utility for team display formatting (`client/src/lib/teamDisplay.ts`).

## External Dependencies
- **Authentication**: `bcryptjs`, `express-session`, `connect-pg-simple`.
- **Database**: PostgreSQL (`pg`).
- **UI Libraries**: Radix UI, Lucide React, date-fns, Embla Carousel.
- **Development Tools**: Vite, TypeScript, ESBuild.
- **Email Service**: Resend.

## External Build Support
- **SETUP.md**: Guide for building outside Replit with Node.js, PostgreSQL, and environment variable instructions.
- **Docker**: `docker-compose.dev.yml` and `.env.docker` for local Docker-based development.
- **GitHub**: Repository at `https://github.com/caseymaloneongithub/cbl` (main branch).
- **Production Database**: Hosted on Neon PostgreSQL. Production dump available as `cbl_production_dump.sql`.
- **Scripts**: Various utility scripts in `script/` for data seeding, testing, reconciliation, and MLB stat checking.
