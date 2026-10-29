#!/usr/bin/env bash
# Lints and tests the backend, then lints and builds the frontend (the build type-checks).
set -e
cd "$(dirname "$0")/backend"
uv run ruff check .
uv run pytest -q
cd ../frontend
npm run lint
npm run build
