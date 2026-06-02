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
    DispatchResultsOut,
    EquipmentUtilizationOut,
    RequestStatisticsOut,
    TrendsOut,
)
from apps.reports.services import (
    dispatch_result_rows,
    equipment_utilization_rows,
    equipment_utilization_trend,
)

_PERMISSION_DENIED = "Permission denied"

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
    response={200: EquipmentUtilizationOut, 400: ErrorOut, 403: ErrorOut},
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
        return 403, {"detail": _PERMISSION_DENIED}

    try:
        data = equipment_utilization_rows(start_date, end_date, equipment_id)
    except ValueError as exc:
        return 400, {"detail": str(exc)}

    return 200, {
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "data": data,
    }


@router.get(
    "/dispatch-results",
    response={200: DispatchResultsOut, 400: ErrorOut, 403: ErrorOut},
)
def dispatch_results(
    request: HttpRequest,
    start_date: date = Query(...),  # noqa: B008
    end_date: date = Query(...),  # noqa: B008
) -> tuple:
    """Return dispatch status/result rows for the selected date range."""
    if not _is_lab_manager(request):
        return 403, {"detail": _PERMISSION_DENIED}

    try:
        data = dispatch_result_rows(start_date, end_date)
    except ValueError as exc:
        return 400, {"detail": str(exc)}

    return 200, {
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
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
        return 403, {"detail": _PERMISSION_DENIED}

    base_qs = Request.objects.filter(
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    )
    request_rows_qs = (
        base_qs.select_related("requester")
        .prefetch_related("request_experiments__experiment_type")
        .annotate(sample_count=Count("samples", distinct=True))
        .order_by("-created_at", "-id")
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

    request_rows = []
    for req in request_rows_qs:
        request_rows.append(
            {
                "id": req.pk,
                "title": req.title,
                "status": req.status,
                "urgency": req.urgency,
                "requester": req.requester.username,
                "sample_count": req.sample_count,
                "experiment_types": [
                    re.experiment_type.name for re in req.request_experiments.all()
                ],
                "submitted_at": req.submitted_at.isoformat()
                if req.submitted_at
                else None,
                "created_at": req.created_at.isoformat(),
                "updated_at": req.updated_at.isoformat(),
            }
        )

    return 200, {
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "status_distribution": status_distribution,
        "average_tat_hours": avg_tat_hours,
        "total_requests": total_requests,
        "requests": request_rows,
    }


# Trend metrics — extend this set as more series are added.
_TREND_METRICS = {"requests_per_day", "equipment_utilization_per_day"}


@router.get("/trends", response={200: TrendsOut, 400: ErrorOut, 403: ErrorOut})
def trends(
    request: HttpRequest,
    metric: str = Query(...),  # noqa: B008
    days: int = Query(30, ge=1, le=365),  # noqa: B008
):
    """Return a per-day count series for the requested metric.

    INTEGRATION_GAPS §4: backs the lab manager dashboard trend chart.
    Supports request counts and real equipment utilization. The latter
    returns daily dispatch counts plus busy-time ratios calculated from
    equipment reservation intervals.

    Zero-fills days with no rows so the SPA can plot a continuous
    series of length ``days`` without client-side gap filling.
    """
    if not _is_lab_manager(request):
        return 403, {"detail": _PERMISSION_DENIED}

    if metric not in _TREND_METRICS:
        return 400, {"detail": f"Unknown metric '{metric}'"}

    end_day = timezone.now().date()
    start_day = end_day - timedelta(days=days - 1)

    if metric == "equipment_utilization_per_day":
        points = equipment_utilization_trend(start_day, end_day)
    else:
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
