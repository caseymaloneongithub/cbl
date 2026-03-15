CREATE TABLE IF NOT EXISTS mlb_player_stats (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  mlb_player_id integer NOT NULL REFERENCES mlb_players(id),
  season integer NOT NULL,
  sport_level text,
  had_hitting_stats boolean DEFAULT false,
  had_pitching_stats boolean DEFAULT false,
  hitting_at_bats integer DEFAULT 0,
  hitting_walks integer DEFAULT 0,
  hitting_singles integer DEFAULT 0,
  hitting_doubles integer DEFAULT 0,
  hitting_triples integer DEFAULT 0,
  hitting_home_runs integer DEFAULT 0,
  hitting_avg real,
  hitting_obp real,
  hitting_slg real,
  hitting_ops real,
  pitching_games integer DEFAULT 0,
  pitching_games_started integer DEFAULT 0,
  pitching_strikeouts integer DEFAULT 0,
  pitching_walks integer DEFAULT 0,
  pitching_hits integer DEFAULT 0,
  pitching_home_runs integer DEFAULT 0,
  pitching_era real,
  pitching_innings_pitched real DEFAULT 0,
  hitting_games_started integer DEFAULT 0,
  hitting_plate_appearances integer DEFAULT 0,
  is_two_way_qualified boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_mlb_player_stats_player_season ON mlb_player_stats(mlb_player_id, season);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mlb_player_stats_unique ON mlb_player_stats(mlb_player_id, season);

-- Migrate existing stats from mlb_players into the new table
-- Only migrate players that actually have stats
INSERT INTO mlb_player_stats (
  mlb_player_id, season, sport_level,
  had_hitting_stats, had_pitching_stats,
  hitting_at_bats, hitting_walks, hitting_singles, hitting_doubles, hitting_triples, hitting_home_runs,
  hitting_avg, hitting_obp, hitting_slg, hitting_ops,
  pitching_games, pitching_games_started, pitching_strikeouts, pitching_walks, pitching_hits, pitching_home_runs,
  pitching_era, pitching_innings_pitched,
  hitting_games_started, hitting_plate_appearances,
  is_two_way_qualified
)
SELECT
  id, COALESCE(stats_season, season), sport_level,
  had_hitting_stats, had_pitching_stats,
  hitting_at_bats, hitting_walks, hitting_singles, hitting_doubles, hitting_triples, hitting_home_runs,
  hitting_avg, hitting_obp, hitting_slg, hitting_ops,
  pitching_games, pitching_games_started, pitching_strikeouts, pitching_walks, pitching_hits, pitching_home_runs,
  pitching_era, pitching_innings_pitched,
  hitting_games_started, hitting_plate_appearances,
  is_two_way_qualified
FROM mlb_players
WHERE had_hitting_stats = true OR had_pitching_stats = true
ON CONFLICT DO NOTHING;
