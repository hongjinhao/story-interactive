#!/usr/bin/env bash
# Starts backend (:8000) and frontend (:5173). Ctrl+C stops both.
set -e
cd "$(dirname "$0")"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"

# .env picks the database (see .env.example). set -a exports every variable it sets.
[ -f .env ] || cp .env.example .env
set -a
. ./.env
set +a
echo "Database: $DATABASE_URL"

(cd backend && uv run uvicorn app.main:app --reload --port 8000) &
BACK=$!
trap 'kill $BACK 2>/dev/null' EXIT

cd frontend && npm run dev
