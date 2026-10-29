#!/usr/bin/env bash
# Runs backend tests. Add frontend tests here if you add a runner.
set -e
cd "$(dirname "$0")/backend"
uv run pytest -q
