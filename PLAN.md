# Build plan: Story Interactive

Build to `SPEC.md` (API, rules R1–R7, edge cases) and follow `CLAUDE.md` (layers, conventions, guardrails).
Every step ends with `./test.sh` passing and the human reviewing the diff. One endpoint or one component per change.

Backend layers: handlers (`app/handlers/`) → services (`app/services/`) → repositories (`app/repositories/`) → `app/db.py`; services also call `app/llm.py`.

---

## Step 0: Setup (no features)
- [x] `uv add xai-sdk` in `backend/`. Add `XAI_API_KEY=` to `.env.example`.
- [x] Create `app/handlers/`, `app/services/`, `app/repositories/` (each with `__init__.py`) and `app/errors.py`. (`schemas.py`, `llm.py` and the `fake_llm` fixture are created in Step 2, where they're first used.)
- [x] `errors.py`: `AppError` base with a `status_code`; `NotFound` 404, `Conflict` 409, `RuleViolation` 400, `GenerationFailed` 502, `GenerationTimeout` 504.
- [x] `main.py`: one exception handler for `AppError` returning its status with `{"detail": message}`. Test: `tests/test_errors.py`.
- [x] Move `/api/health` into `handlers/health.py` and include the router.

**Done when:** `test_health.py` and `test_errors.py` pass.

## Step 1: Schema (`backend/app/schema/postgres.sql`, replaces `items`)

```sql
CREATE TABLE IF NOT EXISTS stories (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    idea        TEXT NOT NULL CHECK (length(idea) BETWEEN 1 AND 300),
    max_level   INTEGER NOT NULL CHECK (max_level BETWEEN 5 AND 10),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nodes (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    story_id    INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    parent_id   INTEGER REFERENCES nodes(id) ON DELETE CASCADE,      -- NULL = root
    slot        TEXT CHECK (slot IN ('a', 'b', 'custom')),             -- choice that led here
    choice_text TEXT CHECK (length(choice_text) <= 100),               -- words of that choice
    level       INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
    content     TEXT NOT NULL,
    option_a    TEXT,                                                  -- NULL on an ending
    option_b    TEXT,
    is_ending   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((parent_id IS NULL) = (slot IS NULL)),
    CHECK ((parent_id IS NULL) = (choice_text IS NULL)),
    CHECK (is_ending OR (option_a IS NOT NULL AND option_b IS NOT NULL)),
    UNIQUE (parent_id, slot)            -- ★ one a, one b, one custom per node
);

CREATE UNIQUE INDEX IF NOT EXISTS one_root_per_story ON nodes (story_id) WHERE parent_id IS NULL;
```

- `UNIQUE (parent_id, slot)` enforces the custom cap (R5) and settles concurrent requests: the losing insert gets `IntegrityError` and is served the winner's node.
- Children and the path to the root are queried (recursive CTE), never stored.

**Done when:** the app starts on a fresh DB and both tables exist. Reset dev DB: `docker compose down -v && docker compose up -d`.

## Step 2: Create and list
Build one endpoint at a time, each with its tests.

| # | Endpoint | Success | Errors |
|---|---|---|---|
| 2a | `POST /api/stories` `{idea}` | 201 story + `root_node_id` | 422 · 502 · 504 |
| 2b | `GET /api/stories` | 200 list, newest first, ties by id desc | none (`[]`) |
| 2c | `GET /api/stories/{id}` | 200 story + `root_node_id` | 404 |
| 2d | `GET /api/nodes/{id}` | 200 node view (see SPEC.md) | 404 |

Pieces:
- [ ] `conftest.py`: `fake_llm` fixture that monkeypatches `app.llm` functions with deterministic output and can be set to raise `GenerationTimeout` / `GenerationFailed`.
- [ ] `schemas.py`: `StoryCreate` (idea trimmed, 1–300), `Story`, `NodeOption`, `NodeView`.
- [ ] `llm.py`:
  - `start_story(idea, max_level) -> Opening{title, content, option_a, option_b}`
  - `continue_story(idea, path, choice_text, level, max_level, final) -> Passage{content, option_a?, option_b?}`
  - `grok-4.3` via `xai_sdk`, structured output with Pydantic, options ≤ 100 chars, 30 s timeout. Timeout → `GenerationTimeout`. Any other SDK error or invalid output → `GenerationFailed`. Verify the model id and timeout option against the SDK when building.
- [ ] `repositories/stories.py`: `insert`, `list_all`, `get` (with `root_node_id`).
- [ ] `repositories/nodes.py`: `insert`, `get`, `children`, `path_to_root`.
- [ ] `services/stories.py`: `create_story` (random `max_level` 5–10, call LLM, then insert story + root in one transaction), `list_stories`, `get_story`.
- [ ] `services/nodes.py`: `get_node_view` (node + options with `child_id` + custom child if any + `can_add_custom`).
- [ ] `handlers/stories.py`, `handlers/nodes.py`.

Tests (`tests/test_stories.py`, `tests/test_nodes.py`):
- [ ] create → 201, root node at level 1 with two options
- [ ] blank, whitespace-only and 301-char idea → 422
- [ ] LLM timeout → 504, LLM failure → 502, and no story row left either way
- [ ] list empty → `[]`; list order newest first
- [ ] unknown story → 404; unknown node → 404
- [ ] node view: `child_id` null before exploring, no custom option yet, `can_add_custom` true

## Step 3: Core rules: choosing a path ★
`POST /api/nodes/{id}/choose` with `{"slot": "a" | "b"}` or `{"slot": "custom", "text": "..."}`.

Service logic, in order:
1. Load node → 404 if missing.
2. Node is an ending → 400 "This tale has ended."
3. Body validation in `schemas.py` → 422 (custom needs trimmed text 1–100, a/b must not carry text, unknown slot).
4. Child already exists for the slot:
   - a / b / same custom text → return it, **200**, no LLM call.
   - different custom text → **409** "This path already has a custom branch: '…'".
5. Build the path to the root, call `llm.continue_story` with `final = (level + 1 == max_level)`. A final node gets `is_ending = true` and no options.
6. Insert the child. On `IntegrityError` (concurrent winner): re-read and return the winner's node (200), or 409 for a custom branch with different text. A fresh insert → **201**.

Walking up needs no endpoint: the UI fetches `GET /api/nodes/{parent_id}`.

Tests:
- [ ] choose `a` → 201, again → 200 same child, LLM called once
- [ ] custom → 201, and the parent's view now lists it, `can_add_custom` false
- [ ] second different custom → 409; same custom text → 200
- [ ] custom 101 chars / blank / missing text → 422; `a` with text → 422; unknown slot → 422
- [ ] with `max_level` fixed at 5, four choices reach a level-5 node with `is_ending` true and no options
- [ ] choose at an ending → 400
- [ ] unknown node → 404
- [ ] LLM timeout → 504 and no child created

## Step 4: UI (one component per change)

| # | File | Shows | Reads / writes |
|---|---|---|---|
| 4a | `api.ts` | types `Story`, `NodeOption`, `StoryNode`; `api<T>`, `post<T>`, `ApiError`; readable errors from `{detail}` and 422 lists; handles 204 | none |
| 4b | `index.css` + `index.html` | `@theme` tokens, fonts, keyframes (below) | none |
| 4c | `App.tsx` | state `nodeId: number \| null` (null = home); renders home or `StoryView`, plus `HauntedDecor` | none |
| 4d | `SpookyLoader.tsx` | overlay with a floating ghost and "Summoning your tale…"; after 10 s adds "The spirits are slow tonight… still working" (`aria-live="polite"`) | none |
| 4e | `NewStoryForm.tsx` | intro text, idea textarea with a 0/300 counter, "Summon a tale" button, inline error | `POST /api/stories`, then `onOpen(root_node_id)` |
| 4f | `StoryList.tsx` | previous tales (title, idea snippet, date), newest first; empty state "No tales haunt this place yet…" | `GET /api/stories` |
| 4g | `StoryView.tsx` | title, "Level n of max", passage, option buttons (👣 marks explored), custom input with a 0/100 counter (disabled with a reason when a custom branch exists), ↑ Go back (parent), Back to home; ending shows "The End", Start over (root), Home; inline errors; on 409 refetch the node | `GET /api/nodes/{id}`, `POST /api/nodes/{id}/choose` |
| 4h | `HauntedDecor.tsx` | ghosts, cobwebs, spiders (below) | none |

### Halloween look: spooky but readable
Palette (`@theme` tokens):

| Token | Value | Use |
|---|---|---|
| `night` | `#0d0a14` | page background |
| `crypt` | `#1a1325` | cards |
| `crypt-edge` | `#2e2340` | borders |
| `bone` | `#f2ecdf` | main text (about 17:1 on night) |
| `mist` | `#b8aecb` | secondary text |
| `pumpkin` | `#ff8c1a` | primary buttons (dark text on top), focus ring |
| `slime` | `#8fe36b` | explored marker |
| `blood` | `#ff6b6b` | errors |

Type: Google Fonts link in `index.html` (no npm package). *Creepster* for headings only. *Lora* 18px / 1.7 line height for passages. System sans for buttons and inputs.

Decorations (all `aria-hidden`, `pointer-events-none`, behind content, `motion-reduce:animate-none`):
- **Ghosts:** 5–7 small inline SVGs (24–56px) in the page margins, bobbing slowly (`animate-float`, 6–9 s, staggered delays), 50–80% opacity. One peeks from behind a corner of the story card. Only 2 on phones (`hidden md:block` for the rest).
- **Cobwebs:** large SVG webs in the top-left and top-right page corners, a tiny one on a corner of the story card. Thin strokes in `bone` at about 20% opacity.
- **Spiders:** 2–3 hanging from the top on a thread, swaying gently (`animate-dangle`).

Usability floor:
- Body text ≥ 16px, contrast ≥ 4.5:1.
- Buttons ≥ 44px tall, thick orange `focus-visible` ring, soft orange glow on hover.
- Passage in a high-contrast card about 65 characters wide. Nothing decorative behind the text.

**Done when:** `./test.sh` passes, and a manual run of `./dev.sh` covers: create a story → play to the end → walk back up → add a custom branch → see it as an option → back to home → the story is in the list.

## Step 5: Delete
- [ ] `DELETE /api/stories/{id}` → 204, or 404. Cascade removes its nodes.
  - Tests: delete → 204, then story GET → 404 and its node GET → 404. Delete unknown → 404.
- [ ] `StoryList.tsx`: 🗑 button on each card → `confirm("Banish this tale forever?")` → remove the card after 204, inline error otherwise.

## Step 6: Extras (in priority order, each needs a SPEC.md update first)
1. [ ] **Breadcrumb:** node view also returns `path` (the choices taken from the root). Clicking a crumb jumps up to that level.
2. [ ] **Pick the length:** optional `max_level` (5–10) on `POST /api/stories`, 422 outside the range.
3. [ ] **Story map:** `GET /api/stories/{id}/tree` with a simple nested view of explored branches.
4. [ ] **Typewriter reveal** of passages (skipped under reduced motion).
5. [ ] **Delete a custom leaf branch:** `DELETE /api/nodes/{id}`, 400 for non-custom nodes or nodes with children.
