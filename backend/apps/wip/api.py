"""Django Ninja routers for WIP, Dispatch, and Automation endpoints."""

from django.db import models, transaction
from django.db.models import Prefetch
from django.http import HttpRequest
from django.utils import timezone
from ninja import Query, Router

from api.schemas import ErrorOut
from apps.accounts.auth import JWTAuth
from apps.accounts.permissions import has_lab_role
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
from apps.wip.services import (
    TERMINAL_DISPATCH_STATUSES,
    cascade_sample_completion,
    cascade_samples_to_processing_exception,
    check_all_dispatches_done,
    equipment_remaining_capacity,
    maybe_auto_complete_wip,
    transition_samples_to_processing,
    update_experiment_statuses_on_unload,
    validate_samples_for_wip,
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

    samples, error = validate_samples_for_wip(payload.sample_ids, experiment_type)
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

        transition_samples_to_processing(samples)

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

        samples, error = validate_samples_for_wip(
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

        transition_samples_to_processing(samples)

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
            recipe = Recipe.objects.get(pk=payload.recipe_id, is_active=True)
        except Recipe.DoesNotExist:
            return 400, {"detail": "Recipe not found"}

        if recipe.experiment_type_id != experiment_type.pk:
            return 400, {
                "detail": "Recipe experiment type does not match the WIP's experiment type"
            }

        sample_count = wip.samples.count()
        remaining = equipment_remaining_capacity(equipment)
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

        if not check_all_dispatches_done(wip):
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

        cascade_sample_completion(list(wip.samples.values_list("pk", flat=True)))

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

        cascade_samples_to_processing_exception(
            list(wip.samples.values_list("pk", flat=True))
        )

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
    """Unload a dispatch (dispatched/running → unloaded). Lab staff only.

    Rolls the per-wafer pass/fail verdict on every SampleExperimentStatus
    row for this dispatch's WIP × experiment_type. This happens at unload
    time (not at record_result) so the Record Result modal can display
    the outcomes before the operator finalises the run.
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
            target = validate_dispatch_transition(dispatch.status, "unload")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        dispatch.status = target
        dispatch.save()

        update_experiment_statuses_on_unload(dispatch)

    dispatch = _dispatch_detail_queryset().get(pk=dispatch_id)
    return 200, DispatchDetailOut.from_dispatch(dispatch)


@dispatch_router.post(
    "/{dispatch_id}/record-result/",
    response={200: DispatchDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def record_result(request: HttpRequest, dispatch_id: int, payload: RecordResultIn):
    """Record result for an unloaded dispatch — terminal step.

    Payload is just {comment}. Per-wafer pass/fail verdicts are rolled
    at unload time (see update_experiment_statuses_on_unload), so by
    the time the Record Result modal opens, the operator can already
    see the outcomes. This endpoint only persists the comment, lands
    the dispatch in COMPLETED, stamps completed_at, and triggers the
    WIP-level auto-complete cascade. Lab staff only.
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

        # Per-wafer verdicts were already rolled at unload time — see
        # update_experiment_statuses_on_unload. record_result only
        # finalises the dispatch (status + completed_at + comment) and
        # then propagates the WIP-level auto-complete.

        # If this was the last active dispatch on the WIP and ≥1
        # dispatch is COMPLETED, auto-complete the WIP (with sample/
        # request cascade) so the operator doesn't have to POST a
        # separate /wips/{id}/complete/.
        wip = WIP.objects.select_for_update().get(pk=dispatch.wip_id)
        maybe_auto_complete_wip(wip)

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
        maybe_auto_complete_wip(wip)

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

        # Run state machine chain: (dispatched|running) → unloaded →
        # completed. The verdict roll fires at the unload step (mirroring
        # the manual flow), so it runs exactly once even though both
        # transitions happen in this single call.
        for action in ("unload", "record_result"):
            try:
                target = validate_dispatch_transition(dispatch.status, action)
            except InvalidTransitionError as e:
                return 400, {"detail": str(e)}
            dispatch.status = target
            if action == "unload":
                # Persist the UNLOADED status before the cascade reads
                # dispatch.status; the helper itself only cares about
                # WIP × experiment_type, but a consistent on-disk row
                # makes the transaction easier to reason about.
                dispatch.save(update_fields=["status", "updated_at"])
                update_experiment_statuses_on_unload(dispatch)

        dispatch.completed_at = timezone.now()
        dispatch.save()

        ExperimentResult.objects.create(
            dispatch=dispatch,
            comment=payload.comment,
            recorded_by=request.auth,
        )

        # Same auto-complete trigger as the manual record_result path.
        wip = WIP.objects.select_for_update().get(pk=dispatch.wip_id)
        maybe_auto_complete_wip(wip)

    dispatch = _dispatch_detail_queryset().get(pk=payload.dispatch_id)
    return 200, DispatchDetailOut.from_dispatch(dispatch)
