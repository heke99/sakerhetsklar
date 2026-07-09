#!/usr/bin/env bash
# Applies seed data to the database pointed to by SUPABASE_DB_URL.
#
# The demo seed (0012_seed_demo.sql — fictional tenants/incidents) is SKIPPED
# by default so it can never end up in a production database by accident.
# Set SEED_DEMO=1 explicitly to include it in dev/test environments.
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "ERROR: SUPABASE_DB_URL is not set (see .env.example)" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

echo "==> Applying seeds to \$SUPABASE_DB_URL"
for f in supabase/seed/*.sql; do
  if [[ "${f}" == *"seed_demo"* && "${SEED_DEMO:-0}" != "1" ]]; then
    echo "    - ${f} (SKIPPED — demo data; set SEED_DEMO=1 to include)"
    continue
  fi
  echo "    - ${f}"
  psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 -q -f "${f}"
done

echo "==> Seeds applied"
