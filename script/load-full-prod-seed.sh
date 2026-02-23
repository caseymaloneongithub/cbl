#!/usr/bin/env bash
set -euo pipefail

SEED_FILE="${1:-script/sql/seed-full-prod.sql}"
DB_CONTAINER="${DB_CONTAINER:-cbl-db-1}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-cbl}"

if [[ ! -f "${SEED_FILE}" ]]; then
  echo "Seed file not found: ${SEED_FILE}" >&2
  exit 1
fi

echo "Loading seed file '${SEED_FILE}' into ${DB_CONTAINER}:${DB_NAME} as ${DB_USER}..."
cat "${SEED_FILE}" | docker exec -i "${DB_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}"
echo "Seed load completed."
