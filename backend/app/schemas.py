"""Request and response bodies. Input is trimmed and checked here, at the API boundary."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, StringConstraints

Idea = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]


class StoryCreate(BaseModel):
    idea: Idea


class Story(BaseModel):
    id: int
    title: str
    idea: str
    max_level: int
    root_node_id: int
    created_at: datetime
