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


class WIP(models.Model):
    """Work In Progress: tracks processing lifecycle for a single sample."""

    sample = models.OneToOneField(
        "commissions.Sample",
        on_delete=models.PROTECT,  # prevent silent loss of WIP/Dispatch/ExperimentResult history
        related_name="wip",
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


class Dispatch(models.Model):
    """A single experiment execution dispatched from a WIP to equipment."""

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
            models.Index(fields=["equipment", "status"]),
            models.Index(fields=["wip", "status"]),
        ]

    def __str__(self) -> str:
        return f"Dispatch #{self.pk} ({self.status})"


class ExperimentResult(models.Model):
    """Recorded outcome of a completed dispatch."""

    class DataSource(models.TextChoices):
        MANUAL = "manual", "手動登錄"
        AUTOMATED = "automated", "自動化"

    class Verdict(models.TextChoices):
        PASS = "pass", "合格"
        FAIL = "fail", "不合格"

    dispatch = models.OneToOneField(
        Dispatch, on_delete=models.CASCADE, related_name="result"
    )
    summary = models.TextField()
    verdict = models.CharField(max_length=10, choices=Verdict.choices)
    data = models.JSONField(default=dict, blank=True)
    data_source = models.CharField(
        max_length=20,
        choices=DataSource.choices,
        default=DataSource.MANUAL,
    )
    note = models.TextField(blank=True)
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
        return f"Result for Dispatch #{self.dispatch_id}: {self.verdict}"
