# Fullstack starter (FastAPI + React/Vite)

Hello-world full-stack app for the Commure AI-assisted interview.

## First-time setup
```bash
cd backend && uv sync && cd ..
cd frontend && npm install && cd ..
```

## Run
```bash
./dev.sh          # backend http://127.0.0.1:8000  frontend http://localhost:5173
./test.sh         # lint + backend tests, lint + frontend build
```

Open http://localhost:5173. It should say "Backend status: ok". If it says "backend unreachable", the backend isn't running.
Backend docs: http://127.0.0.1:8000/docs

## Database
`backend/app/db.py` connects to SQLite or Postgres depending on `DATABASE_URL`. **To switch, edit `.env`**: keep one `DATABASE_URL` line uncommented and restart `./dev.sh`. `dev.sh` creates `.env` from `.env.example` the first time it runs. `/api/health` shows which database is active. Tables are created at startup from `backend/app/schema/<db>.sql` (a demo `items` table with 3 rows to start).

| | SQLite (default) | Postgres |
|---|---|---|
| Start | Nothing to start. The file is `backend/app.db` | `docker compose up -d` |
| `.env` line | `DATABASE_URL=sqlite:///app.db` | `DATABASE_URL=postgresql://app:app@localhost:5432/app` |
| Look at the data | VS Code: click `backend/app.db` (SQLite Viewer extension). Browser: `cd backend && uvx datasette app.db` → http://127.0.0.1:8001. Terminal: `sqlite3 -box backend/app.db` | Adminer: http://127.0.0.1:8080 (System PostgreSQL, user `app`, password `app`, database `app`). Terminal: `docker compose exec db psql -U app app` |
| Stop (keeps data) | Stop `./dev.sh` | `docker compose down` |
| Reset (**deletes data**; needed after editing a schema file) | `rm backend/app.db` | `docker compose down -v && docker compose up -d` |

The tables come from the app, not from Docker: each `./dev.sh` start runs `backend/app/schema/<db>.sql`. After a reset, start the app once to recreate the tables and demo rows.

`./test.sh` runs the backend tests on the same database `.env` picks: a fresh temp SQLite file, or the separate `app_test` Postgres database (emptied before each test). Dev data is never touched. Plain `uv run pytest` in `backend/` doesn't read `.env` and always tests SQLite.

psql cheat sheet: `\dt` list tables · `\d items` describe one · `\x` toggle vertical rows · `\q` quit. End SQL with `;`.

## Pre-interview checklist
- [ ] `./dev.sh` runs and the page shows "Backend status: ok"
- [ ] `./test.sh` passes
- [ ] `uv --version` works, `node -v` is 20 or higher, `git` works, `gh auth status` is logged in
- [ ] `docker compose up -d` starts Postgres, and `./test.sh` passes with either `DATABASE_URL` line in `.env`
- [ ] Claude Code (or Cursor/Codex) is signed in and working in this folder
- [ ] Chrome and Google Meet: full-screen share works, filters off
