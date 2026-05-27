"""Factory classes for the commissions app, used in tests."""

import factory
from factory.django import DjangoModelFactory

from apps.accounts.factories import UserFactory
from apps.commissions.models import (
    ApprovalLog,
    Request,
    RequestExperiment,
    RequestStatus,
    Sample,
    WaferSize,
)
from apps.experiments.factories import ExperimentTypeFactory


class RequestFactory(DjangoModelFactory):
    """Factory for Request instances."""

    class Meta:
        model = Request

    title = factory.Sequence(lambda n: f"commission_request_{n}")
    requester = factory.SubFactory(UserFactory)
    status = RequestStatus.DRAFT
    note = ""


class RequestExperimentFactory(DjangoModelFactory):
    """Factory for RequestExperiment through model instances."""

    class Meta:
        model = RequestExperiment

    request = factory.SubFactory(RequestFactory)
    experiment_type = factory.SubFactory(ExperimentTypeFactory)
    parameters = factory.LazyFunction(dict)


class SampleFactory(DjangoModelFactory):
    """Factory for Sample instances."""

    class Meta:
        model = Sample

    request = factory.SubFactory(RequestFactory)
    wafer_id = factory.Sequence(lambda n: f"WF-{n:04d}")
    wafer_size = WaferSize.SIZE_300MM
    note = ""


class ApprovalLogFactory(DjangoModelFactory):
    """Factory for ApprovalLog instances."""

    class Meta:
        model = ApprovalLog

    request = factory.SubFactory(RequestFactory)
    reviewer = factory.SubFactory(UserFactory)
    action = ApprovalLog.Action.APPROVE
    comment = ""
