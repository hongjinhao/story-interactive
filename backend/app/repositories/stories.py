def insert(conn, title: str, idea: str, max_level: int) -> dict:
    row = conn.execute(
        "INSERT INTO stories (title, idea, max_level) VALUES (%s, %s, %s) RETURNING *",
        (title, idea, max_level),
    ).fetchone()
    return dict(row)


_SELECT_WITH_ROOT = """SELECT s.*, n.id AS root_node_id
                       FROM stories s
                       JOIN nodes n ON n.story_id = s.id AND n.parent_id IS NULL"""


def list_all(conn) -> list[dict]:
    """Every story with its root node id, newest first (ties: highest id first)."""
    rows = conn.execute(f"{_SELECT_WITH_ROOT} ORDER BY s.created_at DESC, s.id DESC").fetchall()
    return [dict(row) for row in rows]


def get(conn, story_id: int) -> dict | None:
    row = conn.execute(f"{_SELECT_WITH_ROOT} WHERE s.id = %s", (story_id,)).fetchone()
    return dict(row) if row else None
