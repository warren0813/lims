from django.contrib.auth.models import User
from django.db import models


class WaferSize(models.TextChoices):
    SIZE_200MM = "200mm", "200mm"
    SIZE_300MM = "300mm", "300mm"


class RequestUrgency(models.TextChoices):
    THREE_DAYS = "3d", "3 days"
    ONE_WEEK = "1w", "1 week"
    TWO_WEEKS = "2w", "2 weeks"


class RequestStatus(models.TextChoices):
    DRAFT = "draft", "草稿"
    PENDING_APPROVAL = "pending_approval", "待簽核"
    APPROVED = "approved", "已核准"
    RETURNED = "returned", "已退回"
    REJECTED = "rejected", "已拒絕"
    SAMPLE_SHIPPED = "sample_shipped", "已送樣"
    IN_PROGRESS = "in_progress", "處理中"
    EXCEPTION = "exception", "異常處理中"
    COMPLETED = "completed", "已完成"
    CLOSED = "closed", "已結單"
    CANCELLED = "cancelled", "已取消"


class SampleStatus(models.TextChoices):
    CREATED = "created", "已建立"
    SHIPPED = "shipped", "已送樣"
    RECEIVED = "received", "已接樣"
    RECEIVING_EXCEPTION = "receiving_exception", "接樣異常"
    PROCESSING = "processing", "處理中"
    PROCESSING_EXCEPTION = "processing_exception", "處理異常"
    COMPLETED = "completed", "已完成"
    LOST = "lost", "送樣遺失"
    RETURNED = "returned", "已退回"
    VOIDED = "voided", "已作廢"


class Request(models.Model):
    """Commission request submitted by a fab user."""

    title = models.CharField(max_length=300)
    requester = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="requests"
    )
    status = models.CharField(
        max_length=20,
        choices=RequestStatus.choices,
        default=RequestStatus.DRAFT,
    )
    urgency = models.CharField(
        max_length=4,
        choices=RequestUrgency.choices,
        default=RequestUrgency.ONE_WEEK,
    )
    experiment_types = models.ManyToManyField(
        "experiments.ExperimentType",
        through="RequestExperiment",
        related_name="requests",
    )
    note = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "request"
        indexes = [
            models.Index(fields=["requester", "status"]),
            models.Index(fields=["status"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.status})"


class RequestExperiment(models.Model):
    """Through model linking a request to its experiment types with per-experiment parameters."""

    request = models.ForeignKey(
        Request, on_delete=models.CASCADE, related_name="request_experiments"
    )
    experiment_type = models.ForeignKey(
        "experiments.ExperimentType", on_delete=models.PROTECT
    )
    parameters = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "request_experiment"
        unique_together = ("request", "experiment_type")


class Sample(models.Model):
    """Physical wafer sample associated with a commission request."""

    request = models.ForeignKey(
        Request, on_delete=models.CASCADE, related_name="samples"
    )
    wafer_id = models.CharField(max_length=100)
    wafer_size = models.CharField(max_length=10, choices=WaferSize.choices)
    status = models.CharField(
        max_length=30,
        choices=SampleStatus.choices,
        default=SampleStatus.CREATED,
    )
    note = models.TextField(blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sample"
        unique_together = ("request", "wafer_id")
        indexes = [
            models.Index(fields=["request", "status"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.wafer_id} ({self.status})"


class ApprovalLog(models.Model):
    """Audit log entry for request approval actions."""

    class Action(models.TextChoices):
        APPROVE = "approve", "核准"
        RETURN = "return", "退回"
        REJECT = "reject", "拒絕"

    request = models.ForeignKey(
        Request, on_delete=models.CASCADE, related_name="approval_logs"
    )
    reviewer = models.ForeignKey(User, on_delete=models.PROTECT)
    action = models.CharField(max_length=10, choices=Action.choices)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "approval_log"
        ordering = ["-created_at", "-pk"]

    def __str__(self) -> str:
        return f"{self.request} - {self.action} by {self.reviewer}"
