# Working agreement for AI tools in this repo

## Project
Story Interactive: a choose-your-own-adventure app powered by an LLM (Grok via `xai_sdk`). Anyone can use it, no accounts. A player starts a new story from an idea, or reopens one generated earlier, then plays it: each step shows a passage, two generated options and a text box (max 100 characters) for a custom action. A story lasts 5 to 10 levels.

Stories are stored as a tree of nodes. Picking an option that already has a child walks down the tree without calling the LLM. A new choice generates one new child, and each node can have at most one custom branch. The player can walk back up at any time, and a custom action shows up there as an extra option. The core rule: **walk the tree when the branch exists, generate only when it doesn't, and never more than one custom branch per node.**

The UI has a Halloween theme (ghosts, cobwebs, spiders), but readability and ease of use come first.

`SPEC.md` holds the agreed data model, API, rules and edge cases. Read it before planning, build to it, and ask before changing it.

## Architecture
FastAPI backend (`backend/`, port 8000) and React/Vite TypeScript frontend (`frontend/`, port 5173). The Vite dev server proxies `/api/*` to the backend. All database access goes through `backend/app/db.py`, which talks to whichever database `DATABASE_URL` in `.env` picks (Postgres for this project). All LLM access goes through `backend/app/llm.py`.
```
browser → Vite :5173 ──/api proxy──> FastAPI :8000
  handlers (app/handlers/) → services (app/services/) → repositories (app/repositories/) → app/db.py → Postgres (docker) | SQLite
                                   └──────────────→ app/llm.py → xAI Grok API
```
Backend layers (three, on purpose; don't add more unless asked):
- Handlers (`backend/app/handlers/<resource>.py`, one `APIRouter` per resource, included in `main.py`): HTTP only. Declare the path and status code, take `conn: db.DB`, validate the body with Pydantic models from `backend/app/schemas.py`, call one service function, return its result. No SQL, no business rules, no LLM calls, no `try/except` for domain errors.
- Services (`backend/app/services/<resource>.py`): business rules and orchestration. The rules from `SPEC.md` live here (level cap, walk vs generate, one custom branch per node), along with calls to `app/llm.py` and the transactions (`with db.transaction(conn):`). Plain functions that take `conn` plus plain values. No FastAPI imports, no `HTTPException`, no SQL. When a rule is broken, raise a domain error from `backend/app/errors.py`.
- Repositories (`backend/app/repositories/<table>.py`): the SQL, one module per table. Plain functions that take `conn`, run raw parameterized SQL and return `dict(row)`, a list of dicts or `None`. No rules and no transactions of their own (the service wraps them). They let `db.IntegrityError` propagate so the service can decide what it means.
- Adapters under the layers: `app/db.py` owns connections, transactions and the SQLite/Postgres switch, and knows no tables. `app/llm.py` is the only module that imports `xai_sdk`. It returns validated Pydantic objects and raises `errors.GenerationTimeout` or `errors.GenerationFailed`. Nothing opens its own connection or LLM client.
- Errors: `app/errors.py` defines `NotFound`, `Conflict`, `RuleViolation`, `GenerationTimeout` and `GenerationFailed`. `main.py` registers one exception handler per error that maps it to 404, 409, 400, 504 or 502 with body `{"detail": message}`. Services raise them and handlers never catch them.
- Imports go one way only: handlers → services → repositories → db. A layer never imports from a layer above it. Handlers never call repositories directly, even for a simple GET: use a thin service function.
- Never hold a database transaction open while waiting on the LLM. Generate first, then write in a short transaction.

Frontend layers (three, matching the backend; no state library, no per-resource API functions unless asked):
- `frontend/src/App.tsx`: the page. Holds only state shared between panels (e.g. the current node id) and passes it down as props. No fetching.
- Feature components (one file each, e.g. `StoryView.tsx`): load their own data in `useEffect`, own their loading/error/saving states, apply the UI rules, render. Endpoint paths are written here, e.g. `api<Story[]>('/api/stories')`.
- `frontend/src/api.ts`: the API client, the frontend's `db.py`. Shared response types, an `api<T>(path, init)` fetch wrapper and a `post<T>(path, data)` helper. It turns FastAPI errors (`{detail: string}`, or the 422 list) into one readable message and throws an `ApiError` carrying the HTTP status. It handles 204 (no body). Create it with the first feature; components never call `fetch` directly. The starter's `/api/health` fetch in `App.tsx` is the one exception, since a 503 there still carries a body to show.

Styling is Tailwind v4: utility classes in `className`, loaded by the `@tailwindcss/vite` plugin and `@import "tailwindcss";` in `frontend/src/index.css`. No component library, no separate `.css` files per component.

Halloween theme rules:
- Colour tokens, fonts and keyframes (`float`, `dangle`) go in the `@theme` block in `index.css`. Use the tokens (`bg-night`, `text-bone`, `bg-pumpkin`, ...) rather than one-off hex values.
- Readability beats spookiness: body text at least 16px (story passages 18px), text contrast at least 4.5:1, a visible focus ring on every control, buttons at least 44px tall. The decorative font is for headings only, never for passages, buttons or inputs.
- Ghosts, cobwebs and spiders are inline SVG in `HauntedDecor.tsx` (plus the loader). They are `aria-hidden`, `pointer-events-none`, sit behind the content, never cover text or controls, use `motion-reduce:animate-none`, and are thinned out on small screens.

## Commands
- Run: `./dev.sh` (backend and frontend together)
- Test: `./test.sh` runs ruff, pytest, oxlint, then the frontend build (`tsc -b` type-check). Any lint or type error fails it.
- Python deps: `uv add <pkg>` (or `uv add --dev <pkg>`) in `backend/`. Never use pip. `psycopg` (Postgres driver) is already installed. `xai-sdk` is the LLM client.
- Postgres: `docker compose up -d`
- Reset dev database (deletes dev data): `rm backend/app.db`, or `docker compose down -v && docker compose up -d`
- `XAI_API_KEY` lives in `.env` (gitignored). Never print it, log it or commit it.

## Database conventions
- One database at a time. `DATABASE_URL` in `.env` picks SQLite or Postgres for both `./dev.sh` and `./test.sh`. This project uses Postgres. Check `.env` (or `GET /api/health`) and write SQL for that database only.
- Handlers take a per-request connection (`conn: db.DB`) and pass it to the service, which passes it on to repositories. Only repositories call `conn.execute`. No ORM, no new database libraries.
- Raw SQL, values passed as placeholders, e.g. `conn.execute("SELECT * FROM nodes WHERE id = %s", (node_id,))`. Never put values into SQL with f-strings, `+` or `%`. Table/column names can't be placeholders: check them against a fixed allowlist.
- Rows are read by column name (`row["name"]`). Repositories return `dict(row)`. Prefer `INSERT ... RETURNING *` to get the new row (works on both databases).
- Connections autocommit (each statement is saved immediately). The service wraps statements that must succeed or fail together in `with db.transaction(conn):`.
- Constraint violations raise `db.IntegrityError`: the service catches it and raises `Conflict` (409) or `RuleViolation` (400), never a 500. Prefer a `UNIQUE` constraint over check-then-insert.
- Tables go in `backend/app/schema/<db>.sql` (`postgres.sql` for this project).
- Tests use the `client` fixture in `backend/tests/conftest.py`, which gives each test an empty database (never the dev data). Don't mock the database.
- Fake only the LLM: a `fake_llm` fixture in `conftest.py` monkeypatches the functions in `app.llm` with deterministic stand-ins, and can be told to raise `GenerationTimeout` or `GenerationFailed`. Tests never call the real xAI API.

## Pitfalls
- Always test with `./test.sh`, not bare `uv run pytest`: only `./test.sh` loads `.env`.
- Placeholders differ: `?` for SQLite, `%s` for Postgres.
- Schema files use `CREATE TABLE IF NOT EXISTS`, so editing an existing table does not change the dev database. After any schema edit, tell the human to reset it (see Commands). Tests always start fresh, so they won't catch a stale dev database.
- Tailwind is v4, not v3. There is no `tailwind.config.js`, `postcss.config.js` or `npx tailwindcss init`, and no `@tailwind base/components/utilities` directives. Theme changes go in an `@theme { ... }` block in `frontend/src/index.css`.
- Services call the LLM as `llm.start_story(...)` after `from app import llm`, not `from app.llm import start_story`, so the test fixture's monkeypatch takes effect.
- Postgres treats NULLs as distinct in `UNIQUE`, so "one root node per story" needs a partial unique index (`WHERE parent_id IS NULL`).

## Guardrails
1. Plan first. Before writing code, state the approach, the data shape, and the edge cases. Wait for approval.
2. Small steps. One endpoint or one component per change. Run it after every change.
3. Tests with the feature. Add a pytest test for each endpoint, including the unhappy paths (400/404/409/422/empty).
4. Stay in scope. Don't add libraries, rename files, or refactor code that wasn't asked about.
5. Show the diff and explain it. The human reads every change before accepting it.
6. When something fails, report the real error output first and diagnose it. Don't guess-fix.
7. Validate input at the API boundary. Return correct status codes.
