import random

from app import db, llm
from app.repositories import nodes, stories

MIN_LEVELS, MAX_LEVELS = 5, 10


def create_story(conn, idea: str) -> dict:
    """R1: the LLM writes the title, opening passage and two options; save story + root together."""
    max_level = random.randint(MIN_LEVELS, MAX_LEVELS)
    # Generate before the transaction: never hold one open while waiting on the LLM.
    opening = llm.start_story(idea, max_level)
    with db.transaction(conn):
        story = stories.insert(conn, opening.title, idea, max_level)
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
