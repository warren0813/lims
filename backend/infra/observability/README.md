# Local observability stack (LGTM)

Opt-in **local** Loki / Grafana / Tempo / Prometheus for development. The app is
already instrumented (`config/observability.py`); this directory only holds the
config for the *backend servers* that collect, store, and visualise the signals.

Production does **not** use this — Railway runs its own LGTM services, and the
production Prometheus lives in [`../prometheus/`](../prometheus/README.md).

## Run it

From the repo root, overlay this stack on the base compose file:

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up
```

Plain `docker compose up` stays lean (postgres + backend + frontend) and starts
none of these. The overlay also sets `OTEL_EXPORTER_OTLP_ENDPOINT` and
`LOKI_URL` on the backend, so tracing/log-push only activate when the stack is up.

| Service | URL | Purpose |
|---------|-----|---------|
| Grafana | http://localhost:3001 | Dashboards / Explore (anonymous, admin role) |
| Prometheus | http://localhost:9090 | Metrics, scrapes `backend:8000/metrics` |
| Tempo | http://localhost:3200 | Trace store, OTLP gRPC on `:4317` |
| Loki | http://localhost:3100 | Log store, backend pushes directly |

Grafana opens with all three datasources pre-provisioned
([`grafana/datasources.yml`](grafana/datasources.yml)) **and** a ready-made
dashboard **LIMS Backend Overview** (folder *LIMS*): request rate by method,
responses by status, p50/p95/p99 latency, a 5xx stat, backend-up, and a live
Loki log panel. Drop more `*.json` dashboards into `grafana/dashboards/` — they
auto-load on startup ([`grafana/dashboards.yml`](grafana/dashboards.yml)).

## Verify the signals

- **Metrics**: Grafana → Explore → Prometheus → `up{job="lims-backend"}` should be `1`.
- **Traces**: hit any API endpoint, then Explore → Tempo → search service `lims-backend`.
- **Logs**: Explore → Loki → `{service="lims-backend"}`.

## Files

| File | What |
|------|------|
| `prometheus-local.yml` | Scrape config targeting the compose `backend` service |
| `tempo.yaml` | Single-binary Tempo with OTLP receiver + local storage |
| `grafana/datasources.yml` | Auto-provisioned Prometheus / Tempo / Loki datasources (fixed uids) |
| `grafana/dashboards.yml` | Dashboard provider — auto-loads everything under `dashboards/` |
| `grafana/dashboards/*.json` | Bundled dashboards (currently `lims-backend-overview.json`) |

Loki runs on its image-bundled `local-config.yaml` (battle-tested defaults), so
there is no Loki config file to drift against version bumps.

## Why an overlay file, not Compose profiles

Profiles can gate which *services* start, but cannot conditionally set env vars
on a shared service. The backend must point at `tempo`/`loki` **only** when they
exist — otherwise the default `docker compose up` path spams connect-retries to
absent collectors. An overlay file adds the services *and* augments the backend
env in one opt-in switch.
