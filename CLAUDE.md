# Working agreement for AI tools in this repo

## Project
Reusable full-stack starter, the base for new projects. TODO: replace with the real project's summary (what it is, who uses it).

`SPEC.md` holds the agreed data model, API, rules and edge cases. Read it before planning, build to it, and ask before changing it.

## Architecture
FastAPI backend (`backend/`, port 8000) and React/Vite TypeScript frontend (`frontend/`, port 5173). The Vite dev server proxies `/api/*` to the backend. All database access goes through `backend/app/db.py`, which talks to whichever database `DATABASE_URL` in `.env` picks.
```
browser → Vite :5173 ──/api proxy──> FastAPI :8000 → app/db.py → SQLite (backend/app.db) | Postgres (docker)
```

## Commands
- Run: `./dev.sh` (backend and frontend together)
- Test: `./test.sh` runs ruff, pytest, oxlint, then the frontend build (`tsc -b` type-check). Any lint or type error fails it.
- Python deps: `uv add <pkg>` (or `uv add --dev <pkg>`) in `backend/`. Never use pip. `psycopg` (Postgres driver) is already installed.
- Postgres: `docker compose up -d`
- Reset dev database (deletes dev data): `rm backend/app.db`, or `docker compose down -v && docker compose up -d`

## Database conventions
- One database at a time. `DATABASE_URL` in `.env` picks SQLite (default) or Postgres for both `./dev.sh` and `./test.sh`. Check `.env` (or `GET /api/health`) and write SQL for that database only.
- Routes take a per-request connection: `def route(conn: db.DB)`. No ORM, no new database libraries.
- Raw SQL, values passed as placeholders, e.g. `conn.execute("SELECT * FROM items WHERE id = ?", (item_id,))`. Never put values into SQL with f-strings, `+` or `%`. Table/column names can't be placeholders: check them against a fixed allowlist.
- Rows are read by column name (`row["name"]`). Return `dict(row)` from routes. Prefer `INSERT ... RETURNING *` to get the new row (works on both databases).
- Connections autocommit (each statement is saved immediately). Wrap statements that must succeed or fail together in `with db.transaction(conn):`.
- Constraint violations raise `db.IntegrityError`: catch it and return 409 (duplicate) or 400, never a 500. Prefer a `UNIQUE` constraint over check-then-insert.
- Tables go in `backend/app/schema/<db>.sql` (`sqlite.sql` or `postgres.sql`, matching `.env`). The `items` table is a demo: replace it with the task's tables.
- Tests use the `client` fixture in `backend/tests/conftest.py`, which gives each test an empty database (never the dev data). Don't mock the database.

## Pitfalls
- Always test with `./test.sh`, not bare `uv run pytest`: only `./test.sh` loads `.env`.
- Placeholders differ: `?` for SQLite, `%s` for Postgres.
- Schema files use `CREATE TABLE IF NOT EXISTS`, so editing an existing table does not change the dev database. After any schema edit, tell the human to reset it (see Commands). Tests always start fresh, so they won't catch a stale dev database.

## Guardrails
1. Plan first. Before writing code, state the approach, the data shape, and the edge cases. Wait for approval.
2. Small steps. One endpoint or one component per change. Run it after every change.
3. Tests with the feature. Add a pytest test for each endpoint, including the unhappy paths (400/404/empty).
4. Stay in scope. Don't add libraries, rename files, or refactor code that wasn't asked about.
5. Show the diff and explain it. The human reads every change before accepting it.
6. When something fails, report the real error output first and diagnose it. Don't guess-fix.
7. Validate input at the API boundary. Return correct status codes.
