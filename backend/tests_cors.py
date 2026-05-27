"""Tests for the dev-only CORS configuration.

CORS is enabled only when DEBUG=True (see config/settings.py). These
tests pin that contract so production deployments don't accidentally
inherit the dev allowlist.
"""

from django.test import Client, override_settings


@override_settings(
    DEBUG=True,
    CORS_ALLOWED_ORIGINS=["http://localhost:8080", "http://127.0.0.1:8080"],
)
def test_options_preflight_returns_cors_header_when_debug():
    """OPTIONS preflight from an allowed origin gets a CORS header back.

    The endpoint chosen is /api/auth/login because it's public (no auth
    needed); the preflight semantics are the same for any DRF/Ninja
    endpoint.
    """
    client = Client()
    response = client.options(
        "/api/auth/login",
        HTTP_ORIGIN="http://localhost:8080",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
    )
    assert response.status_code == 200
    assert response["Access-Control-Allow-Origin"] == "http://localhost:8080"


@override_settings(DEBUG=False, CORS_ALLOWED_ORIGINS=[])
def test_options_preflight_omits_cors_header_in_production():
    """With DEBUG=False and an empty allowlist, no CORS header is sent —
    the SPA is served same-origin via whitenoise in production."""
    client = Client()
    response = client.options(
        "/api/auth/login",
        HTTP_ORIGIN="http://localhost:8080",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
    )
    assert "Access-Control-Allow-Origin" not in response
