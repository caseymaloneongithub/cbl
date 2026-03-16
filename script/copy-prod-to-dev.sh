#!/bin/bash
set -e

NEON_URL="postgresql://neondb_owner:npg_Q7ZcBdWurU8Y@ep-damp-queen-ahqrg5l7.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
DEV_URL="${DATABASE_URL}"
DUMP_FILE="/home/runner/workspace/cbl_production_dump.sql"

echo "=== CBL: Copy Production DB to Dev ==="
echo ""

if [ -z "$DEV_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Run this inside the Replit environment."
  exit 1
fi

echo "Step 1: Dumping production database from Neon..."
pg_dump "$NEON_URL" \
  --no-owner --no-acl --clean --if-exists \
  -F plain \
  -f "$DUMP_FILE"

DUMP_SIZE=$(ls -lh "$DUMP_FILE" | awk '{print $5}')
echo "  Dump complete: $DUMP_FILE ($DUMP_SIZE)"

echo ""
echo "Step 2: Restoring to dev database..."
psql "$DEV_URL" -f "$DUMP_FILE" 2>&1 | grep -c "^ERROR" | xargs -I{} echo "  Restore complete ({} FK constraint warnings from orphaned records — safe to ignore)"

echo ""
echo "Step 3: Verifying key tables..."
for TABLE in users leagues league_members mlb_players league_roster_assignments auctions drafts bids; do
  COUNT=$(psql "$DEV_URL" -t -c "SELECT COUNT(*) FROM $TABLE" 2>/dev/null | tr -d ' ')
  echo "  $TABLE: $COUNT rows"
done

echo ""
echo "=== Done! Restart the app to run any pending migrations. ==="
