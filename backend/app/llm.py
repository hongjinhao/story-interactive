"""The LLM adapter, the only module that talks to xAI. Like db.py it knows no tables.

Each function returns a validated Pydantic object. A timeout raises GenerationTimeout;
any other API error or an answer that doesn't fit the shape raises GenerationFailed.
Services call these as `llm.start_story(...)` so tests can swap them for fakes.
"""

import os
from functools import cache
from typing import Annotated

import grpc
from pydantic import BaseModel, Field, StringConstraints, ValidationError
from xai_sdk import Client
from xai_sdk.chat import system, user

from app import errors

MODEL = "grok-4.20-0309-non-reasoning"  # about 2 s per passage; grok-4.3 took 7-11 s
TIMEOUT_SECONDS = 30  # the UI says "still working" after 10 s; this is when we give up

SYSTEM_PROMPT = """You are the narrator of an interactive choose-your-own-adventure story.
Write in second person, present tense, for a general audience (no graphic gore).
Lean eerie and atmospheric where it suits the player's idea.
Each passage is 80 to 150 words and, unless it is the final one, ends at a moment of decision.
Options are short actions the player can take, each under 80 characters, clearly different
from each other, written as commands (e.g. "Follow the lantern into the woods").
The player may type their own action or a twist for the story: follow it, keeping the story
coherent and suitable for a general audience."""

Option = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class Opening(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    content: str = Field(min_length=1)
    option_a: Option
    option_b: Option


class Passage(BaseModel):
    content: str = Field(min_length=1)
    option_a: Option
    option_b: Option


class Ending(BaseModel):
    content: str = Field(min_length=1)


@cache
def _client() -> Client:
    key = os.environ.get("XAI_API_KEY")
    if not key:
        raise errors.GenerationFailed("The storyteller isn't configured (XAI_API_KEY is not set).")
    return Client(api_key=key, timeout=TIMEOUT_SECONDS)


def _ask[T: BaseModel](shape: type[T], prompt: str) -> T:
    try:
        chat = _client().chat.create(model=MODEL, messages=[system(SYSTEM_PROMPT), user(prompt)])
        _, parsed = chat.parse(shape)
    except grpc.RpcError as e:
        if getattr(e, "code", None) and e.code() == grpc.StatusCode.DEADLINE_EXCEEDED:
            raise errors.GenerationTimeout(
                "The story took too long to arrive. Please try again."
            ) from e
        raise errors.GenerationFailed("The storyteller is unavailable right now. Please try again.") from e
    except ValidationError as e:
        raise errors.GenerationFailed("The storyteller's answer was garbled. Please try again.") from e
    return parsed


def start_story(idea: str, max_level: int) -> Opening:
    return _ask(
        Opening,
        f"The player's story idea: {idea}\n\n"
        f"The story will last {max_level} passages in total. Write passage 1 of {max_level}: "
        "a title under 60 characters, the opening passage, and two options (option_a, option_b).",
    )


def continue_story(idea: str, path: list[dict], choice_text: str, level: int, max_level: int,
                   final: bool) -> Passage | Ending:
    """`path` is the nodes from the root down to the one the player is choosing at, each with
    `level`, `content` and `choice_text` (the choice that led to it, None for the root)."""
    so_far = "\n\n".join(
        (f'The player chose: "{node["choice_text"]}"\n' if node["choice_text"] else "")
        + f"Passage {node['level']}: {node['content']}"
        for node in path
    )
    if final:
        task = (f"Write passage {level} of {max_level}, the final passage: bring the story to a "
                "satisfying ending. No options.")
    else:
        task = f"Write passage {level} of {max_level} and two new options (option_a, option_b)."
    return _ask(
        Ending if final else Passage,
        f"The player's story idea: {idea}\n\nThe story so far:\n\n{so_far}\n\n"
        f'The player now chooses: "{choice_text}"\n\n{task}',
    )
