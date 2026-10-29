#!/usr/bin/env bash
# Lints and tests the backend, then lints and builds the frontend (the build type-checks).
set -e
cd "$(dirname "$0")"

# Test on the database .env picks, same as dev.sh.
[ -f .env ] || cp .env.example .env
set -a
. ./.env
set +a
echo "Database: $DATABASE_URL"

cd backend
uv run ruff check .
uv run pytest -q
cd ../frontend
npm run lint
npm run build
