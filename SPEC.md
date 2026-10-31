# Spec: Story Interactive

<!-- Fill this in WHILE you ask questions (0–12 min). Understanding and writing the spec-->

## Goal
<!-- Restate before asking anything: who uses it, what they do, and the ONE rule the problem is really
     about. -->

choose your own adventure powered by LLMs. Anyone can use it to create interactive adventures, choose previously generated adventures, choose what action to take at different steps of the adventure. adventure should have 5 to 10 levels of interaction. 

For the story interaction, users should have 2 pre generated options and a text bar to type whatever action or story prompt they can think of (max 100 characters). The stories should be stored as like a tree, where a user action can walk down the tree, while a user story prompt will generate more branches on the tree. Users can also walk up the tree at any time where they will see their story prompt becomes one of the options. We should cap the number of generated story options to just 1 at each point. 

★ Core rule: walk the tree when the branch exists, generate only when it doesn't, and never more than one custom branch per node.

The UI is Halloween themed (ghosts, cobwebs, spiders) but stays easy to read and use.


## Users & actions → API
<!-- Who uses it? What can they do? Each action is an endpoint: the path is a plural noun, the method is the verb.
     POST /api/items create · GET /api/items list · GET /api/items/{id} get · PATCH edit · DELETE delete.
     Special (book, dispense): POST /api/items/{id}/dispense. Body = the change ({quantity}), not the new value.
     Then walk each screen: what must it read before the user can act (dropdowns)? Add those GETs.
     For each list: users create it (add a POST) or assume it's seeded (no POST, still needs its GET).
     Errors: body → 422 · id → 404 · duplicate/clash → 409 · broken rule → 400/409.
     Success: create → 201 + row · list → 200 [] in a stated order · delete → 204 -->
| Method | Path | Body | Success | Errors |
|--------|------|------|---------|--------|
| POST   | /api/stories | `{idea}` | 201 story + `root_node_id` | 422, 502, 504 |
| GET    | /api/stories | | 200 `[story]`, newest first (ties: id desc), `[]` when empty | |
| GET    | /api/stories/{id} | | 200 story + `root_node_id` | 404 |
| DELETE | /api/stories/{id} (stretch) | | 204 (its nodes are deleted too) | 404 |
| GET    | /api/nodes/{id} | | 200 node view | 404 |
| POST   | /api/nodes/{id}/choose | `{slot: "a"\|"b"}` or `{slot: "custom", text}` | 200 existing child (walk) · 201 new child (generated) | 400, 404, 409, 422, 502, 504 |

Story: `{id, title, idea, max_level, root_node_id, created_at}`

Node view (what the story screen renders):
```json
{ "id": 12, "story_id": 3, "story_title": "...", "parent_id": 7, "level": 3, "max_level": 7,
  "content": "...", "is_ending": false,
  "options": [ {"slot": "a", "text": "Open the crypt", "child_id": 15},
               {"slot": "b", "text": "Run to the chapel", "child_id": null},
               {"slot": "custom", "text": "Whistle at the raven", "child_id": 19} ],
  "can_add_custom": false }
```
- `child_id` is null until that branch has been generated (the UI marks explored options).
- The `custom` option is only listed once someone has created it. An ending has `options: []`.
- Walking up = `GET /api/nodes/{parent_id}`. No extra endpoint.

## Page
<!-- Per component: what it shows (sorted?), what it reads (GETs, dropdowns),
     what it writes, where errors show. After a write: what refetches? Missing a GET? Add it to the API. -->
- start (`NewStoryForm` + `StoryList`): shows hello and introduces this app, idea box with a 0/300 counter, shows previous stories newest first (empty state when none), each opens on click. Reads GET /api/stories, writes POST /api/stories. After create → opens the root node. Stretch: a delete button per card (confirm first) → DELETE /api/stories/{id}, then removes the card. Errors show inline under the form/card.
- storybox (`StoryView`): shows story title, "Level n of max", the current passage, the 2 options plus the custom one if it exists (explored ones marked), a custom action box with a 0/100 counter (disabled with a reason when the node already has a custom branch), "go back" to the parent node. An ending shows "The End", start over (root) and home. Reads GET /api/nodes/{id}, writes POST /api/nodes/{id}/choose. After a choose → shows the returned child. After a 409 → refetches the node so the existing custom option appears. Errors show inline under the options.
- loading (`SpookyLoader`): overlay while a story/node is generating. After 10 s it adds "still working" text.
- back to home, brings user back to the home page which shows start. 

## Nouns → tables
<!-- Tables are nouns. Fields should support the rules (plus what the UI shows).
     Constraints: NOT NULL · UNIQUE · FK (on delete: block / cascade?) · CHECK.
     Money → integer cents · times → UTC text. Don't use end, order, user as column names. -->
- stories(id PK, title NOT NULL 1–120 chars, idea NOT NULL 1–300 chars, max_level INT NOT NULL CHECK 5–10, created_at TIMESTAMPTZ)
- nodes(id PK, story_id FK → stories ON DELETE CASCADE, parent_id FK → nodes ON DELETE CASCADE (NULL = root), slot 'a'|'b'|'custom' (NULL for root), choice_text ≤ 100 chars (the words of the choice that led here, NULL for root), level INT CHECK 1–10, content TEXT NOT NULL, option_a, option_b (NULL on an ending), is_ending BOOLEAN, created_at TIMESTAMPTZ)
  - UNIQUE (parent_id, slot): at most one a, one b and one custom child per node. This is the custom cap and also settles concurrent requests.
  - Partial unique index: one root per story (`WHERE parent_id IS NULL`).
  - CHECKs: root ⇔ slot NULL ⇔ choice_text NULL; a non-ending node has both options.
  - The tree is stored by `parent_id` only. Children and the path to the root are queried (recursive CTE), never stored as JSON.
Postgres is used here for practice. 

## Rules
<!-- The core of the interview. Ask what applies:
     Conflicts (overlap? back-to-back OK? overlap = A.start < B.end AND B.start < A.end)
     · Time window (opening hours, days, slot size, past, how far ahead) · Limits (capacity, max per day, ≥ 0)
     · Ordering (sort, ties) · States (allowed transitions) · Derived (totals, rounding) · Who can do what.
     Write R1, R2 with exact boundaries (< vs <=). Mark the core rule ★. -->
R1. ★ Users can create a new story based on their idea. The LLM writes the title, the first passage (level 1) and 2 options. `max_level` is picked at random from 5 to 10 inclusive.
R2. ★ Users can create new nodes based on 2 pre generated actions or a custom prompt. Choosing a slot whose child exists walks down (200, no LLM call). Otherwise the LLM generates the child (201) from the story's path so far.
R3. Stories should have a maximum of 10 levels. A child's level = parent level + 1. The node at level == `max_level` is an ending: `is_ending = true`, no options, and choosing from it is refused (400).
R4. Users should see a loading screen if the story is being generated
R5. ★ At most 1 custom branch per node. Same custom text again → walk to it (200). Different text → 409, with the existing custom option in the message.
R6. Walking up is always allowed (to the parent node). The custom branch shows as a third option there.
R7. Nothing is saved if generation fails. The LLM is called before the write, and the write is one transaction.

## Edge cases (decided)
<!-- Write "case → behaviour (status)". Each line becomes a test.
     Input (blank, too long, wrong type, ≤ 0) · Missing (unknown id, empty list) · Time (no TZ, end ≤ start,
     exactly on a boundary) · Concurrency (two requests, one slot → one wins) · Deleting something in use · Scale -->
- If the story idea / action prompt input is too long, give a descriptive error: idea > 300 chars → 422 · custom text > 100 chars → 422
- Blank or whitespace-only idea / custom text → 422 (input is trimmed first)
- Custom slot without text, a/b slot with text, unknown slot → 422
- If the generation takes too long (> 10 seconds), let the user know: the UI shows "still working" after 10 s. The backend gives up after 30 s → 504, nothing saved.
- LLM error or malformed LLM output → 502, nothing saved
- Unknown story / node id → 404
- No stories yet → 200 `[]`
- Choose at an ending → 400
- Choose a/b twice → second call returns the same child (200), LLM called once
- Two requests generate the same slot at once → one insert wins, the other returns the winner's node (200), or 409 if it's a custom branch with different text
- (stretch) Delete a story → 204, its nodes then 404. Delete unknown story → 404

## Scope
**MVP:** users can generate story ideas, see previous stories, run through the story with the pre generated action options, walk back up
**Stretch:** users can generate their own custom action prompts (built with the core rules, since the schema handles it). Delete stories (moved from MVP; the schema already cascades). Breadcrumb path, choosing story length, story map view, typewriter reveal, deleting a custom leaf branch.
**Out of scope:** Auth, deployment, CICD


## Assumptions
<!-- "Your call" answers and anything decided without asking. Defaults below: say them out loud in
     one line, don't spend a question on them. Delete any the interviewer overrides. -->
- API is JSON REST under `/api`: nouns as resources, standard status codes (see table above).
  Special actions are `POST /api/<resource>/{id}/<action>`.
- No pagination 
- use the grok api for story generation, using xai_sdk in python. Model: grok-4.20-0309-non-reasoning (about 2 s per passage). It replaces grok-4.3, the cheapest option, which took 7–11 s and would show the "still working" message on most generations. Structured output (Pydantic) for title/content/options. Client timeout 30 s.
- Tests fake the LLM, never the database.
