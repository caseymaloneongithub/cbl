-- Update the duplicate MLB assignment trigger to use season_id instead of legacy season integer.
-- This ensures uniqueness is enforced per league season entity, not the raw card year.

-- Forward migration: ensure the partial unique index exists even if 0013 ran before it was added.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_league_seasons_one_current"
  ON "league_seasons" ("league_id") WHERE "is_current" = true;

CREATE OR REPLACE FUNCTION prevent_duplicate_mlb_roster_assignment()
RETURNS trigger AS $$
BEGIN
  IF NEW.roster_type = 'mlb' THEN
    IF EXISTS (
      SELECT 1
      FROM league_roster_assignments lra
      WHERE lra.league_id = NEW.league_id
        AND lra.season_id = NEW.season_id
        AND lra.mlb_player_id = NEW.mlb_player_id
        AND lra.roster_type = 'mlb'
        AND lra.id <> COALESCE(NEW.id, -1)
    ) THEN
      RAISE EXCEPTION 'Duplicate MLB assignment for league %, season_id %, mlb_player_id %', NEW.league_id, NEW.season_id, NEW.mlb_player_id
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
