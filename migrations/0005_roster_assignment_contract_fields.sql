ALTER TABLE "league_roster_assignments"
  ADD COLUMN IF NOT EXISTS "contract_status" varchar(80),
  ADD COLUMN IF NOT EXISTS "salary_2026" real;
