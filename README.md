# Story Interactive

A choose-your-own-adventure game written live by an LLM, in seasonal themes (Halloween and Christmas so far). Anyone can start a tale from an idea, reopen a tale someone already started, and play it: each turn shows a passage, two generated options and a box to type your own action (max 100 characters). A tale lasts 5 to 10 turns.

Each theme is its own **story bank**: a tale keeps the theme it was started in, is listed only there, and is narrated in that theme's mood (eerie for Halloween, warm and festive for Christmas). The app opens on the nearest festival's theme, until a week after it; a pumpkin and a tree at the top of the home page switch between them.

Every tale is stored as a **tree**. Picking a path someone already took walks down the tree instantly, with no LLM call. A new choice generates one new branch. You can walk back up at any time, and a custom action you typed shows up there as an extra option for everyone. Each turn allows at most one custom branch.

The tale is played as a **storybook**: a closed book appears and a quill writes your idea on its cover while the tale is written, then the cover opens onto page 1. Each choice turns the page. A path someone already took turns straight to its page; a new choice turns to a blank page where the quill writes your action while Grok writes the passage, which then inks in. Going back turns the page the other way. Every page has the same height in both themes, and "reduce motion" swaps the quill and the turns for short cross-fades (see [`SPEC-3.md`](SPEC-3.md)).

![A Halloween tale open on page 2: the passage on paper, the action that led there above it, and three choices below](docs/storybook.png)

FastAPI + Postgres backend, React + Vite + Tailwind v4 frontend, Grok (`xai_sdk`) for the writing.

---

## Run it

### Prerequisites
- [uv](https://docs.astral.sh/uv/) (Python 3.12+), Node 20.19+, Docker (for Postgres)
- An xAI API key from https://console.x.ai

### First-time setup
```bash
cd backend && uv sync && cd ..
cd frontend && npm install && cd ..
cp .env.example .env
```
Then set `XAI_API_KEY=xai-...` in `.env`. It is gitignored; never commit the key. `.env` already points at the Docker Postgres (`DATABASE_URL=postgresql://app:app@localhost:5432/app`), the only database the app supports (see [Gaps](#gaps-and-known-limitations)).

### Start
```bash
docker compose up -d   # Postgres on 127.0.0.1:5432, Adminer on http://127.0.0.1:8080
./dev.sh               # backend http://127.0.0.1:8000, frontend http://localhost:5173
```
Open http://localhost:5173. If the backend or database is down, a red banner at the top says so (`GET /api/health` shows the status). API docs: http://127.0.0.1:8000/docs.

### Test
```bash
./test.sh   # ruff, pytest (107 tests), oxlint, then the frontend build (tsc type-check)
```
Always use `./test.sh` (it loads `.env`). Tests run against a separate `app_test` Postgres database that is emptied before each test, and use a fake LLM: they never touch dev data or call xAI.

### Reset or inspect the database
- Reset (**deletes all tales**; needed after editing `backend/app/schema/postgres.sql`): `docker compose down -v && docker compose up -d`, then start `./dev.sh` once to recreate the tables.
- Look at the data: Adminer at http://127.0.0.1:8080 (System PostgreSQL, user `app`, password `app`, database `app`), or `docker compose exec db psql -U app app`.
- If tests fail with `Connection refused` on port 5432 while `docker compose ps` says the `db` container is healthy, the container lost its port mapping (seen on WSL): `docker compose up -d --force-recreate db` (data survives).

---

## How to play
0. Pick a theme with the icons at the top of the home page (🎃 pumpkin, 🎄 tree), or keep the season's default. The list below shows that theme's tales.
1. Type an idea ("A jack-o-lantern that whispers the names of the dead") and press **Summon a tale** (**Spin a tale** in Christmas) or Enter.
2. Pick **A** or **B**, or type your own action and press **✦** (or Enter). Paths marked **explored** were taken before and open instantly.
3. **↑ Go back** walks up one level; **← Home** returns to the list of tales.
4. On the last level you reach **The End**: **Start over** goes back to the first passage to try another path.

---

## MVP status

| Feature | Status |
|---|---|
| Create a tale from an idea (LLM writes title, opening, two options) | ✅ |
| List previous tales, newest first, and reopen one | ✅ |
| Play: two generated options per turn; explored paths walk the tree with no LLM call | ✅ |
| Custom action (max 100 chars), one custom branch per turn, shown to everyone afterwards | ✅ (was stretch in the spec) |
| Walk back up at any time; start over from an ending | ✅ |
| 5–10 levels; the last level is an ending | ✅ |
| Loading screen; "still working" after 10 s (the quill on the cover or a blank page, `SPEC-3.md`) | ✅ |
| Readable error messages for bad input, timeouts and LLM failures | ✅ |
| Halloween theme: ghosts, cobwebs, spiders, still easy to read | ✅ |
| Themes as story banks: Christmas theme, per-theme narrator mood, seasonal default, theme picker (`SPECS-2.md`, `PLAN-2.md`) | ✅ |
| Storybook UI: the book, page turns, the quill, the action line on every page (`SPEC-3.md`, `PLAN-3.md`) | ✅ |

Stretch, not built yet: deleting a tale (`DELETE /api/stories/{id}`, `PLAN.md` Step 5) and the extras in `PLAN.md` Step 6.

The full spec is in [`SPEC.md`](SPEC.md) and the build log, step by step, in [`PLAN.md`](PLAN.md). The theme update is in [`SPECS-2.md`](SPECS-2.md) and [`PLAN-2.md`](PLAN-2.md), with one sheet per theme in [`theme-specs/`](theme-specs/). The storybook update is in [`SPEC-3.md`](SPEC-3.md) and [`PLAN-3.md`](PLAN-3.md).

---

## Architecture

```
browser → Vite :5173 ──/api proxy──> FastAPI :8000
  handlers (app/handlers/) → services (app/services/) → repositories (app/repositories/) → app/db.py → Postgres
                                   └──────────────→ app/llm.py → xAI Grok API
```

| Layer | Files | Owns |
|---|---|---|
| Handlers | `backend/app/handlers/{health,stories,nodes}.py` | HTTP only: paths, status codes, request validation (`app/schemas.py`) |
| Services | `backend/app/services/{stories,nodes}.py` | The rules, the LLM calls, transactions; raise domain errors (`app/errors.py`) |
| Repositories | `backend/app/repositories/{stories,nodes}.py` | Raw parameterized SQL, one module per table |
| Adapters | `backend/app/db.py`, `backend/app/llm.py` | Connections/transactions; the only module that talks to xAI |
| Frontend | `frontend/src/App.tsx` (page state: current node and theme), one file per feature (`NewStoryForm`, `StoryList`, `StoryView`, `ThemePicker`), the book's presentation pieces (`Book`: cover and page turns; `StoryPage`: one page; `QuillWriting`: the quill), `themes.ts` (theme list, seasonal default, saved pick), `themes/<id>/` (each theme's decorations and icons), `api.ts` (fetch wrapper, types, error messages) | |

### API

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| POST | `/api/stories` | `{idea, theme?}` (default `halloween`) | 201 story + `root_node_id` | 422, 502, 504 |
| GET | `/api/stories` | `?theme=` (optional) | 200 that theme's list (all without it), newest first | 422 unknown theme |
| GET | `/api/stories/{id}` | | 200 story + `root_node_id` | 404 |
| GET | `/api/nodes/{id}` | | 200 node view: passage, options (each with `child_id` or null), `can_add_custom` | 404 |
| POST | `/api/nodes/{id}/choose` | `{slot: "a"\|"b"}` or `{slot: "custom", text}` | 201 generated · 200 already existed | 400, 404, 409, 422, 502, 504 |

### Data model
- `stories(id, title, idea, theme (default 'halloween'), max_level 5–10, created_at)`. `theme` is added by an idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` at startup, so existing databases need no reset.
- `nodes(id, story_id → stories ON DELETE CASCADE, parent_id → nodes ON DELETE CASCADE, slot 'a'|'b'|'custom', choice_text, level 1–10, content, option_a, option_b, is_ending, created_at)` with **`UNIQUE (parent_id, slot)`** and a partial unique index for one root per story.

---

## Decisions made

| Decision | Why |
|---|---|
| **Tree stored as `nodes.parent_id` + `slot`, with `UNIQUE (parent_id, slot)`** (instead of `head_node_id` + a JSON list of child ids) | One constraint enforces the one-custom-branch rule *and* settles two players generating the same branch at once (the second insert fails and is served the winner's node). Nothing to keep in sync; children and the path to the root are queried (recursive CTE). |
| **`POST /api/nodes/{id}/choose`** returns 201 when it generated, 200 when the branch existed | The original `/api/stories/actions` didn't say which node the action belonged to. The status tells the client whether the LLM ran. |
| **Explored options open `child_id` directly in the UI** | Walking the tree costs one GET and no loader; only new choices call `/choose`. |
| **LLM call before the database write, never inside a transaction** | Generation takes seconds; holding a transaction would block. If generation fails, nothing is saved. |
| **Model `grok-4.20-0309-non-reasoning`** instead of the spec's `grok-4.3` | Measured on the same prompt: about 2 s per passage vs 7–11 s, with comparable writing. `grok-4.3` is cheaper, so this costs more per tale (not measured). One line in `backend/app/llm.py`. |
| **Show "still working" at 10 s, give up at 30 s (504)** | The spec asks to tell the player after 10 s; a hard 10 s cutoff would have failed most `grok-4.3` calls. |
| **Structured output** (`chat.parse` with Pydantic: title ≤ 120, options ≤ 100 chars) | A malformed or oversized answer becomes a clean 502 instead of bad data in the tree. |
| **Story length picked at random, 5–10**, stored as `max_level`; the node at `max_level` is the ending | Matches the spec's range; the LLM is told which passage it is writing and when to end. |
| **Idea 1–300 chars, custom action 1–100 chars, both trimmed** | The spec gave 100 for actions and no limit for ideas. Enforced in the UI (`maxLength`, counters) and the API (422). |
| **Same custom text, ignoring case, walks to the existing custom branch** (different text → 409) | Retyping your own action shouldn't be an error. |
| **Three backend layers** (handlers / services / repositories) | Requested; keeps HTTP, rules and SQL apart. Domain errors carry their status, mapped in one place in `main.py`. |
| **Tests fake only the LLM**, never the database | Real constraint and transaction behaviour is tested; no network or cost in tests. |
| **Themes with measured contrast** | Every text pair ≥ 6.5:1 in both themes (WCAG asks 4.5:1); input borders ≥ 3.5:1; headings-only decorative font; 44px buttons; visible focus rings. Ratios are in each `theme-specs/<id>.md`. |
| **A theme is a story bank**: `stories.theme` set once at creation; the narrator uses the story's stored theme, never the client's | A spooky tale and a festive tale shouldn't share a list or a voice. One column, no new tables; `theme` is optional on create so the older frontend keeps working. |
| **Neutral colour tokens** (`bg`, `surface`, `accent`, ...) switched by `<html data-theme>` | Tailwind v4 utilities read CSS variables, so one `[data-theme='christmas']` block restyles every component. No component knows which theme is on. |
| **Seasonal default**: a festival's theme until a week after it; a manual pick holds for that season only | Nobody gets stuck on Halloween in December. The theme is applied in `main.tsx` before React's first render, so the page never flashes the wrong theme. |
| **Allowed theme ids live in code, not a DB `CHECK`** | Adding a theme is a code change plus a sheet, with no migration. |
| **Decorations in an `absolute` layer under the content**, margins only on wide screens | A `fixed` layer let a ghost drift behind a heading on a phone. Decorations ignore the mouse, are hidden from screen readers and stop for "reduce motion". |
| **Focus moves to the "Page n of max" heading after each turn**; a turn scrolls up only as far as that line | Keyboard and screen-reader users land on the new passage, not a button that disappeared, and the window never snaps to the top. |
| **One fixed page height; the passage steps 18 → 17 → 16px to fit** (`SPEC-3.md` R23) | Pages can turn over each other without the book changing size. Past 16px the passage scrolls inside the page. |
| **A new choice turns to a blank page at once, filled only from the node the backend returns** | The player sees something happen right away, but the UI never invents a node; an error turns back to the page they were on. |

---

## Edge cases (decided and tested)

| Case | Behaviour | Status | Test |
|---|---|---|---|
| Idea blank, whitespace only, over 300 chars, not a string, missing | Rejected, LLM not called | 422 | `test_stories.py` |
| Idea exactly 300 chars | Accepted | 201 | `test_stories.py` |
| LLM times out / fails / returns a malformed answer / API key missing | Clear message, nothing saved | 504 / 502 | `test_stories.py`, `test_choose.py`, `test_llm.py` |
| No tales yet | Empty list (UI: "No tales haunt this place yet…" / "No tales by the tree yet…") | 200 `[]` | `test_stories.py` |
| Create with `theme` missing / `christmas` / unknown, empty, null, wrong case | Halloween / Christmas, narrator gets it / rejected, LLM not called | 201 / 201 / 422 | `test_stories.py` |
| List `?theme=` one bank / empty bank / no filter / unknown | That bank only / `[]` / every tale / rejected | 200 / 200 / 200 / 422 | `test_stories.py` |
| Choose in a Christmas tale | Narrator gets `christmas` for every passage | 201 | `test_choose.py` |
| Saved theme unknown, stale season, broken, or storage blocked | Seasonal default; the picker still works | — | headless browser run (`PLAN-2.md` Step 9) |
| Two tales created in the same instant | Ordered by id, newest first | 200 | `test_stories.py` |
| Unknown story or node id / non-numeric id | Not found / invalid | 404 / 422 | `test_stories.py`, `test_nodes.py`, `test_choose.py` |
| Choose the same option twice | Second call walks to the same child, LLM called once | 201 then 200 | `test_choose.py` |
| Custom action: blank, 101 chars, missing text; `a`/`b` with text; unknown slot | Rejected, LLM not called | 422 | `test_choose.py` |
| Custom action exactly 100 chars | Accepted | 201 | `test_choose.py` |
| Second, different custom action at the same turn | Rejected, naming the existing one; UI reloads to show it | 409 | `test_choose.py` |
| Same custom text again (any case) | Walks to it | 200 | `test_choose.py` |
| Reach `max_level` | That node is the ending: no options, no custom box | 201 | `test_choose.py` |
| Choose at an ending | "This tale has ended" | 400 | `test_choose.py` |
| Two players generate the same branch at once | One insert wins; the other gets the winner's node (or 409 for a different custom action) | 200 / 409 | `test_choose.py` |
| Constraint bypass at the database level (second root, second child per slot, bad slot, level/length bounds, ending without options) | Database rejects it | — | `test_schema.py` |
| Backend or database down | Red banner in the UI; health returns 503 | 503 | `test_health.py` |

---

## Gaps and known limitations
- **No way to delete a tale** (stretch). The schema already cascades (`ON DELETE CASCADE`), so it is one endpoint and one button (`PLAN.md` Step 5). Until then, reset the database to clear tales.
- **Postgres only.** `.env.example` defaults to Postgres, but `backend/app/schema/sqlite.sql` still holds the starter's demo table, so switching `DATABASE_URL` to SQLite breaks the app (and plain `uv run pytest`, which ignores `.env` and tests SQLite).
- **No URL per passage.** The current node lives in React state, so the browser's Back button leaves the app, a refresh returns home, and a passage can't be shared as a link.
- **No frontend tests.** The UI is covered by the type-checked build, lint, and manual/headless-browser runs (screenshots at 1280, 390 and 320 px, scripted playthroughs in both themes, 18 widths checked for decorations over text), not by automated tests. The seasonal-default logic (`seasonalTheme`) is checked by those runs only.
- **Themes: open questions.** The Christmas mood softens a spooky idea more than the spec intends (a "haunted lighthouse" became a gentle mystery); Halloween's small header ghosts overlap the big home-page title below 1024 px (about 414 px and narrower is where it shows most). Both are noted in `theme-specs/`.
- **Fixed-date festivals only.** Easter, Lunar New Year and other moving festivals need a date per year (`theme-specs/README.md` TH5). The default follows the device's date.
- **No limits on generation.** Anyone can create tales and branches; there is no rate limit, quota or cost tracking, and no retry when the LLM fails (the player retries).
- **Moderation is prompt-only.** The system prompt asks for a general audience; custom actions are passed to the model as written and can steer the tale (intended), and anything a player writes becomes visible to everyone who reaches that turn. No auth, so no way to remove or attribute a branch.
- **Endings only at `max_level`.** The story can't end early (e.g. a fatal choice at level 3).
- **422 messages are a bit technical** ("idea: String should have at most 300 characters"); the form's `maxLength` and counters mostly prevent them.
- **Long passages scroll inside the page on phones.** The page has a fixed height, and at 16px the longest passages still don't fit on a 320–390px phone. Phones use overlay scrollbars, so there is no visible scrollbar until you scroll.
- **The storybook's motion was checked by headless-browser scripts with mocked create and choose responses**, not with real Grok calls or a stopped backend.
- **No pagination** on the tale list (agreed in the spec).
- **"Start over"** was not clicked in the browser checks; it uses `GET /api/stories/{id}`, which is tested.

---

## Future work
1. **More themes**: copy `theme-specs/TEMPLATE.md`, fill it in against the rules in `theme-specs/README.md`, then follow its build checklist.
2. **Delete a tale** (`PLAN.md` Step 5): `DELETE /api/stories/{id}` → 204/404, a confirm-before-delete button on each card.
3. **SQLite parity or removal:** port the schema to `sqlite.sql`, or remove SQLite support.
4. **URL routing** (`/nodes/42`): working Back button, refresh, and shareable passages.
5. **Breadcrumb of the path taken**, click to jump back several levels (`PLAN.md` Step 6).
6. **Choose the tale length** (5–10) when creating it.
7. **Story map:** a view of every explored branch of a tale.
8. **Stream passages** as they are written instead of waiting for the whole answer; a typewriter reveal (off under "reduce motion").
9. **Early endings** the model can trigger, and a few ending types (escape, doom, twist).
10. **Rate limiting and cost tracking** per client; retry once on transient LLM errors.
11. **Frontend tests** (component tests plus a Playwright playthrough in `./test.sh`).
12. **Moderation** of custom actions and generated text; delete a custom leaf branch (`PLAN.md` Step 6).
