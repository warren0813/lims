"""End-to-end integration tests for the LIMS backend.

These tests exercise complete business workflows spanning multiple apps,
using the HTTP API as the primary interface. Direct ORM access is used
only when no corresponding API endpoint exists (e.g., sample split).
"""

import pytest
from django.test import Client

from apps.accounts.auth import create_access_token
from apps.accounts.factories import FabUserFactory, LabManagerFactory, LabStaffFactory
from apps.commissions.models import RequestExperiment, RequestStatus, SampleStatus
from apps.equipment.factories import EquipmentFactory, RecipeFactory
from apps.equipment.models import EquipmentCapability
from apps.experiments.factories import ExperimentTypeFactory
from apps.wip.models import DispatchStatus, ExperimentResult, WIPStatus

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def client():
    return Client()


@pytest.fixture
def fab_user():
    return FabUserFactory().user


@pytest.fixture
def lab_staff():
    return LabStaffFactory().user


@pytest.fixture
def lab_manager():
    return LabManagerFactory().user


@pytest.fixture
def experiment_type():
    return ExperimentTypeFactory()


@pytest.fixture
def equipment(experiment_type):
    equip = EquipmentFactory()
    EquipmentCapability.objects.create(equipment=equip, experiment_type=experiment_type)
    return equip


@pytest.fixture
def recipe(equipment, experiment_type):
    return RecipeFactory(experiment_type=experiment_type)


# =============================================================================
# Helpers
# =============================================================================


def _headers(user) -> dict:
    """Build JWT Bearer auth headers for the given user."""
    token = create_access_token(user.pk)
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


def _post(client, url, user, data=None) -> object:
    """POST JSON to url and return the response."""
    kwargs = {"content_type": "application/json", **_headers(user)}
    if data is not None:
        kwargs["data"] = data
    return client.post(url, **kwargs)


def _get(client, url, user) -> object:
    return client.get(url, **_headers(user))


def _run_dispatch_to_complete(client, dispatch_id, lab_staff_user) -> dict:
    """Drive a dispatch from PENDING to COMPLETED via the API.

    Steps: start (PENDING→RUNNING) → unload → record-result.
    record-result is the terminal step now — it lands in COMPLETED
    directly; there is no separate /complete/ call.
    """
    r = _post(client, f"/api/dispatches/{dispatch_id}/start/", lab_staff_user)
    assert r.status_code == 200, r.json()
    r = _post(client, f"/api/dispatches/{dispatch_id}/unload/", lab_staff_user)
    assert r.status_code == 200, r.json()
    r = _post(
        client,
        f"/api/dispatches/{dispatch_id}/record-result/",
        lab_staff_user,
        {"comment": "E2E test result"},
    )
    assert r.status_code == 200, r.json()
    return r.json()


def _create_and_receive_request(
    client, fab_user, lab_manager, lab_staff, experiment_type
):
    """Create a request, approve it, ship it, and receive all samples.

    Returns (request_id, [sample_id, ...]).
    The samples will be in RECEIVED status after this helper.
    """
    # fab_user creates the request
    r = _post(
        client,
        "/api/requests/",
        fab_user,
        {
            "title": "E2E test request",
            "experiment_type_ids": [experiment_type.pk],
            "samples": [{"wafer_id": "WF-E2E-001", "wafer_size": "300mm"}],
        },
    )
    assert r.status_code == 201, r.json()
    request_id = r.json()["id"]
    sample_id = r.json()["samples"][0]["id"]

    # fab_user submits
    r = _post(client, f"/api/requests/{request_id}/submit", fab_user)
    assert r.status_code == 200

    # lab_manager approves
    r = _post(client, f"/api/requests/{request_id}/approve", lab_manager)
    assert r.status_code == 200

    # fab_user ships
    r = _post(client, f"/api/requests/{request_id}/ship", fab_user)
    assert r.status_code == 200

    # lab_staff receives the sample
    r = _post(client, f"/api/samples/{sample_id}/receive", lab_staff)
    assert r.status_code == 200, r.json()

    return request_id, [sample_id]


# =============================================================================
# Test 7.1: Full happy-path workflow
# =============================================================================


@pytest.mark.django_db
class TestFullWorkflow:
    """Complete workflow: open → approve → ship → receive → WIP → Dispatch → close."""

    def test_full_happy_path(
        self,
        client,
        fab_user,
        lab_staff,
        lab_manager,
        experiment_type,
        equipment,
        recipe,
    ):
        # --- Phase 1: Create and approve the request ---
        request_id, sample_ids = _create_and_receive_request(
            client, fab_user, lab_manager, lab_staff, experiment_type
        )
        sample_id = sample_ids[0]

        # Verify request is now in_progress (all samples received)
        r = _get(client, f"/api/requests/{request_id}", lab_manager)
        assert r.json()["status"] == RequestStatus.IN_PROGRESS

        # Verify sample is in RECEIVED state
        r = _get(client, f"/api/samples/{sample_id}", lab_staff)
        assert r.json()["status"] == SampleStatus.RECEIVED

        # --- Phase 2: Set sample to PROCESSING (no API endpoint; direct ORM) ---
        from apps.commissions.models import Sample

        Sample.objects.filter(pk=sample_id).update(status=SampleStatus.PROCESSING)

        # --- Phase 3: Create WIP ---
        r = _post(
            client,
            "/api/wips/",
            lab_staff,
            {
                "sample_ids": [sample_id],
                "experiment_type_id": experiment_type.pk,
            },
        )
        assert r.status_code == 201, r.json()
        wip_id = r.json()["id"]
        assert r.json()["status"] == WIPStatus.CREATED

        # --- Phase 4: Create Dispatch (auto-transitions WIP to in_progress) ---
        r = _post(
            client,
            f"/api/wips/{wip_id}/dispatches/",
            lab_staff,
            {
                "equipment_id": equipment.pk,
                "recipe_id": recipe.pk,
            },
        )
        assert r.status_code == 201, r.json()
        dispatch_id = r.json()["dispatches"][0]["id"]

        r = _get(client, f"/api/wips/{wip_id}/", lab_staff)
        assert r.json()["status"] == WIPStatus.IN_PROGRESS

        # --- Phase 5: Run dispatch to completion ---
        _run_dispatch_to_complete(client, dispatch_id, lab_staff)

        r = _get(client, f"/api/dispatches/{dispatch_id}/", lab_staff)
        assert r.json()["status"] == DispatchStatus.COMPLETED

        # --- Phase 6: WIP auto-completes after the last dispatch lands in
        # COMPLETED (cascades to sample and request). No manual
        # /wips/{id}/complete/ POST needed.
        r = _get(client, f"/api/wips/{wip_id}/", lab_staff)
        assert r.json()["status"] == WIPStatus.COMPLETED

        r = _get(client, f"/api/samples/{sample_id}", lab_staff)
        assert r.json()["status"] == SampleStatus.COMPLETED

        r = _get(client, f"/api/requests/{request_id}", lab_manager)
        assert r.json()["status"] == RequestStatus.COMPLETED

        # --- Phase 7: Close the request ---
        r = _post(client, f"/api/requests/{request_id}/close", lab_manager)
        assert r.status_code == 200, r.json()
        assert r.json()["status"] == RequestStatus.CLOSED


# =============================================================================
# Test 7.2: Multi-dispatch workflow
# =============================================================================


@pytest.mark.django_db
class TestMultiDispatchWorkflow:
    """One WIP with multiple dispatches over its lifetime — single-active
    rule means dispatches must be sequential. WIP auto-completes when
    the final dispatch lands in COMPLETED (and at least one COMPLETED
    dispatch exists)."""

    def test_abort_then_redo_then_auto_complete(
        self, client, lab_staff, lab_manager, experiment_type, equipment, recipe
    ):
        """Operator creates a dispatch, aborts it, then creates a fresh
        one and drives it to COMPLETED. The WIP auto-completes on that
        second dispatch's record-result call."""
        from apps.commissions.factories import SampleFactory
        from apps.wip.factories import WIPFactory
        from apps.wip.models import WIPSample

        sample = SampleFactory(status=SampleStatus.PROCESSING)
        RequestExperiment.objects.create(
            request=sample.request, experiment_type=experiment_type
        )
        wip = WIPFactory(
            experiment_type=experiment_type,
            status=WIPStatus.IN_PROGRESS,
            created_by=lab_staff,
        )
        WIPSample.objects.create(wip=wip, sample=sample)
        wip_id = wip.pk

        # First dispatch — gets aborted before run.
        r = _post(
            client,
            f"/api/wips/{wip_id}/dispatches/",
            lab_staff,
            {"equipment_id": equipment.pk, "recipe_id": recipe.pk},
        )
        assert r.status_code == 201, r.json()
        dispatch1_id = r.json()["dispatches"][0]["id"]

        # Trying to create a second dispatch while #1 is still active is
        # blocked by the single-active rule.
        r = _post(
            client,
            f"/api/wips/{wip_id}/dispatches/",
            lab_staff,
            {"equipment_id": equipment.pk, "recipe_id": recipe.pk},
        )
        assert r.status_code == 422, r.json()
        assert "active" in r.json()["detail"].lower()

        # Abort the first dispatch. WIP stays in_progress because no
        # COMPLETED dispatch exists yet.
        r = _post(client, f"/api/dispatches/{dispatch1_id}/abort/", lab_staff)
        assert r.status_code == 200
        r = _get(client, f"/api/wips/{wip_id}/", lab_staff)
        assert r.json()["status"] == WIPStatus.IN_PROGRESS

        # Now create a fresh dispatch — allowed because the aborted one
        # is terminal.
        r = _post(
            client,
            f"/api/wips/{wip_id}/dispatches/",
            lab_staff,
            {"equipment_id": equipment.pk, "recipe_id": recipe.pk},
        )
        assert r.status_code == 201, r.json()
        dispatch2_id = next(
            d["id"] for d in r.json()["dispatches"] if d["id"] != dispatch1_id
        )

        # Drive it to COMPLETED — WIP auto-completes.
        _run_dispatch_to_complete(client, dispatch2_id, lab_staff)
        r = _get(client, f"/api/wips/{wip_id}/", lab_staff)
        assert r.json()["status"] == WIPStatus.COMPLETED


# =============================================================================
# Test 7.3: Exception and redispatch workflow
# =============================================================================


@pytest.mark.django_db
class TestExceptionRedispatch:
    """Dispatch encounters an exception, gets redispatched, new dispatch completes."""

    def test_exception_then_redispatch(
        self, client, lab_staff, experiment_type, equipment, recipe
    ):
        from apps.commissions.factories import SampleFactory
        from apps.wip.factories import WIPFactory
        from apps.wip.models import WIPSample

        sample = SampleFactory(status=SampleStatus.PROCESSING)
        RequestExperiment.objects.create(
            request=sample.request, experiment_type=experiment_type
        )
        wip = WIPFactory(
            experiment_type=experiment_type,
            status=WIPStatus.IN_PROGRESS,
            created_by=lab_staff,
        )
        WIPSample.objects.create(wip=wip, sample=sample)
        wip_id = wip.pk

        # Create dispatch and start it
        r = _post(
            client,
            f"/api/wips/{wip_id}/dispatches/",
            lab_staff,
            {
                "equipment_id": equipment.pk,
                "recipe_id": recipe.pk,
            },
        )
        assert r.status_code == 201
        dispatch_id = r.json()["dispatches"][0]["id"]

        r = _post(client, f"/api/dispatches/{dispatch_id}/start/", lab_staff)
        assert r.status_code == 200

        # Report exception (RUNNING → EXECUTION_EXCEPTION)
        r = _post(
            client,
            f"/api/dispatches/{dispatch_id}/report-exception/",
            lab_staff,
            {"note": "Equipment malfunction"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == DispatchStatus.EXECUTION_EXCEPTION

        # Redispatch (creates new PENDING dispatch)
        r = _post(client, f"/api/dispatches/{dispatch_id}/redispatch/", lab_staff)
        assert r.status_code == 200
        assert r.json()["status"] == DispatchStatus.PENDING_REDISPATCH

        # Find the new dispatch (latest PENDING dispatch for this WIP)
        from apps.wip.models import Dispatch

        new_dispatch = Dispatch.objects.filter(
            wip_id=wip_id, status=DispatchStatus.PENDING
        ).latest("created_at")
        new_dispatch_id = new_dispatch.pk

        # Complete the new dispatch — WIP auto-completes because the
        # original is PENDING_REDISPATCH (terminal) and the new one is
        # COMPLETED, so all dispatches are terminal + ≥1 COMPLETED.
        _run_dispatch_to_complete(client, new_dispatch_id, lab_staff)

        r = _get(client, f"/api/wips/{wip_id}/", lab_staff)
        assert r.json()["status"] == WIPStatus.COMPLETED


# =============================================================================
# Test 7.4: Sample lost workflow
# =============================================================================


@pytest.mark.django_db
class TestSampleLostWorkflow:
    """Sample is lost during shipping and then voided."""

    def test_sample_lost_then_voided(
        self, client, fab_user, lab_staff, lab_manager, experiment_type
    ):
        # Create request and ship it
        r = _post(
            client,
            "/api/requests/",
            fab_user,
            {
                "title": "Lost sample test",
                "experiment_type_ids": [experiment_type.pk],
                "samples": [{"wafer_id": "WF-LOST-001", "wafer_size": "300mm"}],
            },
        )
        assert r.status_code == 201
        request_id = r.json()["id"]
        sample_id = r.json()["samples"][0]["id"]

        _post(client, f"/api/requests/{request_id}/submit", fab_user)
        _post(client, f"/api/requests/{request_id}/approve", lab_manager)
        r = _post(client, f"/api/requests/{request_id}/ship", fab_user)
        assert r.status_code == 200

        # Sample is now SHIPPED
        r = _get(client, f"/api/samples/{sample_id}", lab_staff)
        assert r.json()["status"] == SampleStatus.SHIPPED

        # Lab staff reports sample as lost
        r = _post(client, f"/api/samples/{sample_id}/report-lost", lab_staff)
        assert r.status_code == 200
        assert r.json()["status"] == SampleStatus.LOST

        # Lab staff voids the lost sample
        r = _post(client, f"/api/samples/{sample_id}/void", lab_staff)
        assert r.status_code == 200
        assert r.json()["status"] == SampleStatus.VOIDED

        # All samples are terminal (voided), so request auto-completes.
        r = _get(client, f"/api/requests/{request_id}", lab_manager)
        assert r.json()["status"] == RequestStatus.COMPLETED


# =============================================================================
# Test 7.5: Cancellation workflow
# =============================================================================


@pytest.mark.django_db
class TestCancelWorkflow:
    """Cancelling a request blocks all further workflow actions."""

    def test_cancel_approved_request(
        self, client, fab_user, lab_manager, experiment_type
    ):
        r = _post(
            client,
            "/api/requests/",
            fab_user,
            {
                "title": "Cancel test",
                "experiment_type_ids": [experiment_type.pk],
                "samples": [{"wafer_id": "WF-CANCEL-001", "wafer_size": "300mm"}],
            },
        )
        assert r.status_code == 201
        request_id = r.json()["id"]

        _post(client, f"/api/requests/{request_id}/submit", fab_user)
        _post(client, f"/api/requests/{request_id}/approve", lab_manager)

        # Cancel the approved request
        r = _post(
            client,
            f"/api/requests/{request_id}/cancel",
            fab_user,
            {"reason": "No longer needed"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == RequestStatus.CANCELLED

    def test_cancelled_request_cannot_be_shipped(
        self, client, fab_user, lab_manager, experiment_type
    ):
        r = _post(
            client,
            "/api/requests/",
            fab_user,
            {
                "title": "Cancel block test",
                "experiment_type_ids": [experiment_type.pk],
                "samples": [{"wafer_id": "WF-CANCEL-002", "wafer_size": "300mm"}],
            },
        )
        assert r.status_code == 201
        request_id = r.json()["id"]

        _post(client, f"/api/requests/{request_id}/submit", fab_user)
        _post(client, f"/api/requests/{request_id}/approve", lab_manager)
        _post(
            client,
            f"/api/requests/{request_id}/cancel",
            fab_user,
            {"reason": "Test cancellation"},
        )

        # Ship should be rejected (invalid transition from cancelled)
        r = _post(client, f"/api/requests/{request_id}/ship", fab_user)
        assert r.status_code == 400

    def test_cancel_in_progress_request(
        self, client, fab_user, lab_staff, lab_manager, experiment_type
    ):
        """A request in IN_PROGRESS can also be cancelled."""
        request_id, sample_ids = _create_and_receive_request(
            client, fab_user, lab_manager, lab_staff, experiment_type
        )

        # Request should be in_progress (all samples received)
        r = _get(client, f"/api/requests/{request_id}", lab_manager)
        assert r.json()["status"] == RequestStatus.IN_PROGRESS

        # Lab manager cancels the in_progress request
        r = _post(
            client,
            f"/api/requests/{request_id}/cancel",
            lab_manager,
            {"reason": "Lab incident"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == RequestStatus.CANCELLED


# =============================================================================
# Test 7.6: Automation workflow
# =============================================================================


@pytest.mark.django_db
class TestAutomationWorkflow:
    """Equipment auto-submits results via the automation endpoint."""

    def test_automation_result_completes_dispatch(
        self, client, lab_staff, experiment_type, equipment, recipe
    ):
        from apps.commissions.factories import SampleFactory
        from apps.wip.factories import WIPFactory
        from apps.wip.models import WIPSample

        sample = SampleFactory(status=SampleStatus.PROCESSING)
        RequestExperiment.objects.create(
            request=sample.request, experiment_type=experiment_type
        )
        wip = WIPFactory(
            experiment_type=experiment_type,
            status=WIPStatus.IN_PROGRESS,
            created_by=lab_staff,
        )
        WIPSample.objects.create(wip=wip, sample=sample)
        wip_id = wip.pk

        # Create dispatch and start it
        r = _post(
            client,
            f"/api/wips/{wip_id}/dispatches/",
            lab_staff,
            {
                "equipment_id": equipment.pk,
                "recipe_id": recipe.pk,
            },
        )
        assert r.status_code == 201
        dispatch_id = r.json()["dispatches"][0]["id"]

        r = _post(client, f"/api/dispatches/{dispatch_id}/start/", lab_staff)
        assert r.status_code == 200

        # Equipment submits result automatically — payload is just
        # {dispatch_id, comment} now; per-wafer verdicts are rolled
        # server-side on SampleExperimentStatus.
        r = _post(
            client,
            "/api/automation/equipment-result/",
            lab_staff,
            {
                "dispatch_id": dispatch_id,
                "comment": "Auto-measurement complete",
            },
        )
        assert r.status_code == 200, r.json()
        data = r.json()

        assert data["status"] == DispatchStatus.COMPLETED
        assert data["result"] is not None
        assert data["result"]["comment"] == "Auto-measurement complete"

        # Verify ExperimentResult is stored correctly
        result = ExperimentResult.objects.get(dispatch_id=dispatch_id)
        assert result.comment == "Auto-measurement complete"

        # WIP auto-completes when the only active dispatch finishes via
        # the automation endpoint — no manual /wips/{id}/complete/ POST.
        r = _get(client, f"/api/wips/{wip_id}/", lab_staff)
        assert r.json()["status"] == WIPStatus.COMPLETED

    def test_automation_accepts_dispatched_state(
        self, client, lab_staff, experiment_type, equipment, recipe
    ):
        """Automation endpoint accepts dispatch in DISPATCHED (not yet running) state."""
        from apps.commissions.factories import SampleFactory
        from apps.wip.factories import DispatchFactory, WIPFactory
        from apps.wip.models import DispatchStatus, WIPSample

        sample = SampleFactory(status=SampleStatus.PROCESSING)
        RequestExperiment.objects.create(
            request=sample.request, experiment_type=experiment_type
        )
        wip = WIPFactory(
            experiment_type=experiment_type,
            status=WIPStatus.IN_PROGRESS,
            created_by=lab_staff,
        )
        WIPSample.objects.create(wip=wip, sample=sample)

        dispatch = DispatchFactory(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            status=DispatchStatus.DISPATCHED,
            created_by=lab_staff,
        )

        r = _post(
            client,
            "/api/automation/equipment-result/",
            lab_staff,
            {
                "dispatch_id": dispatch.pk,
                "comment": "Auto result from dispatched state",
            },
        )
        assert r.status_code == 200
        assert r.json()["status"] == DispatchStatus.COMPLETED
        assert r.json()["result"]["comment"] == "Auto result from dispatched state"
