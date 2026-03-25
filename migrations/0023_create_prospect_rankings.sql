CREATE TABLE prospect_rankings (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  mlb_player_id INTEGER NOT NULL REFERENCES mlb_players(id),
  season INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  future_value INTEGER,
  eta TEXT
);

CREATE UNIQUE INDEX idx_prospect_rankings_unique ON prospect_rankings (mlb_player_id, season);
CREATE INDEX idx_prospect_rankings_season ON prospect_rankings (season);
