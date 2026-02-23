-- Draft slot model + timezone normalization

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone varchar(50);

ALTER TABLE drafts
  ALTER COLUMN snake SET DEFAULT false;

ALTER TABLE draft_rounds
  ALTER COLUMN start_time TYPE timestamptz
  USING (start_time AT TIME ZONE 'America/Chicago');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'draft_picks'
      AND column_name = 'pick_number'
  ) THEN
    ALTER TABLE draft_picks RENAME COLUMN pick_number TO overall_pick_number;
  END IF;
END $$;

ALTER TABLE draft_picks
  ADD COLUMN IF NOT EXISTS round_pick_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selected_org_name varchar(255),
  ADD COLUMN IF NOT EXISTS selected_org_id integer,
  ADD COLUMN IF NOT EXISTS selected_org_player_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS made_at timestamptz,
  ADD COLUMN IF NOT EXISTS made_by_user_id varchar;

ALTER TABLE draft_picks
  ALTER COLUMN mlb_player_id DROP NOT NULL,
  ALTER COLUMN roster_type DROP NOT NULL;

DO $$
BEGIN
  ALTER TABLE draft_picks
    ADD CONSTRAINT fk_draft_picks_made_by_user
    FOREIGN KEY (made_by_user_id) REFERENCES users(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_draft_pick_slot_identity
  ON draft_picks (draft_id, round, round_pick_index);

CREATE UNIQUE INDEX IF NOT EXISTS uq_draft_pick_slot_overall
  ON draft_picks (draft_id, overall_pick_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_draft_pick_player_once
  ON draft_picks (draft_id, mlb_player_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_draft_selected_org_once
  ON draft_picks (draft_id, selected_org_name);

