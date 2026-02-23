ALTER TABLE "mlb_players"
ADD COLUMN IF NOT EXISTS "full_fml_name" varchar(255);

UPDATE "mlb_players"
SET "full_fml_name" = TRIM(
  COALESCE(NULLIF("first_name", ''), '') ||
  CASE WHEN COALESCE(NULLIF("middle_name", ''), '') <> '' THEN ' ' || TRIM("middle_name") ELSE '' END ||
  CASE WHEN COALESCE(NULLIF("last_name", ''), '') <> '' THEN ' ' || TRIM("last_name") ELSE '' END
)
WHERE COALESCE(NULLIF(TRIM("full_fml_name"), ''), '') = ''
  AND COALESCE(NULLIF(TRIM("first_name"), ''), '') <> ''
  AND COALESCE(NULLIF(TRIM("last_name"), ''), '') <> '';
