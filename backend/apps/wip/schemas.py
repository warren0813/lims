"""Ninja schemas for the wip app."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from ninja import Field, Schema

from apps.commissions.schemas import RequesterOut

if TYPE_CHECKING:
    from apps.wip.models import WIP, Dispatch


# --- Nested output schemas ---


class SampleBriefOut(Schema):
    """Brief sample info nested in WIP responses."""

    id: int
    wafer_id: str
    wafer_size: str
    status: str
    request_id: int


class DispatchBriefOut(Schema):
    """Brief dispatch info nested in WIP responses."""

    id: int
    experiment_type_id: int
    experiment_type_name: str
    equipment_id: int
    equipment_name: str
    recipe_id: int
    recipe_name: str
    status: str
    estimated_duration_seconds: int | None
    dispatched_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


class ExperimentResultOut(Schema):
    """Experiment result details nested in dispatch responses.

    Pass/fail verdict lives per-wafer on SampleExperimentStatus.verdict
    (exposed via SampleExperimentStatusOut + the sample-experiments
    rollup). This block only carries the dispatch-level operator
    comment.
    """

    id: int
    comment: str
    created_at: datetime


# --- WIP input schemas ---


class WIPIn(Schema):
    """Input schema for creating a WIP.

    Chat-design: a WIP is bound to one experiment_type at creation time.
    Equipment is chosen later, per dispatch.
    """

    sample_ids: list[int] = Field(..., min_length=1)
    experiment_type_id: int
    note: str = ""


class WIPAddSamplesIn(Schema):
    """Input schema for adding samples to an existing WIP."""

    sample_ids: list[int] = Field(..., min_length=1)


# --- Dispatch input schemas ---


class DispatchIn(Schema):
    """Input schema for creating a dispatch.

    Chat-design: experiment_type is derived from the parent WIP; the
    payload only carries the per-dispatch choices (equipment + recipe).
    estimated_duration_seconds is optional — operators can leave it
    blank, and the SPA falls back to a hardcoded 24h countdown.
    Seconds (not minutes) so demo scenarios can specify sub-minute runs.
    """

    equipment_id: int
    recipe_id: int
    note: str = ""
    estimated_duration_seconds: int | None = Field(None, gt=0)


class RecordResultIn(Schema):
    """Input schema for recording a dispatch result.

    Server randomises the per-wafer verdict (80% pass / 20% fail) — the
    client never sends one. extra="forbid" so stale clients still
    posting verdict/data/summary fail loudly (422) instead of silently
    losing those fields' intent.
    """

    comment: str = ""

    class Config:
        extra = "forbid"


class ExceptionReportIn(Schema):
    """Input schema for reporting a dispatch exception."""

    note: str = ""


class AutomationResultIn(Schema):
    """Input schema for automated equipment result submission.

    Same simplification as the manual record_result path — server
    randomises per-wafer verdict; the equipment integration only needs
    to identify the dispatch and optionally attach a comment string.
    """

    dispatch_id: int
    comment: str = ""

    class Config:
        extra = "forbid"


# --- WIP output schemas ---


class WIPListOut(Schema):
    """Output schema for WIP list responses."""

    id: int
    experiment_type_id: int
    experiment_type_name: str
    sample_count: int
    dispatch_count: int
    status: str
    note: str
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def from_wip(wip: WIP) -> dict:
        """Build a dict from a WIP instance.

        Expects the queryset to annotate ``dispatch_count`` (see
        list_wips in apps/wip/api.py) so the list endpoint doesn't
        incur a per-row COUNT(*). sample_count comes from a count on
        the M2M; we don't annotate it because WIP detail / state
        transition paths reuse this builder without the annotation.
        """
        return {
            "id": wip.pk,
            "experiment_type_id": wip.experiment_type_id,
            "experiment_type_name": wip.experiment_type.name,
            "sample_count": wip.samples.count(),
            "dispatch_count": getattr(wip, "dispatch_count", wip.dispatches.count()),
            "status": wip.status,
            "note": wip.note,
            "completed_at": wip.completed_at,
            "created_at": wip.created_at,
            "updated_at": wip.updated_at,
        }


class WIPDetailOut(Schema):
    """Output schema for WIP detail responses."""

    id: int
    experiment_type_id: int
    experiment_type_name: str
    samples: list[SampleBriefOut]
    status: str
    note: str
    dispatches: list[DispatchBriefOut]
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def from_wip(wip: WIP) -> dict:
        """Build a dict from a WIP instance with nested dispatches and samples."""
        dispatches = []
        for d in wip.dispatches.all():
            dispatches.append(
                {
                    "id": d.pk,
                    "experiment_type_id": d.experiment_type_id,
                    "experiment_type_name": d.experiment_type.name,
                    "equipment_id": d.equipment_id,
                    "equipment_name": d.equipment.name,
                    "recipe_id": d.recipe_id,
                    "recipe_name": d.recipe.name,
                    "status": d.status,
                    "estimated_duration_seconds": d.estimated_duration_seconds,
                    "dispatched_at": d.dispatched_at,
                    "completed_at": d.completed_at,
                    "created_at": d.created_at,
                }
            )
        samples = [
            {
                "id": s.pk,
                "wafer_id": s.wafer_id,
                "wafer_size": s.wafer_size,
                "status": s.status,
                "request_id": s.request_id,
            }
            for s in wip.samples.all()
        ]
        return {
            "id": wip.pk,
            "experiment_type_id": wip.experiment_type_id,
            "experiment_type_name": wip.experiment_type.name,
            "samples": samples,
            "status": wip.status,
            "note": wip.note,
            "dispatches": dispatches,
            "completed_at": wip.completed_at,
            "created_at": wip.created_at,
            "updated_at": wip.updated_at,
        }


# --- Dispatch output schemas ---


def _build_created_by(dispatch: Dispatch) -> dict | None:
    """Shape a Dispatch.created_by user into RequesterOut form.

    Returns None if created_by is unset (defensive — the FK is non-null
    on the model, but ORM instances created in some test paths could
    plausibly leave it dangling, and we'd rather render a null operator
    than 500). department falls back to '' when the user has no profile.
    """
    user = dispatch.created_by
    if user is None:
        return None
    profile = getattr(user, "profile", None)
    return {
        "id": user.pk,
        "username": user.username,
        "department": profile.department if profile else "",
    }


class DispatchDetailOut(Schema):
    """Output schema for dispatch detail responses."""

    id: int
    wip_id: int
    experiment_type_id: int
    experiment_type_name: str
    equipment_id: int
    equipment_name: str
    recipe_id: int
    recipe_name: str
    status: str
    note: str
    estimated_duration_seconds: int | None
    dispatched_at: datetime | None
    completed_at: datetime | None
    result: ExperimentResultOut | None
    created_by: RequesterOut | None
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def from_dispatch(dispatch: Dispatch) -> dict:
        """Build a dict from a Dispatch instance."""
        result = None
        if hasattr(dispatch, "result"):
            r = dispatch.result
            result = {
                "id": r.pk,
                "comment": r.comment,
                "created_at": r.created_at,
            }
        return {
            "id": dispatch.pk,
            "wip_id": dispatch.wip_id,
            "experiment_type_id": dispatch.experiment_type_id,
            "experiment_type_name": dispatch.experiment_type.name,
            "equipment_id": dispatch.equipment_id,
            "equipment_name": dispatch.equipment.name,
            "recipe_id": dispatch.recipe_id,
            "recipe_name": dispatch.recipe.name,
            "status": dispatch.status,
            "note": dispatch.note,
            "estimated_duration_seconds": dispatch.estimated_duration_seconds,
            "dispatched_at": dispatch.dispatched_at,
            "completed_at": dispatch.completed_at,
            "result": result,
            "created_by": _build_created_by(dispatch),
            "created_at": dispatch.created_at,
            "updated_at": dispatch.updated_at,
        }


class DispatchListOut(Schema):
    """Output schema for dispatch list responses."""

    id: int
    wip_id: int
    experiment_type_id: int
    equipment_id: int
    recipe_id: int
    status: str
    estimated_duration_seconds: int | None
    dispatched_at: datetime | None
    completed_at: datetime | None
    created_by: RequesterOut | None
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def from_dispatch(dispatch: Dispatch) -> dict:
        """Build a dict from a Dispatch instance for the list response.

        The list endpoint switched from raw queryset auto-serialization
        to an explicit builder once we needed nested created_by — Ninja
        can't infer a {id, username, department} dict from a Django User
        FK on its own."""
        return {
            "id": dispatch.pk,
            "wip_id": dispatch.wip_id,
            "experiment_type_id": dispatch.experiment_type_id,
            "equipment_id": dispatch.equipment_id,
            "recipe_id": dispatch.recipe_id,
            "status": dispatch.status,
            "estimated_duration_seconds": dispatch.estimated_duration_seconds,
            "dispatched_at": dispatch.dispatched_at,
            "completed_at": dispatch.completed_at,
            "created_by": _build_created_by(dispatch),
            "created_at": dispatch.created_at,
            "updated_at": dispatch.updated_at,
        }
