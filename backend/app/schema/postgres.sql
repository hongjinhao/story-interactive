-- Runs at every startup, so every statement must be idempotent.
-- Editing a table that already exists does nothing to the dev database:
-- after a change, docker compose down -v && docker compose up -d.

CREATE TABLE IF NOT EXISTS stories (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    idea        TEXT NOT NULL CHECK (length(idea) BETWEEN 1 AND 300),
    max_level   INTEGER NOT NULL CHECK (max_level BETWEEN 5 AND 10),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A story is a tree of nodes linked by parent_id. The root has no parent, slot or choice_text.
CREATE TABLE IF NOT EXISTS nodes (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    story_id    INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    parent_id   INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    slot        TEXT CHECK (slot IN ('a', 'b', 'custom')),      -- which choice led here
    choice_text TEXT CHECK (length(choice_text) BETWEEN 1 AND 100),  -- the words of that choice
    level       INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
    content     TEXT NOT NULL,
    option_a    TEXT,                                           -- NULL on an ending
    option_b    TEXT,
    is_ending   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((parent_id IS NULL) = (slot IS NULL)),
    CHECK ((parent_id IS NULL) = (choice_text IS NULL)),
    CHECK (is_ending OR (option_a IS NOT NULL AND option_b IS NOT NULL)),
    -- At most one 'a', one 'b' and one 'custom' child per node. This is the custom-branch cap,
    -- and it settles two requests generating the same branch at once: the second insert fails.
    UNIQUE (parent_id, slot)
);

-- UNIQUE treats NULLs as distinct, so one root per story needs a partial index.
CREATE UNIQUE INDEX IF NOT EXISTS one_root_per_story ON nodes (story_id) WHERE parent_id IS NULL;
