ALTER TABLE league_roster_assignments
  ADD COLUMN IF NOT EXISTS minor_league_status VARCHAR(8),
  ADD COLUMN IF NOT EXISTS minor_league_years INTEGER;

ALTER TABLE draft_players
  ADD COLUMN IF NOT EXISTS minor_league_status VARCHAR(8),
  ADD COLUMN IF NOT EXISTS minor_league_years INTEGER;

