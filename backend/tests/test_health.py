import sqlite3

import pytest

from app import db


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "db": db.kind()}


def test_schema_seeds_demo_items(client):
    conn = db.connect()
    try:
        names = [row["name"] for row in conn.execute("SELECT name FROM items ORDER BY name")]
    finally:
        conn.close()
    assert names == ["apples", "pears", "plums"]


def test_unique_constraint_raises_integrity_error(client):
    conn = db.connect()
    try:
        insert = "INSERT INTO items (name, qty) VALUES ('apples', 1)"
        try:
            conn.execute(insert)
        except db.IntegrityError:
            return
        raise AssertionError("duplicate name was accepted")
    finally:
        conn.close()


def test_transaction_rolls_back_on_error(client):
    conn = db.connect()
    try:
        try:
            with db.transaction(conn):
                conn.execute("INSERT INTO items (name, qty) VALUES ('kiwis', 5)")
                conn.execute("INSERT INTO items (name, qty) VALUES ('figs', -1)")  # fails CHECK
        except db.IntegrityError:
            pass
        count = conn.execute("SELECT COUNT(*) AS n FROM items WHERE name = 'kiwis'").fetchone()
    finally:
        conn.close()
    assert count["n"] == 0


def test_health_returns_503_when_database_is_down(client, monkeypatch, tmp_path):
    # An unopenable SQLite path, or a Postgres port nothing listens on
    dead = (
        f"sqlite:///{tmp_path / 'missing-dir' / 'x.db'}"
        if db.kind() == "sqlite"
        else "postgresql://app:app@localhost:1/app_test"
    )
    monkeypatch.setattr(db, "DATABASE_URL", dead)
    r = client.get("/api/health")
    assert r.status_code == 503
    assert r.json()["status"] == "database unreachable"


@pytest.mark.parametrize(
    "url", ["sqlite://app.db", "postgresq://app:app@localhost/app", "mysql://x", ""]
)
def test_bad_database_url_raises_clear_error(monkeypatch, url):
    monkeypatch.setattr(db, "DATABASE_URL", url)
    with pytest.raises(ValueError, match="must start with"):
        db.kind()


def test_sqlite_transaction_takes_write_lock_at_begin(client):
    if db.kind() != "sqlite":
        pytest.skip("SQLite locking only")
    a = db.connect()
    # timeout=0: fail at once instead of waiting for the lock
    b = sqlite3.connect(db.DATABASE_URL.removeprefix("sqlite:///"), timeout=0, isolation_level=None)
    try:
        with db.transaction(a), pytest.raises(sqlite3.OperationalError, match="locked"):
            b.execute("BEGIN IMMEDIATE")
    finally:
        a.close()
        b.close()
