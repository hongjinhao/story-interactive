# Spec: <name>

## Goal
<!-- Two sentences: who uses it, what they can do, the core rule. -->

## Data
<!-- Nouns become tables. Only the fields the rules need, plus what the UI shows.
     What must always be true? NOT NULL, UNIQUE, FOREIGN KEY, CHECK. -->
- table(id, field NOT NULL, ...)

## API
<!-- Verbs become endpoints. For each one ask: body? → 422. Id? → 404. Must be unique / not clash? → 409. -->
| Method | Path | Body | Success | Errors |
|--------|------|------|---------|--------|
|  GET   |      |      |         |        |
| POST   |      |      |         |        |
|        |      |      |         |        |

## Rules
<!-- The business logic, the part this problem is really about. Exact conditions, including boundaries (< vs <=). -->
R1.

## Edge cases (decided)
<!-- Walk: input · empty/missing data · time zones · concurrency · deleting things that are in use. Each one gets a decision and a test. -->
-

## Out of scope
<!-- Anything the core rule doesn't need that costs time. -->
Auth, deployment.

## Assumptions
<!-- What I decided without asking. -->
-
