def insert(conn, title: str, idea: str, max_level: int) -> dict:
    row = conn.execute(
        "INSERT INTO stories (title, idea, max_level) VALUES (%s, %s, %s) RETURNING *",
        (title, idea, max_level),
    ).fetchone()
    return dict(row)
