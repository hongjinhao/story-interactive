def insert(conn, *, story_id: int, level: int, content: str, option_a: str | None,
           option_b: str | None, is_ending: bool = False, parent_id: int | None = None,
           slot: str | None = None, choice_text: str | None = None) -> dict:
    row = conn.execute(
        """INSERT INTO nodes (story_id, parent_id, slot, choice_text, level, content,
                              option_a, option_b, is_ending)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
           RETURNING *""",
        (story_id, parent_id, slot, choice_text, level, content, option_a, option_b, is_ending),
    ).fetchone()
    return dict(row)


def get(conn, node_id: int) -> dict | None:
    """The node plus its story's title and max_level."""
    row = conn.execute(
        """SELECT n.*, s.title AS story_title, s.max_level
           FROM nodes n
           JOIN stories s ON s.id = n.story_id
           WHERE n.id = %s""",
        (node_id,),
    ).fetchone()
    return dict(row) if row else None


def children(conn, node_id: int) -> list[dict]:
    rows = conn.execute(
        "SELECT id, slot, choice_text FROM nodes WHERE parent_id = %s", (node_id,)
    ).fetchall()
    return [dict(row) for row in rows]
