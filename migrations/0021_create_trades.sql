CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  league_id INTEGER NOT NULL REFERENCES leagues(id),
  proposing_user_id VARCHAR NOT NULL REFERENCES users(id),
  partner_user_id VARCHAR NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  notes TEXT,
  season INTEGER NOT NULL,
  proposed_at TIMESTAMP DEFAULT NOW() NOT NULL,
  responded_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trades_league ON trades(league_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

CREATE TABLE IF NOT EXISTS trade_items (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  trade_id INTEGER NOT NULL REFERENCES trades(id),
  from_user_id VARCHAR NOT NULL REFERENCES users(id),
  mlb_player_id INTEGER NOT NULL REFERENCES mlb_players(id),
  roster_type VARCHAR(10) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trade_items_trade ON trade_items(trade_id);
