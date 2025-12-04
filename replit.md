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

**Authentication Provider**: Replit Auth using OpenID Connect (OIDC) with Passport.js strategy.

**Authorization Model**: Simple role-based system with two roles:
- Regular users (team owners) - can view auctions and place bids
- Commissioners - can modify league settings, upload free agents, and manage users

**Session Flow**:
1. User initiates login via `/api/login`
2. OIDC redirect to Replit authentication
3. Callback processes tokens and creates/updates user record
4. Session stored in PostgreSQL with user claims
5. Protected routes use `isAuthenticated` middleware

### External Dependencies

**Authentication**: 
- Replit Auth (OIDC provider)
- Passport.js with openid-client strategy

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
- `SESSION_SECRET` - Session encryption key
- `ISSUER_URL` - OIDC provider URL (defaults to Replit)
- `REPL_ID` - Replit environment identifier

## Recent Changes (December 2024)

### Completed Features
- **Full auction platform implemented** - Complete bidding system with 10% minimum increment validation
- **Auto-bid feature** - Automated bidding up to user-specified maximum amounts
- **Commissioner dashboard** - CSV upload for free agents and year factor configuration
- **Real-time countdown timers** - Shows time remaining for each auction
- **Dark/Light theme support** - System-based theme with manual toggle
- **Responsive Material Design** - Professional sports aesthetic with Roboto fonts

### Bid Validation Logic
Each new bid must have a total value at least 10% higher than the current highest bid:
- Total Value = Annual Amount × Year Factor
- Year factors are configurable by commissioner (defaults: 1.0, 1.8, 2.5, 3.1, 3.6)
- Auto-bids automatically place minimum winning bids up to the user's maximum

### Page Structure
- `/` - Landing page (unauthenticated) or Home dashboard (authenticated)
- `/my-bids` - User's active bids and auto-bid configurations
- `/results` - Completed auctions with winners
- `/commissioner` - Admin controls (commissioner only)