"""Ninja schemas for the reports app."""

from __future__ import annotations

from ninja import Schema


class DateRangeOut(Schema):
    """Date range nested in report responses."""

    start_date: str
    end_date: str


# --- Equipment Utilization schemas ---


class EquipmentBriefOut(Schema):
    """Brief equipment info nested in utilization responses."""

    id: int
    name: str


class EquipmentUtilizationEntryOut(Schema):
    """Per-equipment utilization entry."""

    equipment: EquipmentBriefOut
    busy_seconds: float
    available_seconds: float
    utilization_pct: float
    dispatch_count: int
    wip_count: int
    sample_count: int


class EquipmentUtilizationOut(Schema):
    """Output schema for the equipment-utilization endpoint."""

    period: str
    start_date: str
    end_date: str
    data: list[EquipmentUtilizationEntryOut]


# --- Dispatch result report schemas ---


class DispatchResultEntryOut(Schema):
    """One dispatch row in the manager dispatch-result report."""

    id: int
    wip_id: int
    status: str
    equipment: EquipmentBriefOut
    experiment_type: EquipmentBriefOut
    recipe: EquipmentBriefOut
    request_ids: list[int]
    request_titles: list[str]
    sample_count: int
    pass_count: int
    fail_count: int
    operator: str | None
    dispatched_at: str | None
    completed_at: str | None
    duration_seconds: float | None
    result_comment: str


class DispatchResultsOut(Schema):
    """Output schema for the dispatch-result report endpoint."""

    period: DateRangeOut
    data: list[DispatchResultEntryOut]


class RequestStatisticsEntryOut(Schema):
    """One request row in the manager request-statistics report."""

    id: int
    title: str
    status: str
    urgency: str
    requester: str
    sample_count: int
    experiment_types: list[str]
    submitted_at: str | None
    created_at: str
    updated_at: str


class RequestStatisticsOut(Schema):
    """Output schema for the request-statistics endpoint."""

    period: DateRangeOut
    status_distribution: dict[str, int]
    average_tat_hours: float | None
    total_requests: int
    requests: list[RequestStatisticsEntryOut]


# --- Trends schemas ---


class TrendPointOut(Schema):
    """One day's count on a trend series."""

    date: str
    count: int
    utilization_pct: float | None = None


class TrendsOut(Schema):
    """Output schema for the trends endpoint."""

    metric: str
    days: int
    points: list[TrendPointOut]
