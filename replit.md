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
- **Core Tables**: `users`, `auctions`, `auctionTeams`, `leagueSettings`, `freeAgents`, `bids`, `autoBids`, `sessions`, `drafts`, `draftPlayers`, `draftPicks`, `draftOrder`, `leagueRosterAssignments`.
- **Storage**: `server/storage.ts` encapsulates database operations.
- **Migrations**: Drizzle Kit.
- **Query Optimization**: Employs batch queries to prevent N+1 issues, particularly for free agent loading.

### Authentication & Authorization
- **Authentication**: Email/password with bcrypt hashing.
- **Authorization**: Multi-tier role-based system including Super Admin, League Commissioner (per-league), and Owner.
- **Security**: League-scoped commissioner checks and secure session management.
- **User Management**: Commissioners can upload users via CSV, with auto-generated passwords and forced password resets.

### Key Features
- **Auction System**: Comprehensive bidding with configurable increments, auto-bids, real-time countdowns, and per-auction settings for year multipliers, budget enforcement, and optional features like bundled bids or auction extensions.
- **Commissioner Dashboard**: Tools for free agent and user management via CSV, roster management, and full auction lifecycle control (create, activate, reset, delete).
- **Roster Management**: Tracks existing player contracts, calculates available budgets based on league caps, and supports flexible CSV uploads.
- **Budget System**: Per-auction team budgets stored in `auctionTeams`, influencing bid validation and real-time budget displays.
- **Player Management**: Relist feature for unsold players, player type classification (Hitter/Pitcher), and per-auction team limits (roster, IP, PA).
- **Super Admin**: Impersonation capabilities and role management for commissioners.
- **Multi-Auction Support**: Manages multiple auctions, with only one active for bidding at a time; supports filtering for historical auctions.
- **Background Jobs**: Automated auction finalization, auto-bid deployment, and hourly email summaries.
- **MLB Stats Integration**: Commissioners can sync player statistics from MLB's official Stats API, supporting fuzzy name matching, selective stat updates, and batch processing to respect API rate limits.
- **Email Notifications**: Integrated with Resend for password resets, new user credentials, and hourly auction summaries with configurable notification settings (none, commissioner, bidders, league) and individual opt-out options.
- **Draft System**: Full draft management with separate detail pages per draft (`/commissioner/drafts/:draftId`), CSV-based order configuration, customizable rounds, "Team Draft" functionality, commissioner pick-on-behalf and nullify/undo pick capabilities, and time-based pick scheduling with early-pick support.
- **League Roster Assignments**: Tracks MLB players assigned to league teams per season, supporting ML and MiLB roster limits, and dynamically identifying unassigned players as free agents.

## External Dependencies
- **Authentication**: `bcryptjs`, `express-session`, `connect-pg-simple`.
- **Database**: PostgreSQL (`pg`).
- **UI Libraries**: Radix UI, Lucide React, date-fns, Embla Carousel.
- **Development Tools**: Vite, TypeScript, ESBuild.
- **Email Service**: Resend.