"""Factory classes for the equipment app, used in tests."""

import factory
from factory.django import DjangoModelFactory

from apps.equipment.models import Equipment, EquipmentStatus, Recipe
from apps.experiments.factories import ExperimentTypeFactory


class EquipmentFactory(DjangoModelFactory):
    """Factory for Equipment instances."""

    class Meta:
        model = Equipment

    name = factory.Sequence(lambda n: f"equipment_{n}")
    model_name = factory.Sequence(lambda n: f"model_{n}")
    capacity = 25
    status = EquipmentStatus.AVAILABLE


class RecipeFactory(DjangoModelFactory):
    """Factory for Recipe instances."""

    class Meta:
        model = Recipe

    name = factory.Sequence(lambda n: f"recipe_{n}")
    description = "Test recipe description"
    parameters = {"temperature_celsius": 150, "duration_hours": 300}
    experiment_type = factory.SubFactory(ExperimentTypeFactory)
    is_active = True
