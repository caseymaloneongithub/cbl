ALTER TABLE "mlb_players"
  ADD COLUMN IF NOT EXISTS "hitting_plate_appearances" integer NOT NULL DEFAULT 0;

UPDATE "mlb_players"
SET "hitting_plate_appearances" = COALESCE("hitting_plate_appearances", 0);
