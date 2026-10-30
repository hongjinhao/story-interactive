import pytest

from app import errors
from app.main import app


@pytest.mark.parametrize(
    ("error", "status"),
    [
        (errors.NotFound, 404),
        (errors.Conflict, 409),
        (errors.RuleViolation, 400),
        (errors.GenerationFailed, 502),
        (errors.GenerationTimeout, 504),
    ],
)
def test_domain_error_maps_to_status(client, error, status):
    def boom():
        raise error("nope")

    app.add_api_route("/api/_boom", boom)
    try:
        r = client.get("/api/_boom")
    finally:
        app.router.routes.pop()  # the route just added; keep the app clean for other tests
    assert r.status_code == status
    assert r.json() == {"detail": "nope"}
