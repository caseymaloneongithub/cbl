-- Migration: Add league_seasons as a first-class entity
-- Seeds one current season per league from existing rosterOnboardingSeason,
-- then maps all roster assignments and drafts to that season.

-- 1. Create league_seasons table
CREATE TABLE IF NOT EXISTS "league_seasons" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "league_id" integer NOT NULL REFERENCES "leagues"("id"),
  "name" varchar(100) NOT NULL,
  "year" integer NOT NULL,
  "card_year" integer NOT NULL,
  "is_current" boolean NOT NULL DEFAULT false,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_league_seasons_league" ON "league_seasons" ("league_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_league_season_league_year" ON "league_seasons" ("league_id", "year");
-- Enforce at most one current season per league at the DB level
CREATE UNIQUE INDEX IF NOT EXISTS "uq_league_seasons_one_current" ON "league_seasons" ("league_id") WHERE "is_current" = true;

-- 2. Seed current season per league (card_year from rosterOnboardingSeason, game year = card_year + 1)
INSERT INTO "league_seasons" ("league_id", "name", "year", "card_year", "is_current", "status")
SELECT id,
       'Season ' || (roster_onboarding_season + 1),
       roster_onboarding_season + 1,
       roster_onboarding_season,
       true,
       'active'
FROM leagues
ON CONFLICT DO NOTHING;

-- 3. Add nullable season_id FKs
ALTER TABLE "league_roster_assignments" ADD COLUMN IF NOT EXISTS "season_id" integer REFERENCES "league_seasons"("id");
ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "season_id" integer REFERENCES "league_seasons"("id");

-- 4. Backfill — map ALL existing data to the current season for each league
UPDATE "league_roster_assignments" lra
SET "season_id" = ls.id
FROM "league_seasons" ls
WHERE lra.league_id = ls.league_id AND ls.is_current = true
  AND lra.season_id IS NULL;

UPDATE "drafts" d
SET "season_id" = ls.id
FROM "league_seasons" ls
WHERE d.league_id = ls.league_id AND ls.is_current = true
  AND d.season_id IS NULL;

-- 5. Enforce NOT NULL
ALTER TABLE "league_roster_assignments" ALTER COLUMN "season_id" SET NOT NULL;
ALTER TABLE "drafts" ALTER COLUMN "season_id" SET NOT NULL;

-- 6. Add indexes
CREATE INDEX IF NOT EXISTS "idx_roster_assignments_season_id" ON "league_roster_assignments" ("season_id");
CREATE INDEX IF NOT EXISTS "idx_drafts_season_id" ON "drafts" ("season_id");
