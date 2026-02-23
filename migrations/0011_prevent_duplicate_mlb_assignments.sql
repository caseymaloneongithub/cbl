CREATE OR REPLACE FUNCTION prevent_duplicate_mlb_roster_assignment()
RETURNS trigger AS $$
BEGIN
  IF NEW.roster_type = 'mlb' THEN
    IF EXISTS (
      SELECT 1
      FROM league_roster_assignments lra
      WHERE lra.league_id = NEW.league_id
        AND lra.season = NEW.season
        AND lra.mlb_player_id = NEW.mlb_player_id
        AND lra.roster_type = 'mlb'
        AND lra.id <> COALESCE(NEW.id, -1)
    ) THEN
      RAISE EXCEPTION 'Duplicate MLB assignment for league %, season %, mlb_player_id %', NEW.league_id, NEW.season, NEW.mlb_player_id
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_mlb_roster_assignment ON league_roster_assignments;

CREATE TRIGGER trg_prevent_duplicate_mlb_roster_assignment
BEFORE INSERT OR UPDATE ON league_roster_assignments
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_mlb_roster_assignment();
