"""The adapter's own behaviour, with the xAI client replaced (no network)."""

import json
from types import SimpleNamespace
from typing import get_args

import grpc
import pytest

from app import errors, llm, schemas

GOOD_OPENING = {
    "title": "The Lantern Road",
    "content": "Fog rolls over the road...",
    "option_a": "Follow the lantern",
    "option_b": "Hide in the ditch",
}


class FakeRpcError(grpc.RpcError):
    def __init__(self, code: grpc.StatusCode):
        self._code = code

    def code(self) -> grpc.StatusCode:
        return self._code


def use_client(monkeypatch, answer) -> list[dict]:
    """`answer` is the JSON text the model returns, or an exception the call raises.
    Returns the list that collects each request's kwargs (model, messages)."""
    sent: list[dict] = []

    def parse(shape):
        if isinstance(answer, Exception):
            raise answer
        return None, shape.model_validate_json(answer)

    def create(**kwargs):
        sent.append(kwargs)
        return SimpleNamespace(parse=parse)

    monkeypatch.setattr(llm, "_client", lambda: SimpleNamespace(chat=SimpleNamespace(create=create)))
    return sent


def test_start_story_returns_parsed_opening(monkeypatch):
    use_client(monkeypatch, json.dumps(GOOD_OPENING))
    opening = llm.start_story("a lantern in the fog", 6, theme="halloween")
    assert opening == llm.Opening(**GOOD_OPENING)


def test_deadline_exceeded_raises_generation_timeout(monkeypatch):
    use_client(monkeypatch, FakeRpcError(grpc.StatusCode.DEADLINE_EXCEEDED))
    with pytest.raises(errors.GenerationTimeout):
        llm.start_story("idea", 5, theme="halloween")


def test_other_api_error_raises_generation_failed(monkeypatch):
    use_client(monkeypatch, FakeRpcError(grpc.StatusCode.UNAVAILABLE))
    with pytest.raises(errors.GenerationFailed):
        llm.start_story("idea", 5, theme="halloween")


@pytest.mark.parametrize(
    "answer",
    [
        "not json",
        json.dumps({**GOOD_OPENING, "option_b": None}),
        json.dumps({**GOOD_OPENING, "option_a": "x" * 101}),
        json.dumps({**GOOD_OPENING, "title": "   "}),
    ],
    ids=["not-json", "missing-option", "option-too-long", "blank-title"],
)
def test_answer_that_does_not_fit_raises_generation_failed(monkeypatch, answer):
    use_client(monkeypatch, answer)
    with pytest.raises(errors.GenerationFailed):
        llm.start_story("idea", 5, theme="halloween")


def test_missing_api_key_raises_generation_failed(monkeypatch):
    monkeypatch.delenv("XAI_API_KEY", raising=False)
    llm._client.cache_clear()
    try:
        with pytest.raises(errors.GenerationFailed, match="XAI_API_KEY"):
            llm.start_story("idea", 5, theme="halloween")
    finally:
        llm._client.cache_clear()


PATH = [
    {"level": 1, "choice_text": None, "content": "Fog rolls over the road."},
    {"level": 2, "choice_text": "Follow the lantern", "content": "The lantern bobs ahead."},
]
GOOD_PASSAGE = {"content": "You reach a gate.", "option_a": "Open it", "option_b": "Climb it"}


def test_continue_story_returns_passage_with_story_so_far(monkeypatch):
    sent = use_client(monkeypatch, json.dumps(GOOD_PASSAGE))
    passage = llm.continue_story("a lantern in the fog", PATH, "Run after it", 3, 6, final=False, theme="halloween")
    assert passage == llm.Passage(**GOOD_PASSAGE)
    prompt = str(sent[0]["messages"][1])
    for part in ("a lantern in the fog", "Passage 1: Fog rolls over the road.",
                 "Follow the lantern", "Passage 2: The lantern bobs ahead.", "Run after it",
                 "passage 3 of 6"):
        assert part in prompt


def test_final_passage_is_an_ending_without_options(monkeypatch):
    sent = use_client(monkeypatch, json.dumps({"content": "The fog lifts. The end."}))
    ending = llm.continue_story("idea", PATH, "Run after it", 6, 6, final=True, theme="halloween")
    assert ending == llm.Ending(content="The fog lifts. The end.")
    assert "final passage" in str(sent[0]["messages"][1])


def test_non_final_answer_without_options_raises_generation_failed(monkeypatch):
    use_client(monkeypatch, json.dumps({"content": "The fog lifts."}))
    with pytest.raises(errors.GenerationFailed):
        llm.continue_story("idea", PATH, "Run after it", 3, 6, final=False, theme="halloween")


# Narrator mood per theme (SPECS-2.md, theme-specs/)


def test_every_theme_has_a_mood_line():
    assert set(get_args(schemas.ThemeId)) == set(llm.MOODS)


@pytest.mark.parametrize("theme, other", [("halloween", "christmas"), ("christmas", "halloween")])
def test_system_prompt_carries_only_the_story_themes_mood(monkeypatch, theme, other):
    sent = use_client(monkeypatch, json.dumps(GOOD_OPENING))
    llm.start_story("idea", 5, theme=theme)
    sent_passage = use_client(monkeypatch, json.dumps(GOOD_PASSAGE))
    llm.continue_story("idea", PATH, "Run after it", 3, 6, final=False, theme=theme)
    for request in (sent[0], sent_passage[0]):
        system_prompt = str(request["messages"][0])
        assert llm.MOODS[theme] in system_prompt
        assert llm.MOODS[other] not in system_prompt
        assert "choose-your-own-adventure" in system_prompt  # the shared prompt is still there


def test_shared_prompt_no_longer_leans_eerie():
    assert "eerie" not in llm.SYSTEM_PROMPT
