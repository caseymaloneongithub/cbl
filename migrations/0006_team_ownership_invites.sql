CREATE TABLE IF NOT EXISTS "team_ownership_invites" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "league_id" integer NOT NULL REFERENCES "leagues"("id"),
  "team_user_id" varchar NOT NULL REFERENCES "users"("id"),
  "invited_email" varchar(320) NOT NULL,
  "token" varchar(128) NOT NULL,
  "invited_by_user_id" varchar NOT NULL REFERENCES "users"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "expires_at" timestamp NOT NULL,
  "accepted_by_user_id" varchar REFERENCES "users"("id"),
  "accepted_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_team_ownership_invites_token"
  ON "team_ownership_invites" ("token");

CREATE INDEX IF NOT EXISTS "idx_team_ownership_invites_league"
  ON "team_ownership_invites" ("league_id");

CREATE INDEX IF NOT EXISTS "idx_team_ownership_invites_email"
  ON "team_ownership_invites" ("invited_email");
