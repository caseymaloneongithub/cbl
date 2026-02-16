# CBL Auctions Platform - External Setup Guide

## Prerequisites

- **Node.js** v20+ (recommended: v20.20.0)
- **npm** v10+
- **PostgreSQL** database (v15+ recommended)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/caseymaloneongithub/cbl.git
cd cbl
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root of the project:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/cbl_auctions
SESSION_SECRET=your-random-secret-string-here
```

- **DATABASE_URL**: Your PostgreSQL connection string
- **SESSION_SECRET**: Any random string for session encryption (generate one with `openssl rand -hex 32`)

#### Optional environment variables

```env
RESEND_API_KEY=your-resend-api-key    # For email notifications (password resets, auction summaries)
```

### 4. Set up the database

Push the schema to your PostgreSQL database:

```bash
npm run db:push
```

### 5. Run in development mode

```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

### 6. Build for production

```bash
npm run build
npm start
```

## Project Structure

```
├── client/                 # React frontend (Vite)
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── pages/          # Page components
│       ├── hooks/          # Custom React hooks
│       └── lib/            # Utilities
├── server/                 # Express.js backend
│   ├── routes.ts           # API routes
│   ├── storage.ts          # Database operations
│   └── index.ts            # Server entry point
├── shared/                 # Shared between frontend and backend
│   └── schema.ts           # Drizzle ORM schema + Zod types
└── drizzle.config.ts       # Drizzle Kit configuration
```

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Email/password with bcrypt + express-session
