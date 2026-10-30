import pytest

from app import db
from app.repositories import nodes


@pytest.fixture
def story(client):
    return client.post("/api/stories", json={"idea": "a lighthouse that knocks back"}).json()


def add_child(parent_id: int, story_id: int, slot: str, choice_text: str, level: int = 2,
              is_ending: bool = False) -> int:
    """Stand-in for the choose endpoint (Step 3): insert a child node directly."""
    options = (None, None) if is_ending else ("Climb higher", "Turn back")
    conn = db.connect()
    try:
        return nodes.insert(
            conn, story_id=story_id, parent_id=parent_id, slot=slot, choice_text=choice_text,
            level=level, content=f"After '{choice_text}'...", option_a=options[0],
            option_b=options[1], is_ending=is_ending,
        )["id"]
    finally:
        conn.close()


# GET /api/nodes/{id}


def test_root_node_view(client, story):
    r = client.get(f"/api/nodes/{story['root_node_id']}")
    assert r.status_code == 200
    assert r.json() == {
        "id": story["root_node_id"],
        "story_id": story["id"],
        "story_title": "The Haunted Test",
        "parent_id": None,
        "level": 1,
        "max_level": story["max_level"],
        "content": "Your tale begins: a lighthouse that knocks back",
        "is_ending": False,
        "options": [
            {"slot": "a", "text": "Open the creaking door", "child_id": None},
            {"slot": "b", "text": "Run back to the road", "child_id": None},
        ],
        "can_add_custom": True,
    }


def test_explored_options_carry_their_child_id(client, story):
    root = story["root_node_id"]
    child_a = add_child(root, story["id"], "a", "Open the creaking door")
    options = client.get(f"/api/nodes/{root}").json()["options"]
    assert [(o["slot"], o["child_id"]) for o in options] == [("a", child_a), ("b", None)]


def test_custom_branch_listed_third_and_blocks_another(client, story):
    root = story["root_node_id"]
    custom = add_child(root, story["id"], "custom", "Whistle at the raven")
    view = client.get(f"/api/nodes/{root}").json()
    assert view["options"][2] == {"slot": "custom", "text": "Whistle at the raven", "child_id": custom}
    assert view["can_add_custom"] is False


def test_child_node_view_points_to_parent(client, story):
    root = story["root_node_id"]
    child = add_child(root, story["id"], "b", "Run back to the road")
    view = client.get(f"/api/nodes/{child}").json()
    assert view["parent_id"] == root
    assert view["level"] == 2
    assert view["content"] == "After 'Run back to the road'..."
    assert [o["text"] for o in view["options"]] == ["Climb higher", "Turn back"]


def test_ending_has_no_options_and_no_custom(client, story):
    ending = add_child(story["root_node_id"], story["id"], "a", "Open the door", is_ending=True)
    view = client.get(f"/api/nodes/{ending}").json()
    assert view["is_ending"] is True
    assert view["options"] == []
    assert view["can_add_custom"] is False


def test_unknown_node_returns_404(client):
    r = client.get("/api/nodes/999")
    assert r.status_code == 404
    assert r.json() == {"detail": "Node 999 not found."}


def test_node_with_non_numeric_id_returns_422(client):
    assert client.get("/api/nodes/abc").status_code == 422
