#!/usr/bin/env bash
# Runs backend tests, then builds the frontend to catch syntax and import errors.
set -e
cd "$(dirname "$0")/backend"
uv run pytest -q
cd ../frontend
npm run build
