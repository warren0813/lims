"""Django Ninja routers for commission request and sample endpoints."""

from collections.abc import Callable

from django.contrib.auth.models import User
from django.db import models, transaction
from django.db.models import Count, Exists, OuterRef, Prefetch
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
    RequestUrgency,
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
    SampleExperimentRollupOut,
    SampleExperimentStatusOut,
    SampleListOut,
)
from apps.commissions.services import (
    check_all_samples_received,
    check_request_completed,
)
from apps.commissions.state_machine import (
    InvalidTransitionError,
    validate_request_transition,
    validate_sample_transition,
)
from apps.experiments.models import ExperimentType
from apps.wip.models import SampleExperimentStatus

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
    urgency: RequestUrgency | None = Query(None),  # noqa: B008
):
    """List commission requests. Fab users see only their own."""
    qs = (
        Request.objects.select_related("requester__profile")
        .annotate(sample_count=Count("samples"))
        .order_by("-created_at")
    )

    if _is_fab_user(request):
        qs = qs.filter(requester=request.auth)
    else:
        # Lab staff and managers never see draft requests — drafts are
        # private to the requester until they are submitted.
        qs = qs.exclude(status=RequestStatus.DRAFT)

    if status:
        qs = qs.filter(status=status)
    if urgency:
        qs = qs.filter(urgency=urgency)

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
            urgency=payload.urgency,
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
    response={
        200: RequestDetailOut,
        400: ErrorOut,
        403: ErrorOut,
        404: ErrorOut,
        422: ErrorOut,
    },
)
def update_request(request: HttpRequest, request_id: int, payload: RequestUpdateIn):
    """Update a draft or returned request. Only the requester (fab user) allowed.

    Scalar fields (title/note/urgency) can be patched on DRAFT and
    RETURNED. samples and experiment_type_ids are draft-only — once a
    reviewer has seen the request, the sample set and required
    experiments are locked, even after a return. INTEGRATION_GAPS §2.9.
    """
    role = _get_user_role(request)
    req = _get_request_for_user(request_id, request.auth, role)
    if req is None:
        return 404, {"detail": "Not found"}

    if req.requester != request.auth:
        return 403, {"detail": "Only the requester can update this request"}

    # model_dump(exclude_unset=True) keeps explicit None/[] values so
    # we can distinguish "no field sent" from "field sent as empty".
    sent = payload.model_dump(exclude_unset=True)

    with transaction.atomic():
        req = Request.objects.select_for_update().get(pk=req.pk)

        if req.status not in (RequestStatus.DRAFT, RequestStatus.RETURNED):
            return 400, {"detail": "Can only update draft or returned requests"}

        samples_in = sent.pop("samples", None)
        exp_type_ids_in = sent.pop("experiment_type_ids", None)

        # Draft-only gate for the relational fields.
        if (samples_in is not None or exp_type_ids_in is not None) and (
            req.status != RequestStatus.DRAFT
        ):
            return 422, {
                "detail": (
                    "samples and experiment_type_ids can only be modified "
                    "while request is in draft state"
                )
            }

        if samples_in is not None and len(samples_in) == 0:
            return 422, {"detail": "samples cannot be empty — at least one required"}

        # Validate experiment_type_ids before any DB mutation so the
        # whole PATCH rolls back together on bad input.
        new_exp_types = None
        if exp_type_ids_in is not None:
            unique_ids = list(dict.fromkeys(exp_type_ids_in))
            new_exp_types = list(
                ExperimentType.objects.filter(pk__in=unique_ids, is_active=True)
            )
            if len(new_exp_types) != len(unique_ids):
                return 422, {
                    "detail": "One or more experiment_type_ids not found or inactive"
                }

        # Scalar partial update (title/note/urgency).
        for field, value in sent.items():
            setattr(req, field, value)
        req.save()

        # Replace experiment_types through-table.
        if new_exp_types is not None:
            req.request_experiments.all().delete()
            for et in new_exp_types:
                RequestExperiment.objects.create(request=req, experiment_type=et)

        # Replace samples — safe in DRAFT because no WIPs reference them.
        if samples_in is not None:
            req.samples.all().delete()
            for s in samples_in:
                Sample.objects.create(
                    request=req,
                    wafer_id=s["wafer_id"],
                    wafer_size=s["wafer_size"],
                )

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


@router.delete(
    "/{request_id}",
    response={204: None, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def delete_draft(request: HttpRequest, request_id: int):
    """Hard-delete a draft request. Only the owning fab user may do this."""
    if not _is_fab_user(request):
        return 403, {"detail": "Only fab users can delete draft requests"}

    req = _get_request_for_user(request_id, request.auth, Role.FAB_USER)
    if req is None:
        return 404, {"detail": "Not found"}

    if req.status != RequestStatus.DRAFT:
        return 400, {"detail": "Only draft requests can be deleted"}

    req.delete()
    return 204, None


# =============================================================================
# Sample endpoints
# =============================================================================


@sample_router.get("/", response=list[SampleListOut])
def list_samples(
    request: HttpRequest,
    request_id: int | None = Query(None),
    status: SampleStatus | None = Query(None),  # noqa: B008
):
    """List samples with optional filters. Fab users see only their own.

    Annotates ``has_wip`` (True when the sample is in at least one
    non-terminal WIP) so the SPA's Lab Samples page can derive its
    ``in_wip`` pill without a second round-trip — see
    INTEGRATION_GAPS §3.2 (sample status enum) and §4.
    """
    # Imported lazily to avoid a top-of-file circular import: apps.wip
    # imports from apps.commissions for state-machine helpers.
    from apps.wip.models import WIPSample, WIPStatus

    active_wip_for_sample = WIPSample.objects.filter(
        sample=OuterRef("pk"),
        wip__status__in=[WIPStatus.CREATED, WIPStatus.IN_PROGRESS],
    )
    qs = Sample.objects.annotate(has_wip=Exists(active_wip_for_sample)).order_by(
        "-created_at"
    )

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


@sample_router.get(
    "/{sample_id}/experiments",
    response={200: list[SampleExperimentRollupOut], 404: ErrorOut},
)
def sample_experiments(request: HttpRequest, sample_id: int):
    """Per-experiment-type rollup for one sample's wafer detail page.

    For each experiment_type required by the sample's parent request,
    inspects dispatches across this sample's WIPs and returns the
    status, dispatch_id, and (when done) the result. INTEGRATION_GAPS
    §2.8 resolution A — saves the SPA three extra requests per wafer
    detail open.
    """
    # Lazy imports to avoid a top-of-file circular dep: apps.wip
    # already imports from apps.commissions for state-machine helpers.
    from apps.wip.models import Dispatch, DispatchStatus

    sample = _get_sample_for_user(sample_id, request)
    if sample is None:
        return 404, {"detail": "Not found"}

    request_experiments = sample.request.request_experiments.select_related(
        "experiment_type"
    ).order_by("experiment_type__name")

    sample_wip_ids = list(sample.wips.values_list("pk", flat=True))
    dispatches_by_et: dict[int, list[Dispatch]] = {}
    if sample_wip_ids:
        dispatch_qs = (
            Dispatch.objects.filter(wip_id__in=sample_wip_ids)
            .select_related("result")
            .order_by("experiment_type_id", "-created_at")
        )
        for d in dispatch_qs:
            dispatches_by_et.setdefault(d.experiment_type_id, []).append(d)

    # Per-wafer verdicts now live on SampleExperimentStatus, not on
    # the dispatch result. One query for all of this sample's rows.
    verdicts_by_et: dict[int, str | None] = dict(
        SampleExperimentStatus.objects.filter(sample=sample).values_list(
            "experiment_type_id", "verdict"
        )
    )

    rows = []
    for re in request_experiments:
        et = re.experiment_type
        dispatches = dispatches_by_et.get(et.pk, [])

        status = "pending"
        dispatch_id: int | None = None
        result_payload: dict | None = None

        if dispatches:
            # dispatches are ordered newest-first within each ET group.
            completed = next(
                (d for d in dispatches if d.status == DispatchStatus.COMPLETED),
                None,
            )
            if completed is not None and hasattr(completed, "result"):
                status = "done"
                dispatch_id = completed.pk
                r = completed.result
                result_payload = {
                    "id": r.pk,
                    "comment": r.comment,
                    "created_at": r.created_at,
                }
            else:
                non_terminal = {
                    DispatchStatus.PENDING,
                    DispatchStatus.DISPATCHED,
                    DispatchStatus.RUNNING,
                    DispatchStatus.EXECUTION_EXCEPTION,
                    DispatchStatus.UNLOADED,
                    DispatchStatus.RESULT_RECORDED,
                }
                active = next((d for d in dispatches if d.status in non_terminal), None)
                if active is not None:
                    status = "in_progress"
                    dispatch_id = active.pk

        rows.append(
            {
                "experiment_type": {"id": et.pk, "name": et.name},
                "status": status,
                "verdict": verdicts_by_et.get(et.pk),
                "dispatch_id": dispatch_id,
                "result": result_payload,
            }
        )

    return 200, rows


@sample_router.post(
    "/{sample_id}/receive",
    response={200: SampleDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def receive_sample(request: HttpRequest, sample_id: int):
    """Confirm sample receipt. Only lab staff/managers allowed.

    Stamps Sample.received_at with the current time on the receive
    transition. The frontend uses this to render the urgency countdown
    on the Samples list (deadline = received_at + urgency_duration),
    so it must be captured at the moment of receipt, not derived from
    later updated_at values.
    """

    def pre_save(sample: Sample) -> None:
        sample.received_at = timezone.now()

    def post_save_in_txn(sample: Sample) -> None:
        req = Request.objects.select_for_update().get(pk=sample.request_id)
        check_all_samples_received(req)

    return _lab_sample_action(
        request,
        sample_id,
        "receive",
        pre_save=pre_save,
        post_save_in_txn=post_save_in_txn,
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

    def post_save_in_txn(sample: Sample) -> None:
        req = Request.objects.select_for_update().get(pk=sample.request_id)
        check_all_samples_received(req)
        req.refresh_from_db()
        check_request_completed(req)

    return _lab_sample_action(
        request, sample_id, "void", post_save_in_txn=post_save_in_txn
    )


@sample_router.post(
    "/{sample_id}/return",
    response={200: SampleDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def return_sample(request: HttpRequest, sample_id: int):
    """Return a sample (from exception states). Only lab staff/managers allowed."""

    def post_save_in_txn(sample: Sample) -> None:
        req = Request.objects.select_for_update().get(pk=sample.request_id)
        check_all_samples_received(req)
        req.refresh_from_db()
        check_request_completed(req)

    return _lab_sample_action(
        request, sample_id, "return", post_save_in_txn=post_save_in_txn
    )


@sample_router.get(
    "/{sample_id}/experiment-status",
    response={200: list[SampleExperimentStatusOut], 404: ErrorOut},
)
def get_sample_experiment_status(request: HttpRequest, sample_id: int):
    """Get experiment progress for a sample. Fab users see only their own samples."""
    sample = _get_sample_for_user(sample_id, request)
    if sample is None:
        return 404, {"detail": "Not found"}

    statuses = (
        SampleExperimentStatus.objects.filter(sample=sample)
        .select_related("experiment_type")
        .order_by("experiment_type__name")
    )
    return 200, [
        {
            "experiment_type_id": s.experiment_type_id,
            "experiment_type_name": s.experiment_type.name,
            "status": s.status,
            "verdict": s.verdict,
            "dispatch_id": s.dispatch_id,
        }
        for s in statuses
    ]
