import os

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from app import db
from app.main import app

# A separate database from the dev one. Created on first use, emptied before each test.
TEST_POSTGRES_URL = os.environ.get(
    "TEST_POSTGRES_URL", "postgresql://app:app@localhost:5432/app_test"
)


def reset_postgres_test_db(url: str) -> None:
    """Create the test database if it's missing, then drop every table in it."""
    name = conninfo_to_dict(url)["dbname"]
    if not name.endswith("_test"):
        pytest.fail(f"Refusing to wipe {name!r}: TEST_POSTGRES_URL must name a *_test database")
    try:
        # CREATE DATABASE has to run while connected to some other database
        admin_url = make_conninfo(url, dbname="postgres")
        with psycopg.connect(admin_url, autocommit=True, connect_timeout=2) as conn:
            if not conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (name,)).fetchone():
                conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        with psycopg.connect(url, autocommit=True, connect_timeout=2) as conn:
            conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
    except psycopg.OperationalError as e:
        pytest.fail(f"Postgres isn't reachable (run `docker compose up -d`): {e}")


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Tests run on the database .env picks (./test.sh loads it), never on the dev data:
    a fresh SQLite file, or the emptied Postgres test database."""
    if db.kind() == "sqlite":
        url = f"sqlite:///{tmp_path / 'test.db'}"
    else:
        url = TEST_POSTGRES_URL
        reset_postgres_test_db(url)
    monkeypatch.setattr(db, "DATABASE_URL", url)
    with TestClient(app) as c:  # `with` runs the lifespan, which creates the tables
        yield c
