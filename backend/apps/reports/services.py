"""Shared equipment-utilization calculations for reports and dashboards."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta

from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.equipment.models import Equipment
from apps.wip.models import Dispatch, DispatchStatus

_OCCUPYING_STATUSES = {
    DispatchStatus.DISPATCHED,
    DispatchStatus.RUNNING,
    DispatchStatus.UNLOADED,
}


def _date_range_bounds(start_date: date, end_date: date) -> tuple[datetime, datetime]:
    """Return the half-open UTC datetime range covering both input dates."""
    if end_date < start_date:
        raise ValueError("end_date must be on or after start_date")
    start = timezone.make_aware(datetime.combine(start_date, time.min))
    end = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), time.min))
    return start, end


def _dispatch_busy_end(dispatch: Dispatch, window_end: datetime) -> datetime:
    """Return the best available end timestamp for one equipment reservation."""
    if dispatch.completed_at is not None:
        return min(dispatch.completed_at, window_end)
    if dispatch.status in _OCCUPYING_STATUSES:
        return window_end
    return min(dispatch.updated_at, window_end)


def _merge_busy_seconds(intervals: list[tuple[datetime, datetime]]) -> float:
    """Return the duration of overlapping intervals without double counting."""
    if not intervals:
        return 0.0
    merged_seconds = 0.0
    current_start, current_end = sorted(intervals)[0]
    for start, end in sorted(intervals)[1:]:
        if start <= current_end:
            current_end = max(current_end, end)
            continue
        merged_seconds += (current_end - current_start).total_seconds()
        current_start, current_end = start, end
    return merged_seconds + (current_end - current_start).total_seconds()


def _dispatches_overlapping(
    window_start: datetime,
    window_end: datetime,
    equipment_ids: list[int] | None = None,
) -> QuerySet[Dispatch]:
    """Return dispatched runs that can overlap the requested time window."""
    qs = (
        Dispatch.objects.filter(
            dispatched_at__isnull=False, dispatched_at__lt=window_end
        )
        .filter(Q(completed_at__isnull=True) | Q(completed_at__gt=window_start))
        .select_related("wip")
        .prefetch_related("wip__samples")
    )
    if equipment_ids is not None:
        qs = qs.filter(equipment_id__in=equipment_ids)
    return qs


def _utilization_rows_for_bounds(
    equipments: list[Equipment],
    dispatches: list[Dispatch],
    window_start: datetime,
    window_end: datetime,
) -> list[dict]:
    """Build per-equipment utilization rows for a half-open datetime window."""
    window_seconds = (window_end - window_start).total_seconds()
    intervals_by_equipment: dict[int, list[tuple[datetime, datetime]]] = defaultdict(
        list
    )
    dispatch_ids_by_equipment: dict[int, set[int]] = defaultdict(set)
    wip_ids_by_equipment: dict[int, set[int]] = defaultdict(set)
    sample_ids_by_equipment: dict[int, set[int]] = defaultdict(set)

    for dispatch in dispatches:
        if dispatch.dispatched_at is None:
            continue
        start = max(dispatch.dispatched_at, window_start)
        end = _dispatch_busy_end(dispatch, window_end)
        if end <= start:
            continue
        equipment_id = dispatch.equipment_id
        intervals_by_equipment[equipment_id].append((start, end))
        dispatch_ids_by_equipment[equipment_id].add(dispatch.pk)
        wip_ids_by_equipment[equipment_id].add(dispatch.wip_id)
        sample_ids_by_equipment[equipment_id].update(
            sample.pk for sample in dispatch.wip.samples.all()
        )

    rows = []
    for equipment in equipments:
        busy_seconds = _merge_busy_seconds(intervals_by_equipment[equipment.pk])
        available_seconds = max(window_seconds - busy_seconds, 0.0)
        rows.append(
            {
                "equipment": {"id": equipment.pk, "name": equipment.name},
                "busy_seconds": round(busy_seconds, 1),
                "available_seconds": round(available_seconds, 1),
                "utilization_pct": (
                    round(busy_seconds / window_seconds * 100, 1)
                    if window_seconds
                    else 0.0
                ),
                "dispatch_count": len(dispatch_ids_by_equipment[equipment.pk]),
                "wip_count": len(wip_ids_by_equipment[equipment.pk]),
                "sample_count": len(sample_ids_by_equipment[equipment.pk]),
            }
        )
    return rows


def equipment_utilization_rows(
    start_date: date,
    end_date: date,
    equipment_id: int | None = None,
) -> list[dict]:
    """Return per-equipment busy-time utilization for an inclusive date range."""
    window_start, window_end = _date_range_bounds(start_date, end_date)
    equipment_qs = Equipment.objects.order_by("name", "pk")
    if equipment_id is not None:
        equipment_qs = equipment_qs.filter(pk=equipment_id)
    equipments = list(equipment_qs)
    dispatches = list(
        _dispatches_overlapping(
            window_start, window_end, [equipment.pk for equipment in equipments]
        )
    )
    return _utilization_rows_for_bounds(
        equipments, dispatches, window_start, window_end
    )


def equipment_utilization_trend(start_date: date, end_date: date) -> list[dict]:
    """Return daily dispatch counts and busy-time utilization percentages."""
    window_start, window_end = _date_range_bounds(start_date, end_date)
    equipments = list(Equipment.objects.order_by("name", "pk"))
    dispatches = list(
        _dispatches_overlapping(
            window_start, window_end, [equipment.pk for equipment in equipments]
        )
    )
    points = []
    day = start_date
    while day <= end_date:
        day_start, day_end = _date_range_bounds(day, day)
        rows = _utilization_rows_for_bounds(equipments, dispatches, day_start, day_end)
        denominator = (day_end - day_start).total_seconds() * len(equipments)
        busy_seconds = sum(row["busy_seconds"] for row in rows)
        points.append(
            {
                "date": day.isoformat(),
                "count": sum(
                    1
                    for dispatch in dispatches
                    if dispatch.dispatched_at is not None
                    and day_start <= dispatch.dispatched_at < day_end
                ),
                "utilization_pct": (
                    round(busy_seconds / denominator * 100, 1) if denominator else 0.0
                ),
            }
        )
        day += timedelta(days=1)
    return points


def dispatch_result_rows(start_date: date, end_date: date) -> list[dict]:
    """Return dispatch result/status rows active in an inclusive date range."""
    window_start, window_end = _date_range_bounds(start_date, end_date)
    dispatches = (
        Dispatch.objects.filter(
            Q(created_at__gte=window_start, created_at__lt=window_end)
            | Q(dispatched_at__gte=window_start, dispatched_at__lt=window_end)
            | Q(completed_at__gte=window_start, completed_at__lt=window_end)
        )
        .select_related(
            "equipment",
            "experiment_type",
            "recipe",
            "created_by",
            "wip",
            "result",
        )
        .prefetch_related(
            "wip__samples__request",
            "sample_experiment_statuses",
        )
        .order_by("-completed_at", "-dispatched_at", "-created_at", "-pk")
    )

    rows = []
    for dispatch in dispatches:
        requests_by_id = {}
        samples = list(dispatch.wip.samples.all())
        for sample in samples:
            requests_by_id[sample.request_id] = sample.request.title

        statuses = list(dispatch.sample_experiment_statuses.all())
        pass_count = sum(1 for status in statuses if status.verdict == "pass")
        fail_count = sum(1 for status in statuses if status.verdict == "fail")
        duration_seconds = (
            (dispatch.completed_at - dispatch.dispatched_at).total_seconds()
            if dispatch.dispatched_at and dispatch.completed_at
            else None
        )
        result = getattr(dispatch, "result", None)
        rows.append(
            {
                "id": dispatch.pk,
                "wip_id": dispatch.wip_id,
                "status": dispatch.status,
                "equipment": {
                    "id": dispatch.equipment_id,
                    "name": dispatch.equipment.name,
                },
                "experiment_type": {
                    "id": dispatch.experiment_type_id,
                    "name": dispatch.experiment_type.name,
                },
                "recipe": {
                    "id": dispatch.recipe_id,
                    "name": dispatch.recipe.name,
                },
                "request_ids": list(requests_by_id.keys()),
                "request_titles": list(requests_by_id.values()),
                "sample_count": len(samples),
                "pass_count": pass_count,
                "fail_count": fail_count,
                "operator": dispatch.created_by.username
                if dispatch.created_by
                else None,
                "dispatched_at": (
                    dispatch.dispatched_at.isoformat()
                    if dispatch.dispatched_at
                    else None
                ),
                "completed_at": (
                    dispatch.completed_at.isoformat() if dispatch.completed_at else None
                ),
                "duration_seconds": round(duration_seconds, 1)
                if duration_seconds is not None
                else None,
                "result_comment": result.comment if result else "",
            }
        )
    return rows
