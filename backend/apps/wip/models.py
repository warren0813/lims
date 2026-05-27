from django.contrib.auth.models import User
from django.db import models


class WIPStatus(models.TextChoices):
    CREATED = "created", "已建立"
    IN_PROGRESS = "in_progress", "處理中"
    COMPLETED = "completed", "已完成"
    ABORTED = "aborted", "已中止"


class DispatchStatus(models.TextChoices):
    PENDING = "pending", "待派貨"
    DISPATCHED = "dispatched", "已派貨"
    RUNNING = "running", "執行中"
    EXECUTION_EXCEPTION = "execution_exception", "執行異常"
    UNLOADED = "unloaded", "已下貨"
    RESULT_RECORDED = "result_recorded", "結果已登錄"
    COMPLETED = "completed", "已完成"
    PENDING_REDISPATCH = "pending_redispatch", "待重派"
    ABORTED = "aborted", "已中止"


class SampleExperimentProgress(models.TextChoices):
    PENDING = "pending", "待處理"
    IN_PROGRESS = "in_progress", "處理中"
    COMPLETED = "completed", "已完成"
    # FAILED is kept in the enum for migration / historical compatibility
    # but new code does not assign it. Pass/fail outcome lives on
    # SampleExperimentStatus.verdict; procedural state is just pending →
    # in_progress → completed regardless of verdict.
    FAILED = "failed", "不合格"


class SampleExperimentVerdict(models.TextChoices):
    """Per-(sample, experiment_type) outcome assigned at record_result."""

    PASS = "pass", "合格"
    FAIL = "fail", "不合格"


class WIP(models.Model):
    """Work In Progress: a batch of samples bound to one experiment_type.

    Chat-design: equipment is no longer a property of the WIP — it's
    chosen per-dispatch (see Dispatch.equipment).
    """

    experiment_type = models.ForeignKey(
        "experiments.ExperimentType",
        on_delete=models.PROTECT,
        related_name="wips",
    )
    samples = models.ManyToManyField(
        "commissions.Sample",
        through="WIPSample",
        related_name="wips",
    )
    status = models.CharField(
        max_length=30, choices=WIPStatus.choices, default=WIPStatus.CREATED
    )
    note = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="created_wips"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wip"
        indexes = [
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"WIP #{self.pk} ({self.status})"


class WIPSample(models.Model):
    """Through model linking a WIP to its samples."""

    wip = models.ForeignKey(WIP, on_delete=models.CASCADE, related_name="wip_samples")
    sample = models.ForeignKey(
        "commissions.Sample",
        on_delete=models.PROTECT,
        related_name="wip_samples",
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "wip_sample"
        unique_together = ("wip", "sample")

    def __str__(self) -> str:
        return f"WIP #{self.wip_id} – Sample #{self.sample_id}"


class Dispatch(models.Model):
    """A single experiment execution dispatched from a WIP."""

    wip = models.ForeignKey(WIP, on_delete=models.CASCADE, related_name="dispatches")
    experiment_type = models.ForeignKey(
        "experiments.ExperimentType",
        on_delete=models.PROTECT,
        related_name="dispatches",
    )
    equipment = models.ForeignKey(
        "equipment.Equipment",
        on_delete=models.PROTECT,
        related_name="dispatches",
    )
    recipe = models.ForeignKey(
        "equipment.Recipe",
        on_delete=models.PROTECT,
        related_name="dispatches",
    )
    status = models.CharField(
        max_length=30,
        choices=DispatchStatus.choices,
        default=DispatchStatus.PENDING,
    )
    note = models.TextField(blank=True)
    estimated_duration_seconds = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="預估執行秒數",
    )
    dispatched_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="created_dispatches"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "dispatch"
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["wip", "experiment_type"]),
            models.Index(fields=["wip", "status"]),
        ]

    def __str__(self) -> str:
        return f"Dispatch #{self.pk} ({self.status})"


class ExperimentResult(models.Model):
    """Recorded outcome of a completed dispatch.

    Pass/fail outcome lives per-wafer on SampleExperimentStatus.verdict
    (randomised by the server at record_result time); this row only
    carries a free-form operator comment about the run as a whole.
    """

    dispatch = models.OneToOneField(
        Dispatch, on_delete=models.CASCADE, related_name="result"
    )
    comment = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="recorded_results",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "experiment_result"

    def __str__(self) -> str:
        return f"Result for Dispatch #{self.dispatch_id}"


class SampleExperimentStatus(models.Model):
    """Tracks per-sample, per-experiment-type completion status."""

    sample = models.ForeignKey(
        "commissions.Sample",
        on_delete=models.CASCADE,
        related_name="experiment_statuses",
    )
    experiment_type = models.ForeignKey(
        "experiments.ExperimentType",
        on_delete=models.PROTECT,
        related_name="sample_statuses",
    )
    status = models.CharField(
        max_length=20,
        choices=SampleExperimentProgress.choices,
        default=SampleExperimentProgress.PENDING,
    )
    verdict = models.CharField(
        max_length=8,
        choices=SampleExperimentVerdict.choices,
        null=True,
        blank=True,
        help_text="Per-wafer pass/fail outcome — null until record_result fills it.",
    )
    dispatch = models.ForeignKey(
        "wip.Dispatch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sample_experiment_statuses",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sample_experiment_status"
        unique_together = ("sample", "experiment_type")
        indexes = [
            models.Index(fields=["sample", "status"]),
        ]

    def __str__(self) -> str:
        return f"Sample #{self.sample_id} – {self.experiment_type_id}: {self.status}"
