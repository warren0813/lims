"""Proxy models for the reports app admin interface.

Reports has no data models of its own; these proxies provide admin entry points
for the equipment utilization and request statistics report pages.
"""

from apps.commissions.models import Request
from apps.wip.models import Dispatch


class EquipmentUtilizationReport(Dispatch):
    """Proxy of Dispatch used solely to host the equipment utilization admin page."""

    class Meta:
        proxy = True
        verbose_name = "Equipment Utilization Report"
        verbose_name_plural = "Equipment Utilization Reports"


class RequestStatisticsReport(Request):
    """Proxy of Request used solely to host the request statistics admin page."""

    class Meta:
        proxy = True
        verbose_name = "Request Statistics Report"
        verbose_name_plural = "Request Statistics Reports"
