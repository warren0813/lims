"""Factory classes for the experiments app, used in tests."""

import factory
from factory.django import DjangoModelFactory

from apps.experiments.models import ExperimentType, LabCategory


class ExperimentTypeFactory(DjangoModelFactory):
    """Factory for ExperimentType instances."""

    class Meta:
        model = ExperimentType

    name = factory.Sequence(lambda n: f"experiment_type_{n}")
    description = "Test experiment description"
    lab_category = LabCategory.RA
    is_active = True
