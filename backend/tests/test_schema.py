"""The constraints in schema/postgres.sql that the story rules rely on."""

import pytest

from app import db


@pytest.fixture
def conn(client):
    c = db.connect()
    try:
        yield c
    finally:
        c.close()


def add_story(conn, max_level=5):
    row = conn.execute(
        "INSERT INTO stories (title, idea, max_level) VALUES ('Tale', 'an idea', %s) RETURNING id",
        (max_level,),
    ).fetchone()
    return row["id"]


def add_node(conn, story_id, parent_id=None, slot=None, choice_text=None, level=1,
             is_ending=False, option_a="Go left", option_b="Go right"):
    row = conn.execute(
        """INSERT INTO nodes (story_id, parent_id, slot, choice_text, level, content,
                              option_a, option_b, is_ending)
           VALUES (%s, %s, %s, %s, %s, 'Once upon a midnight dreary...', %s, %s, %s)
           RETURNING id""",
        (story_id, parent_id, slot, choice_text, level, option_a, option_b, is_ending),
    ).fetchone()
    return row["id"]


def test_tables_start_empty(conn):
    assert conn.execute("SELECT COUNT(*) AS n FROM stories").fetchone()["n"] == 0
    assert conn.execute("SELECT COUNT(*) AS n FROM nodes").fetchone()["n"] == 0


@pytest.mark.parametrize("max_level", [5, 10])
def test_max_level_boundaries_accepted(conn, max_level):
    add_story(conn, max_level)


@pytest.mark.parametrize("max_level", [4, 11])
def test_max_level_outside_5_to_10_rejected(conn, max_level):
    with pytest.raises(db.IntegrityError):
        add_story(conn, max_level)


def test_one_root_per_story(conn):
    story = add_story(conn)
    add_node(conn, story)
    with pytest.raises(db.IntegrityError):
        add_node(conn, story)


def test_one_child_per_slot(conn):
    story = add_story(conn)
    root = add_node(conn, story)
    for slot in ("a", "b", "custom"):
        add_node(conn, story, root, slot, f"choice {slot}", level=2)
    with pytest.raises(db.IntegrityError):
        add_node(conn, story, root, "custom", "a second custom branch", level=2)


def test_unknown_slot_rejected(conn):
    story = add_story(conn)
    root = add_node(conn, story)
    with pytest.raises(db.IntegrityError):
        add_node(conn, story, root, "c", "sneak", level=2)


def test_child_needs_slot_and_choice_text(conn):
    story = add_story(conn)
    root = add_node(conn, story)
    with pytest.raises(db.IntegrityError):
        add_node(conn, story, root, slot=None, choice_text="no slot", level=2)
    with pytest.raises(db.IntegrityError):
        add_node(conn, story, root, slot="a", choice_text=None, level=2)


def test_root_has_no_slot(conn):
    story = add_story(conn)
    with pytest.raises(db.IntegrityError):
        add_node(conn, story, slot="a", choice_text="root with a slot")


def test_choice_text_max_100_chars(conn):
    story = add_story(conn)
    root = add_node(conn, story)
    add_node(conn, story, root, "a", "x" * 100, level=2)
    with pytest.raises(db.IntegrityError):
        add_node(conn, story, root, "b", "x" * 101, level=2)


def test_non_ending_needs_both_options(conn):
    story = add_story(conn)
    with pytest.raises(db.IntegrityError):
        add_node(conn, story, option_b=None)


def test_ending_may_have_no_options(conn):
    story = add_story(conn)
    add_node(conn, story, is_ending=True, option_a=None, option_b=None)


def test_deleting_story_deletes_its_nodes(conn):
    story = add_story(conn)
    root = add_node(conn, story)
    add_node(conn, story, root, "a", "Go left", level=2)
    conn.execute("DELETE FROM stories WHERE id = %s", (story,))
    assert conn.execute("SELECT COUNT(*) AS n FROM nodes").fetchone()["n"] == 0
