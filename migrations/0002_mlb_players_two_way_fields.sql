ALTER TABLE "mlb_players"
  ADD COLUMN IF NOT EXISTS "pitching_innings_pitched" real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hitting_games_started" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_two_way_qualified" boolean NOT NULL DEFAULT false;

UPDATE "mlb_players"
SET
  "pitching_innings_pitched" = COALESCE("pitching_innings_pitched", 0),
  "hitting_games_started" = COALESCE("hitting_games_started", 0),
  "is_two_way_qualified" = COALESCE("is_two_way_qualified", false);
