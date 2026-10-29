-- Runs at every startup, so every statement must be idempotent.
-- Editing a table that already exists does nothing to the dev database:
-- after a change, docker compose down -v && docker compose up -d.
-- `items` is a demo table so the GUIs have rows to show. Replace it with the interview's tables
-- and keep sqlite.sql in step if you might switch.

CREATE TABLE IF NOT EXISTS items (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    qty         INTEGER NOT NULL CHECK (qty >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO items (name, qty) VALUES ('apples', 3), ('pears', 0), ('plums', 12)
ON CONFLICT (name) DO NOTHING;
