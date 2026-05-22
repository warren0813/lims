"""Ninja schemas for the commissions app."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from ninja import Field, Schema

from apps.commissions.models import RequestUrgency, WaferSize

if TYPE_CHECKING:
    from apps.commissions.models import Request, Sample


# --- Nested output schemas ---


class RequesterOut(Schema):
    """Nested requester summary."""

    id: int
    username: str
    department: str


class ExperimentTypeWithParamsOut(Schema):
    """Nested experiment type with per-request parameters."""

    id: int
    name: str
    parameters: dict[str, Any]


class SampleBriefOut(Schema):
    """Brief sample info nested in request responses."""

    id: int
    wafer_id: str
    wafer_size: str
    status: str


class ApprovalLogOut(Schema):
    """Approval log entry in request detail responses."""

    reviewer: RequesterOut
    action: str
    comment: str
    created_at: datetime


class RequestSummaryOut(Schema):
    """Brief request summary nested in sample responses."""

    id: int
    title: str


# --- Sample input schemas ---


class SampleIn(Schema):
    """Input for a single sample when creating a request."""

    wafer_id: str = Field(..., min_length=1, max_length=100)
    wafer_size: WaferSize


# --- Request input schemas ---


class RequestIn(Schema):
    """Input schema for creating a commission request."""

    title: str = Field(..., min_length=1, max_length=300)
    note: str = ""
    urgency: RequestUrgency = RequestUrgency.ONE_WEEK
    experiment_type_ids: list[int] = Field(..., min_length=1)
    experiment_parameters: dict[str, dict[str, Any]] = {}
    samples: list[SampleIn] = Field(..., min_length=1)


class RequestUpdateIn(Schema):
    """Input schema for updating a draft/returned request.

    title/note/urgency are partial-update fields that work on both
    DRAFT and RETURNED requests. samples and experiment_type_ids are
    DRAFT-only — reviewing a request locks the sample + experiment
    set. None means "don't change this field"; an empty list is a
    business-rule violation (samples need ≥1) and is rejected with
    422 by update_request rather than slipping past as a no-op.
    """

    title: str | None = Field(None, min_length=1, max_length=300)
    note: str | None = None
    urgency: RequestUrgency | None = None
    samples: list[SampleIn] | None = None
    experiment_type_ids: list[int] | None = None


# --- Action input schemas ---


class CommentIn(Schema):
    """Input for actions requiring a comment (return, reject)."""

    comment: str = Field(..., min_length=1)


class ReasonIn(Schema):
    """Input for cancel action requiring a reason."""

    reason: str = Field(..., min_length=1)


class ReasonOptionalIn(Schema):
    """Input for actions with optional reason (reject-receiving, report-lost, void, return sample)."""

    reason: str = ""


# --- Request output schemas ---


class RequestListOut(Schema):
    """Output schema for request list responses."""

    id: int
    title: str
    requester: RequesterOut
    status: str
    urgency: str
    note: str
    sample_count: int
    submitted_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def from_request(req: Request) -> dict:
        """Build a dict from a Request instance.

        Expects the queryset to annotate ``sample_count`` (see
        list_requests in apps/commissions/api.py) so the list endpoint
        doesn't incur a per-row COUNT(*).
        """
        profile = getattr(req.requester, "profile", None)
        return {
            "id": req.pk,
            "title": req.title,
            "requester": {
                "id": req.requester_id,
                "username": req.requester.username,
                "department": profile.department if profile else "",
            },
            "status": req.status,
            "urgency": req.urgency,
            "note": req.note,
            "sample_count": getattr(req, "sample_count", req.samples.count()),
            "submitted_at": req.submitted_at,
            "created_at": req.created_at,
            "updated_at": req.updated_at,
        }


class RequestDetailOut(Schema):
    """Output schema for request detail responses."""

    id: int
    title: str
    requester: RequesterOut
    status: str
    urgency: str
    note: str
    experiment_types: list[ExperimentTypeWithParamsOut]
    samples: list[SampleBriefOut]
    approval_logs: list[ApprovalLogOut]
    submitted_at: datetime | None
    completed_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def from_request(req: Request) -> dict:
        """Build a dict from a Request instance with all nested relations."""
        profile = getattr(req.requester, "profile", None)

        experiment_types = []
        for re in req.request_experiments.all():
            experiment_types.append(
                {
                    "id": re.experiment_type_id,
                    "name": re.experiment_type.name,
                    "parameters": re.parameters,
                }
            )

        samples = [
            {
                "id": s.pk,
                "wafer_id": s.wafer_id,
                "wafer_size": s.wafer_size,
                "status": s.status,
            }
            for s in req.samples.all()
        ]

        approval_logs = []
        for log in req.approval_logs.all():
            reviewer_profile = getattr(log.reviewer, "profile", None)
            approval_logs.append(
                {
                    "reviewer": {
                        "id": log.reviewer_id,
                        "username": log.reviewer.username,
                        "department": (
                            reviewer_profile.department if reviewer_profile else ""
                        ),
                    },
                    "action": log.action,
                    "comment": log.comment,
                    "created_at": log.created_at,
                }
            )

        return {
            "id": req.pk,
            "title": req.title,
            "requester": {
                "id": req.requester_id,
                "username": req.requester.username,
                "department": profile.department if profile else "",
            },
            "status": req.status,
            "urgency": req.urgency,
            "note": req.note,
            "experiment_types": experiment_types,
            "samples": samples,
            "approval_logs": approval_logs,
            "submitted_at": req.submitted_at,
            "completed_at": req.completed_at,
            "closed_at": req.closed_at,
            "created_at": req.created_at,
            "updated_at": req.updated_at,
        }


# --- Sample output schemas ---


class SampleDetailOut(Schema):
    """Output schema for sample detail responses."""

    id: int
    wafer_id: str
    wafer_size: str
    status: str
    request: RequestSummaryOut
    note: str
    received_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def from_sample(sample: Sample) -> dict:
        """Build a dict from a Sample instance."""
        return {
            "id": sample.pk,
            "wafer_id": sample.wafer_id,
            "wafer_size": sample.wafer_size,
            "status": sample.status,
            "request": {
                "id": sample.request_id,
                "title": sample.request.title,
            },
            "note": sample.note,
            "received_at": sample.received_at,
            "created_at": sample.created_at,
            "updated_at": sample.updated_at,
        }


class SampleExperimentStatusOut(Schema):
    """Output schema for per-sample experiment progress.

    verdict is null until the dispatch's record_result fills it in
    (random pass/fail per wafer).
    """

    experiment_type_id: int
    experiment_type_name: str
    status: str
    verdict: str | None
    dispatch_id: int | None


class ExperimentResultBrief(Schema):
    """Result summary nested in the sample experiments rollup."""

    id: int
    comment: str
    created_at: datetime


class ExperimentTypeBrief(Schema):
    """Experiment type summary nested in the rollup."""

    id: int
    name: str


class SampleExperimentRollupOut(Schema):
    """One row of the per-sample experiments rollup.

    Status semantics (computed server-side from the sample's dispatches):
      - "done": the latest dispatch for this experiment_type is COMPLETED
      - "in_progress": at least one non-terminal dispatch exists
      - "pending": no dispatch has been created yet
    """

    experiment_type: ExperimentTypeBrief
    status: str
    verdict: str | None
    dispatch_id: int | None
    result: ExperimentResultBrief | None


class SampleListOut(Schema):
    """Output schema for sample list responses."""

    id: int
    wafer_id: str
    wafer_size: str
    status: str
    request_id: int
    has_wip: bool = False
    received_at: datetime | None
    created_at: datetime
    updated_at: datetime
