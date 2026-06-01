"""Domain services for the commissions app — Request lifecycle cascades.

These helpers are the canonical source of truth for Request-level state
propagation. They are called from both the JSON API (apps.commissions.api)
and the legacy SSR views (apps.web.views) so the two channels stay in sync.

All cascade helpers assume the caller already holds the relevant row
lock (select_for_update) on the Request being mutated.
"""

from django.utils import timezone

from apps.commissions.models import Request, RequestStatus, SampleStatus


def initialize_sample_experiment_statuses(req: Request) -> None:
    """Create SampleExperimentStatus rows from each wafer's *own* experiment
    selection. Called once when the request transitions to IN_PROGRESS.

    Per-wafer selection lives on ``Sample.experiment_types`` (the
    ``SampleExperiment`` through table). A wafer with no per-wafer rows — e.g.
    a request created via the legacy SSR form, which only records the
    request-level set — falls back to the full request-level experiment set so
    it still gets initialised.
    """
    # Local import to avoid a top-of-file circular dep: apps.wip imports
    # from apps.commissions.state_machine in its services module.
    from apps.wip.models import SampleExperimentStatus

    request_experiment_types = [
        re.experiment_type
        for re in req.request_experiments.select_related("experiment_type").all()
    ]
    for sample in req.samples.prefetch_related("experiment_types").all():
        chosen = list(sample.experiment_types.all())
        if not chosen:
            chosen = request_experiment_types
        for experiment_type in chosen:
            SampleExperimentStatus.objects.get_or_create(
                sample=sample,
                experiment_type=experiment_type,
            )


def check_all_samples_received(req: Request) -> None:
    """If all samples in a sample_shipped request are accounted for,
    auto-transition the request to in_progress.

    Counts RECEIVED, PROCESSING, COMPLETED, VOIDED, and RETURNED — any
    state that means the sample has been definitively dealt with.

    Caller must hold a lock on the request row (select_for_update).
    """
    if req.status != RequestStatus.SAMPLE_SHIPPED:
        return

    accounted_statuses = {
        SampleStatus.RECEIVED,
        SampleStatus.PROCESSING,
        SampleStatus.COMPLETED,
        SampleStatus.VOIDED,
        SampleStatus.RETURNED,
    }
    total = req.samples.count()
    accounted_count = req.samples.filter(status__in=accounted_statuses).count()

    if total > 0 and accounted_count == total:
        req.status = RequestStatus.IN_PROGRESS
        req.save()
        initialize_sample_experiment_statuses(req)


def check_request_completed(req: Request) -> None:
    """If all samples are in terminal states, auto-complete the request.

    Stamps completed_at when the transition fires so the SPA / reports
    can derive turnaround time.

    Caller must hold a lock on the request row (select_for_update).
    """
    if req.status != RequestStatus.IN_PROGRESS:
        return

    terminal_statuses = {
        SampleStatus.COMPLETED,
        SampleStatus.VOIDED,
        SampleStatus.RETURNED,
    }
    total = req.samples.count()
    terminal_count = req.samples.filter(status__in=terminal_statuses).count()

    if total > 0 and terminal_count == total:
        req.status = RequestStatus.COMPLETED
        req.completed_at = timezone.now()
        req.save(update_fields=["status", "completed_at", "updated_at"])
