from django.contrib import admin
from django.urls import include, path

from api.router import api
from config import observability

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]

# Prometheus scrape target. Registered before apps.web.urls so its
# catch-all does not shadow /metrics.
if observability.metrics_enabled():
    from django_prometheus.exports import ExportToDjangoView

    urlpatterns.append(
        path("metrics", ExportToDjangoView, name="prometheus-django-metrics"),
    )

urlpatterns.append(path("", include("apps.web.urls")))
