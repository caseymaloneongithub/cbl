CREATE TABLE IF NOT EXISTS "draft_user_settings" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "draft_id" integer NOT NULL REFERENCES "drafts"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "auto_draft_mode" varchar(20) NOT NULL DEFAULT 'immediate'
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_draft_user_settings_draft_user" ON "draft_user_settings" ("draft_id", "user_id");
