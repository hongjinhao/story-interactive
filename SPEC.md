# Spec: <name>

<!-- Fill this in WHILE you ask questions (0–12 min). Understanding and writing the spec-->

## Goal
<!-- Restate before asking anything: who uses it, what they do, and the ONE rule the problem is really
     about. -->


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
| POST   |      |      | 201     | 422,   |
| GET    |      |      | 200 []  |        |


## Page
<!-- Per component: what it shows (sorted?), what it reads (GETs, dropdowns),
     what it writes, where errors show. After a write: what refetches? Missing a GET? Add it to the API. -->
- component1, shows list, reads GET /api/items


## Nouns → tables
<!-- Tables are nouns. Fields should support the rules (plus what the UI shows).
     Constraints: NOT NULL · UNIQUE · FK (on delete: block / cascade?) · CHECK.
     Money → integer cents · times → UTC text. Don't use end, order, user as column names. -->
- table(id PK, field NOT NULL UNIQUE, FK...)


## Rules
<!-- The core of the interview. Ask what applies:
     Conflicts (overlap? back-to-back OK? overlap = A.start < B.end AND B.start < A.end)
     · Time window (opening hours, days, slot size, past, how far ahead) · Limits (capacity, max per day, ≥ 0)
     · Ordering (sort, ties) · States (allowed transitions) · Derived (totals, rounding) · Who can do what.
     Write R1, R2 with exact boundaries (< vs <=). Mark the core rule ★. -->
R1. ★


## Edge cases (decided)
<!-- Write "case → behaviour (status)". Each line becomes a test.
     Input (blank, too long, wrong type, ≤ 0) · Missing (unknown id, empty list) · Time (no TZ, end ≤ start,
     exactly on a boundary) · Concurrency (two requests, one slot → one wins) · Deleting something in use · Scale -->
- 


## Scope
**MVP:**
**Stretch:**
**Out of scope:** Auth, deployment.


## Assumptions
<!-- "Your call" answers and anything decided without asking. Defaults below: say them out loud in
     one line, don't spend a question on them. Delete any the interviewer overrides. -->
- API is JSON REST under `/api`: nouns as resources, standard status codes (see table above).
  Special actions are `POST /api/<resource>/{id}/<action>`.
- 
