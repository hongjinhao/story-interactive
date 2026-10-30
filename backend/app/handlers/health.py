from fastapi import APIRouter, Response

from app import db

router = APIRouter()


@router.get("/api/health")
def health(response: Response):
    if not db.ping():
        response.status_code = 503
        return {"status": "database unreachable", "db": db.kind()}
    return {"status": "ok", "db": db.kind()}
