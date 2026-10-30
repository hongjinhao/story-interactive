import os
from collections.abc import Callable

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from app import db, llm
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


class FakeLLM:
    """Stands in for app.llm: deterministic answers, records calls, and raises `error` if set.
    `on_call` runs during the call, e.g. to play a second request that wins a race."""

    def __init__(self):
        self.calls: list[tuple] = []
        self.error: Exception | None = None
        self.on_call: Callable[[], None] | None = None

    def start_story(self, idea: str, max_level: int) -> llm.Opening:
        self.calls.append(("start_story", idea, max_level))
        if self.error:
            raise self.error
        return llm.Opening(
            title="The Haunted Test",
            content=f"Your tale begins: {idea}",
            option_a="Open the creaking door",
            option_b="Run back to the road",
        )

    def continue_story(self, idea: str, path: list[dict], choice_text: str, level: int,
                       max_level: int, final: bool) -> llm.Passage | llm.Ending:
        self.calls.append(("continue_story", idea, path, choice_text, level, max_level, final))
        if self.on_call:
            self.on_call()
        if self.error:
            raise self.error
        if final:
            return llm.Ending(content=f"The end, after '{choice_text}'.")
        return llm.Passage(
            content=f"Level {level}: you chose '{choice_text}'.",
            option_a=f"Option A at level {level}",
            option_b=f"Option B at level {level}",
        )


@pytest.fixture
def fake_llm(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(llm, "start_story", fake.start_story)
    monkeypatch.setattr(llm, "continue_story", fake.continue_story)
    return fake


@pytest.fixture
def client(tmp_path, monkeypatch, fake_llm):
    """Tests run on the database .env picks (./test.sh loads it), never on the dev data:
    a fresh SQLite file, or the emptied Postgres test database. The LLM is always the fake."""
    if db.kind() == "sqlite":
        url = f"sqlite:///{tmp_path / 'test.db'}"
    else:
        url = TEST_POSTGRES_URL
        reset_postgres_test_db(url)
    monkeypatch.setattr(db, "DATABASE_URL", url)
    with TestClient(app) as c:  # `with` runs the lifespan, which creates the tables
        yield c
