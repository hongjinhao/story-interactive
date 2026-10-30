import pytest

from app import db, errors


def count(table: str) -> int:
    assert table in ("stories", "nodes")  # table names can't be placeholders
    conn = db.connect()
    try:
        return conn.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()["n"]
    finally:
        conn.close()


def get_node(node_id: int) -> dict:
    conn = db.connect()
    try:
        return dict(conn.execute("SELECT * FROM nodes WHERE id = %s", (node_id,)).fetchone())
    finally:
        conn.close()


# POST /api/stories


def test_create_story_returns_201_with_root_node(client, fake_llm):
    r = client.post("/api/stories", json={"idea": "A lighthouse keeper hears knocking"})
    assert r.status_code == 201
    story = r.json()
    assert story["title"] == "The Haunted Test"
    assert story["idea"] == "A lighthouse keeper hears knocking"
    assert 5 <= story["max_level"] <= 10
    assert story["created_at"]

    root = get_node(story["root_node_id"])
    assert root["story_id"] == story["id"]
    assert root["parent_id"] is None
    assert root["level"] == 1
    assert root["content"] == "Your tale begins: A lighthouse keeper hears knocking"
    assert (root["option_a"], root["option_b"]) == ("Open the creaking door", "Run back to the road")
    assert root["is_ending"] is False
    assert fake_llm.calls == [("start_story", "A lighthouse keeper hears knocking", story["max_level"])]


def test_create_story_trims_idea(client):
    r = client.post("/api/stories", json={"idea": "   a cursed violin  "})
    assert r.status_code == 201
    assert r.json()["idea"] == "a cursed violin"


def test_idea_of_300_chars_accepted(client):
    r = client.post("/api/stories", json={"idea": "x" * 300})
    assert r.status_code == 201


@pytest.mark.parametrize(
    "body",
    [
        {"idea": "x" * 301},
        {"idea": ""},
        {"idea": "   "},
        {"idea": 123},
        {},
    ],
    ids=["too-long", "empty", "whitespace", "not-a-string", "missing"],
)
def test_invalid_idea_returns_422_without_calling_llm(client, fake_llm, body):
    r = client.post("/api/stories", json=body)
    assert r.status_code == 422
    assert fake_llm.calls == []
    assert count("stories") == 0


def test_too_long_idea_error_says_why(client):
    r = client.post("/api/stories", json={"idea": "x" * 301})
    assert "300 characters" in r.json()["detail"][0]["msg"]


def test_llm_timeout_returns_504_and_saves_nothing(client, fake_llm):
    fake_llm.error = errors.GenerationTimeout("The story took too long to arrive.")
    r = client.post("/api/stories", json={"idea": "a slow ghost"})
    assert r.status_code == 504
    assert r.json() == {"detail": "The story took too long to arrive."}
    assert count("stories") == 0
    assert count("nodes") == 0


def test_llm_failure_returns_502_and_saves_nothing(client, fake_llm):
    fake_llm.error = errors.GenerationFailed("The storyteller is unavailable right now.")
    r = client.post("/api/stories", json={"idea": "a broken ghost"})
    assert r.status_code == 502
    assert count("stories") == 0
    assert count("nodes") == 0
