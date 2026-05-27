"""Smoke tests for the LGTM observability wiring.

These tests pin the contract that the /metrics endpoint is exposed and the
observability module is import-safe with no env vars set.
"""

from django.test import Client

from config import observability


def test_metrics_endpoint_returns_prometheus_text() -> None:
    """/metrics returns Prometheus text format that scrapers can parse."""
    client = Client()
    response = client.get("/metrics")
    assert response.status_code == 200
    body = response.content.decode()
    # The exposition format always starts each metric with a HELP line.
    assert "# HELP" in body
    # django-prometheus' built-in counter that should always be present.
    assert "django_http_responses_total_by_status_total" in body


def test_setup_tracing_is_noop_without_endpoint(monkeypatch) -> None:
    """setup_tracing() must be a safe no-op when OTEL endpoint is unset."""
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    # Reset the module-level guard so we exercise the early return path.
    monkeypatch.setattr(observability, "_tracing_initialized", False)
    observability.setup_tracing()  # Should not raise.


def test_loki_handler_config_none_when_unset(monkeypatch) -> None:
    monkeypatch.delenv("LOKI_URL", raising=False)
    assert observability.loki_handler_config() is None


def test_loki_handler_config_includes_url_when_set(monkeypatch) -> None:
    monkeypatch.setenv("LOKI_URL", "http://loki.example:3100/loki/api/v1/push")
    handler = observability.loki_handler_config()
    assert handler is not None
    assert handler["url"] == "http://loki.example:3100/loki/api/v1/push"
    assert handler["class"] == "logging_loki.LokiHandler"
