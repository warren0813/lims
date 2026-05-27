# syntax=docker/dockerfile:1.7
#
# Self-contained Prometheus image for the LIMS observability stack on Railway.
# The scrape config lives in this repo so changes go through PR review and
# survive Railway service rebuilds — unlike the Tinybox template default
# which bakes prometheus.yml into an opaque upstream image.

FROM prom/prometheus:v3.5.0

COPY prometheus.yml /etc/prometheus/prometheus.yml

EXPOSE 9090

# Match the upstream image's CMD but add --web.enable-lifecycle so we can
# trigger a hot config reload via `curl -X POST .../-/reload` instead of
# restarting the service.
CMD ["--config.file=/etc/prometheus/prometheus.yml", \
     "--storage.tsdb.path=/prometheus", \
     "--storage.tsdb.retention.time=15d", \
     "--web.console.libraries=/usr/share/prometheus/console_libraries", \
     "--web.console.templates=/usr/share/prometheus/consoles", \
     "--web.enable-lifecycle"]
