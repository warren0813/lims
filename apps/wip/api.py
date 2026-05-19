"""Django Ninja routers for WIP, Dispatch, and Automation endpoints."""

from django.db import models, transaction
from django.db.models import Prefetch
from django.http import HttpRequest
from django.utils import timezone
from ninja import Query, Router

from api.schemas import ErrorOut
from apps.accounts.auth import JWTAuth
from apps.accounts.permissions import has_lab_role
from apps.commissions.models import Request, RequestStatus, Sample, SampleStatus
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
    WIPSample,
    WIPStatus,
)
from apps.wip.schemas import (
    AutomationResultIn,
    DispatchDetailOut,
    DispatchIn,
    DispatchListOut,
    ExceptionReportIn,
    ExperimentResultIn,
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
    return WIP.objects.select_related("equipment").prefetch_related(
        "samples",
        Prefetch(
            "dispatches",
            queryset=Dispatch.objects.select_related(
                "experiment_type", "recipe"
            ).order_by("created_at"),
        ),
    )


def _dispatch_detail_queryset() -> "models.QuerySet[Dispatch]":
    """Base queryset with all prefetches needed for DispatchDetailOut.

    created_by__profile is selected so DispatchDetailOut.from_dispatch
    can render the operator's department without an extra query.
    """
    return Dispatch.objects.select_related(
"experiment_type", "recipe", "wip__equipment", "created_by__profile"
    ).prefetch_related("result")


def _check_all_dispatches_done(wip: WIP) -> bool:
    """Return True if all dispatches for the WIP are in a terminal state."""
    active_statuses = {
        DispatchStatus.PENDING,
        DispatchStatus.DISPATCHED,
        DispatchStatus.RUNNING,
        DispatchStatus.UNLOADED,
        DispatchStatus.RESULT_RECORDED,
    }
    return not wip.dispatches.filter(status__in=active_statuses).exists()


def _equipment_remaining_capacity(
    equipment: Equipment, exclude_wip_id: int | None = None
) -> int:
    """Return how many more samples can be added to active WIPs on this equipment.

    Active WIPs are those not in COMPLETED or ABORTED state.
    """
    active_statuses = {WIPStatus.CREATED, WIPStatus.IN_PROGRESS}
    active_wips = WIP.objects.filter(equipment=equipment, status__in=active_statuses)
    if exclude_wip_id is not None:
        active_wips = active_wips.exclude(pk=exclude_wip_id)
    occupied = WIPSample.objects.filter(wip__in=active_wips).count()
    return max(equipment.capacity - occupied, 0)


def _validate_samples_for_wip(sample_ids: list[int]) -> tuple[list[Sample], str | None]:
    """Validate that samples are eligible for WIP creation/addition.

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

    return samples, None


def _transition_samples_to_processing(samples: list[Sample]) -> None:
    """Transition RECEIVED samples to PROCESSING status."""
    for sample in samples:
        if sample.status == SampleStatus.RECEIVED:
            target = validate_sample_transition(sample.status, "start_processing")
            sample.status = target
            sample.save(update_fields=["status", "updated_at"])


def _update_experiment_statuses_on_dispatch_complete(dispatch: Dispatch) -> None:
    """When a dispatch completes, update SampleExperimentStatus for all
    samples in the WIP, then check for sample/request auto-completion.

    Must be called inside an active transaction.atomic() block.
    """
    wip = dispatch.wip
    experiment_type = dispatch.experiment_type
    result = getattr(dispatch, "result", None)
    verdict_status = SampleExperimentProgress.COMPLETED
    if result and result.verdict == ExperimentResult.Verdict.FAIL:
        verdict_status = SampleExperimentProgress.FAILED

    sample_ids = list(wip.samples.values_list("pk", flat=True))

    SampleExperimentStatus.objects.filter(
        sample_id__in=sample_ids,
        experiment_type=experiment_type,
    ).update(status=verdict_status, dispatch=dispatch)

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
            except InvalidTransitionError:
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

    qs = WIP.objects.select_related("equipment").order_by("-created_at")
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
    """Create a WIP with samples on a single equipment. Lab staff only."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    # Validate equipment.
    try:
        equipment = Equipment.objects.get(pk=payload.equipment_id)
    except Equipment.DoesNotExist:
        return 404, {"detail": "Equipment not found"}

    if equipment.status != EquipmentStatus.AVAILABLE:
        return 400, {"detail": "Equipment is not available"}

    # Validate samples.
    samples, error = _validate_samples_for_wip(payload.sample_ids)
    if error:
        return 400, {"detail": error}

    # Check equipment capacity.
    remaining = _equipment_remaining_capacity(equipment)
    if len(samples) > remaining:
        return 400, {
            "detail": (
                f"Equipment capacity exceeded: {remaining} slot(s) remaining, "
                f"but {len(samples)} sample(s) requested"
            )
        }

    with transaction.atomic():
        wip = WIP.objects.create(
            equipment=equipment,
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
    """Add samples to an existing WIP. Lab staff only."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    samples, error = _validate_samples_for_wip(payload.sample_ids)
    if error:
        return 400, {"detail": error}

    with transaction.atomic():
        try:
            wip = WIP.objects.select_for_update().get(pk=wip_id)
        except WIP.DoesNotExist:
            return 404, {"detail": "Not found"}

        if wip.status not in (WIPStatus.CREATED, WIPStatus.IN_PROGRESS):
            return 400, {"detail": "Cannot add samples to a completed or aborted WIP"}

        existing_sample_ids = set(wip.samples.values_list("pk", flat=True))
        for sample in samples:
            if sample.pk in existing_sample_ids:
                return 400, {
                    "detail": f"Sample {sample.wafer_id} is already in this WIP"
                }

        # Check equipment capacity (exclude current WIP's own samples).
        remaining = _equipment_remaining_capacity(wip.equipment, exclude_wip_id=wip.pk)
        total_after = len(existing_sample_ids) + len(samples)
        if total_after > wip.equipment.capacity:
            avail = remaining - len(existing_sample_ids)
            return 400, {
                "detail": (
                    f"Equipment capacity exceeded: {max(avail, 0)} more slot(s) "
                    f"available, but {len(samples)} sample(s) requested"
                )
            }

        for sample in samples:
            WIPSample.objects.create(wip=wip, sample=sample)

        _transition_samples_to_processing(samples)

    wip = _wip_detail_queryset().get(pk=wip_id)
    return 200, WIPDetailOut.from_wip(wip)


@router.post(
    "/{wip_id}/dispatches/",
    response={201: WIPDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def create_dispatch(request: HttpRequest, wip_id: int, payload: DispatchIn):
    """Create a dispatch for a WIP. Validates recipe matches WIP equipment.

    Automatically transitions WIP to in_progress on first dispatch.
    """
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    # Validate experiment type.
    try:
        experiment_type = ExperimentType.objects.get(
            pk=payload.experiment_type_id, is_active=True
        )
    except ExperimentType.DoesNotExist:
        return 400, {"detail": "Experiment type not found or inactive"}

    with transaction.atomic():
        try:
            wip = (
                WIP.objects.select_for_update()
                .select_related("equipment")
                .get(pk=wip_id)
            )
        except WIP.DoesNotExist:
            return 404, {"detail": "Not found"}

        # Validate recipe belongs to this WIP's equipment.
        try:
            recipe = Recipe.objects.get(pk=payload.recipe_id)
        except Recipe.DoesNotExist:
            return 400, {"detail": "Recipe not found"}

        if recipe.equipment_id != wip.equipment_id:
            return 400, {"detail": "Recipe does not belong to this WIP's equipment"}

        if recipe.experiment_type_id != experiment_type.pk:
            return 400, {
                "detail": "Recipe experiment type does not match the dispatch experiment type"
            }

        # Validate equipment capability.
        if not EquipmentCapability.objects.filter(
            equipment=wip.equipment, experiment_type=experiment_type
        ).exists():
            return 400, {"detail": "Equipment does not support this experiment type"}

        # Validate experiment type is relevant to at least one sample in the WIP.
        sample_request_ids = wip.samples.values_list("request_id", flat=True)
        if not Request.objects.filter(
            pk__in=sample_request_ids,
            request_experiments__experiment_type=experiment_type,
        ).exists():
            return 400, {
                "detail": "Experiment type is not required by any sample's request in this WIP"
            }

        Dispatch.objects.create(
            wip=wip,
            experiment_type=experiment_type,
            recipe=recipe,
            note=payload.note,
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
                except InvalidTransitionError:
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

        # Mark PROCESSING samples as processing_exception.
        for sample in Sample.objects.select_for_update().filter(
            pk__in=wip.samples.values_list("pk", flat=True)
        ):
            try:
                sample_target = validate_sample_transition(
                    sample.status, "processing_exception"
                )
                sample.status = sample_target
                sample.save(update_fields=["status", "updated_at"])
            except InvalidTransitionError:
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
        qs = qs.filter(wip__equipment_id=equipment_id)

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
def record_result(request: HttpRequest, dispatch_id: int, payload: ExperimentResultIn):
    """Record result for an unloaded dispatch. Creates ExperimentResult. Lab staff only."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    with transaction.atomic():
        try:
            dispatch = Dispatch.objects.select_for_update().get(pk=dispatch_id)
        except Dispatch.DoesNotExist:
            return 404, {"detail": "Not found"}

        try:
            target = validate_dispatch_transition(dispatch.status, "record_result")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        dispatch.status = target
        if payload.note:
            dispatch.note = f"{dispatch.note}\n{payload.note}".strip()
        dispatch.save()

        ExperimentResult.objects.create(
            dispatch=dispatch,
            summary=payload.summary,
            verdict=payload.verdict,
            data=payload.data,
            data_source=ExperimentResult.DataSource.MANUAL,
            recorded_by=request.auth,
        )

    dispatch = _dispatch_detail_queryset().get(pk=dispatch_id)
    return 200, DispatchDetailOut.from_dispatch(dispatch)


@dispatch_router.post(
    "/{dispatch_id}/complete/",
    response={200: DispatchDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def complete_dispatch(request: HttpRequest, dispatch_id: int):
    """Complete a result_recorded dispatch. Lab staff only."""
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
            target = validate_dispatch_transition(dispatch.status, "complete")
        except InvalidTransitionError as e:
            return 400, {"detail": str(e)}

        dispatch.status = target
        dispatch.completed_at = timezone.now()
        dispatch.save()

        # Update experiment statuses for all samples in the WIP.
        _update_experiment_statuses_on_dispatch_complete(dispatch)

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

        # Create a new dispatch with the same experiment/recipe parameters.
        Dispatch.objects.create(
            wip=dispatch.wip,
            experiment_type=dispatch.experiment_type,
            recipe=dispatch.recipe,
            created_by=request.auth,
        )

    dispatch = _dispatch_detail_queryset().get(pk=dispatch_id)
    return 200, DispatchDetailOut.from_dispatch(dispatch)


@dispatch_router.post(
    "/{dispatch_id}/abort/",
    response={200: DispatchDetailOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
)
def abort_dispatch(request: HttpRequest, dispatch_id: int):
    """Abort a dispatch. Lab staff and managers allowed."""
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

    Accepts dispatch in DISPATCHED or RUNNING state. Runs the full state
    machine chain: unload → record_result → complete.
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

        # Run state machine chain: (dispatched|running) → unloaded → result_recorded → completed.
        for action in ("unload", "record_result", "complete"):
            try:
                target = validate_dispatch_transition(dispatch.status, action)
            except InvalidTransitionError as e:
                return 400, {"detail": str(e)}
            dispatch.status = target

        dispatch.completed_at = timezone.now()
        dispatch.save()

        ExperimentResult.objects.create(
            dispatch=dispatch,
            summary=payload.summary,
            verdict=payload.verdict,
            data=payload.data,
            data_source=ExperimentResult.DataSource.AUTOMATED,
        )

        # Update experiment statuses for all samples in the WIP.
        _update_experiment_statuses_on_dispatch_complete(dispatch)

    dispatch = _dispatch_detail_queryset().get(pk=payload.dispatch_id)
    return 200, DispatchDetailOut.from_dispatch(dispatch)
