"""Django Ninja routers for reports endpoints (equipment utilization, request statistics)."""

from datetime import date, timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.http import HttpRequest
from django.utils import timezone
from ninja import Query, Router

from api.schemas import ErrorOut
from apps.accounts.auth import JWTAuth
from apps.accounts.models import Role, UserProfile
from apps.commissions.models import Request, RequestStatus
from apps.reports.schemas import (
    EquipmentUtilizationOut,
    RequestStatisticsOut,
    TrendsOut,
)
from apps.wip.models import Dispatch

router = Router(tags=["Reports"], auth=JWTAuth())


def _is_lab_manager(request: HttpRequest) -> bool:
    """Return True only if the authenticated user has the lab_manager role."""
    try:
        role = request.auth.profile.role
    except (UserProfile.DoesNotExist, AttributeError):
        return False
    return role == Role.LAB_MANAGER


@router.get(
    "/equipment-utilization",
    response={200: EquipmentUtilizationOut, 403: ErrorOut},
)
def equipment_utilization(
    request: HttpRequest,
    period: str = Query(...),  # noqa: B008
    start_date: date = Query(...),  # noqa: B008
    end_date: date = Query(...),  # noqa: B008
    equipment_id: int | None = Query(None),  # noqa: B008
) -> tuple:
    """Return equipment utilization statistics. Lab Manager only."""
    if not _is_lab_manager(request):
        return 403, {"detail": "Permission denied"}

    # Build dispatch queryset filtered by date range.
    dispatch_qs = Dispatch.objects.filter(
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    )
    if equipment_id is not None:
        dispatch_qs = dispatch_qs.filter(equipment_id=equipment_id)

    # Aggregate per equipment: wip_count = number of dispatches,
    # sample_count = distinct WIP count (proxy for batch count).
    aggregated = (
        dispatch_qs.values("equipment_id", "equipment__name")
        .annotate(
            wip_count=Count("id"),
            sample_count=Count("wip_id", distinct=True),
        )
        .order_by("equipment_id")
    )

    data = [
        {
            "equipment": {
                "id": row["equipment_id"],
                "name": row["equipment__name"],
            },
            "wip_count": row["wip_count"],
            "sample_count": row["sample_count"],
        }
        for row in aggregated
    ]

    return 200, {
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "data": data,
    }


@router.get(
    "/request-statistics",
    response={200: RequestStatisticsOut, 403: ErrorOut},
)
def request_statistics(
    request: HttpRequest,
    start_date: date = Query(...),  # noqa: B008
    end_date: date = Query(...),  # noqa: B008
) -> tuple:
    """Return request statistics for a date range. Lab Manager only."""
    if not _is_lab_manager(request):
        return 403, {"detail": "Permission denied"}

    base_qs = Request.objects.filter(
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    )

    total_requests = base_qs.count()

    # Build status distribution (only statuses with at least one request).
    status_rows = (
        base_qs.values("status")
        .annotate(count=Count("id"))
        .filter(count__gt=0)
        .order_by("status")
    )
    status_distribution = {row["status"]: row["count"] for row in status_rows}

    # Average TAT for completed/closed requests (created_at → updated_at), in hours.
    terminal_statuses = [RequestStatus.COMPLETED, RequestStatus.CLOSED]
    terminal_requests = list(
        base_qs.filter(status__in=terminal_statuses).values("created_at", "updated_at")
    )

    avg_tat_hours: float | None = None
    if terminal_requests:
        total_seconds = sum(
            (row["updated_at"] - row["created_at"]).total_seconds()
            for row in terminal_requests
        )
        avg_seconds = total_seconds / len(terminal_requests)
        avg_tat_hours = round(avg_seconds / 3600, 1)

    return 200, {
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "status_distribution": status_distribution,
        "average_tat_hours": avg_tat_hours,
        "total_requests": total_requests,
    }


# Trend metrics — extend this set as more series are added.
_TREND_METRICS = {"requests_per_day"}


@router.get("/trends", response={200: TrendsOut, 400: ErrorOut, 403: ErrorOut})
def trends(
    request: HttpRequest,
    metric: str = Query(...),  # noqa: B008
    days: int = Query(30, ge=1, le=365),  # noqa: B008
):
    """Return a per-day count series for the requested metric.

    INTEGRATION_GAPS §4: backs the lab manager dashboard trend chart.
    Currently only ``requests_per_day`` (Request rows grouped by
    created_at::date) is supported; the metric set is centralised in
    _TREND_METRICS so adding new series is one-line.

    Zero-fills days with no rows so the SPA can plot a continuous
    series of length ``days`` without client-side gap filling.
    """
    if not _is_lab_manager(request):
        return 403, {"detail": "Permission denied"}

    if metric not in _TREND_METRICS:
        return 400, {"detail": f"Unknown metric '{metric}'"}

    end_day = timezone.now().date()
    start_day = end_day - timedelta(days=days - 1)

    rows = (
        Request.objects.filter(created_at__date__gte=start_day)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(count=Count("id"))
    )
    counts_by_day = {row["day"]: row["count"] for row in rows}

    points = []
    for offset in range(days):
        d = start_day + timedelta(days=offset)
        points.append({"date": d.isoformat(), "count": counts_by_day.get(d, 0)})

    return 200, {"metric": metric, "days": days, "points": points}
