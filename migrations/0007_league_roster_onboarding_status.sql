ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS roster_onboarding_season integer DEFAULT 2025 NOT NULL,
  ADD COLUMN IF NOT EXISTS roster_onboarding_status varchar(20) DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS roster_onboarding_last_processed integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS roster_onboarding_last_imported integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS roster_onboarding_last_unresolved integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS roster_onboarding_last_errors integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS roster_onboarding_completed_at timestamp,
  ADD COLUMN IF NOT EXISTS roster_onboarding_updated_at timestamp DEFAULT now();
