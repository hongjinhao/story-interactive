from fastapi import APIRouter

from app import db, schemas
from app.services import stories

router = APIRouter()


@router.post("/api/stories", status_code=201, response_model=schemas.Story)
def create_story(body: schemas.StoryCreate, conn: db.DB):
    return stories.create_story(conn, body.idea)


@router.get("/api/stories", response_model=list[schemas.Story])
def list_stories(conn: db.DB):
    return stories.list_stories(conn)


@router.get("/api/stories/{story_id}", response_model=schemas.Story)
def get_story(story_id: int, conn: db.DB):
    return stories.get_story(conn, story_id)
