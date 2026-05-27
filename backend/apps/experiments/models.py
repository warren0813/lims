from django.db import models


class LabCategory(models.TextChoices):
    RA = "RA", "可靠度分析 (Reliability Analysis)"
    MA = "MA", "材料分析 (Material Analysis)"
    FA = "FA", "失效分析 (Failure Analysis)"
    TM = "TM", "電性測試 (Test & Measurement)"


class ExperimentType(models.Model):
    """Experiment type maintained by lab staff and selected by fab users."""

    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    lab_category = models.CharField(max_length=10, choices=LabCategory.choices)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "experiment_type"

    def __str__(self) -> str:
        return self.name
