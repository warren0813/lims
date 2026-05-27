# Prometheus (LIMS observability stack)

Self-hosted Prometheus deployment for Railway. The scrape config lives in
this repo so it can be reviewed, versioned, and reproduced. This replaces
the Tinybox Grafana-stack template's bundled Prometheus (which bakes
`prometheus.yml` into an opaque image).

## What gets scraped

- `prometheus` — Prometheus self-monitoring (`localhost:9090`)
- `lims-backend` — Django metrics from `django-prometheus`
  (`/metrics` on `lims-backend.railway.internal:8000`)

Add more scrape targets by editing `prometheus.yml` and merging a PR.

## One-time Railway setup

Switch the existing Prometheus service from the Tinybox template image to
this directory. The volume (`prometheus-volume` with TSDB data) is kept.

1. Open the Prometheus service in Railway.
2. **Settings** -> **Source** -> change to:
   - **Repository**: `c-cf/lims-backend`
   - **Branch**: `main`
   - **Root Directory**: `infra/prometheus`
3. **Settings** -> **Build & Deploy** -> set **Watch Paths**:
   ```
   infra/prometheus/**
   ```
   Without this, every push to `lims-backend` triggers a Prometheus
   rebuild even when nothing relevant changed.
4. **Settings** -> **Volume** -> confirm mount path is `/prometheus`
   (matches `--storage.tsdb.path` in the Dockerfile CMD). If the existing
   volume is mounted elsewhere, either change it here or update the
   Dockerfile flag.
5. **Deploy** -> Railway rebuilds Prometheus from this directory.

## Required configuration on the `lims-backend` service

The scrape config assumes the Django service listens on port `8000` on the
internal network. Pin that port explicitly:

- Open the `lims-backend` service -> **Variables** -> add:
  ```
  PORT=8000
  ```

Railway routes external traffic regardless of `PORT`, but internal service
discovery (`*.railway.internal`) targets whatever port the container
binds. Without `PORT=8000`, Railway picks a dynamic port and Prometheus
scrapes nothing.

If you prefer a different port, update both `PORT` on the Django service
and the `targets:` line in `prometheus.yml`.

## Verifying after deploy

After Prometheus redeploys, check in Grafana:

```
Explore -> Prometheus -> query: up{job="lims-backend"}
```

Expected value `1`. If `0`, the scrape failed — open Prometheus' targets
page (`/targets` on its public domain) to see the error.

To hot-reload the config without restarting the service after editing
`prometheus.yml`:

```
curl -X POST https://<prometheus-public-domain>/-/reload
```

## Why a custom Dockerfile (and not just env vars)

Prometheus has no env-var-driven config — it reads a YAML file and that's
it. The only ways to inject our scrape config into the Tinybox image are:

1. Mount a config volume populated some other way (Railway has no
   first-class config-file mount).
2. Build our own image that bakes the config in (this approach).

Option 2 keeps the config diffable in git and rebuilds reproducibly. The
upstream image is pinned to a specific `prom/prometheus` tag so security
updates are explicit, not silent.
