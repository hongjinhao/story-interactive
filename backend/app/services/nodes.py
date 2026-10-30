from app import errors
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
