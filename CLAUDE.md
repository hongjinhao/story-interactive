# Working agreement for AI tools in this repo

Stack: FastAPI (backend/, port 8000) + React/Vite TypeScript (frontend/, port 5173, proxies /api to the backend).
Run: `./dev.sh`    Test: `./test.sh`
Python deps are managed with uv: `uv add <pkg>` (or `uv add --dev <pkg>`) in backend/. Never use pip. `psycopg` (Postgres driver) is already installed.
Always test with `./test.sh`, not bare `uv run pytest`: only `./test.sh` loads `.env`.

## Database
- One database at a time. `DATABASE_URL` in `.env` picks SQLite (default, file `backend/app.db`) or Postgres (Docker, `docker compose up -d`) for both `./dev.sh` and `./test.sh`. Check `.env` (or `GET /api/health`) and write SQL for that database only.
- All database code goes through `backend/app/db.py`. Routes take a per-request connection: `def route(conn: db.DB)`. No ORM, no new database libraries.
- Raw SQL, values passed as placeholders: `?` for SQLite, `%s` for Postgres, e.g. `conn.execute("SELECT * FROM items WHERE id = ?", (item_id,))`. Never put values into SQL with f-strings, `+` or `%`. Table/column names can't be placeholders: check them against a fixed allowlist.
- Rows are read by column name (`row["name"]`). Return `dict(row)` from routes. Prefer `INSERT ... RETURNING *` to get the new row (works on both databases).
- Connections autocommit (each statement is saved immediately). Wrap statements that must succeed or fail together in `with db.transaction(conn):`.
- Constraint violations raise `db.IntegrityError`: catch it and return 409 (duplicate) or 400, never a 500. Prefer a `UNIQUE` constraint over check-then-insert.
- Tables go in `backend/app/schema/<db>.sql` (`sqlite.sql` or `postgres.sql`, matching `.env`). They use `CREATE TABLE IF NOT EXISTS`, so editing an existing table does not change the dev database: after any schema edit, tell the human to reset it (`rm backend/app.db`, or `docker compose down -v && docker compose up -d`; this deletes dev data). Tests always start fresh, so they won't catch a stale dev database. The `items` table is a demo: replace it with the task's tables.
- Tests use the `client` fixture in `backend/tests/conftest.py`, which gives each test an empty database (never the dev data). Don't mock the database.

## Guardrails
1. Plan first. Before writing code, state the approach, the data shape, and the edge cases. Wait for approval.
2. Small steps. One endpoint or one component per change. Run it after every change.
3. Tests with the feature. Add a pytest test for each endpoint, including the unhappy paths (400/404/empty).
4. Stay in scope. Don't add libraries, rename files, or refactor code that wasn't asked about.
5. Show the diff and explain it. The human reads every change before accepting it.
6. When something fails, report the real error output first and diagnose it. Don't guess-fix.
7. Validate input at the API boundary. Return correct status codes. Never trust the client.
8. Keep it simple. In-memory storage is fine unless a database is requested.
