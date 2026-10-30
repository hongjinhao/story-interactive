from fastapi import APIRouter, Response

from app import db, schemas
from app.services import nodes

router = APIRouter()


@router.get("/api/nodes/{node_id}", response_model=schemas.NodeView)
def get_node(node_id: int, conn: db.DB):
    return nodes.get_node_view(conn, node_id)


@router.post("/api/nodes/{node_id}/choose", status_code=201, response_model=schemas.NodeView)
def choose(node_id: int, body: schemas.ChooseRequest, response: Response, conn: db.DB):
    """201 when the branch was just generated, 200 when it already existed (a walk)."""
    view, created = nodes.choose(conn, node_id, body.slot, body.text)
    if not created:
        response.status_code = 200
    return view
