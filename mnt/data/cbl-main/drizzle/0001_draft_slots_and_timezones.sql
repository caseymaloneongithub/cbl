-- Draft slot support + Central default timezone

-- League default timezone should be Central
ALTER TABLE leagues ALTER COLUMN timezone SET DEFAULT 'America/Chicago';
UPDATE leagues SET timezone = 'America/Chicago' WHERE timezone IS NULL OR timezone = 'America/New_York';

-- Optional per-user timezone (UI can still default to browser timezone)
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone varchar(50);

-- Drafts: snake defaults false (commissioner defines order per-round)
ALTER TABLE drafts ALTER COLUMN snake SET DEFAULT false;

-- Draft rounds: store start_time as timestamptz (UTC). Interpret existing values as Central.
ALTER TABLE draft_rounds
  ALTER COLUMN start_time TYPE timestamptz
  USING (start_time AT TIME ZONE 'America/Chicago');

-- Draft picks: convert from "made picks" to "pick slots"
ALTER TABLE draft_picks RENAME COLUMN pick_number TO overall_pick_number;
ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS round_pick_index integer NOT NULL DEFAULT 0;
ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS scheduled_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS deadline_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS made_at timestamptz;
ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS made_by_user_id varchar;
ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS team_draft_org_name varchar(255);
ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS team_draft_player_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Allow unfilled slots
ALTER TABLE draft_picks ALTER COLUMN mlb_player_id DROP NOT NULL;
ALTER TABLE draft_picks ALTER COLUMN roster_type DROP NOT NULL;

-- Constraints / indexes
CREATE INDEX IF NOT EXISTS idx_draft_picks_overall ON draft_picks(draft_id, overall_pick_number);
CREATE INDEX IF NOT EXISTS idx_draft_picks_round ON draft_picks(draft_id, round, round_pick_index);

-- Best-effort FK (ignore if already exists)
DO $$
BEGIN
  ALTER TABLE draft_picks
    ADD CONSTRAINT fk_draft_picks_made_by_user
    FOREIGN KEY (made_by_user_id) REFERENCES users(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
