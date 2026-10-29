"""Database connection. DATABASE_URL picks the database:

    unset / sqlite:///app.db                 SQLite file in backend/ (default, nothing to run)
    postgresql://app:app@localhost:5432/app  Postgres from docker-compose.yml

Placeholders differ: SQLite uses ?, psycopg uses %s. Never build SQL with f-strings.
Connections autocommit, so each statement is saved when it runs. Wrap statements
that must succeed or fail together in `with transaction(conn):`.
"""

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Annotated

import psycopg
from fastapi import Depends
from psycopg.rows import dict_row

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///app.db")
SCHEMA_DIR = Path(__file__).parent / "schema"

Connection = sqlite3.Connection | psycopg.Connection
# Catch this to turn UNIQUE / FOREIGN KEY / CHECK violations into a 409 or 400.
IntegrityError = (sqlite3.IntegrityError, psycopg.IntegrityError)


def kind() -> str:
    if DATABASE_URL.startswith(("postgres://", "postgresql://")):
        return "postgres"
    if DATABASE_URL.startswith("sqlite:///"):
        return "sqlite"
    raise ValueError(
        f"DATABASE_URL={DATABASE_URL!r} must start with sqlite:/// or postgresql:// (check .env)"
    )


def connect() -> Connection:
    if kind() == "postgres":
        # connect_timeout: fail in seconds, not minutes, if the host is wrong or unreachable
        return psycopg.connect(
            DATABASE_URL, autocommit=True, row_factory=dict_row, connect_timeout=5
        )
    # check_same_thread=False: FastAPI may open the connection in one thread-pool thread
    # and run the endpoint in another. Safe because each request gets its own connection.
    conn = sqlite3.connect(
        DATABASE_URL.removeprefix("sqlite:///"), isolation_level=None, check_same_thread=False
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")  # off by default in SQLite
    return conn


def init_db() -> None:
    """Create the tables (idempotent). Runs at app startup."""
    schema = (SCHEMA_DIR / f"{kind()}.sql").read_text()
    conn = connect()
    try:
        if kind() == "postgres":
            conn.execute(schema)
        else:
            conn.executescript(schema)
    finally:
        conn.close()


def get_db() -> Iterator[Connection]:
    """FastAPI dependency: one connection per request."""
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


DB = Annotated[Connection, Depends(get_db)]


def ping() -> bool:
    """True if the database answers a query. Used by /api/health."""
    try:
        conn = connect()
        try:
            conn.execute("SELECT 1")
        finally:
            conn.close()
    except (sqlite3.Error, psycopg.Error):
        return False
    return True


@contextmanager
def transaction(conn: Connection) -> Iterator[None]:
    """All statements inside commit together, or none do if an exception is raised."""
    if isinstance(conn, psycopg.Connection):
        with conn.transaction():
            yield
        return
    # IMMEDIATE takes SQLite's single write lock now, so a second request waits here
    # (up to the 5 s busy timeout) instead of deadlocking later with "database is locked",
    # and it reads the first request's committed data.
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    conn.execute("COMMIT")
