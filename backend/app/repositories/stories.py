def insert(conn, title: str, idea: str, theme: str, max_level: int) -> dict:
    row = conn.execute(
        "INSERT INTO stories (title, idea, theme, max_level) VALUES (%s, %s, %s, %s) RETURNING *",
        (title, idea, theme, max_level),
    ).fetchone()
    return dict(row)


_SELECT_WITH_ROOT = """SELECT s.*, n.id AS root_node_id
                       FROM stories s
                       JOIN nodes n ON n.story_id = s.id AND n.parent_id IS NULL"""


_NEWEST_FIRST = "ORDER BY s.created_at DESC, s.id DESC"


def list_all(conn, theme: str | None = None) -> list[dict]:
    """Stories with their root node id, newest first (ties: highest id first).
    With `theme`, only that theme's stories (its story bank); without, every story."""
    if theme is None:
        rows = conn.execute(f"{_SELECT_WITH_ROOT} {_NEWEST_FIRST}").fetchall()
    else:
        rows = conn.execute(
            f"{_SELECT_WITH_ROOT} WHERE s.theme = %s {_NEWEST_FIRST}", (theme,)
        ).fetchall()
    return [dict(row) for row in rows]


def get(conn, story_id: int) -> dict | None:
    row = conn.execute(f"{_SELECT_WITH_ROOT} WHERE s.id = %s", (story_id,)).fetchone()
    return dict(row) if row else None
