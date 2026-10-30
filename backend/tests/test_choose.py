"""POST /api/nodes/{id}/choose: the core rule (walk if the branch exists, else generate)."""

import random

import pytest

from app import db, errors
from app.repositories import nodes


@pytest.fixture
def story(client, monkeypatch):
    """A story fixed at 5 levels, so the ending is 4 choices away."""
    monkeypatch.setattr(random, "randint", lambda low, high: 5)
    return client.post("/api/stories", json={"idea": "a carnival that never closes"}).json()


def choose(client, node_id: int, slot: str, text: str | None = None):
    body = {"slot": slot} if text is None else {"slot": slot, "text": text}
    return client.post(f"/api/nodes/{node_id}/choose", json=body)


def generations(fake_llm) -> list[tuple]:
    return [c for c in fake_llm.calls if c[0] == "continue_story"]


def insert_child(parent_id: int, story_id: int, slot: str, choice_text: str) -> int:
    conn = db.connect()
    try:
        return nodes.insert(
            conn, story_id=story_id, parent_id=parent_id, slot=slot, choice_text=choice_text,
            level=2, content="The other request's passage.", option_a="Left", option_b="Right",
        )["id"]
    finally:
        conn.close()


# Generate, then walk


def test_choose_new_option_generates_child_201(client, fake_llm, story):
    root = story["root_node_id"]
    r = choose(client, root, "a")
    assert r.status_code == 201
    child = r.json()
    assert child["parent_id"] == root
    assert child["level"] == 2
    assert child["content"] == "Level 2: you chose 'Open the creaking door'."
    assert [o["text"] for o in child["options"]] == ["Option A at level 2", "Option B at level 2"]
    assert child["is_ending"] is False
    assert child["can_add_custom"] is True


def test_choose_same_option_again_walks_200_without_llm(client, fake_llm, story):
    root = story["root_node_id"]
    first = choose(client, root, "a").json()
    r = choose(client, root, "a")
    assert r.status_code == 200
    assert r.json() == first
    assert len(generations(fake_llm)) == 1


def test_options_a_and_b_lead_to_different_children(client, story):
    root = story["root_node_id"]
    a = choose(client, root, "a").json()
    b = choose(client, root, "b").json()
    assert a["id"] != b["id"]
    assert b["content"] == "Level 2: you chose 'Run back to the road'."


def test_parent_view_shows_explored_child(client, story):
    root = story["root_node_id"]
    child = choose(client, root, "b").json()
    options = client.get(f"/api/nodes/{root}").json()["options"]
    assert [(o["slot"], o["child_id"]) for o in options] == [("a", None), ("b", child["id"])]


def test_llm_gets_idea_story_so_far_and_choice(client, fake_llm, story):
    root = story["root_node_id"]
    level2 = choose(client, root, "a").json()
    choose(client, level2["id"], "b")
    _, idea, path, choice_text, level, max_level, final = generations(fake_llm)[-1]
    assert idea == "a carnival that never closes"
    assert [(n["level"], n["choice_text"]) for n in path] == [
        (1, None),
        (2, "Open the creaking door"),
    ]
    assert path[1]["content"] == level2["content"]
    assert (choice_text, level, max_level, final) == ("Option B at level 2", 3, 5, False)


# Custom branch (R5, R6)


def test_custom_choice_generates_branch_listed_on_parent(client, story):
    root = story["root_node_id"]
    r = choose(client, root, "custom", "  Ride the carousel backwards ")
    assert r.status_code == 201
    custom = r.json()
    assert custom["content"] == "Level 2: you chose 'Ride the carousel backwards'."
    parent = client.get(f"/api/nodes/{root}").json()
    assert parent["options"][2] == {
        "slot": "custom", "text": "Ride the carousel backwards", "child_id": custom["id"],
    }
    assert parent["can_add_custom"] is False


def test_same_custom_text_walks_to_it(client, fake_llm, story):
    root = story["root_node_id"]
    first = choose(client, root, "custom", "Ride the carousel backwards").json()
    r = choose(client, root, "custom", "ride the CAROUSEL backwards")
    assert r.status_code == 200
    assert r.json()["id"] == first["id"]
    assert len(generations(fake_llm)) == 1


def test_second_different_custom_returns_409(client, fake_llm, story):
    root = story["root_node_id"]
    choose(client, root, "custom", "Ride the carousel backwards")
    r = choose(client, root, "custom", "Feed the clown")
    assert r.status_code == 409
    assert '"Ride the carousel backwards"' in r.json()["detail"]
    assert len(generations(fake_llm)) == 1


def test_custom_text_of_100_chars_accepted(client, story):
    assert choose(client, story["root_node_id"], "custom", "x" * 100).status_code == 201


@pytest.mark.parametrize(
    "body",
    [
        {"slot": "custom"},
        {"slot": "custom", "text": "   "},
        {"slot": "custom", "text": "x" * 101},
        {"slot": "custom", "text": 42},
        {"slot": "a", "text": "sneaky"},
        {"slot": "c"},
        {},
    ],
    ids=["custom-no-text", "custom-blank", "custom-too-long", "custom-not-string",
         "preset-with-text", "unknown-slot", "missing-slot"],
)
def test_invalid_choice_returns_422_without_llm(client, fake_llm, story, body):
    r = client.post(f"/api/nodes/{story['root_node_id']}/choose", json=body)
    assert r.status_code == 422
    assert generations(fake_llm) == []


# Levels and endings (R3)


def test_node_at_max_level_is_an_ending(client, fake_llm, story):
    node = client.get(f"/api/nodes/{story['root_node_id']}").json()
    for _ in range(4):
        node = choose(client, node["id"], "a").json()
    assert node["level"] == 5
    assert node["is_ending"] is True
    assert node["options"] == []
    assert node["can_add_custom"] is False
    assert node["content"] == "The end, after 'Option A at level 4'."
    assert [c[-1] for c in generations(fake_llm)] == [False, False, False, True]


def test_choose_at_ending_returns_400(client, fake_llm, story):
    node = client.get(f"/api/nodes/{story['root_node_id']}").json()
    for _ in range(4):
        node = choose(client, node["id"], "a").json()
    for body in ({"slot": "a"}, {"slot": "custom", "text": "Keep going"}):
        r = client.post(f"/api/nodes/{node['id']}/choose", json=body)
        assert r.status_code == 400
        assert "ended" in r.json()["detail"]
    assert len(generations(fake_llm)) == 4


def test_choose_on_unknown_node_returns_404(client):
    r = choose(client, 999, "a")
    assert r.status_code == 404
    assert r.json() == {"detail": "Node 999 not found."}


# LLM failure (R7)


@pytest.mark.parametrize(
    ("error", "status"),
    [(errors.GenerationTimeout("Too slow."), 504), (errors.GenerationFailed("Broken."), 502)],
)
def test_llm_error_creates_no_child(client, fake_llm, story, error, status):
    root = story["root_node_id"]
    fake_llm.error = error
    assert choose(client, root, "a").status_code == status
    assert client.get(f"/api/nodes/{root}").json()["options"][0]["child_id"] is None


# Two requests for the same branch at once


def test_race_on_preset_option_returns_the_winner(client, fake_llm, story):
    root = story["root_node_id"]
    winner: list[int] = []
    fake_llm.on_call = lambda: winner.append(insert_child(root, story["id"], "a", "Open the creaking door"))
    r = choose(client, root, "a")
    assert r.status_code == 200
    assert r.json()["id"] == winner[0]
    assert r.json()["content"] == "The other request's passage."


def test_race_on_custom_with_different_text_returns_409(client, fake_llm, story):
    root = story["root_node_id"]
    fake_llm.on_call = lambda: insert_child(root, story["id"], "custom", "Feed the clown")
    r = choose(client, root, "custom", "Ride the carousel backwards")
    assert r.status_code == 409
    assert '"Feed the clown"' in r.json()["detail"]
