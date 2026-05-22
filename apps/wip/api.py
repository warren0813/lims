"""Django Ninja routers for WIP, Dispatch, and Automation endpoints."""

import random

from django.db import models, transaction
from django.db.models import Prefetch
from django.http import HttpRequest
from django.utils import timezone
from ninja import Query, Router

from api.schemas import ErrorOut
from apps.accounts.auth import JWTAuth
from apps.accounts.permissions import has_lab_role
from apps.commissions.models import Request, RequestStatus, Sample, SampleStatus
from apps.commissions.state_machine import (
    InvalidTransitionError as SampleInvalidTransitionError,
)
from apps.commissions.state_machine import validate_sample_transition
from apps.equipment.models import (
    Equipment,
    EquipmentCapability,
    EquipmentStatus,
    Recipe,
)
from apps.experiments.models import ExperimentType
from apps.wip.models import (
    WIP,
    Dispatch,
    DispatchStatus,
    ExperimentResult,
    SampleExperimentProgress,
    SampleExperimentStatus,
    SampleExperimentVerdict,
    WIPSample,
    WIPStatus,
)
from apps.wip.schemas import (
    AutomationResultIn,
    DispatchDetailOut,
    DispatchIn,
    DispatchListOut,
    ExceptionReportIn,
    RecordResultIn,
    WIPAddSamplesIn,
    WIPDetailOut,
    WIPIn,
    WIPListOut,
)
from apps.wip.state_machine import (
    InvalidTransitionError,
    validate_dispatch_transition,
    validate_wip_transition,
)

router = Router(tags=["WIPs"], auth=JWTAuth())
dispatch_router = Router(tags=["Dispatches"], auth=JWTAuth())
automation_router = Router(tags=["Automation"], auth=JWTAuth())


# =============================================================================
# Helpers
# =============================================================================


def _wip_detail_queryset() -> "models.QuerySet[WIP]":
    """Base queryset with all prefetches needed for WIPDetailOut."""
    return WIP.objects.select_related("experiment_type").prefetch_related(
        "samples",
        Prefetch(
            "dispatches",
            queryset=Dispatch.objects.select_related(
                "experiment_type", "equipment", "recipe"
            ).order_by("created_at"),
        ),
    )


def _dispatch_detail_queryset() -> "models.QuerySet[Dispatch]":
    """Base queryset with all prefetches needed for DispatchDetailOut.

    created_by__profile is selected so DispatchDetailOut.from_dispatch
    can render the operator's department without an extra query.
    """
    return Dispatch.objects.select_related(
        "experiment_type", "recipe", "equipment", "created_by__profile"
    ).prefetch_related("result")


# Dispatch statuses with no further progression possible on this row.
# PENDING_REDISPATCH is included because its semantics are "this attempt
# has been superseded by a replacement" — the row will never transition
# again. All three checks below (single-active gate, auto-complete
# trigger, manual /wips/{id}/complete/ gate) agree on the same set, so
# the redispatch flow can both (a) freely open a fresh dispatch after
# the replacement chain ends and (b) let the WIP auto-complete when
# the surviving sibling lands in COMPLETED.
TERMINAL_DISPATCH_STATUSES = frozenset(
    {
        DispatchStatus.COMPLETED,
        DispatchStatus.ABORTED,
        DispatchStatus.PENDING_REDISPATCH,
    }
)


# Per-wafer pass/fail randomisation weights for record_result.
# Tunable in one place; tests pin via random.seed.
_VERDICT_CHOICES = (SampleExperimentVerdict.PASS, SampleExperimentVerdict.FAIL)
_VERDICT_WEIGHTS = (0.8, 0.2)


def _random_verdict() -> str:
    """Roll a per-wafer verdict — 80% pass / 20% fail."""
    return random.choices(_VERDICT_CHOICES, weights=_VERDICT_WEIGHTS, k=1)[0]


def _check_all_dispatches_done(wip: WIP) -> bool:
    """Return True if all dispatches for the WIP are in a terminal state."""
    return not wip.dispatches.exclude(status__in=TERMINAL_DISPATCH_STATUSES).exists()


def _maybe_auto_complete_wip(wip: WIP) -> bool:
    """If every dispatch on this WIP is terminal AND at least one is
    COMPLETED, transition the WIP to COMPLETED and cascade
    sample/request auto-completion. Returns True iff the WIP was
    transitioned. Caller must hold a select_for_update lock on the WIP.

    Terminal here uses TERMINAL_DISPATCH_STATUSES (COMPLETED, ABORTED,
    PENDING_REDISPATCH). An all-aborted (or all-superseded) WIP with no
    COMPLETED dispatch is intentionally NOT auto-completed — operators
    decide whether to manually complete or create a fresh dispatch.
    """
    if wip.status != WIPStatus.IN_PROGRESS:
        return False

    statuses = list(wip.dispatches.values_list("status", flat=True))
    if not statuses:
        return False
    if any(s not in TERMINAL_DISPATCH_STATUSES for s in statuses):
        return False
    if DispatchStatus.COMPLETED not in statuses:
        return False

    wip.status = WIPStatus.COMPLETED
    wip.completed_at = timezone.now()
    wip.save(update_fields=["status", "completed_at", "updated_at"])

    # Cascade per-sample / per-request auto-completion — same logic as
    # the manual /wips/{id}/complete/ endpoint.
    for sample in Sample.objects.select_for_update().filter(
        pk__in=wip.samples.values_list("pk", flat=True)
    ):
        if sample.status != SampleStatus.PROCESSING:
            continue
        total = SampleExperimentStatus.objects.filter(sample=sample).count()
        completed = SampleExperimentStatus.objects.filter(
            sample=sample, status=SampleExperimentProgress.COMPLETED
        ).count()
        if total <= 0 or completed < total:
            continue
        try:
            sample_target = validate_sample_transition(sample.status, "complete")
        except SampleInvalidTransitionError:
            continue
        sample.status = sample_target
        sample.save(update_fields=["status", "updated_at"])

        req = Request.objects.select_for_update().get(pk=sample.request_id)
        if req.status != RequestStatus.IN_PROGRESS:
            continue
        terminal_sample_statuses = {
            SampleStatus.COMPLETED,
            SampleStatus.VOIDED,
            SampleStatus.RETURNED,
        }
        total_samples = req.samples.count()
        terminal_count = req.samples.filter(status__in=terminal_sample_statuses).count()
        if total_samples > 0 and terminal_count == total_samples:
            req.status = RequestStatus.COMPLETED
            req.completed_at = timezone.now()
            req.save(update_fields=["status", "completed_at", "updated_at"])

    return True


def _equipment_remaining_capacity(
    equipment: Equipment, exclude_dispatch_id: int | None = None
) -> int:
    """Return how many sample slots are free on this equipment right now.

    Chat-design: equipment is occupied per-dispatch, not per-WIP. An
    equipment is "busy" while it has dispatches in DISPATCHED/RUNNING/
    UNLOADED state; each such dispatch holds len(wip.samples) slots.
    """
    occupying_statuses = {
        DispatchStatus.DISPATCHED,
        DispatchStatus.RUNNING,
        DispatchStatus.UNLOADED,
    }
    qs = Dispatch.objects.filter(equipment=equipment, status__in=occupying_statuses)
    if exclude_dispatch_id is not None:
        qs = qs.exclude(pk=exclude_dispatch_id)
    occupied = sum(d.wip.samples.count() for d in qs.select_related("wip"))
    return max(equipment.capacity - occupied, 0)


def _validate_samples_for_wip(
    sample_ids: list[int], experiment_type: ExperimentType | None = None
) -> tuple[list[Sample], str | None]:
    """Validate that samples are eligible for WIP creation/addition.

    When experiment_type is provided, also enforces the chat-design
    constraint that every sample's parent request must include the
    experiment_type in its request_experiments.

    Returns (samples, error_message). error_message is None on success.
    """
    samples = list(Sample.objects.select_related("request").filter(pk__in=sample_ids))
    if len(samples) != len(set(sample_ids)):
        return [], "One or more samples not found"

    for sample in samples:
        if sample.request.status != RequestStatus.IN_PROGRESS:
            return [], (
                f"Sample {sample.wafer_id}: request is not in_progress "
                f"(all samples must be received first)"
            )
        if sample.status not in (SampleStatus.RECEIVED, SampleStatus.PROCESSING):
            return [], (
                f"Sample {sample.wafer_id}: status is '{sample.status}', "
                f"must be 'received' or 'processing'"
            )

    if experiment_type is not None:
        request_ids = {s.request_id for s in samples}
        covered_request_ids = set(
            Request.objects.filter(
                pk__in=request_ids,
                request_experiments__experiment_type=experiment_type,
            ).values_list("pk", flat=True)
        )
        missing = request_ids - covered_request_ids
        if missing:
            sample_labels = ", ".join(
                s.wafer_id for s in samples if s.request_id in missing
            )
            return [], (
                f"Sample(s) {sample_labels}: parent request does not include "
                f"experiment type '{experiment_type.name}'"
            )

    return samples, None


def _transition_samples_to_processing(samples: list[Sample]) -> None:
    """Transition RECEIVED samples to PROCESSING status.

    Wrapped in try/except defensively: callers always pre-validate via
    _validate_samples_for_wip so the transition is valid in practice,
    but skipping silently is the consistent state-machine pattern used
    by abort_wip / complete_wip — never let a state-machine failure
    inside an auto-transition bubble out as a 500.
    """
    for sample in samples:
        if sample.status == SampleStatus.RECEIVED:
            try:
                target = validate_sample_transition(sample.status, "start_processing")
            except SampleInvalidTransitionError:
                continue
            sample.status = target
            sample.save(update_fields=["status", "updated_at"])


def _update_experiment_statuses_on_dispatch_complete(dispatch: Dispatch) -> None:
    """When a dispatch completes, set status=COMPLETED and roll a
    per-wafer verdict (80/20 pass/fail) on every SampleExperimentStatus
    row attached to this dispatch's WIP × experiment_type, then check
    for sample/request auto-completion.

    Must be called inside an active transaction.atomic() block.
    """
    wip = dispatch.wip
    experiment_type = dispatch.experiment_type
    sample_ids = list(wip.samples.values_list("pk", flat=True))

    # Per-wafer roll: each row gets its own dice. We can't .update() in
    # bulk because each row needs an independent random value.
    rows = SampleExperimentStatus.objects.select_for_update().filter(
        sample_id__in=sample_ids, experiment_type=experiment_type
    )
    for row in rows:
        row.status = SampleExperimentProgress.COMPLETED
        row.verdict = _random_verdict()
        row.dispatch = dispatch
        row.save(update_fields=["status", "verdict", "dispatch", "updated_at"])

    # Check auto-completion for each sample.
    for sample in Sample.objects.select_for_update().filter(pk__in=sample_ids):
        if sample.status != SampleStatus.PROCESSING:
            continue

        total = SampleExperimentStatus.objects.filter(sample=sample).count()
        completed = SampleExperimentStatus.objects.filter(
            sample=sample, status=SampleExperimentProgress.COMPLETED
        ).count()

        if total > 0 and completed >= total:
            try:
                target = validate_sample_transition(sample.status, "complete")
            except SampleInvalidTransitionError:
                continue
            sample.status = target
            sample.save(update_fields=["status", "updated_at"])

            # Check request auto-completion.
            req = Request.objects.select_for_update().get(pk=sample.request_id)
            if req.status != RequestStatus.IN_PROGRESS:
                continue

            terminal_statuses = {
                SampleStatus.COMPLETED,
                SampleStatus.VOIDED,
                SampleStatus.RETURNED,
            }
            total_samples = req.samples.count()
            terminal_count = req.samples.filter(status__in=terminal_statuses).count()

            if total_samples > 0 and terminal_count == total_samples:
                req.status = RequestStatus.COMPLETED
                req.completed_at = timezone.now()
                req.save(update_fields=["status", "completed_at", "updated_at"])


# =============================================================================
# WIP endpoints
# =============================================================================


@router.get("/", response={200: list[WIPListOut], 403: ErrorOut})
def list_wips(
    request: HttpRequest,
    status: WIPStatus | None = Query(None),  # noqa: B008
):
    """List WIPs. Lab staff and managers only."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    qs = (
        WIP.objects.select_related("experiment_type")
        .annotate(dispatch_count=models.Count("dispatches"))
        .order_by("-created_at")
    )
    if status:
        qs = qs.filter(status=status)

    return 200, [WIPListOut.from_wip(w) for w in qs]


@router.post(
    "/",
    response={
        201: WIPDetailOut,
        400: ErrorOut,
        403: ErrorOut,
        404: ErrorOut,
    },
)
def create_wip(request: HttpRequest, payload: WIPIn):
    """Create a WIP for one experiment_type with the given samples.

    Chat-design: equipment is chosen later per-dispatch; WIP only pins
    the experiment_type and the sample batch.
    """
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    try:
        experiment_type = ExperimentType.objects.get(
            pk=payload.experiment_type_id, is_active=True
        )
    except ExperimentType.DoesNotExist:
        return 404, {"detail": "Experiment type not found or inactive"}

    samples, error = _validate_samples_for_wip(payload.sample_ids, experiment_type)
    if error:
        return 400, {"detail": error}

    with transaction.atomic():
        wip = WIP.objects.create(
            experiment_type=experiment_type,
            note=payload.note,
            created_by=request.auth,
        )
        for sample in samples:
            WIPSample.objects.create(wip=wip, sample=sample)

        _transition_samples_to_processing(samples)

    wip = _wip_detail_queryset().get(pk=wip.pk)
    return 201, WIPDetailOut.from_wip(wip)


@router.get("/{wip_id}/", response={200: WIPDetailOut, 403: ErrorOut, 404: ErrorOut})
def get_wip(request: HttpRequest, wip_id: int):
    """Get WIP detail with dispatches. Lab staff and managers only."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    try:
        wip = _wip_detail_queryset().get(pk=wip_id)
    except WIP.DoesNotExist:
        return 404, {"detail": "Not found"}

    return 200, WIPDetailOut.from_wip(wip)


@router.post(
    "/{wip_id}/samples/",
    response={200: WIPDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def add_samples_to_wip(request: HttpRequest, wip_id: int, payload: WIPAddSamplesIn):
    """Add samples to an existing WIP. Lab staff only.

    The new samples' parent requests must include the WIP's experiment_type.
    """
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    with transaction.atomic():
        try:
            wip = (
                WIP.objects.select_for_update()
                .select_related("experiment_type")
                .get(pk=wip_id)
            )
        except WIP.DoesNotExist:
            return 404, {"detail": "Not found"}

        if wip.status not in (WIPStatus.CREATED, WIPStatus.IN_PROGRESS):
            return 400, {"detail": "Cannot add samples to a completed or aborted WIP"}

        samples, error = _validate_samples_for_wip(
            payload.sample_ids, wip.experiment_type
        )
        if error:
            return 400, {"detail": error}

        existing_sample_ids = set(wip.samples.values_list("pk", flat=True))
        for sample in samples:
            if sample.pk in existing_sample_ids:
                return 400, {
                    "detail": f"Sample {sample.wafer_id} is already in this WIP"
                }

        for sample in samples:
            WIPSample.objects.create(wip=wip, sample=sample)

        _transition_samples_to_processing(samples)

    wip = _wip_detail_queryset().get(pk=wip_id)
    return 200, WIPDetailOut.from_wip(wip)


@router.post(
    "/{wip_id}/dispatches/",
    response={
        201: WIPDetailOut,
        400: ErrorOut,
        403: ErrorOut,
        404: ErrorOut,
        422: ErrorOut,
    },
)
def create_dispatch(request: HttpRequest, wip_id: int, payload: DispatchIn):
    """Create a dispatch for a WIP using the chosen equipment + recipe.

    Chat-design: experiment_type is derived from the parent WIP, so the
    payload only carries equipment_id, recipe_id, and an optional note.
    Validates that the equipment supports the WIP's experiment_type, the
    recipe targets the same experiment_type, and the equipment has room.

    Rejects with 422 if the WIP already has an active dispatch (anything
    other than COMPLETED or ABORTED). A WIP can accumulate many
    dispatches over its lifetime, but only one at a time.

    Automatically transitions WIP to in_progress on first dispatch.
    """
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    with transaction.atomic():
        try:
            wip = (
                WIP.objects.select_for_update()
                .select_related("experiment_type")
                .get(pk=wip_id)
            )
        except WIP.DoesNotExist:
            return 404, {"detail": "Not found"}

        # Single-active-dispatch rule: refuse if any existing dispatch
        # is non-terminal (see TERMINAL_DISPATCH_STATUSES). Done after
        # the WIP select_for_update so concurrent create_dispatch calls
        # serialize through the same row lock.
        if wip.dispatches.exclude(status__in=TERMINAL_DISPATCH_STATUSES).exists():
            return 422, {
                "detail": (
                    "WIP already has an active dispatch — only one "
                    "non-terminal dispatch is allowed at a time"
                )
            }

        experiment_type = wip.experiment_type

        try:
            equipment = Equipment.objects.get(pk=payload.equipment_id)
        except Equipment.DoesNotExist:
            return 400, {"detail": "Equipment not found"}

        if equipment.status != EquipmentStatus.AVAILABLE:
            return 400, {"detail": "Equipment is not available"}

        if not EquipmentCapability.objects.filter(
            equipment=equipment, experiment_type=experiment_type
        ).exists():
            return 400, {
                "detail": "Equipment does not support this WIP's experiment type"
            }

        try:
            recipe = Recipe.objects.get(pk=payload.recipe_id)
        except Recipe.DoesNotExist:
            return 400, {"detail": "Recipe not found"}

        if recipe.experiment_type_id != experiment_type.pk:
            return 400, {
                "detail": "Recipe experiment type does not match the WIP's experiment type"
            }

        sample_count = wip.samples.count()
        remaining = _equipment_remaining_capacity(equipment)
        if sample_count > remaining:
            return 400, {
                "detail": (
                    f"Equipment capacity exceeded: {remaining} slot(s) free, "
                    f"but this WIP holds {sample_count} sample(s)"
                )
            }

        Dispatch.objects.create(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            note=payload.note,
            estimated_duration_seconds=payload.estimated_duration_seconds,
            created_by=request.auth,
        )

        # Auto-transition WIP to in_progress on first dispatch.
        if wip.status == WIPStatus.CREATED:
            wip.status = WIPStatus.IN_PROGRESS
            wip.save(update_fields=["status", "updated_at"])

        # Mark experiment statuses as in_progress for relevant samples.
        sample_ids = list(wip.samples.values_list("pk", flat=True))
        SampleExperimentStatus.objects.filter(
            sample_id__in=sample_ids,
            experiment_type=experiment_type,
            status=SampleExperimentProgress.PENDING,
        ).update(status=SampleExperimentProgress.IN_PROGRESS)

    wip = _wip_detail_queryset().get(pk=wip_id)
    return 201, WIPDetailOut.from_wip(wip)


@router.post(
    "/{wip_id}/complete/",
    response={200: WIPDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def complete_wip(request: HttpRequest, wip_id: int):
    """Complete a WIP. Requires all dispatches to be in terminal state.

    Auto-completes samples and checks if parent requests are done.
    """
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    with transaction.atomic():
        try:
            wip = WIP.objects.select_for_update().get(pk=wip_id)
        except WIP.DoesNotExist:
            return 404, {"detail": "Not found"}

        if not _check_all_dispatches_done(wip):
            return 400, {
                "detail": "All dispatches must be completed or aborted before completing the WIP"
            }

        try:
            target = validate_wip_transition(wip.status, "complete")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        wip.status = target
        wip.completed_at = timezone.now()
        wip.save(update_fields=["status", "completed_at", "updated_at"])

        # Check sample/request auto-completion for each sample in the WIP.
        for sample in Sample.objects.select_for_update().filter(
            pk__in=wip.samples.values_list("pk", flat=True)
        ):
            if sample.status != SampleStatus.PROCESSING:
                continue

            total = SampleExperimentStatus.objects.filter(sample=sample).count()
            completed = SampleExperimentStatus.objects.filter(
                sample=sample, status=SampleExperimentProgress.COMPLETED
            ).count()

            if total > 0 and completed >= total:
                try:
                    sample_target = validate_sample_transition(
                        sample.status, "complete"
                    )
                except SampleInvalidTransitionError:
                    continue
                sample.status = sample_target
                sample.save(update_fields=["status", "updated_at"])

                req = Request.objects.select_for_update().get(pk=sample.request_id)
                if req.status != RequestStatus.IN_PROGRESS:
                    continue

                terminal_statuses = {
                    SampleStatus.COMPLETED,
                    SampleStatus.VOIDED,
                    SampleStatus.RETURNED,
                }
                total_samples = req.samples.count()
                terminal_count = req.samples.filter(
                    status__in=terminal_statuses
                ).count()

                if total_samples > 0 and terminal_count == total_samples:
                    req.status = RequestStatus.COMPLETED
                    req.completed_at = timezone.now()
                    req.save(update_fields=["status", "completed_at", "updated_at"])

    wip = _wip_detail_queryset().get(pk=wip_id)
    return 200, WIPDetailOut.from_wip(wip)


@router.post(
    "/{wip_id}/abort/",
    response={200: WIPDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def abort_wip(request: HttpRequest, wip_id: int):
    """Abort a WIP. Marks associated samples as processing_exception."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    with transaction.atomic():
        try:
            wip = WIP.objects.select_for_update().get(pk=wip_id)
        except WIP.DoesNotExist:
            return 404, {"detail": "Not found"}

        try:
            target = validate_wip_transition(wip.status, "abort")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        wip.status = target
        wip.save(update_fields=["status", "updated_at"])

        # Mark PROCESSING samples as processing_exception. Samples in
        # other states (e.g. RECEIVED if no dispatch ever started) are
        # skipped silently — the abort applies at the WIP level and we
        # don't want sample-side state-machine failures to crash it.
        # Critical: catch SampleInvalidTransitionError, not WIP's
        # InvalidTransitionError — the two classes are distinct (one
        # per app's state_machine module) and confusing them was the
        # bug that surfaced as a 500 on abort_wip during smoke testing.
        for sample in Sample.objects.select_for_update().filter(
            pk__in=wip.samples.values_list("pk", flat=True)
        ):
            try:
                sample_target = validate_sample_transition(
                    sample.status, "processing_exception"
                )
                sample.status = sample_target
                sample.save(update_fields=["status", "updated_at"])
            except SampleInvalidTransitionError:
                pass

    wip = _wip_detail_queryset().get(pk=wip_id)
    return 200, WIPDetailOut.from_wip(wip)


# =============================================================================
# Dispatch endpoints
# =============================================================================


@dispatch_router.get("/", response={200: list[DispatchListOut], 403: ErrorOut})
def list_dispatches(
    request: HttpRequest,
    status: DispatchStatus | None = Query(None),  # noqa: B008
    wip_id: int | None = Query(None),
    equipment_id: int | None = Query(None),
):
    """List dispatches with optional filters. Lab staff and managers only.

    Selects created_by__profile so the response can include the
    operator's username and department for each row without an N+1.
    """
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    qs = Dispatch.objects.select_related("created_by__profile").order_by("-created_at")
    if status:
        qs = qs.filter(status=status)
    if wip_id:
        qs = qs.filter(wip_id=wip_id)
    if equipment_id:
        qs = qs.filter(equipment_id=equipment_id)

    return 200, [DispatchListOut.from_dispatch(d) for d in qs]


@dispatch_router.get(
    "/{dispatch_id}/", response={200: DispatchDetailOut, 403: ErrorOut, 404: ErrorOut}
)
def get_dispatch(request: HttpRequest, dispatch_id: int):
    """Get dispatch detail. Lab staff and managers only."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    try:
        dispatch = _dispatch_detail_queryset().get(pk=dispatch_id)
    except Dispatch.DoesNotExist:
        return 404, {"detail": "Not found"}

    return 200, DispatchDetailOut.from_dispatch(dispatch)


@dispatch_router.post(
    "/{dispatch_id}/start/",
    response={200: DispatchDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def start_dispatch(request: HttpRequest, dispatch_id: int):
    """Start a dispatch (pending/dispatched → running). Lab staff only."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    with transaction.atomic():
        try:
            dispatch = Dispatch.objects.select_for_update().get(pk=dispatch_id)
        except Dispatch.DoesNotExist:
            return 404, {"detail": "Not found"}

        # If PENDING, run the "dispatch" transition first, then "start".
        if dispatch.status == DispatchStatus.PENDING:
            try:
                validate_dispatch_transition(dispatch.status, "dispatch")
            except InvalidTransitionError as e:
                return 400, {"detail": str(e)}
            dispatch.status = DispatchStatus.DISPATCHED
            dispatch.dispatched_at = timezone.now()

        try:
            target = validate_dispatch_transition(dispatch.status, "start")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        dispatch.status = target
        dispatch.save()

    dispatch = _dispatch_detail_queryset().get(pk=dispatch_id)
    return 200, DispatchDetailOut.from_dispatch(dispatch)


@dispatch_router.post(
    "/{dispatch_id}/unload/",
    response={200: DispatchDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def unload_dispatch(request: HttpRequest, dispatch_id: int):
    """Unload a dispatch (dispatched/running → unloaded). Lab staff only."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    with transaction.atomic():
        try:
            dispatch = Dispatch.objects.select_for_update().get(pk=dispatch_id)
        except Dispatch.DoesNotExist:
            return 404, {"detail": "Not found"}

        try:
            target = validate_dispatch_transition(dispatch.status, "unload")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        dispatch.status = target
        dispatch.save()

    dispatch = _dispatch_detail_queryset().get(pk=dispatch_id)
    return 200, DispatchDetailOut.from_dispatch(dispatch)


@dispatch_router.post(
    "/{dispatch_id}/record-result/",
    response={200: DispatchDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def record_result(request: HttpRequest, dispatch_id: int, payload: RecordResultIn):
    """Record result for an unloaded dispatch — terminal step.

    Payload is just {comment} now — the per-wafer pass/fail verdict
    is rolled server-side (80% pass / 20% fail per wafer) and stored
    on each SampleExperimentStatus row, not on the dispatch result.
    Lands the dispatch in COMPLETED directly (no intermediate
    RESULT_RECORDED step), stamps completed_at, and cascades the
    per-sample experiment-status update. Lab staff only.
    """
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    with transaction.atomic():
        try:
            dispatch = (
                Dispatch.objects.select_for_update()
                .select_related("wip", "experiment_type")
                .get(pk=dispatch_id)
            )
        except Dispatch.DoesNotExist:
            return 404, {"detail": "Not found"}

        try:
            target = validate_dispatch_transition(dispatch.status, "record_result")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        dispatch.status = target
        dispatch.completed_at = timezone.now()
        dispatch.save()

        ExperimentResult.objects.create(
            dispatch=dispatch,
            comment=payload.comment,
            recorded_by=request.auth,
        )

        # Cascade per-sample / per-request auto-completion that used to
        # live in the standalone /complete/ endpoint.
        _update_experiment_statuses_on_dispatch_complete(dispatch)

        # If this was the last active dispatch on the WIP and ≥1
        # dispatch is COMPLETED, auto-complete the WIP (with sample/
        # request cascade) so the operator doesn't have to POST a
        # separate /wips/{id}/complete/.
        wip = WIP.objects.select_for_update().get(pk=dispatch.wip_id)
        _maybe_auto_complete_wip(wip)

    dispatch = _dispatch_detail_queryset().get(pk=dispatch_id)
    return 200, DispatchDetailOut.from_dispatch(dispatch)


@dispatch_router.post(
    "/{dispatch_id}/report-exception/",
    response={200: DispatchDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def report_exception(
    request: HttpRequest,
    dispatch_id: int,
    payload: ExceptionReportIn = ExceptionReportIn(),  # noqa: B008
):
    """Report an execution exception. Lab staff only."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    with transaction.atomic():
        try:
            dispatch = Dispatch.objects.select_for_update().get(pk=dispatch_id)
        except Dispatch.DoesNotExist:
            return 404, {"detail": "Not found"}

        try:
            target = validate_dispatch_transition(dispatch.status, "report_exception")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        dispatch.status = target
        if payload.note:
            dispatch.note = f"{dispatch.note}\n[Exception] {payload.note}".strip()
        dispatch.save()

    dispatch = _dispatch_detail_queryset().get(pk=dispatch_id)
    return 200, DispatchDetailOut.from_dispatch(dispatch)


@dispatch_router.post(
    "/{dispatch_id}/redispatch/",
    response={200: DispatchDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def redispatch(request: HttpRequest, dispatch_id: int):
    """Redispatch an exception dispatch. Creates a new PENDING dispatch. Lab staff only."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    with transaction.atomic():
        try:
            dispatch = (
                Dispatch.objects.select_for_update()
                .select_related("wip")
                .get(pk=dispatch_id)
            )
        except Dispatch.DoesNotExist:
            return 404, {"detail": "Not found"}

        try:
            target = validate_dispatch_transition(dispatch.status, "redispatch")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        dispatch.status = target
        dispatch.save()

        # Create a new dispatch with the same experiment/equipment/recipe;
        # carry the duration estimate over so the SPA countdown stays
        # accurate on the redispatched run.
        Dispatch.objects.create(
            wip=dispatch.wip,
            experiment_type=dispatch.experiment_type,
            equipment=dispatch.equipment,
            recipe=dispatch.recipe,
            estimated_duration_seconds=dispatch.estimated_duration_seconds,
            created_by=request.auth,
        )

    dispatch = _dispatch_detail_queryset().get(pk=dispatch_id)
    return 200, DispatchDetailOut.from_dispatch(dispatch)


@dispatch_router.post(
    "/{dispatch_id}/abort/",
    response={200: DispatchDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def abort_dispatch(request: HttpRequest, dispatch_id: int):
    """Abort a dispatch. Lab staff and managers allowed.

    Aborting clears one active dispatch — if the WIP had a prior
    COMPLETED dispatch and this abort closes out the last in-flight
    one, the WIP auto-completes via the same gate as record_result.
    An all-aborted WIP (no COMPLETED at all) is intentionally NOT
    auto-completed; the operator decides whether to manually complete
    or open a fresh dispatch.
    """
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    with transaction.atomic():
        try:
            dispatch = Dispatch.objects.select_for_update().get(pk=dispatch_id)
        except Dispatch.DoesNotExist:
            return 404, {"detail": "Not found"}

        try:
            target = validate_dispatch_transition(dispatch.status, "abort")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        dispatch.status = target
        dispatch.save()

        wip = WIP.objects.select_for_update().get(pk=dispatch.wip_id)
        _maybe_auto_complete_wip(wip)

    dispatch = _dispatch_detail_queryset().get(pk=dispatch_id)
    return 200, DispatchDetailOut.from_dispatch(dispatch)


# =============================================================================
# Automation endpoints
# =============================================================================


@automation_router.post(
    "/equipment-result/",
    response={200: DispatchDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def submit_equipment_result(request: HttpRequest, payload: AutomationResultIn):
    """Automated equipment result submission. Completes dispatch and creates result.

    Accepts dispatch in DISPATCHED or RUNNING state. Runs the abbreviated
    state machine chain: unload → record_result (which now lands
    directly in COMPLETED).
    """
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    with transaction.atomic():
        try:
            dispatch = (
                Dispatch.objects.select_for_update()
                .select_related("wip", "experiment_type")
                .get(pk=payload.dispatch_id)
            )
        except Dispatch.DoesNotExist:
            return 404, {"detail": "Dispatch not found"}

        # Run state machine chain: (dispatched|running) → unloaded → completed.
        for action in ("unload", "record_result"):
            try:
                target = validate_dispatch_transition(dispatch.status, action)
            except InvalidTransitionError as e:
                return 400, {"detail": str(e)}
            dispatch.status = target

        dispatch.completed_at = timezone.now()
        dispatch.save()

        ExperimentResult.objects.create(
            dispatch=dispatch,
            comment=payload.comment,
        )

        # Update experiment statuses for all samples in the WIP.
        _update_experiment_statuses_on_dispatch_complete(dispatch)

        # Same auto-complete trigger as the manual record_result path.
        wip = WIP.objects.select_for_update().get(pk=dispatch.wip_id)
        _maybe_auto_complete_wip(wip)

    dispatch = _dispatch_detail_queryset().get(pk=payload.dispatch_id)
    return 200, DispatchDetailOut.from_dispatch(dispatch)
