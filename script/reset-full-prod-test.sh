#!/usr/bin/env bash
set -euo pipefail

APP_CONTAINER="${APP_CONTAINER:-cbl-app-test}"
DB_CONTAINER="${DB_CONTAINER:-cbl-db-1}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-cbl}"
DUMP_FILE="${DUMP_FILE:-cbl_database_dump.sql}"
SEED_FILE="${SEED_FILE:-script/sql/seed-full-prod.sql}"

echo "==> Using containers: app=${APP_CONTAINER}, db=${DB_CONTAINER}"
echo "==> Using dump: ${DUMP_FILE}"

if [[ ! -f "${DUMP_FILE}" ]]; then
  echo "Dump file not found: ${DUMP_FILE}" >&2
  exit 1
fi

echo "==> Running migrations (db:push) in ${APP_CONTAINER}..."
docker exec -i "${APP_CONTAINER}" npm run db:push

echo "==> Generating full-prod seed SQL..."
node script/generate-full-prod-seed.cjs "${DUMP_FILE}" "${SEED_FILE}"

echo "==> Loading seed into ${DB_CONTAINER}:${DB_NAME}..."
cat "${SEED_FILE}" | docker exec -i "${DB_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}"

echo "==> Restarting ${APP_CONTAINER}..."
docker restart "${APP_CONTAINER}" >/dev/null

echo "==> Done. Verifying app endpoint on http://localhost:5001/ ..."
if command -v curl >/dev/null 2>&1; then
  curl -fsS -o /dev/null -w "HTTP %{http_code}\n" http://localhost:5001/ || true
fi

echo "Full prod reset completed."
