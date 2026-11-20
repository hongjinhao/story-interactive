import random

from app import db, errors, llm
from app.repositories import nodes, stories

MIN_LEVELS, MAX_LEVELS = 5, 10


def create_story(conn, idea: str, theme: str) -> dict:
    """R1: the LLM writes the title, opening passage and two options; save story + root together.
    R8: the story keeps the theme it was created in, and the narrator writes in that theme's mood."""
    max_level = random.randint(MIN_LEVELS, MAX_LEVELS)
    # Generate before the transaction: never hold one open while waiting on the LLM.
    opening = llm.start_story(idea, max_level, theme=theme)
    with db.transaction(conn):
        story = stories.insert(conn, opening.title, idea, theme, max_level)
        root = nodes.insert(
            conn,
            story_id=story["id"],
            level=1,
            content=opening.content,
            option_a=opening.option_a,
            option_b=opening.option_b,
        )
    return {**story, "root_node_id": root["id"]}


def list_stories(conn) -> list[dict]:
    return stories.list_all(conn)


def get_story(conn, story_id: int) -> dict:
    story = stories.get(conn, story_id)
    if story is None:
        raise errors.NotFound(f"Story {story_id} not found.")
    return story
