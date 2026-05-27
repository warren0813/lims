"""Observability bootstrap for the LGTM stack (Prometheus, Loki, Tempo).

All integrations are opt-in via environment variables so local development and
tests are unaffected unless explicitly enabled.

Environment variables:
    METRICS_ENABLED            Enable Prometheus middleware + /metrics endpoint
                               (default: True).
    METRICS_DB_INSTRUMENT      Wrap the DB engine with django-prometheus to
                               record query metrics (default: False — adds
                               overhead).
    OTEL_EXPORTER_OTLP_ENDPOINT  Tempo OTLP endpoint, e.g.
                               http://tempo.railway.internal:4317. When unset,
                               tracing is disabled.
    OTEL_SERVICE_NAME          Service name reported in spans
                               (default: lims-backend).
    LOKI_URL                   Loki push URL, e.g.
                               http://loki.railway.internal:3100/loki/api/v1/push.
                               When unset, Loki handler is not added.
"""

from __future__ import annotations

import os


def metrics_enabled() -> bool:
    return os.environ.get("METRICS_ENABLED", "True") == "True"


def db_instrumentation_enabled() -> bool:
    return os.environ.get("METRICS_DB_INSTRUMENT", "False") == "True"


def tracing_endpoint() -> str | None:
    return os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT") or None


def service_name() -> str:
    return os.environ.get("OTEL_SERVICE_NAME", "lims-backend")


def loki_url() -> str | None:
    return os.environ.get("LOKI_URL") or None


_tracing_initialized = False


def setup_tracing() -> None:
    """Install OpenTelemetry tracing once per process.

    Must be called before Django models/middleware execute their first request
    so that DjangoInstrumentor can wrap the WSGI app. Safe to call multiple
    times — repeat invocations are no-ops.
    """
    global _tracing_initialized
    if _tracing_initialized:
        return

    endpoint = tracing_endpoint()
    if not endpoint:
        return

    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
        OTLPSpanExporter,
    )
    from opentelemetry.instrumentation.django import DjangoInstrumentor
    from opentelemetry.instrumentation.logging import LoggingInstrumentor
    from opentelemetry.instrumentation.psycopg import PsycopgInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    provider = TracerProvider(
        resource=Resource.create({"service.name": service_name()}),
    )
    insecure = endpoint.startswith("http://")
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, insecure=insecure)),
    )
    trace.set_tracer_provider(provider)

    DjangoInstrumentor().instrument()
    PsycopgInstrumentor().instrument(enable_commenter=False)
    # Injects trace_id/span_id into log records so Grafana can pivot
    # logs ↔ traces via the Tempo/Loki correlation.
    LoggingInstrumentor().instrument(set_logging_format=False)

    _tracing_initialized = True


def loki_handler_config() -> dict | None:
    """Return a LOGGING handler dict for Loki, or None when LOKI_URL is unset."""
    url = loki_url()
    if not url:
        return None
    return {
        "class": "logging_loki.LokiHandler",
        "url": url,
        "tags": {"service": service_name()},
        "version": "1",
        "level": os.environ.get("LOKI_LOG_LEVEL", "INFO"),
    }
