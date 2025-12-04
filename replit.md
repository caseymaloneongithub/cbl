# Strat League Auction Platform

## Overview

A fantasy baseball league platform for managing free agent auctions with automated bidding, multi-year contracts, and real-time updates. Team owners can bid on free agents with 1-5 year contract terms, where contract values are calculated using configurable year multipliers. The platform supports both manual bidding and automated bidding with maximum limits.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool and bundler.

**UI Component System**: shadcn/ui components (built on Radix UI primitives) following a Material Design-inspired approach focused on data clarity and information density. The design system emphasizes:
- Scannable bid information and player statistics
- Prominent call-to-action buttons for bidding
- Real-time visual feedback for countdowns and bid updates
- Professional sports aesthetic with Roboto font family

**Styling**: Tailwind CSS with a custom design system using CSS variables for theming. Supports both light and dark modes with theme persistence.

**State Management**: TanStack Query (React Query) for server state management with aggressive caching strategies (staleTime: Infinity). No global client state management library needed.

**Routing**: Wouter for lightweight client-side routing with four main pages:
- Landing (unauthenticated users)
- Home (free agents listing)
- My Bids (user's active and won bids)
- Results (closed auctions)
- Commissioner (admin controls)

**Key Design Decisions**:
- Component co-location: UI components stored in `client/src/components/ui/`
- Path aliases configured for clean imports (`@/`, `@shared/`, `@assets/`)
- Form validation using React Hook Form with Zod resolvers
- Real-time countdown timers for auction end times

### Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js.

**Build Strategy**: Production builds use esbuild to bundle server code into a single `dist/index.cjs` file. Specific dependencies (like database drivers, authentication libraries) are bundled to reduce cold start times by minimizing file system calls.

**API Design**: RESTful JSON API with endpoints organized by resource:
- `/api/auth/*` - Authentication endpoints
- `/api/settings` - League configuration
- `/api/free-agents` - Player auction listings
- `/api/bids` - Manual bid submission
- `/api/auto-bids` - Automated bidding configuration
- `/api/my-bids` - User's bid history
- `/api/results` - Closed auction results

**Session Management**: Express sessions backed by PostgreSQL using `connect-pg-simple` for persistent session storage. Sessions last 7 days with secure, httpOnly cookies.

**Development Server**: Vite dev server integrated with Express in development mode for HMR support and fast refresh.

### Database Layer

**ORM**: Drizzle ORM with PostgreSQL dialect for type-safe database operations.

**Schema Organization**: All schema definitions centralized in `shared/schema.ts` for sharing between client and server. Uses Drizzle-Zod for runtime validation schemas derived from database schema.

**Core Tables**:
- `users` - Team owners and commissioners with profile information
- `leagueSettings` - Configurable year multipliers for contract calculations
- `freeAgents` - Players available for bidding with auction end times
- `bids` - Manual bid history with timestamps and amounts
- `autoBids` - Automated bidding rules with max amounts and year preferences
- `sessions` - Persistent session storage for authentication

**Storage Abstraction**: `server/storage.ts` provides an interface layer between routes and database operations, encapsulating all Drizzle queries. This allows for easier testing and potential database swapping.

**Migrations**: Schema changes managed via Drizzle Kit with migrations stored in `/migrations` directory.

### Authentication & Authorization

**Authentication Provider**: Email/password authentication with bcrypt password hashing (cost factor 12).

**Authorization Model**: Role-based system with three roles:
- Regular users (team owners) - can view auctions and place bids
- Commissioners - can modify league settings, upload free agents, manage users, and create new user accounts
- Super Admin - has all commissioner powers plus can impersonate any user to see the platform from their perspective

**Session Flow**:
1. User submits email/password to `POST /api/auth/login`
2. Server validates credentials against bcrypt hash
3. Session created and stored in PostgreSQL with userId
4. Protected routes use `isAuthenticated` middleware
5. User can logout via `POST /api/auth/logout`

**User Management**:
- Commissioners can upload users via CSV (email, first_name, last_name, team_name, budget)
- System auto-generates secure passwords for new users
- Credentials CSV can be downloaded after upload
- Users with `mustResetPassword` flag are prompted to change password

### External Dependencies

**Authentication**: 
- bcryptjs for password hashing
- express-session for session management
- connect-pg-simple for PostgreSQL session storage

**Database**:
- PostgreSQL (required via DATABASE_URL environment variable)
- Connection pooling via `pg` library

**UI Libraries**:
- Radix UI primitives for accessible component foundation
- Lucide React for icons
- date-fns for time calculations and formatting
- Embla Carousel for any carousel needs

**Development Tools**:
- Replit-specific Vite plugins for error overlay, cartographer, and dev banner
- TypeScript for type safety across full stack
- ESBuild for production server bundling

**Key Environment Variables**:
- `DATABASE_URL` - PostgreSQL connection string (required)
- `SESSION_SECRET` - Session encryption key (required)

## Recent Changes (December 2024)

### Completed Features
- **Full auction platform implemented** - Complete bidding system with 10% minimum increment validation
- **Auto-bid feature** - Automated bidding up to user-specified maximum amounts
- **Commissioner dashboard** - CSV upload for free agents and year factor configuration
- **Real-time countdown timers** - Shows time remaining for each auction
- **Dark/Light theme support** - System-based theme with manual toggle
- **Responsive Material Design** - Professional sports aesthetic with Roboto fonts
- **Search/filtering/sorting** - Filter free agents by name, position, team, player type with column sorting
- **CSV export** - Commissioner can export auction results and final rosters as CSV files
- **Budget system** - Per-team variable budgets tracking dollar amounts (not total values)
- **Minimum bid support** - Each player has a minimum starting bid, configurable in CSV uploads
- **Relist players** - Commissioner can relist players with no bids with new minimum bid and end date
- **Email/password authentication** - Full email/password auth with bcrypt hashing, replacing OIDC
- **Commissioner user management** - Bulk upload users via CSV with auto-generated passwords
- **Player stats display** - Sortable stats columns for hitters and pitchers with type-based filtering

### Budget System
- Budget is per-team and can vary by team (not a fixed amount for all teams)
- Budget tracks the **dollar amount of the bid**, NOT the total value (amount × year factor)
- Spent = sum of winning bid amounts on closed auctions
- Committed = sum of current high bid amounts on open auctions
- Available = Team Budget - Spent - Committed
- Budget enforcement can be toggled on/off by commissioner

### Bid Validation Logic
Each new bid must have a total value at least 10% higher than the current highest bid:
- Total Value = Annual Amount × Year Factor
- Year factors are configurable by commissioner (defaults: 1.0, 1.25, 1.33, 1.43, 1.55)
- First bid must meet the player's minimum bid requirement
- Auto-bids automatically place minimum winning bids up to the user's maximum
- Auto-bids check available budget before placing each bid

### Minimum Bid & Minimum Years
- Each free agent has a `minimumBid` field (default: $1) and `minimumYears` field (default: 1)
- Commissioner can set these when uploading via CSV:
  - minimum_bid column (aliases: min_bid, minbid, min)
  - minimum_years column (aliases: min_years, minyears)
- Players requiring multi-year contracts will show "Xyr+" in the Years column
- BidDialog and AutoBidDialog disable year buttons below the minimum
- Server validates bids/auto-bids reject contracts shorter than minimumYears

### Relist Feature
- If a player receives no bids and auction closes, commissioner can relist them:
  - Navigate to Results page
  - Click "Relist" button on players with no bids
  - Set new minimum bid, minimum years, and auction end date
  - Player returns to active auctions

### Player Stats Display
- Players are categorized as "hitter" or "pitcher" based on position (P, SP, RP, CL = pitcher)
- Stats are displayed when filtering by player type in the FreeAgentsTable
- Hitter stats: AVG, HR, RBI, R (runs), SB, OPS, PA (plate appearances)
- Pitcher stats: W (wins), L (losses), ERA, WHIP, K (strikeouts), IP
- All stats columns are sortable
- Stats can be uploaded via CSV with columns: avg, hr, rbi, runs/r, sb, ops, pa (hitters) and wins/w, losses/l, era, whip, strikeouts/k/so, ip (pitchers)

### Team Limits System
Each team can have configurable limits that the commissioner can adjust:
- **Roster Limit**: Maximum number of players a team can acquire (null = unlimited)
- **IP Limit**: Maximum total innings pitched for all pitchers on the team (null = unlimited)
- **PA Limit**: Maximum total plate appearances for all hitters on the team (null = unlimited)

Limit Management:
- Commissioner can edit limits inline in the "League Owners & Team Limits" table on the Commissioner page
- Limits are saved automatically when the input field loses focus
- Empty values mean unlimited (no limit enforced)
- API endpoint: `PATCH /api/users/:userId/limits` with body `{ rosterLimit, ipLimit, paLimit }`

Limit Tracking:
- Roster usage: Count of players won in closed auctions
- IP usage: Sum of IP stat for all pitchers won
- PA usage: Sum of PA stat for all hitters won
- Usage is tracked via `storage.getUserLimitsInfo(userId)` which returns current usage vs limits

### Super Admin & Impersonation
- Super admin is designated by `isSuperAdmin` flag in the users table
- Current super admin: caseyemalone@protonmail.com (Casey Malone)
- Impersonation allows super admin to view the platform as any other user
- Session stores `originalUserId` when impersonating to allow returning to super admin view
- API endpoints:
  - `POST /api/auth/impersonate/:userId` - Start impersonating a user (super admin only)
  - `POST /api/auth/stop-impersonate` - Return to super admin view
  - `GET /api/auth/me` - Returns `isImpersonating` and `originalUser` when impersonating
- UI shows amber banner at top when impersonating with "Viewing as:" and "Exit View" button
- User dropdown shows "Super Admin" badge and "View as user:" section with user selection

### Password Reset Flow
- Users with `mustResetPassword=true` are shown a blocking dialog on login
- Dialog requires setting a new password (minimum 6 characters)
- After successful password change, `mustResetPassword` is set to false
- Newly created users via CSV upload have `mustResetPassword=true` by default

### Page Structure
- `/` - Landing page (unauthenticated) or Home dashboard (authenticated)
- `/my-bids` - User's active bids and auto-bid configurations
- `/results` - Completed auctions with winners (commissioner can relist no-bid players)
- `/commissioner` - Admin controls (commissioner only)