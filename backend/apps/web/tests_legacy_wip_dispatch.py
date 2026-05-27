import pytest
from django.urls import reverse

from apps.accounts.factories import LabStaffFactory
from apps.commissions.factories import RequestFactory, SampleFactory
from apps.commissions.models import RequestExperiment, RequestStatus, SampleStatus
from apps.commissions.state_machine import InvalidTransitionError
from apps.equipment.factories import EquipmentFactory, RecipeFactory
from apps.equipment.models import EquipmentCapability
from apps.experiments.factories import ExperimentTypeFactory
from apps.wip.factories import DispatchFactory, WIPFactory
from apps.wip.models import (
    WIP,
    DispatchStatus,
    ExperimentResult,
    WIPSample,
    WIPStatus,
)


@pytest.mark.django_db
def test_web_wip_create_rolls_back_when_sample_transition_fails(client, monkeypatch):
    profile = LabStaffFactory()
    user = profile.user
    experiment_type = ExperimentTypeFactory()
    request_obj = RequestFactory(status=RequestStatus.IN_PROGRESS, requester=user)
    RequestExperiment.objects.create(
        request=request_obj,
        experiment_type=experiment_type,
    )
    sample = SampleFactory(request=request_obj, status=SampleStatus.RECEIVED)

    calls = 0

    def flaky_transition(status, action):
        nonlocal calls
        calls += 1
        if calls == 1:
            return SampleStatus.PROCESSING
        raise InvalidTransitionError("Sample", status, action)

    monkeypatch.setattr("apps.web.views.validate_sample_transition", flaky_transition)
    client.force_login(user)

    with pytest.raises(InvalidTransitionError):
        client.post(
            reverse("web:wip-create"),
            data={
                "sample_ids": [str(sample.pk)],
                "experiment_type_id": str(experiment_type.pk),
            },
        )

    assert WIP.objects.count() == 0
    assert WIPSample.objects.count() == 0
    sample.refresh_from_db()
    assert sample.status == SampleStatus.RECEIVED


@pytest.mark.django_db
def test_legacy_dispatch_complete_uses_record_result_flow(client):
    profile = LabStaffFactory()
    user = profile.user
    experiment_type = ExperimentTypeFactory()
    equipment = EquipmentFactory()
    EquipmentCapability.objects.create(
        equipment=equipment,
        experiment_type=experiment_type,
    )
    recipe = RecipeFactory(experiment_type=experiment_type)
    wip = WIPFactory(
        experiment_type=experiment_type,
        status=WIPStatus.IN_PROGRESS,
        created_by=user,
    )
    dispatch = DispatchFactory(
        wip=wip,
        experiment_type=experiment_type,
        equipment=equipment,
        recipe=recipe,
        status=DispatchStatus.UNLOADED,
        created_by=user,
    )
    client.force_login(user)

    response = client.post(
        reverse("web:dispatch-complete", args=[dispatch.pk]),
        data={"comment": "legacy complete route"},
    )

    assert response.status_code == 302
    dispatch.refresh_from_db()
    assert dispatch.status == DispatchStatus.COMPLETED
    result = ExperimentResult.objects.get(dispatch=dispatch)
    assert result.comment == "legacy complete route"
    assert result.recorded_by == user
