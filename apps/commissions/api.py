"""Django Ninja routers for commission request and sample endpoints."""

from collections.abc import Callable

from django.contrib.auth.models import User
from django.db import models, transaction
from django.db.models import Prefetch
from django.http import HttpRequest
from django.utils import timezone
from ninja import Query, Router

from api.schemas import ErrorOut
from apps.accounts.auth import JWTAuth
from apps.accounts.models import Role, UserProfile
from apps.accounts.permissions import has_lab_role
from apps.commissions.models import (
    ApprovalLog,
    Request,
    RequestExperiment,
    RequestStatus,
    Sample,
    SampleStatus,
)
from apps.commissions.schemas import (
    CommentIn,
    ReasonIn,
    ReasonOptionalIn,
    RequestDetailOut,
    RequestIn,
    RequestListOut,
    RequestUpdateIn,
    SampleDetailOut,
    SampleListOut,
)
from apps.commissions.state_machine import (
    InvalidTransitionError,
    validate_request_transition,
    validate_sample_transition,
)
from apps.experiments.models import ExperimentType

router = Router(tags=["Requests"], auth=JWTAuth())
sample_router = Router(tags=["Samples"], auth=JWTAuth())


# =============================================================================
# Helpers
# =============================================================================


def _get_user_role(request: HttpRequest) -> str | None:
    """Return the user's role string, or None if no profile exists."""
    try:
        return request.auth.profile.role
    except (UserProfile.DoesNotExist, AttributeError):
        return None


def _is_fab_user(request: HttpRequest) -> bool:
    return _get_user_role(request) == Role.FAB_USER


def _is_lab_manager(request: HttpRequest) -> bool:
    return _get_user_role(request) == Role.LAB_MANAGER


def _request_detail_queryset() -> models.QuerySet[Request]:
    """Base queryset with all prefetches needed for RequestDetailOut."""
    return Request.objects.select_related("requester__profile").prefetch_related(
        "samples",
        Prefetch(
            "request_experiments",
            queryset=RequestExperiment.objects.select_related("experiment_type"),
        ),
        Prefetch(
            "approval_logs",
            queryset=ApprovalLog.objects.select_related("reviewer__profile"),
        ),
    )


def _get_request_for_user(
    request_id: int, user: User, role: str | None, *, prefetch: bool = False
) -> Request | None:
    """Fetch a Request visible to the given user (fab users only see their own)."""
    try:
        qs = (
            _request_detail_queryset()
            if prefetch
            else (Request.objects.select_related("requester__profile"))
        )
        if role == Role.FAB_USER:
            return qs.get(pk=request_id, requester=user)
        return qs.get(pk=request_id)
    except Request.DoesNotExist:
        return None


def _get_sample_for_user(sample_id: int, request: HttpRequest) -> Sample | None:
    """Fetch a Sample visible to the given user (fab users only see their own)."""
    try:
        qs = Sample.objects.select_related("request")
        if _is_fab_user(request):
            return qs.get(pk=sample_id, request__requester=request.auth)
        return qs.get(pk=sample_id)
    except Sample.DoesNotExist:
        return None


def _check_all_samples_received(req: Request) -> None:
    """If all samples in a sample_shipped request are genuinely received,
    auto-transition the request to in_progress.

    Only counts samples in RECEIVED, SPLIT, or COMPLETED as "received".
    Samples in exception/lost/voided/returned states do NOT count.

    Caller must hold a lock on the request row (select_for_update).
    """
    if req.status != RequestStatus.SAMPLE_SHIPPED:
        return

    received_statuses = {
        SampleStatus.RECEIVED,
        SampleStatus.SPLIT,
        SampleStatus.COMPLETED,
    }
    total = req.samples.count()
    received_count = req.samples.filter(status__in=received_statuses).count()

    if total > 0 and received_count == total:
        req.status = RequestStatus.IN_PROGRESS
        req.save()


def _lab_sample_action(
    request: HttpRequest,
    sample_id: int,
    action: str,
    pre_save: Callable[[Sample], None] | None = None,
    post_save_in_txn: Callable[[Sample], None] | None = None,
) -> tuple[int, SampleDetailOut | dict]:
    """Shared logic for lab-only sample state transitions.

    Handles permission check, 404, atomic transaction, state validation, and
    save.  Optional callbacks allow callers to inject per-action behaviour:
    - pre_save: mutate the sample before save (e.g. append a note)
    - post_save_in_txn: run additional DB work inside the same transaction
      after the sample is saved (e.g. auto-transition the parent request)
    """
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    try:
        sample = Sample.objects.select_related("request").get(pk=sample_id)
    except Sample.DoesNotExist:
        return 404, {"detail": "Not found"}

    with transaction.atomic():
        sample = Sample.objects.select_for_update().get(pk=sample.pk)

        try:
            target = validate_sample_transition(sample.status, action)
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        sample.status = target
        if pre_save:
            pre_save(sample)
        sample.save()

        if post_save_in_txn:
            post_save_in_txn(sample)

    sample = Sample.objects.select_related("request").get(pk=sample.pk)
    return 200, SampleDetailOut.from_sample(sample)


# =============================================================================
# Request endpoints
# =============================================================================


@router.get("/", response=list[RequestListOut])
def list_requests(
    request: HttpRequest,
    status: RequestStatus | None = Query(None),  # noqa: B008
):
    """List commission requests. Fab users see only their own."""
    qs = Request.objects.select_related("requester__profile").order_by("-created_at")

    if _is_fab_user(request):
        qs = qs.filter(requester=request.auth)

    if status:
        qs = qs.filter(status=status)

    return [RequestListOut.from_request(r) for r in qs]


@router.post("/", response={201: RequestDetailOut, 400: ErrorOut, 403: ErrorOut})
def create_request(request: HttpRequest, payload: RequestIn):
    """Create a new commission request (draft). Only fab users allowed."""
    if not _is_fab_user(request):
        return 403, {"detail": "Only fab users can create requests"}

    # Deduplicate and validate experiment types exist and are active
    exp_type_id_set = list(dict.fromkeys(payload.experiment_type_ids))
    exp_types = list(
        ExperimentType.objects.filter(pk__in=exp_type_id_set, is_active=True)
    )
    if len(exp_types) != len(exp_type_id_set):
        return 400, {"detail": "One or more experiment types not found or inactive"}

    with transaction.atomic():
        req = Request.objects.create(
            title=payload.title,
            note=payload.note,
            requester=request.auth,
        )

        # Create request-experiment associations
        for et in exp_types:
            params = payload.experiment_parameters.get(str(et.pk), {})
            RequestExperiment.objects.create(
                request=req, experiment_type=et, parameters=params
            )

        # Create samples
        for sample_in in payload.samples:
            Sample.objects.create(
                request=req,
                wafer_id=sample_in.wafer_id,
                wafer_size=sample_in.wafer_size,
            )

    # Re-fetch with prefetches for response
    req = _request_detail_queryset().get(pk=req.pk)
    return 201, RequestDetailOut.from_request(req)


@router.get("/{request_id}", response={200: RequestDetailOut, 404: ErrorOut})
def get_request(request: HttpRequest, request_id: int):
    """Get request detail with samples, experiment types, and approval logs."""
    role = _get_user_role(request)
    req = _get_request_for_user(request_id, request.auth, role, prefetch=True)
    if req is None:
        return 404, {"detail": "Not found"}

    return 200, RequestDetailOut.from_request(req)


@router.patch(
    "/{request_id}",
    response={200: RequestDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def update_request(request: HttpRequest, request_id: int, payload: RequestUpdateIn):
    """Update a draft or returned request. Only the requester (fab user) allowed."""
    role = _get_user_role(request)
    req = _get_request_for_user(request_id, request.auth, role)
    if req is None:
        return 404, {"detail": "Not found"}

    if req.requester != request.auth:
        return 403, {"detail": "Only the requester can update this request"}

    with transaction.atomic():
        req = Request.objects.select_for_update().get(pk=req.pk)

        if req.status not in (RequestStatus.DRAFT, RequestStatus.RETURNED):
            return 400, {"detail": "Can only update draft or returned requests"}

        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(req, field, value)
        req.save()

    req = _request_detail_queryset().get(pk=req.pk)
    return 200, RequestDetailOut.from_request(req)


@router.post(
    "/{request_id}/submit",
    response={200: RequestDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def submit_request(request: HttpRequest, request_id: int):
    """Submit a draft/returned request for approval. Only the requester allowed."""
    role = _get_user_role(request)
    req = _get_request_for_user(request_id, request.auth, role)
    if req is None:
        return 404, {"detail": "Not found"}

    if req.requester != request.auth:
        return 403, {"detail": "Only the requester can submit this request"}

    with transaction.atomic():
        req = Request.objects.select_for_update().get(pk=req.pk)

        try:
            target = validate_request_transition(req.status, "submit")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        req.status = target
        if req.submitted_at is None:
            req.submitted_at = timezone.now()
        req.save()

    req = _request_detail_queryset().get(pk=req.pk)
    return 200, RequestDetailOut.from_request(req)


@router.post(
    "/{request_id}/approve",
    response={200: RequestDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def approve_request(request: HttpRequest, request_id: int):
    """Approve a pending request. Only lab managers allowed."""
    if not _is_lab_manager(request):
        return 403, {"detail": "Only lab managers can approve requests"}

    req = _get_request_for_user(request_id, request.auth, Role.LAB_MANAGER)
    if req is None:
        return 404, {"detail": "Not found"}

    with transaction.atomic():
        req = Request.objects.select_for_update().get(pk=req.pk)

        try:
            target = validate_request_transition(req.status, "approve")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        req.status = target
        req.save()
        ApprovalLog.objects.create(
            request=req,
            reviewer=request.auth,
            action=ApprovalLog.Action.APPROVE,
        )

    req = _request_detail_queryset().get(pk=req.pk)
    return 200, RequestDetailOut.from_request(req)


@router.post(
    "/{request_id}/return",
    response={200: RequestDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def return_request(request: HttpRequest, request_id: int, payload: CommentIn):
    """Return a pending request with comment. Only lab managers allowed."""
    if not _is_lab_manager(request):
        return 403, {"detail": "Only lab managers can return requests"}

    req = _get_request_for_user(request_id, request.auth, Role.LAB_MANAGER)
    if req is None:
        return 404, {"detail": "Not found"}

    with transaction.atomic():
        req = Request.objects.select_for_update().get(pk=req.pk)

        try:
            target = validate_request_transition(req.status, "return")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        req.status = target
        req.save()
        ApprovalLog.objects.create(
            request=req,
            reviewer=request.auth,
            action=ApprovalLog.Action.RETURN,
            comment=payload.comment,
        )

    req = _request_detail_queryset().get(pk=req.pk)
    return 200, RequestDetailOut.from_request(req)


@router.post(
    "/{request_id}/reject",
    response={200: RequestDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def reject_request(request: HttpRequest, request_id: int, payload: CommentIn):
    """Reject a pending request with comment. Only lab managers allowed."""
    if not _is_lab_manager(request):
        return 403, {"detail": "Only lab managers can reject requests"}

    req = _get_request_for_user(request_id, request.auth, Role.LAB_MANAGER)
    if req is None:
        return 404, {"detail": "Not found"}

    with transaction.atomic():
        req = Request.objects.select_for_update().get(pk=req.pk)

        try:
            target = validate_request_transition(req.status, "reject")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        req.status = target
        req.save()
        ApprovalLog.objects.create(
            request=req,
            reviewer=request.auth,
            action=ApprovalLog.Action.REJECT,
            comment=payload.comment,
        )

    req = _request_detail_queryset().get(pk=req.pk)
    return 200, RequestDetailOut.from_request(req)


@router.post(
    "/{request_id}/ship",
    response={200: RequestDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def ship_request(request: HttpRequest, request_id: int):
    """Mark an approved request as shipped. Only the requester allowed."""
    role = _get_user_role(request)
    req = _get_request_for_user(request_id, request.auth, role)
    if req is None:
        return 404, {"detail": "Not found"}

    if req.requester != request.auth:
        return 403, {"detail": "Only the requester can ship this request"}

    with transaction.atomic():
        req = Request.objects.select_for_update().get(pk=req.pk)

        try:
            target = validate_request_transition(req.status, "ship")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        req.status = target
        req.save()

        # Auto-transition all samples to shipped
        req.samples.filter(status=SampleStatus.CREATED).update(
            status=SampleStatus.SHIPPED
        )

    req = _request_detail_queryset().get(pk=req.pk)
    return 200, RequestDetailOut.from_request(req)


@router.post(
    "/{request_id}/cancel",
    response={200: RequestDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def cancel_request(request: HttpRequest, request_id: int, payload: ReasonIn):
    """Cancel a request. Fab user can cancel own; lab manager can cancel any."""
    role = _get_user_role(request)

    # Only fab users (own requests) and lab managers may cancel
    if role == Role.FAB_USER:
        req = _get_request_for_user(request_id, request.auth, Role.FAB_USER)
    elif role == Role.LAB_MANAGER:
        req = _get_request_for_user(request_id, request.auth, Role.LAB_MANAGER)
    else:
        return 403, {"detail": "Permission denied"}

    if req is None:
        return 404, {"detail": "Not found"}

    with transaction.atomic():
        req = Request.objects.select_for_update().get(pk=req.pk)

        try:
            target = validate_request_transition(req.status, "cancel")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        req.status = target
        req.note = f"{req.note}\n[Cancelled] {payload.reason}".strip()
        req.save()

    req = _request_detail_queryset().get(pk=req.pk)
    return 200, RequestDetailOut.from_request(req)


@router.post(
    "/{request_id}/close",
    response={200: RequestDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def close_request(request: HttpRequest, request_id: int):
    """Close a completed request. Only lab managers allowed."""
    if not _is_lab_manager(request):
        return 403, {"detail": "Only lab managers can close requests"}

    req = _get_request_for_user(request_id, request.auth, Role.LAB_MANAGER)
    if req is None:
        return 404, {"detail": "Not found"}

    with transaction.atomic():
        req = Request.objects.select_for_update().get(pk=req.pk)

        try:
            target = validate_request_transition(req.status, "close")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        req.status = target
        req.closed_at = timezone.now()
        req.save()

    req = _request_detail_queryset().get(pk=req.pk)
    return 200, RequestDetailOut.from_request(req)


# =============================================================================
# Sample endpoints
# =============================================================================


@sample_router.get("/", response=list[SampleListOut])
def list_samples(
    request: HttpRequest,
    request_id: int | None = Query(None),
    status: SampleStatus | None = Query(None),  # noqa: B008
):
    """List samples with optional filters. Fab users see only their own."""
    qs = Sample.objects.order_by("-created_at")

    if _is_fab_user(request):
        qs = qs.filter(request__requester=request.auth)

    if request_id:
        qs = qs.filter(request_id=request_id)
    if status:
        qs = qs.filter(status=status)

    return qs


@sample_router.get("/{sample_id}", response={200: SampleDetailOut, 404: ErrorOut})
def get_sample(request: HttpRequest, sample_id: int):
    """Get sample detail with request info."""
    sample = _get_sample_for_user(sample_id, request)
    if sample is None:
        return 404, {"detail": "Not found"}

    return 200, SampleDetailOut.from_sample(sample)


@sample_router.post(
    "/{sample_id}/receive",
    response={200: SampleDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def receive_sample(request: HttpRequest, sample_id: int):
    """Confirm sample receipt. Only lab staff/managers allowed."""

    def post_save_in_txn(sample: Sample) -> None:
        req = Request.objects.select_for_update().get(pk=sample.request_id)
        _check_all_samples_received(req)

    return _lab_sample_action(
        request, sample_id, "receive", post_save_in_txn=post_save_in_txn
    )


@sample_router.post(
    "/{sample_id}/reject-receiving",
    response={200: SampleDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def reject_receiving_sample(
    request: HttpRequest, sample_id: int, payload: ReasonOptionalIn
):
    """Mark sample as receiving exception. Only lab staff/managers allowed."""

    def pre_save(sample: Sample) -> None:
        if payload.reason:
            sample.note = f"{sample.note}\n[Reject] {payload.reason}".strip()

    return _lab_sample_action(request, sample_id, "reject_receiving", pre_save=pre_save)


@sample_router.post(
    "/{sample_id}/report-lost",
    response={200: SampleDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def report_lost_sample(request: HttpRequest, sample_id: int):
    """Mark sample as lost. Only lab staff/managers allowed."""
    return _lab_sample_action(request, sample_id, "report_lost")


@sample_router.post(
    "/{sample_id}/void",
    response={200: SampleDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def void_sample(request: HttpRequest, sample_id: int):
    """Void a sample (from exception/lost states). Only lab staff/managers allowed."""
    return _lab_sample_action(request, sample_id, "void")


@sample_router.post(
    "/{sample_id}/return",
    response={200: SampleDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def return_sample(request: HttpRequest, sample_id: int):
    """Return a sample (from exception states). Only lab staff/managers allowed."""
    return _lab_sample_action(request, sample_id, "return")
