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
