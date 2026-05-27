"""API tests for the wip app (WIP, Dispatch, and Automation endpoints)."""

import pytest
from django.test import Client

from apps.accounts.factories import FabUserFactory, LabManagerFactory, LabStaffFactory
from apps.commissions.factories import RequestFactory, SampleFactory
from apps.commissions.models import RequestExperiment, RequestStatus, SampleStatus
from apps.equipment.factories import EquipmentFactory, RecipeFactory
from apps.equipment.models import EquipmentCapability
from apps.experiments.factories import ExperimentTypeFactory
from apps.wip.factories import DispatchFactory, WIPFactory
from apps.wip.models import (
    Dispatch,
    DispatchStatus,
    ExperimentResult,
    SampleExperimentStatus,
    WIPSample,
    WIPStatus,
)


@pytest.fixture
def client():
    return Client()


@pytest.fixture
def auth_headers():
    """Return a factory function that creates JWT Bearer auth headers."""
    from apps.accounts.auth import create_access_token

    def _make_headers(user) -> dict[str, str]:
        token = create_access_token(user.pk)
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    return _make_headers


@pytest.fixture
def fab_user():
    profile = FabUserFactory()
    return profile.user


@pytest.fixture
def lab_staff():
    profile = LabStaffFactory()
    return profile.user


@pytest.fixture
def lab_manager():
    profile = LabManagerFactory()
    return profile.user


@pytest.fixture
def experiment_type():
    return ExperimentTypeFactory()


@pytest.fixture
def equipment(experiment_type):
    """Equipment with capability for the given experiment type."""
    equip = EquipmentFactory()
    EquipmentCapability.objects.create(equipment=equip, experiment_type=experiment_type)
    return equip


@pytest.fixture
def recipe(equipment, experiment_type):
    """Recipe for the given equipment and experiment type."""
    return RecipeFactory(experiment_type=experiment_type)


@pytest.fixture
def in_progress_request(lab_staff, experiment_type):
    """A request in IN_PROGRESS status with one received sample and experiment type."""
    req = RequestFactory(status=RequestStatus.IN_PROGRESS, requester=lab_staff)
    RequestExperiment.objects.create(request=req, experiment_type=experiment_type)
    return req


@pytest.fixture
def sample(in_progress_request):
    """A PROCESSING sample (eligible for WIP) with experiment statuses initialized."""
    s = SampleFactory(request=in_progress_request, status=SampleStatus.PROCESSING)
    # Initialize SampleExperimentStatus for the sample.
    for re in in_progress_request.request_experiments.all():
        SampleExperimentStatus.objects.create(
            sample=s, experiment_type=re.experiment_type
        )
    return s


@pytest.fixture
def wip(sample, equipment, experiment_type, lab_staff):
    """A WIP in created state with one sample."""
    w = WIPFactory(experiment_type=experiment_type, created_by=lab_staff)
    WIPSample.objects.create(wip=w, sample=sample)
    return w


@pytest.fixture
def wip_in_progress(sample, equipment, experiment_type, lab_staff):
    """A WIP in in_progress state."""
    w = WIPFactory(
        experiment_type=experiment_type,
        status=WIPStatus.IN_PROGRESS,
        created_by=lab_staff,
    )
    WIPSample.objects.create(wip=w, sample=sample)
    return w


@pytest.fixture
def dispatch(wip_in_progress, experiment_type, equipment, recipe, lab_staff):
    """A dispatch in pending state."""
    return DispatchFactory(
        wip=wip_in_progress,
        experiment_type=experiment_type,
        equipment=equipment,
        recipe=recipe,
        created_by=lab_staff,
    )


@pytest.fixture
def dispatched_dispatch(dispatch):
    """A dispatch in dispatched state."""
    dispatch.status = DispatchStatus.DISPATCHED
    dispatch.save()
    return dispatch


@pytest.fixture
def running_dispatch(dispatch):
    """A dispatch in running state."""
    dispatch.status = DispatchStatus.RUNNING
    dispatch.save()
    return dispatch


@pytest.fixture
def unloaded_dispatch(dispatch):
    """A dispatch in unloaded state."""
    dispatch.status = DispatchStatus.UNLOADED
    dispatch.save()
    return dispatch


@pytest.fixture
def result_recorded_dispatch(dispatch):
    """A dispatch in result_recorded state with an ExperimentResult.

    Kept around for backward-compat tests; new flow lands dispatches
    in COMPLETED directly via record_result.
    """
    dispatch.status = DispatchStatus.RESULT_RECORDED
    dispatch.save()
    ExperimentResult.objects.create(dispatch=dispatch, comment="Test result")
    return dispatch


# =============================================================================
# WIP API Tests
# =============================================================================


@pytest.mark.django_db
class TestWIPList:
    def test_list_wips_as_lab_staff(self, client, auth_headers, lab_staff, wip):
        """Lab staff can list WIPs."""
        resp = client.get("/api/wips/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        data = resp.json()
        assert any(w["id"] == wip.pk for w in data)

    def test_list_wips_as_lab_manager(self, client, auth_headers, lab_manager, wip):
        """Lab manager can list WIPs."""
        resp = client.get("/api/wips/", **auth_headers(lab_manager))
        assert resp.status_code == 200

    def test_list_wips_fab_user_forbidden(self, client, auth_headers, fab_user):
        """Fab user cannot list WIPs."""
        resp = client.get("/api/wips/", **auth_headers(fab_user))
        assert resp.status_code == 403

    def test_list_wips_filter_by_status(
        self, client, auth_headers, lab_staff, wip, wip_in_progress
    ):
        """WIPs can be filtered by status."""
        resp = client.get(
            f"/api/wips/?status={WIPStatus.IN_PROGRESS}", **auth_headers(lab_staff)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert all(w["status"] == WIPStatus.IN_PROGRESS for w in data)

    def test_list_wips_includes_dispatch_count(
        self,
        client,
        auth_headers,
        lab_staff,
        wip_in_progress,
        wip,
        experiment_type,
        equipment,
        recipe,
    ):
        """Each list row exposes dispatch_count so the SPA Lab WIP list
        can render the per-WIP dispatch count without N round-trips."""
        DispatchFactory(
            wip=wip_in_progress,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
        )
        DispatchFactory(
            wip=wip_in_progress,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
        )

        resp = client.get("/api/wips/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        rows = {row["id"]: row for row in resp.json()}
        assert rows[wip_in_progress.pk]["dispatch_count"] == 2
        assert rows[wip.pk]["dispatch_count"] == 0


@pytest.mark.django_db
class TestWIPCreate:
    def test_create_wip_success(
        self, client, auth_headers, lab_staff, sample, experiment_type
    ):
        """Lab staff can create a WIP for an experiment_type with samples."""
        payload = {
            "sample_ids": [sample.pk],
            "experiment_type_id": experiment_type.pk,
        }
        resp = client.post(
            "/api/wips/",
            data=payload,
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 201, resp.json()
        data = resp.json()
        assert data["experiment_type_id"] == experiment_type.pk
        assert len(data["samples"]) == 1
        assert data["samples"][0]["id"] == sample.pk
        assert data["status"] == WIPStatus.CREATED

    def test_create_wip_experiment_type_not_found(
        self, client, auth_headers, lab_staff
    ):
        """Returns 404 if experiment_type does not exist."""
        resp = client.post(
            "/api/wips/",
            data={"sample_ids": [1], "experiment_type_id": 99999},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 404

    def test_create_wip_sample_not_found(
        self, client, auth_headers, lab_staff, experiment_type
    ):
        """Returns 400 if sample does not exist."""
        resp = client.post(
            "/api/wips/",
            data={
                "sample_ids": [99999],
                "experiment_type_id": experiment_type.pk,
            },
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400

    def test_create_wip_sample_request_missing_experiment_type(
        self, client, auth_headers, lab_staff, sample
    ):
        """Returns 400 if the sample's parent request does not include the
        chosen experiment_type (chat-design constraint)."""
        other_et = ExperimentTypeFactory()
        resp = client.post(
            "/api/wips/",
            data={
                "sample_ids": [sample.pk],
                "experiment_type_id": other_et.pk,
            },
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400
        assert "experiment type" in resp.json()["detail"].lower()

    def test_create_wip_fab_user_forbidden(
        self, client, auth_headers, fab_user, sample, experiment_type
    ):
        """Fab user cannot create WIPs."""
        resp = client.post(
            "/api/wips/",
            data={
                "sample_ids": [sample.pk],
                "experiment_type_id": experiment_type.pk,
            },
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestWIPDetail:
    def test_get_wip_detail_includes_dispatches(
        self, client, auth_headers, lab_staff, wip_in_progress, dispatch
    ):
        """WIP detail includes list of dispatches and samples."""
        resp = client.get(f"/api/wips/{wip_in_progress.pk}/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == wip_in_progress.pk
        assert len(data["dispatches"]) == 1
        assert data["dispatches"][0]["id"] == dispatch.pk
        assert len(data["samples"]) >= 1

    def test_get_wip_not_found(self, client, auth_headers, lab_staff):
        """Returns 404 for unknown WIP."""
        resp = client.get("/api/wips/99999/", **auth_headers(lab_staff))
        assert resp.status_code == 404

    def test_get_wip_fab_user_forbidden(self, client, auth_headers, fab_user, wip):
        """Fab user cannot get WIP detail."""
        resp = client.get(f"/api/wips/{wip.pk}/", **auth_headers(fab_user))
        assert resp.status_code == 403

    def test_wip_detail_nested_dispatch_includes_equipment(
        self, client, auth_headers, lab_staff, wip_in_progress, dispatch
    ):
        """Nested dispatches in WIPDetailOut expose equipment_id + name so
        the SPA's WIP detail page can render per-dispatch equipment without
        a second round-trip per dispatch."""
        resp = client.get(f"/api/wips/{wip_in_progress.pk}/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        nested = resp.json()["dispatches"][0]
        assert nested["equipment_id"] == dispatch.equipment_id
        assert nested["equipment_name"] == dispatch.equipment.name


@pytest.mark.django_db
class TestWIPCreateDispatch:
    def test_create_dispatch_success(
        self, client, auth_headers, lab_staff, wip, equipment, recipe
    ):
        """Lab staff can create a dispatch for a WIP. The payload carries
        equipment_id + recipe_id; experiment_type is derived from the WIP."""
        payload = {
            "equipment_id": equipment.pk,
            "recipe_id": recipe.pk,
        }
        resp = client.post(
            f"/api/wips/{wip.pk}/dispatches/",
            data=payload,
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 201, resp.json()
        data = resp.json()
        assert data["status"] == WIPStatus.IN_PROGRESS

        wip.refresh_from_db()
        assert wip.status == WIPStatus.IN_PROGRESS

    def test_create_dispatch_recipe_experiment_type_mismatch(
        self, client, auth_headers, lab_staff, wip, equipment
    ):
        """Returns 400 if recipe.experiment_type != wip.experiment_type."""
        other_et = ExperimentTypeFactory()
        other_recipe = RecipeFactory(experiment_type=other_et)
        resp = client.post(
            f"/api/wips/{wip.pk}/dispatches/",
            data={
                "equipment_id": equipment.pk,
                "recipe_id": other_recipe.pk,
            },
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400
        assert "experiment type" in resp.json()["detail"].lower()

    def test_create_dispatch_rejects_inactive_recipe(
        self, client, auth_headers, lab_staff, wip, equipment, experiment_type
    ):
        """Soft-deleted recipes cannot be used for new dispatches."""
        inactive_recipe = RecipeFactory(
            experiment_type=experiment_type,
            is_active=False,
        )

        resp = client.post(
            f"/api/wips/{wip.pk}/dispatches/",
            data={
                "equipment_id": equipment.pk,
                "recipe_id": inactive_recipe.pk,
            },
            content_type="application/json",
            **auth_headers(lab_staff),
        )

        assert resp.status_code == 400
        assert "recipe not found" in resp.json()["detail"].lower()
        assert Dispatch.objects.filter(recipe=inactive_recipe).count() == 0

    def test_create_dispatch_equipment_lacks_capability(
        self, client, auth_headers, lab_staff, wip, recipe
    ):
        """Returns 400 if the chosen equipment doesn't support the WIP's
        experiment_type."""
        other_equipment = EquipmentFactory()  # no capability for wip.experiment_type
        resp = client.post(
            f"/api/wips/{wip.pk}/dispatches/",
            data={
                "equipment_id": other_equipment.pk,
                "recipe_id": recipe.pk,
            },
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400
        assert "does not support" in resp.json()["detail"].lower()

    def test_create_dispatch_fab_user_forbidden(
        self, client, auth_headers, fab_user, wip, equipment, recipe
    ):
        """Fab user cannot create dispatches."""
        resp = client.post(
            f"/api/wips/{wip.pk}/dispatches/",
            data={
                "equipment_id": equipment.pk,
                "recipe_id": recipe.pk,
            },
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 403

    # ------------------------------------------------------------------
    # Single-active-dispatch rule: a WIP can have many dispatches across
    # its lifetime, but at most one with status NOT IN (COMPLETED, ABORTED)
    # at a time. Predates this guard: the SPA could let an operator
    # stack two PENDING dispatches on the same WIP if they double-clicked.
    # ------------------------------------------------------------------

    def test_create_dispatch_rejected_when_active_exists(
        self,
        client,
        auth_headers,
        lab_staff,
        wip_in_progress,
        dispatch,
        equipment,
        recipe,
    ):
        """The `dispatch` fixture leaves the WIP with one PENDING dispatch
        already; a second create attempt must 422."""
        # Sanity: precondition has a PENDING dispatch.
        assert dispatch.status == DispatchStatus.PENDING

        resp = client.post(
            f"/api/wips/{wip_in_progress.pk}/dispatches/",
            data={"equipment_id": equipment.pk, "recipe_id": recipe.pk},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 422, resp.json()
        assert "active" in resp.json()["detail"].lower()

    def test_create_dispatch_allowed_when_only_completed_exists(
        self,
        client,
        auth_headers,
        lab_staff,
        wip_in_progress,
        dispatch,
        equipment,
        recipe,
    ):
        """Past COMPLETED dispatches don't count as active — a new
        dispatch (e.g. a re-run) can be created."""
        dispatch.status = DispatchStatus.COMPLETED
        dispatch.save(update_fields=["status"])

        resp = client.post(
            f"/api/wips/{wip_in_progress.pk}/dispatches/",
            data={"equipment_id": equipment.pk, "recipe_id": recipe.pk},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 201, resp.json()

    def test_create_dispatch_allowed_when_only_aborted_exists(
        self,
        client,
        auth_headers,
        lab_staff,
        wip_in_progress,
        dispatch,
        equipment,
        recipe,
    ):
        """Past ABORTED dispatches don't count as active either."""
        dispatch.status = DispatchStatus.ABORTED
        dispatch.save(update_fields=["status"])

        resp = client.post(
            f"/api/wips/{wip_in_progress.pk}/dispatches/",
            data={"equipment_id": equipment.pk, "recipe_id": recipe.pk},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 201, resp.json()

    def test_create_dispatch_allowed_when_only_pending_redispatch_exists(
        self,
        client,
        auth_headers,
        lab_staff,
        wip_in_progress,
        dispatch,
        equipment,
        recipe,
    ):
        """PENDING_REDISPATCH semantically means "this attempt has been
        superseded" — it's terminal for the single-active check, same as
        COMPLETED/ABORTED. Operator can open a fresh dispatch."""
        dispatch.status = DispatchStatus.PENDING_REDISPATCH
        dispatch.save(update_fields=["status"])

        resp = client.post(
            f"/api/wips/{wip_in_progress.pk}/dispatches/",
            data={"equipment_id": equipment.pk, "recipe_id": recipe.pk},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 201, resp.json()

    def test_create_dispatch_with_estimated_duration(
        self, client, auth_headers, lab_staff, wip, equipment, recipe
    ):
        """Optional estimated_duration_seconds round-trips on the WIP-detail
        response's nested dispatches array. Uses a sub-minute value (the
        demo case that drove switching from minutes to seconds)."""
        resp = client.post(
            f"/api/wips/{wip.pk}/dispatches/",
            data={
                "equipment_id": equipment.pk,
                "recipe_id": recipe.pk,
                "estimated_duration_seconds": 20,
            },
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 201, resp.json()
        nested = resp.json()["dispatches"][0]
        assert nested["estimated_duration_seconds"] == 20

    def test_create_dispatch_without_estimated_duration(
        self, client, auth_headers, lab_staff, wip, equipment, recipe
    ):
        """estimated_duration_seconds is optional; the response carries
        null so the SPA can fall back to its hardcoded 24h default."""
        resp = client.post(
            f"/api/wips/{wip.pk}/dispatches/",
            data={"equipment_id": equipment.pk, "recipe_id": recipe.pk},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 201, resp.json()
        assert resp.json()["dispatches"][0]["estimated_duration_seconds"] is None

    def test_create_dispatch_rejects_non_positive_duration(
        self, client, auth_headers, lab_staff, wip, equipment, recipe
    ):
        """Field validation: zero / negative values are rejected by Ninja."""
        resp = client.post(
            f"/api/wips/{wip.pk}/dispatches/",
            data={
                "equipment_id": equipment.pk,
                "recipe_id": recipe.pk,
                "estimated_duration_seconds": 0,
            },
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 422


@pytest.mark.django_db
class TestWIPComplete:
    def test_complete_wip_success(
        self, client, auth_headers, lab_staff, wip_in_progress, result_recorded_dispatch
    ):
        """Lab staff can complete WIP when all dispatches are completed."""
        result_recorded_dispatch.status = DispatchStatus.COMPLETED
        result_recorded_dispatch.save()

        # Mark the sample experiment status as completed so sample auto-completes.
        sample = wip_in_progress.samples.first()
        SampleExperimentStatus.objects.filter(sample=sample).update(status="completed")

        resp = client.post(
            f"/api/wips/{wip_in_progress.pk}/complete/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == WIPStatus.COMPLETED

    def test_complete_wip_with_pending_dispatches_fails(
        self, client, auth_headers, lab_staff, wip_in_progress, dispatch
    ):
        """Cannot complete WIP if any dispatch is still in progress."""
        resp = client.post(
            f"/api/wips/{wip_in_progress.pk}/complete/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestWIPAbort:
    def test_abort_wip_success(self, client, auth_headers, lab_staff, wip_in_progress):
        """Lab staff can abort a WIP in progress."""
        resp = client.post(
            f"/api/wips/{wip_in_progress.pk}/abort/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == WIPStatus.ABORTED

        # Sample should be marked processing_exception
        sample = wip_in_progress.samples.first()
        sample.refresh_from_db()
        assert sample.status == SampleStatus.PROCESSING_EXCEPTION

    def test_abort_wip_completed_fails(
        self, client, auth_headers, lab_staff, wip_in_progress
    ):
        """Cannot abort an already completed WIP — must return 400 with
        a state-machine detail string, not 500."""
        wip_in_progress.status = WIPStatus.COMPLETED
        wip_in_progress.save()
        resp = client.post(
            f"/api/wips/{wip_in_progress.pk}/abort/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        # The detail string is the InvalidTransitionError's message; it
        # should mention both the disallowed action and the source state.
        assert "abort" in detail.lower()
        assert "completed" in detail.lower()

    def test_abort_wip_from_aborted_state_returns_400(
        self, client, auth_headers, lab_staff, wip_in_progress
    ):
        """Aborting an already-aborted WIP is a no-op error, not a 500."""
        wip_in_progress.status = WIPStatus.ABORTED
        wip_in_progress.save()
        resp = client.post(
            f"/api/wips/{wip_in_progress.pk}/abort/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400
        assert "detail" in resp.json()

    def test_abort_wip_with_received_sample_succeeds(
        self, client, auth_headers, lab_staff, equipment, experiment_type
    ):
        """Reproducer for the smoke-test 500: abort_wip on a WIP whose
        sample is still in RECEIVED state (not yet PROCESSING) must NOT
        raise InvalidTransitionError from the sample-side
        processing_exception transition. The sample is skipped silently
        and the WIP transitions to aborted with a 200 response.
        """
        from apps.commissions.factories import RequestFactory, SampleFactory

        req = RequestFactory(status=RequestStatus.IN_PROGRESS, requester=lab_staff)
        RequestExperiment.objects.create(request=req, experiment_type=experiment_type)
        # Sample stays in RECEIVED — never advanced to PROCESSING because
        # no dispatch was ever created on this WIP.
        received_sample = SampleFactory(request=req, status=SampleStatus.RECEIVED)
        wip = WIPFactory(
            experiment_type=experiment_type,
            status=WIPStatus.IN_PROGRESS,
            created_by=lab_staff,
        )
        WIPSample.objects.create(wip=wip, sample=received_sample)

        resp = client.post(f"/api/wips/{wip.pk}/abort/", **auth_headers(lab_staff))
        assert resp.status_code == 200, resp.content
        assert resp.json()["status"] == WIPStatus.ABORTED
        received_sample.refresh_from_db()
        # processing_exception is not a valid transition from RECEIVED,
        # so the sample is left untouched rather than crashing the abort.
        assert received_sample.status == SampleStatus.RECEIVED

    def test_abort_wip_fab_user_forbidden(self, client, auth_headers, fab_user, wip):
        """Fab user cannot abort WIPs."""
        resp = client.post(
            f"/api/wips/{wip.pk}/abort/",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 403


# =============================================================================
# Dispatch API Tests
# =============================================================================


@pytest.mark.django_db
class TestDispatchList:
    def test_list_dispatches_as_lab_staff(
        self, client, auth_headers, lab_staff, dispatch
    ):
        """Lab staff can list dispatches."""
        resp = client.get("/api/dispatches/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        data = resp.json()
        assert any(d["id"] == dispatch.pk for d in data)

    def test_list_dispatches_filter_by_status(
        self, client, auth_headers, lab_staff, dispatch, dispatched_dispatch
    ):
        """Dispatches can be filtered by status."""
        resp = client.get(
            f"/api/dispatches/?status={DispatchStatus.DISPATCHED}",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert all(d["status"] == DispatchStatus.DISPATCHED for d in data)

    def test_list_dispatches_filter_by_wip_id(
        self, client, auth_headers, lab_staff, dispatch
    ):
        """Dispatches can be filtered by wip_id."""
        resp = client.get(
            f"/api/dispatches/?wip_id={dispatch.wip_id}",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert all(d["wip_id"] == dispatch.wip_id for d in data)

    def test_list_dispatches_filter_by_equipment_id(
        self, client, auth_headers, lab_staff, dispatch
    ):
        """Dispatches can be filtered by equipment_id (direct FK on Dispatch)."""
        resp = client.get(
            f"/api/dispatches/?equipment_id={dispatch.equipment_id}",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert all(d["equipment_id"] == dispatch.equipment_id for d in data)

    def test_list_dispatches_fab_user_forbidden(self, client, auth_headers, fab_user):
        """Fab user cannot list dispatches."""
        resp = client.get("/api/dispatches/", **auth_headers(fab_user))
        assert resp.status_code == 403

    def test_list_dispatch_row_includes_created_by(
        self, client, auth_headers, lab_staff, dispatch
    ):
        """Each list row exposes the operator who created the dispatch.

        Used by the SPA Dispatches list to render an Operator column.
        Shape: {id, username, department}. department is empty string if
        the user has no profile."""
        resp = client.get("/api/dispatches/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        rows = {row["id"]: row for row in resp.json()}
        row = rows[dispatch.pk]
        assert row["created_by"] is not None
        assert row["created_by"]["id"] == dispatch.created_by_id
        assert row["created_by"]["username"] == dispatch.created_by.username
        assert "department" in row["created_by"]

    def test_list_dispatch_row_includes_estimated_duration(
        self, client, auth_headers, lab_staff, dispatch
    ):
        """Each list row exposes estimated_duration_seconds (None when
        unset) so the SPA can show a per-dispatch countdown without a
        detail round-trip."""
        dispatch.estimated_duration_seconds = 21600  # 6 hours
        dispatch.save(update_fields=["estimated_duration_seconds"])

        resp = client.get("/api/dispatches/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        row = next(r for r in resp.json() if r["id"] == dispatch.pk)
        assert row["estimated_duration_seconds"] == 21600


@pytest.mark.django_db
class TestDispatchDetail:
    def test_get_dispatch_detail(self, client, auth_headers, lab_staff, dispatch):
        """Lab staff can get dispatch detail."""
        resp = client.get(f"/api/dispatches/{dispatch.pk}/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == dispatch.pk
        assert data["result"] is None
        # Equipment is a direct FK on Dispatch under the chat-design model.
        assert data["equipment_id"] == dispatch.equipment_id

    def test_get_dispatch_with_result(
        self, client, auth_headers, lab_staff, result_recorded_dispatch
    ):
        """Dispatch detail includes experiment result when present.

        Verdict no longer lives on the dispatch result — it's per-wafer
        on SampleExperimentStatus. The result block carries just the
        operator comment.
        """
        resp = client.get(
            f"/api/dispatches/{result_recorded_dispatch.pk}/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["result"] is not None
        assert data["result"]["comment"] == "Test result"
        assert "verdict" not in data["result"]

    def test_get_dispatch_not_found(self, client, auth_headers, lab_staff):
        """Returns 404 for unknown dispatch."""
        resp = client.get("/api/dispatches/99999/", **auth_headers(lab_staff))
        assert resp.status_code == 404

    def test_get_dispatch_fab_user_forbidden(
        self, client, auth_headers, fab_user, dispatch
    ):
        """Fab user cannot get dispatch detail."""
        resp = client.get(f"/api/dispatches/{dispatch.pk}/", **auth_headers(fab_user))
        assert resp.status_code == 403

    def test_dispatch_detail_includes_created_by(
        self, client, auth_headers, lab_staff, dispatch
    ):
        """Detail response exposes the operator who created the dispatch."""
        resp = client.get(f"/api/dispatches/{dispatch.pk}/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        data = resp.json()
        assert data["created_by"] is not None
        assert data["created_by"]["id"] == dispatch.created_by_id
        assert data["created_by"]["username"] == dispatch.created_by.username
        assert "department" in data["created_by"]


@pytest.mark.django_db
class TestDispatchStart:
    def test_start_dispatch_from_pending(
        self, client, auth_headers, lab_staff, dispatch
    ):
        """Starting a pending dispatch moves it to running."""
        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/start/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == DispatchStatus.RUNNING

    def test_start_dispatch_from_dispatched(
        self, client, auth_headers, lab_staff, dispatched_dispatch
    ):
        """Starting a dispatched dispatch moves it to running."""
        resp = client.post(
            f"/api/dispatches/{dispatched_dispatch.pk}/start/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == DispatchStatus.RUNNING

    def test_start_already_running_dispatch_fails(
        self, client, auth_headers, lab_staff, running_dispatch
    ):
        """Cannot start an already running dispatch."""
        resp = client.post(
            f"/api/dispatches/{running_dispatch.pk}/start/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400

    def test_start_dispatch_fab_user_forbidden(
        self, client, auth_headers, fab_user, dispatch
    ):
        """Fab user cannot start dispatches."""
        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/start/",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestDispatchUnload:
    def test_unload_from_running(
        self, client, auth_headers, lab_staff, running_dispatch
    ):
        """Lab staff can unload a running dispatch."""
        resp = client.post(
            f"/api/dispatches/{running_dispatch.pk}/unload/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == DispatchStatus.UNLOADED

    def test_unload_from_dispatched(
        self, client, auth_headers, lab_staff, dispatched_dispatch
    ):
        """Lab staff can unload a dispatched (but not started) dispatch."""
        resp = client.post(
            f"/api/dispatches/{dispatched_dispatch.pk}/unload/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == DispatchStatus.UNLOADED

    def test_unload_from_pending_fails(self, client, auth_headers, lab_staff, dispatch):
        """Cannot unload a pending dispatch."""
        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/unload/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400

    def test_unload_assigns_verdicts_to_all_samples(
        self,
        client,
        auth_headers,
        lab_staff,
        experiment_type,
        equipment,
        recipe,
    ):
        """Per-wafer verdict is rolled at unload time — the Record
        Result modal needs them visible BEFORE the operator opens it,
        so the roll cannot wait until record_result. 3 samples → 3
        verdicts after unload."""
        from apps.commissions.factories import RequestFactory
        from apps.commissions.models import RequestExperiment, RequestStatus
        from apps.wip.models import SampleExperimentStatus

        req = RequestFactory(status=RequestStatus.IN_PROGRESS)
        RequestExperiment.objects.create(request=req, experiment_type=experiment_type)
        samples = [
            SampleFactory(
                request=req,
                wafer_id=f"WF-UNLOAD-{i}",
                status=SampleStatus.PROCESSING,
            )
            for i in range(3)
        ]
        wip = WIPFactory(
            experiment_type=experiment_type,
            status=WIPStatus.IN_PROGRESS,
            created_by=lab_staff,
        )
        for s in samples:
            WIPSample.objects.create(wip=wip, sample=s)
        d = DispatchFactory(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            status=DispatchStatus.RUNNING,
        )

        resp = client.post(f"/api/dispatches/{d.pk}/unload/", **auth_headers(lab_staff))
        assert resp.status_code == 200, resp.json()
        assert resp.json()["status"] == DispatchStatus.UNLOADED

        rows = SampleExperimentStatus.objects.filter(
            sample__in=samples, experiment_type=experiment_type
        )
        assert rows.count() == 3
        for row in rows:
            assert row.verdict in ("pass", "fail"), (
                f"sample {row.sample_id} verdict was {row.verdict!r}"
            )

    def test_unload_verdict_distribution_roughly_80_20(
        self,
        client,
        auth_headers,
        lab_staff,
        experiment_type,
        equipment,
        recipe,
    ):
        """100 unloads of single-sample dispatches with seeded RNG; expect
        ~20 fails, allow Wilson-ish slack. Moved from record_result side
        since the roll happens at unload now."""
        import random

        from apps.commissions.factories import RequestFactory
        from apps.commissions.models import RequestExperiment, RequestStatus
        from apps.wip.models import (
            SampleExperimentStatus,
            SampleExperimentVerdict,
        )

        random.seed(42)

        fail_count = 0
        for i in range(100):
            req = RequestFactory(status=RequestStatus.IN_PROGRESS)
            RequestExperiment.objects.create(
                request=req, experiment_type=experiment_type
            )
            s = SampleFactory(
                request=req,
                wafer_id=f"WF-UNLOAD-DIST-{i:03d}",
                status=SampleStatus.PROCESSING,
            )
            w = WIPFactory(
                experiment_type=experiment_type,
                status=WIPStatus.IN_PROGRESS,
                created_by=lab_staff,
            )
            WIPSample.objects.create(wip=w, sample=s)
            d = DispatchFactory(
                wip=w,
                experiment_type=experiment_type,
                equipment=equipment,
                recipe=recipe,
                status=DispatchStatus.RUNNING,
            )
            resp = client.post(
                f"/api/dispatches/{d.pk}/unload/", **auth_headers(lab_staff)
            )
            assert resp.status_code == 200, resp.json()

            row = SampleExperimentStatus.objects.get(
                sample=s, experiment_type=experiment_type
            )
            if row.verdict == SampleExperimentVerdict.FAIL:
                fail_count += 1

        # 80/20 with n=100 → ~95% CI [12, 30]; widen a touch.
        assert 10 <= fail_count <= 35, f"got fail_count={fail_count}"


@pytest.mark.django_db
class TestDispatchRecordResult:
    def test_record_result_comment_only_payload(
        self, client, auth_headers, lab_staff, unloaded_dispatch
    ):
        """The payload is just {comment} now — server randomises the
        per-wafer verdict, so the client never sends one. Dispatch
        transitions straight to COMPLETED and completed_at is stamped."""
        import random

        random.seed(0)

        resp = client.post(
            f"/api/dispatches/{unloaded_dispatch.pk}/record-result/",
            data={"comment": "Run looked clean"},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200, resp.json()
        data = resp.json()
        assert data["status"] == DispatchStatus.COMPLETED
        assert data["completed_at"] is not None
        assert data["result"]["comment"] == "Run looked clean"
        # Old dispatch-level verdict / data / data_source are gone —
        # verdict now lives per-wafer on SampleExperimentStatus.
        assert "verdict" not in data["result"]
        assert "data" not in data["result"]
        assert "data_source" not in data["result"]

    def test_record_result_rejects_legacy_verdict_field(
        self, client, auth_headers, lab_staff, unloaded_dispatch
    ):
        """Old client payloads with explicit verdict / data must fail
        loudly (422) rather than silently drop — the SPA needs to
        notice it's still sending stale fields."""
        resp = client.post(
            f"/api/dispatches/{unloaded_dispatch.pk}/record-result/",
            data={"comment": "ok", "verdict": "pass", "data": {"x": 1}},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 422

    def test_record_result_wrong_status_fails(
        self, client, auth_headers, lab_staff, running_dispatch
    ):
        """Cannot record result for non-unloaded dispatch."""
        resp = client.post(
            f"/api/dispatches/{running_dispatch.pk}/record-result/",
            data={"comment": "test"},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400

    def test_record_result_does_not_modify_verdict(
        self,
        client,
        auth_headers,
        lab_staff,
        experiment_type,
        equipment,
        recipe,
    ):
        """Verdict is rolled at unload; record_result must NOT touch it.
        Capture verdicts post-unload, run record_result, assert unchanged."""
        from apps.commissions.factories import RequestFactory
        from apps.commissions.models import RequestExperiment, RequestStatus
        from apps.wip.models import SampleExperimentStatus

        req = RequestFactory(status=RequestStatus.IN_PROGRESS)
        RequestExperiment.objects.create(request=req, experiment_type=experiment_type)
        samples = [
            SampleFactory(
                request=req,
                wafer_id=f"WF-FROZEN-{i}",
                status=SampleStatus.PROCESSING,
            )
            for i in range(3)
        ]
        wip = WIPFactory(
            experiment_type=experiment_type,
            status=WIPStatus.IN_PROGRESS,
            created_by=lab_staff,
        )
        for s in samples:
            WIPSample.objects.create(wip=wip, sample=s)
        d = DispatchFactory(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            status=DispatchStatus.RUNNING,
        )

        # Unload — verdict rolled here.
        client.post(f"/api/dispatches/{d.pk}/unload/", **auth_headers(lab_staff))
        before = dict(
            SampleExperimentStatus.objects.filter(
                sample__in=samples, experiment_type=experiment_type
            ).values_list("sample_id", "verdict")
        )
        assert len(before) == 3
        assert all(v in ("pass", "fail") for v in before.values())

        # record_result must not touch verdict.
        resp = client.post(
            f"/api/dispatches/{d.pk}/record-result/",
            data={"comment": "operator note"},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200, resp.json()

        after = dict(
            SampleExperimentStatus.objects.filter(
                sample__in=samples, experiment_type=experiment_type
            ).values_list("sample_id", "verdict")
        )
        assert after == before

    def test_record_result_only_persists_comment(
        self, client, auth_headers, lab_staff, unloaded_dispatch
    ):
        """Post-unload, record_result's only job is to write the comment
        and transition the dispatch to COMPLETED."""
        resp = client.post(
            f"/api/dispatches/{unloaded_dispatch.pk}/record-result/",
            data={"comment": "abc"},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200, resp.json()
        unloaded_dispatch.refresh_from_db()
        assert unloaded_dispatch.status == DispatchStatus.COMPLETED
        assert unloaded_dispatch.result.comment == "abc"

    def test_sample_experiment_status_verdict_null_before_record(
        self, sample, experiment_type
    ):
        """SampleExperimentStatus.verdict starts null until a dispatch's
        record_result fills it in."""
        from apps.wip.models import SampleExperimentStatus

        # The `sample` fixture already created a SampleExperimentStatus
        # for the experiment_type via `in_progress_request`.
        row = SampleExperimentStatus.objects.get(
            sample=sample, experiment_type=experiment_type
        )
        assert row.verdict is None

    def test_record_result_full_flow_fills_verdict_without_preinit(
        self,
        client,
        auth_headers,
        lab_staff,
        experiment_type,
        equipment,
        recipe,
    ):
        """Regression test for the verdict-stays-null bug.

        Mirrors the SPA smoke scenario exactly: factory-built request +
        samples + WIP + dispatch (no manual SampleExperimentStatus
        priming), then walks start → unload → record_result via the API.
        The previous shape — _update_experiment_statuses_on_unload
        filtering existing SampleExperimentStatus rows — silently
        no-op'd when rows weren't pre-created, leaving verdict=null on
        every wafer.
        """
        from apps.commissions.factories import RequestFactory
        from apps.commissions.models import RequestExperiment, RequestStatus
        from apps.wip.models import SampleExperimentStatus

        req = RequestFactory(status=RequestStatus.IN_PROGRESS)
        RequestExperiment.objects.create(request=req, experiment_type=experiment_type)
        samples = [
            SampleFactory(
                request=req,
                wafer_id=f"WF-REPRO-{i}",
                status=SampleStatus.PROCESSING,
            )
            for i in range(3)
        ]
        wip = WIPFactory(
            experiment_type=experiment_type,
            status=WIPStatus.IN_PROGRESS,
            created_by=lab_staff,
        )
        for s in samples:
            WIPSample.objects.create(wip=wip, sample=s)
        # Deliberately do NOT pre-create SampleExperimentStatus rows —
        # this is the gap. The helper has to either find existing rows
        # or create them.

        d = DispatchFactory(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
        )

        # start → unload → record_result via the API.
        assert (
            client.post(
                f"/api/dispatches/{d.pk}/start/", **auth_headers(lab_staff)
            ).status_code
            == 200
        )
        assert (
            client.post(
                f"/api/dispatches/{d.pk}/unload/", **auth_headers(lab_staff)
            ).status_code
            == 200
        )
        resp = client.post(
            f"/api/dispatches/{d.pk}/record-result/",
            data={"comment": "test"},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200, resp.json()
        assert resp.json()["status"] == DispatchStatus.COMPLETED

        # Every wafer must have a verdict — this is what the bug breaks.
        rows = SampleExperimentStatus.objects.filter(
            sample__in=samples, experiment_type=experiment_type
        )
        assert rows.count() == 3
        for row in rows:
            assert row.verdict in ("pass", "fail"), (
                f"sample {row.sample_id} verdict was {row.verdict!r}"
            )


@pytest.mark.django_db
class TestWIPAutoCompleteOnDispatchTerminate:
    """When the LAST active dispatch on a WIP transitions to COMPLETED,
    the WIP auto-completes (no manual POST /wips/{id}/complete/ needed).

    Auto-complete only triggers when:
      - every dispatch is in (COMPLETED, ABORTED)
      - at least one dispatch is COMPLETED

    Aborting the only / last dispatch does NOT auto-complete the WIP —
    operators decide whether to manually complete or create a new
    dispatch.
    """

    def test_record_result_on_only_dispatch_auto_completes_wip(
        self, client, auth_headers, lab_staff, wip_in_progress, dispatch
    ):
        """Drive the single PENDING dispatch through start → unload →
        record-result; the WIP auto-transitions to COMPLETED on the
        record-result call."""
        # start
        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/start/", **auth_headers(lab_staff)
        )
        assert resp.status_code == 200, resp.json()
        # unload
        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/unload/", **auth_headers(lab_staff)
        )
        assert resp.status_code == 200, resp.json()
        # record-result → dispatch lands in COMPLETED → WIP auto-completes
        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/record-result/",
            data={"comment": "ok"},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200, resp.json()

        wip_in_progress.refresh_from_db()
        assert wip_in_progress.status == WIPStatus.COMPLETED
        assert wip_in_progress.completed_at is not None

    def test_record_result_with_prior_aborted_auto_completes_wip(
        self,
        client,
        auth_headers,
        lab_staff,
        wip_in_progress,
        dispatch,
        experiment_type,
        equipment,
        recipe,
    ):
        """An aborted historical dispatch + a fresh dispatch driven to
        COMPLETED should auto-complete the WIP (all-terminal + ≥1
        COMPLETED)."""
        # Make the existing fixture dispatch ABORTED — historical.
        dispatch.status = DispatchStatus.ABORTED
        dispatch.save(update_fields=["status"])

        # Create a fresh dispatch via the API (passes the single-active
        # check because the old one is ABORTED).
        resp = client.post(
            f"/api/wips/{wip_in_progress.pk}/dispatches/",
            data={"equipment_id": equipment.pk, "recipe_id": recipe.pk},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 201, resp.json()
        new_dispatch_id = next(
            d["id"] for d in resp.json()["dispatches"] if d["id"] != dispatch.pk
        )

        # Drive it to COMPLETED.
        client.post(
            f"/api/dispatches/{new_dispatch_id}/start/", **auth_headers(lab_staff)
        )
        client.post(
            f"/api/dispatches/{new_dispatch_id}/unload/", **auth_headers(lab_staff)
        )
        resp = client.post(
            f"/api/dispatches/{new_dispatch_id}/record-result/",
            data={"comment": "ok"},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200, resp.json()

        wip_in_progress.refresh_from_db()
        assert wip_in_progress.status == WIPStatus.COMPLETED

    def test_abort_only_dispatch_does_not_auto_complete_wip(
        self, client, auth_headers, lab_staff, wip_in_progress, dispatch
    ):
        """Aborting the only dispatch leaves the WIP in_progress — no
        COMPLETED dispatch exists, so auto-complete doesn't fire."""
        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/abort/", **auth_headers(lab_staff)
        )
        assert resp.status_code == 200, resp.json()

        wip_in_progress.refresh_from_db()
        assert wip_in_progress.status == WIPStatus.IN_PROGRESS
        assert wip_in_progress.completed_at is None

    def test_all_aborted_does_not_auto_complete_wip(
        self,
        client,
        auth_headers,
        lab_staff,
        wip_in_progress,
        dispatch,
        experiment_type,
        equipment,
        recipe,
    ):
        """Even with multiple historical aborted dispatches, the WIP must
        not auto-complete unless ≥1 dispatch is COMPLETED. Operators
        manually decide what to do with an all-aborted WIP."""
        # Abort the existing one.
        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/abort/", **auth_headers(lab_staff)
        )
        assert resp.status_code == 200

        # Create + abort a second one.
        resp = client.post(
            f"/api/wips/{wip_in_progress.pk}/dispatches/",
            data={"equipment_id": equipment.pk, "recipe_id": recipe.pk},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 201, resp.json()
        second_id = next(
            d["id"] for d in resp.json()["dispatches"] if d["id"] != dispatch.pk
        )
        resp = client.post(
            f"/api/dispatches/{second_id}/abort/", **auth_headers(lab_staff)
        )
        assert resp.status_code == 200

        wip_in_progress.refresh_from_db()
        assert wip_in_progress.status == WIPStatus.IN_PROGRESS

    def test_record_result_with_prior_pending_redispatch_auto_completes_wip(
        self,
        client,
        auth_headers,
        lab_staff,
        wip_in_progress,
        dispatch,
        experiment_type,
        equipment,
        recipe,
    ):
        """A historical PENDING_REDISPATCH dispatch (its replacement has
        already been driven and was eventually superseded) should NOT
        block WIP auto-completion when a sibling dispatch finishes
        COMPLETED — PENDING_REDISPATCH is terminal."""
        # Mark the fixture dispatch as historical PENDING_REDISPATCH —
        # like a redispatch happened earlier in the WIP's life.
        dispatch.status = DispatchStatus.PENDING_REDISPATCH
        dispatch.save(update_fields=["status"])

        # Create a fresh dispatch (allowed, since PENDING_REDISPATCH is
        # terminal for the active gate after this fix).
        resp = client.post(
            f"/api/wips/{wip_in_progress.pk}/dispatches/",
            data={"equipment_id": equipment.pk, "recipe_id": recipe.pk},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 201, resp.json()
        new_id = next(
            d["id"] for d in resp.json()["dispatches"] if d["id"] != dispatch.pk
        )
        # Drive the new one through start → unload → record_result.
        client.post(f"/api/dispatches/{new_id}/start/", **auth_headers(lab_staff))
        client.post(f"/api/dispatches/{new_id}/unload/", **auth_headers(lab_staff))
        resp = client.post(
            f"/api/dispatches/{new_id}/record-result/",
            data={"comment": "ok"},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200, resp.json()

        wip_in_progress.refresh_from_db()
        assert wip_in_progress.status == WIPStatus.COMPLETED

    def test_record_result_from_running_with_prior_pending_redispatch_auto_completes_wip(
        self,
        client,
        auth_headers,
        lab_staff,
        wip_in_progress,
        dispatch,
        experiment_type,
        equipment,
        recipe,
    ):
        """Same auto-complete behaviour when the active sibling starts
        in RUNNING (operator unloads then records the result)."""
        dispatch.status = DispatchStatus.PENDING_REDISPATCH
        dispatch.save(update_fields=["status"])

        # Build a sibling already in RUNNING via the factory (skip the
        # PENDING → DISPATCHED → RUNNING walk).
        from apps.wip.factories import DispatchFactory

        running = DispatchFactory(
            wip=wip_in_progress,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            status=DispatchStatus.RUNNING,
            created_by=lab_staff,
        )

        # unload → record_result (lands in COMPLETED, triggers
        # auto-complete check).
        client.post(f"/api/dispatches/{running.pk}/unload/", **auth_headers(lab_staff))
        resp = client.post(
            f"/api/dispatches/{running.pk}/record-result/",
            data={"comment": "ok"},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200, resp.json()

        wip_in_progress.refresh_from_db()
        assert wip_in_progress.status == WIPStatus.COMPLETED


@pytest.mark.django_db
class TestDispatchCompleteCollapse:
    """record_result is now the terminal step; the /complete/ endpoint
    is removed and RESULT_RECORDED is bypassed in the transition table.
    The DispatchStatus.RESULT_RECORDED enum value is intentionally kept
    so historical rows / migrations don't need touching."""

    def test_complete_endpoint_removed(
        self, client, auth_headers, lab_staff, unloaded_dispatch
    ):
        """POST /complete/ no longer exists — should 404."""
        resp = client.post(
            f"/api/dispatches/{unloaded_dispatch.pk}/complete/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 404

    def test_dispatch_status_result_recorded_enum_preserved(self):
        """RESULT_RECORDED stays in the enum even though no new dispatch
        ever lands in it — keeps existing rows / migrations untouched."""
        assert DispatchStatus.RESULT_RECORDED == "result_recorded"


@pytest.mark.django_db
class TestDispatchReportException:
    def test_report_exception_from_running(
        self, client, auth_headers, lab_staff, running_dispatch
    ):
        """Lab staff can report exception from running dispatch."""
        payload = {"note": "Machine malfunction"}
        resp = client.post(
            f"/api/dispatches/{running_dispatch.pk}/report-exception/",
            data=payload,
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == DispatchStatus.EXECUTION_EXCEPTION

    def test_report_exception_from_dispatched(
        self, client, auth_headers, lab_staff, dispatched_dispatch
    ):
        """Lab staff can report exception from dispatched dispatch."""
        resp = client.post(
            f"/api/dispatches/{dispatched_dispatch.pk}/report-exception/",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == DispatchStatus.EXECUTION_EXCEPTION

    def test_report_exception_from_pending_fails(
        self, client, auth_headers, lab_staff, dispatch
    ):
        """Cannot report exception from pending dispatch."""
        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/report-exception/",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestDispatchRedispatch:
    def test_redispatch_success(self, client, auth_headers, lab_staff, dispatch):
        """Lab staff can redispatch an exception dispatch, creating a new dispatch."""
        dispatch.status = DispatchStatus.EXECUTION_EXCEPTION
        dispatch.save()

        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/redispatch/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == DispatchStatus.PENDING_REDISPATCH

        # A new dispatch should be created at PENDING for the same WIP
        new_dispatches = Dispatch.objects.filter(
            wip=dispatch.wip, status=DispatchStatus.PENDING
        )
        assert new_dispatches.count() == 1

    def test_redispatch_wrong_status_fails(
        self, client, auth_headers, lab_staff, running_dispatch
    ):
        """Cannot redispatch from non-exception status."""
        resp = client.post(
            f"/api/dispatches/{running_dispatch.pk}/redispatch/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestDispatchAbort:
    def test_abort_dispatch_from_exception(
        self, client, auth_headers, lab_staff, dispatch
    ):
        """Lab staff can abort a dispatch in execution_exception state."""
        dispatch.status = DispatchStatus.EXECUTION_EXCEPTION
        dispatch.save()

        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/abort/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == DispatchStatus.ABORTED

    def test_abort_dispatch_from_pending(
        self, client, auth_headers, lab_staff, dispatch
    ):
        """Lab staff can abort a pending dispatch."""
        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/abort/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == DispatchStatus.ABORTED

    def test_abort_completed_dispatch_fails(
        self, client, auth_headers, lab_staff, dispatch
    ):
        """Cannot abort a completed dispatch."""
        dispatch.status = DispatchStatus.COMPLETED
        dispatch.save()
        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/abort/",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400

    def test_abort_dispatch_lab_manager_allowed(
        self, client, auth_headers, lab_manager, dispatch
    ):
        """Lab manager can also abort a dispatch."""
        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/abort/",
            **auth_headers(lab_manager),
        )
        assert resp.status_code == 200

    def test_abort_dispatch_fab_user_forbidden(
        self, client, auth_headers, fab_user, dispatch
    ):
        """Fab user cannot abort dispatches."""
        resp = client.post(
            f"/api/dispatches/{dispatch.pk}/abort/",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 403


# =============================================================================
# Automation API Tests
# =============================================================================


# Automation payload: {dispatch_id, comment} — same simplification
# as record_result. Pass/fail rolled server-side per wafer.
@pytest.mark.django_db
class TestAutomationEquipmentResult:
    def test_automation_result_completes_dispatch(
        self, client, auth_headers, lab_staff, dispatched_dispatch
    ):
        """Automation endpoint completes dispatch and creates a result row."""
        payload = {
            "dispatch_id": dispatched_dispatch.pk,
            "comment": "Automated measurement complete",
        }
        resp = client.post(
            "/api/automation/equipment-result/",
            data=payload,
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == DispatchStatus.COMPLETED

        result = ExperimentResult.objects.get(dispatch_id=dispatched_dispatch.pk)
        assert result.comment == "Automated measurement complete"
        assert result.recorded_by == lab_staff

    def test_automation_result_from_running_dispatch(
        self, client, auth_headers, lab_staff, running_dispatch
    ):
        """Automation endpoint works for running dispatch too."""
        payload = {"dispatch_id": running_dispatch.pk, "comment": "Done"}
        resp = client.post(
            "/api/automation/equipment-result/",
            data=payload,
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200

    def test_automation_result_wrong_status_fails(
        self, client, auth_headers, lab_staff, unloaded_dispatch
    ):
        """Automation endpoint rejects dispatches not in dispatched/running state."""
        payload = {"dispatch_id": unloaded_dispatch.pk, "comment": "Test"}
        resp = client.post(
            "/api/automation/equipment-result/",
            data=payload,
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400

    def test_automation_result_dispatch_not_found(
        self, client, auth_headers, lab_staff
    ):
        """Returns 404 if dispatch not found."""
        payload = {"dispatch_id": 99999, "comment": "Test"}
        resp = client.post(
            "/api/automation/equipment-result/",
            data=payload,
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 404

    def test_automation_result_fab_user_forbidden(
        self, client, auth_headers, fab_user, dispatched_dispatch
    ):
        """Fab user cannot submit automation results."""
        payload = {"dispatch_id": dispatched_dispatch.pk, "comment": "Test"}
        resp = client.post(
            "/api/automation/equipment-result/",
            data=payload,
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 403

    def test_automation_result_assigns_per_wafer_verdict_without_preinit(
        self, client, auth_headers, lab_staff, experiment_type, equipment, recipe
    ):
        """Same verdict-assignment guarantee as the manual record_result
        path — the automation endpoint also runs through
        _update_experiment_statuses_on_unload and must fill in
        every wafer's verdict even when SampleExperimentStatus rows
        weren't pre-initialised."""
        from apps.commissions.factories import RequestFactory
        from apps.commissions.factories import SampleFactory as _SF
        from apps.commissions.models import RequestExperiment, RequestStatus
        from apps.wip.models import SampleExperimentStatus

        req = RequestFactory(status=RequestStatus.IN_PROGRESS)
        RequestExperiment.objects.create(request=req, experiment_type=experiment_type)
        samples = [
            _SF(
                request=req,
                wafer_id=f"WF-AUTO-{i}",
                status=SampleStatus.PROCESSING,
            )
            for i in range(2)
        ]
        wip = WIPFactory(
            experiment_type=experiment_type,
            status=WIPStatus.IN_PROGRESS,
            created_by=lab_staff,
        )
        for s in samples:
            WIPSample.objects.create(wip=wip, sample=s)
        # No SampleExperimentStatus pre-init — same gap as record_result.

        d = DispatchFactory(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            status=DispatchStatus.DISPATCHED,
            created_by=lab_staff,
        )

        resp = client.post(
            "/api/automation/equipment-result/",
            data={"dispatch_id": d.pk, "comment": "auto"},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200, resp.json()

        rows = SampleExperimentStatus.objects.filter(
            sample__in=samples, experiment_type=experiment_type
        )
        assert rows.count() == 2
        for row in rows:
            assert row.verdict in ("pass", "fail")
