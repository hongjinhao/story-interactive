"""Request and response bodies. Input is trimmed and checked here, at the API boundary."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, StringConstraints, model_validator

Idea = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
CustomText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class StoryCreate(BaseModel):
    idea: Idea


class Story(BaseModel):
    id: int
    title: str
    idea: str
    max_level: int
    root_node_id: int
    created_at: datetime


class ChooseRequest(BaseModel):
    slot: Literal["a", "b", "custom"]
    text: CustomText | None = None  # only for "custom"

    @model_validator(mode="after")
    def text_only_for_custom(self):
        if self.slot == "custom" and self.text is None:
            raise ValueError("A custom action needs text (1 to 100 characters).")
        if self.slot != "custom" and self.text is not None:
            raise ValueError("Only a custom action takes text.")
        return self


class NodeOption(BaseModel):
    slot: Literal["a", "b", "custom"]
    text: str
    child_id: int | None  # None until someone takes this choice


class NodeView(BaseModel):
    id: int
    story_id: int
    story_title: str
    parent_id: int | None
    level: int
    max_level: int
    content: str
    is_ending: bool
    options: list[NodeOption]  # a, b, then custom if one exists; [] on an ending
    can_add_custom: bool
