from fastapi import APIRouter

from app import db, schemas
from app.services import stories

router = APIRouter()


@router.post("/api/stories", status_code=201, response_model=schemas.Story)
def create_story(body: schemas.StoryCreate, conn: db.DB):
    return stories.create_story(conn, body.idea)
