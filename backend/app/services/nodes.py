from app import db, errors, llm
from app.repositories import nodes


def get_node_view(conn, node_id: int) -> dict:
    """The node with its options: a and b, plus the custom branch (R5/R6) once one exists.
    Each option carries the child it leads to, or None if nobody has taken it yet."""
    node = nodes.get(conn, node_id)
    if node is None:
        raise errors.NotFound(f"Node {node_id} not found.")
    kids = {kid["slot"]: kid for kid in nodes.children(conn, node_id)}

    options = []
    if not node["is_ending"]:
        for slot in ("a", "b"):
            kid = kids.get(slot)
            options.append(
                {"slot": slot, "text": node[f"option_{slot}"], "child_id": kid["id"] if kid else None}
            )
    custom = kids.get("custom")
    if custom:
        options.append({"slot": "custom", "text": custom["choice_text"], "child_id": custom["id"]})

    return {**node, "options": options, "can_add_custom": not node["is_ending"] and custom is None}


def choose(conn, node_id: int, slot: str, text: str | None) -> tuple[dict, bool]:
    """★ Walk down to the child for this choice if it exists, otherwise generate it (R2).
    Returns (child view, created)."""
    node = nodes.get(conn, node_id)
    if node is None:
        raise errors.NotFound(f"Node {node_id} not found.")
    if node["is_ending"]:
        raise errors.RuleViolation("This tale has ended. Walk back up to choose a different path.")
    choice_text = text if slot == "custom" else node[f"option_{slot}"]

    existing = nodes.child(conn, node_id, slot)
    if existing:
        return _walk_to(conn, existing, choice_text), False

    # R3: the node at max_level is the ending.
    level = node["level"] + 1
    is_ending = level == node["max_level"]
    # Generate before writing: never hold a transaction open while waiting on the LLM (R7).
    passage = llm.continue_story(
        node["idea"], nodes.path_to_root(conn, node_id), choice_text, level, node["max_level"],
        final=is_ending,
    )
    try:
        created = nodes.insert(
            conn, story_id=node["story_id"], parent_id=node_id, slot=slot, choice_text=choice_text,
            level=level, content=passage.content, is_ending=is_ending,
            option_a=None if is_ending else passage.option_a,
            option_b=None if is_ending else passage.option_b,
        )
    except db.IntegrityError:
        # Another request created this branch while we were generating: UNIQUE (parent_id, slot)
        # kept theirs, so treat it as if it had been there all along.
        existing = nodes.child(conn, node_id, slot)
        if existing is None:
            raise
        return _walk_to(conn, existing, choice_text), False
    return get_node_view(conn, created["id"]), True


def _walk_to(conn, child: dict, choice_text: str) -> dict:
    # R5: one custom branch per node. The same text (ignoring case) walks to it.
    if child["slot"] == "custom" and child["choice_text"].casefold() != choice_text.casefold():
        raise errors.Conflict(
            f"This path already has a custom branch: \"{child['choice_text']}\". "
            "Choose it, or pick one of the other options."
        )
    return get_node_view(conn, child["id"])
