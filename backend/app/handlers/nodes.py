from fastapi import APIRouter

from app import db, schemas
from app.services import nodes

router = APIRouter()


@router.get("/api/nodes/{node_id}", response_model=schemas.NodeView)
def get_node(node_id: int, conn: db.DB):
    return nodes.get_node_view(conn, node_id)
