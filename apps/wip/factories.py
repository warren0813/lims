"""Factory classes for the wip app, used in tests."""

import factory
from factory.django import DjangoModelFactory

from apps.accounts.factories import UserFactory
from apps.commissions.factories import SampleFactory
from apps.equipment.factories import EquipmentFactory, RecipeFactory
from apps.experiments.factories import ExperimentTypeFactory
from apps.wip.models import (
    WIP,
    Dispatch,
    DispatchStatus,
    ExperimentResult,
    SampleExperimentStatus,
    WIPSample,
    WIPStatus,
)


class WIPFactory(DjangoModelFactory):
    """Factory for WIP instances."""

    class Meta:
        model = WIP

    experiment_type = factory.SubFactory(ExperimentTypeFactory)
    status = WIPStatus.CREATED
    note = ""
    created_by = factory.SubFactory(UserFactory)

    @factory.post_generation
    def samples(self, create, extracted, **kwargs):
        if not create:
            return
        if extracted:
            for sample in extracted:
                WIPSample.objects.create(wip=self, sample=sample)


class WIPSampleFactory(DjangoModelFactory):
    """Factory for WIPSample instances."""

    class Meta:
        model = WIPSample

    wip = factory.SubFactory(WIPFactory)
    sample = factory.SubFactory(SampleFactory)


class DispatchFactory(DjangoModelFactory):
    """Factory for Dispatch instances."""

    class Meta:
        model = Dispatch

    wip = factory.SubFactory(WIPFactory)
    experiment_type = factory.SubFactory(ExperimentTypeFactory)
    equipment = factory.SubFactory(EquipmentFactory)
    recipe = factory.SubFactory(RecipeFactory)
    status = DispatchStatus.PENDING
    note = ""
    created_by = factory.SubFactory(UserFactory)


class ExperimentResultFactory(DjangoModelFactory):
    """Factory for ExperimentResult instances."""

    class Meta:
        model = ExperimentResult

    dispatch = factory.SubFactory(DispatchFactory)
    comment = factory.Sequence(lambda n: f"Test result {n}")


class SampleExperimentStatusFactory(DjangoModelFactory):
    """Factory for SampleExperimentStatus instances."""

    class Meta:
        model = SampleExperimentStatus

    sample = factory.SubFactory(SampleFactory)
    experiment_type = factory.SubFactory(ExperimentTypeFactory)
