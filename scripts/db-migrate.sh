#!/usr/bin/env bash
# Applies all SQL migrations in order to the database pointed to by
# SUPABASE_DB_URL. Migrations are written to be idempotent (create ... if not
# exists / guarded alters), so re-running is safe.
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "ERROR: SUPABASE_DB_URL is not set (see .env.example)" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

echo "==> Applying migrations to \$SUPABASE_DB_URL"
for f in supabase/migrations/*.sql; do
  echo "    - ${f}"
  psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 -q -f "${f}"
done

echo "==> Migrations applied"
