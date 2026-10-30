"""The adapter's own behaviour, with the xAI client replaced (no network)."""

import json
from types import SimpleNamespace

import grpc
import pytest

from app import errors, llm

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


def use_client(monkeypatch, answer):
    """`answer` is the JSON text the model returns, or an exception the call raises."""

    def parse(shape):
        if isinstance(answer, Exception):
            raise answer
        return None, shape.model_validate_json(answer)

    chat = SimpleNamespace(parse=parse)
    client = SimpleNamespace(chat=SimpleNamespace(create=lambda **kwargs: chat))
    monkeypatch.setattr(llm, "_client", lambda: client)


def test_start_story_returns_parsed_opening(monkeypatch):
    use_client(monkeypatch, json.dumps(GOOD_OPENING))
    opening = llm.start_story("a lantern in the fog", 6)
    assert opening == llm.Opening(**GOOD_OPENING)


def test_deadline_exceeded_raises_generation_timeout(monkeypatch):
    use_client(monkeypatch, FakeRpcError(grpc.StatusCode.DEADLINE_EXCEEDED))
    with pytest.raises(errors.GenerationTimeout):
        llm.start_story("idea", 5)


def test_other_api_error_raises_generation_failed(monkeypatch):
    use_client(monkeypatch, FakeRpcError(grpc.StatusCode.UNAVAILABLE))
    with pytest.raises(errors.GenerationFailed):
        llm.start_story("idea", 5)


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
        llm.start_story("idea", 5)


def test_missing_api_key_raises_generation_failed(monkeypatch):
    monkeypatch.delenv("XAI_API_KEY", raising=False)
    llm._client.cache_clear()
    try:
        with pytest.raises(errors.GenerationFailed, match="XAI_API_KEY"):
            llm.start_story("idea", 5)
    finally:
        llm._client.cache_clear()
