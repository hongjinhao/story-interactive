-- Runs at every startup, so every statement must be idempotent.
-- Editing a table that already exists does nothing to backend/app.db: after a change, rm backend/app.db.
-- `items` is a demo table so the GUIs have rows to show. Replace it with the interview's tables
-- and keep postgres.sql in step if you might switch.

CREATE TABLE IF NOT EXISTS items (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    qty         INTEGER NOT NULL CHECK (qty >= 0),
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO items (name, qty) VALUES ('apples', 3), ('pears', 0), ('plums', 12)
ON CONFLICT (name) DO NOTHING;
