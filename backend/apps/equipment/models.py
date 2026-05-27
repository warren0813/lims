from django.core.validators import MinValueValidator
from django.db import models


class EquipmentStatus(models.TextChoices):
    AVAILABLE = "available", "可用"
    MAINTENANCE = "maintenance", "維修中"
    DISABLED = "disabled", "停用"


class Equipment(models.Model):
    """Lab equipment that can perform experiments."""

    name = models.CharField(max_length=200)
    model_name = models.CharField(max_length=200)
    capacity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    status = models.CharField(
        max_length=20,
        choices=EquipmentStatus.choices,
        default=EquipmentStatus.AVAILABLE,
    )
    capabilities = models.ManyToManyField(
        "experiments.ExperimentType",
        through="EquipmentCapability",
        related_name="equipments",
    )
    parameters = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "equipment"

    def __str__(self) -> str:
        return f"{self.name} ({self.model_name})"


class EquipmentCapability(models.Model):
    """Through model mapping equipment to the experiment types it can perform."""

    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE)
    experiment_type = models.ForeignKey(
        "experiments.ExperimentType", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "equipment_capability"
        unique_together = ("equipment", "experiment_type")

    def __str__(self) -> str:
        return f"{self.equipment.name} → {self.experiment_type.name}"


class Recipe(models.Model):
    """Experiment procedure and parameter template for an experiment type.

    Chat-design: recipes are equipment-agnostic — equipment is chosen
    per-dispatch (see wip.Dispatch.equipment).
    """

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    parameters = models.JSONField(default=dict)
    experiment_type = models.ForeignKey(
        "experiments.ExperimentType",
        on_delete=models.CASCADE,
        related_name="recipes",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "recipe"

    def __str__(self) -> str:
        return self.name
