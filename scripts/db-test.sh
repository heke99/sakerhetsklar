#!/usr/bin/env bash
# Applies all migrations + seeds to a scratch database and runs the SQL test
# suite (RLS/tenant isolation assertions). Requires local PostgreSQL and a
# superuser (default: postgres via sudo, override with DB_SUPERUSER_CMD).
set -euo pipefail

DB_NAME="${DB_NAME:-sakerhetsklar_test}"
PSQL="${DB_SUPERUSER_CMD:-sudo -u postgres psql} -v ON_ERROR_STOP=1 -q"

cd "$(dirname "$0")/.."

echo "==> Recreating database ${DB_NAME}"
$PSQL -c "drop database if exists ${DB_NAME};" postgres
$PSQL -c "create database ${DB_NAME};" postgres

echo "==> Applying Supabase shim"
$PSQL -d "${DB_NAME}" -f supabase/tests/00_supabase_shim.sql

echo "==> Applying migrations"
for f in supabase/migrations/*.sql; do
  echo "    - ${f}"
  $PSQL -d "${DB_NAME}" -f "${f}"
done

echo "==> Applying seeds"
for f in supabase/seed/*.sql; do
  echo "    - ${f}"
  $PSQL -d "${DB_NAME}" -f "${f}"
done

echo "==> Granting table access to shim roles"
$PSQL -d "${DB_NAME}" -c "grant all on all tables in schema public to anon, authenticated, service_role; grant usage, select on all sequences in schema public to anon, authenticated, service_role; grant execute on all functions in schema app to anon, authenticated, service_role; grant usage on schema app to anon, authenticated, service_role;"

echo "==> Running SQL tests"
shopt -s nullglob
for f in supabase/tests/test_*.sql; do
  echo "    - ${f}"
  $PSQL -d "${DB_NAME}" -f "${f}"
done

echo "==> All database tests passed"
