"""Domain services for the wip app — capacity, validation, verdict, cascade.

These helpers are the canonical source of truth for WIP/Dispatch business
rules. They are called from both the JSON API (apps.wip.api) and the
legacy SSR views (apps.web.views) so the two channels stay in sync.

Cascade helpers (maybe_auto_complete_wip, update_experiment_statuses_on_unload)
assume the caller already holds the relevant row lock (select_for_update)
on the WIP / Dispatch being mutated.
"""

import random

from django.utils import timezone

from apps.commissions.models import Request, RequestStatus, Sample, SampleStatus
from apps.commissions.services import check_request_completed
from apps.commissions.state_machine import (
    InvalidTransitionError as SampleInvalidTransitionError,
)
from apps.commissions.state_machine import validate_sample_transition
from apps.equipment.models import Equipment
from apps.experiments.models import ExperimentType
from apps.wip.models import (
    WIP,
    Dispatch,
    DispatchStatus,
    SampleExperimentProgress,
    SampleExperimentStatus,
    SampleExperimentVerdict,
    WIPStatus,
)

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
VERDICT_CHOICES = (SampleExperimentVerdict.PASS, SampleExperimentVerdict.FAIL)
VERDICT_WEIGHTS = (0.8, 0.2)


def random_verdict() -> str:
    """Roll a per-wafer verdict — 80% pass / 20% fail."""
    return random.choices(VERDICT_CHOICES, weights=VERDICT_WEIGHTS, k=1)[0]


def check_all_dispatches_done(wip: WIP) -> bool:
    """Return True if all dispatches for the WIP are in a terminal state."""
    return not wip.dispatches.exclude(status__in=TERMINAL_DISPATCH_STATUSES).exists()


def equipment_remaining_capacity(
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


def validate_samples_for_wip(
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


def transition_samples_to_processing(samples: list[Sample]) -> None:
    """Transition RECEIVED samples to PROCESSING status.

    Wrapped in try/except defensively: callers always pre-validate via
    validate_samples_for_wip so the transition is valid in practice,
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


def _try_complete_sample(sample: Sample) -> bool:
    """Complete a sample if all its experiment statuses are COMPLETED.

    Returns True iff the sample transitioned. Caller must hold a
    select_for_update lock on the sample row.
    """
    if sample.status != SampleStatus.PROCESSING:
        return False
    total = SampleExperimentStatus.objects.filter(sample=sample).count()
    completed = SampleExperimentStatus.objects.filter(
        sample=sample, status=SampleExperimentProgress.COMPLETED
    ).count()
    if total <= 0 or completed < total:
        return False
    try:
        target = validate_sample_transition(sample.status, "complete")
    except SampleInvalidTransitionError:
        return False
    sample.status = target
    sample.save(update_fields=["status", "updated_at"])
    return True


def cascade_sample_completion(sample_ids: list[int]) -> None:
    """For each sample in sample_ids, try to auto-complete it and then
    propagate completion up to its parent request.

    Caller must be inside a transaction.atomic() block.
    """
    for sample in Sample.objects.select_for_update().filter(pk__in=sample_ids):
        if not _try_complete_sample(sample):
            continue
        req = Request.objects.select_for_update().get(pk=sample.request_id)
        check_request_completed(req)


def cascade_samples_to_processing_exception(sample_ids: list[int]) -> None:
    """Mark every sample in sample_ids as processing_exception when the
    transition is allowed. Samples in other states (e.g. RECEIVED if no
    dispatch ever started) are skipped silently — the abort applies at
    the WIP level and we don't want sample-side state-machine failures
    to crash it. Caller must be inside a transaction.atomic() block.
    """
    for sample in Sample.objects.select_for_update().filter(pk__in=sample_ids):
        try:
            target = validate_sample_transition(sample.status, "processing_exception")
        except SampleInvalidTransitionError:
            continue
        sample.status = target
        sample.save(update_fields=["status", "updated_at"])


def maybe_auto_complete_wip(wip: WIP) -> bool:
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

    cascade_sample_completion(list(wip.samples.values_list("pk", flat=True)))
    return True


def update_experiment_statuses_on_unload(dispatch: Dispatch) -> None:
    """Called when a dispatch unloads from the equipment: set
    status=COMPLETED and roll a per-wafer verdict (80/20 pass/fail) on
    every SampleExperimentStatus row attached to this dispatch's
    WIP × experiment_type, then check for sample/request auto-completion.

    The verdict roll happens at unload (not at record_result) so the
    Record Result modal can display the per-wafer outcomes before the
    operator finalises the run with a comment.

    Guarantees a SampleExperimentStatus row exists for every sample in
    the WIP, creating one if upstream init never ran. (Originally
    relied on initialize_sample_experiment_statuses, called when the
    request transitions to IN_PROGRESS — but that's a fragile coupling:
    samples added post-init, or factory-built WIPs that bypass the
    receive flow, would silently land null verdicts.)

    Must be called inside an active transaction.atomic() block.
    """
    wip = dispatch.wip
    experiment_type = dispatch.experiment_type
    sample_ids = list(wip.samples.values_list("pk", flat=True))

    # Per-wafer roll: each row gets its own dice. We can't .update() in
    # bulk because each row needs an independent random value. Use
    # get_or_create so a missing upstream init doesn't silently swallow
    # the verdict assignment — see regression test
    # test_record_result_full_flow_fills_verdict_without_preinit.
    for sample_id in sample_ids:
        row, _ = SampleExperimentStatus.objects.get_or_create(
            sample_id=sample_id, experiment_type=experiment_type
        )
        row.status = SampleExperimentProgress.COMPLETED
        row.verdict = random_verdict()
        row.dispatch = dispatch
        row.save(update_fields=["status", "verdict", "dispatch", "updated_at"])

    cascade_sample_completion(sample_ids)
