#!/usr/bin/env bash
# Runs the database tests (circles, teachers; design-v2) on a throwaway local Postgres database.
# Needs a Postgres server; set PGHOST/PGPORT/PGUSER (default: local socket, postgres).
set -euo pipefail
cd "$(dirname "$0")/../../.."
DB="v2test_$$"
psql -q -c "create database $DB"
trap 'psql -q -c "drop database $DB" >/dev/null' EXIT
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/stub_supabase.sql \
  -f supabase/migrations/20261006000000_circles_and_teachers.sql \
  -f supabase/tests/test_circles_and_teachers.sql
