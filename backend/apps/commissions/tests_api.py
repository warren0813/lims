"""API tests for the commissions app (Request and Sample endpoints)."""

import pytest
from django.test import Client

from apps.accounts.factories import (
    FabUserFactory,
    LabManagerFactory,
    LabStaffFactory,
)
from apps.commissions.factories import RequestFactory, SampleFactory
from apps.commissions.models import (
    ApprovalLog,
    Request,
    RequestExperiment,
    RequestStatus,
    SampleStatus,
)
from apps.experiments.factories import ExperimentTypeFactory


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


# =============================================================================
# Request API Tests
# =============================================================================


@pytest.mark.django_db
class TestRequestList:
    def test_list_requests_as_fab_user_sees_own_only(
        self, client, auth_headers, fab_user
    ):
        """Fab user should only see their own requests."""
        RequestFactory(requester=fab_user)
        RequestFactory()  # another user's request

        resp = client.get("/api/requests/", **auth_headers(fab_user))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["requester"]["id"] == fab_user.pk

    def test_list_requests_as_lab_staff_sees_all_non_draft(
        self, client, auth_headers, lab_staff
    ):
        """Lab staff sees all non-draft requests; draft requests are hidden."""
        RequestFactory(status=RequestStatus.PENDING_APPROVAL)
        RequestFactory(status=RequestStatus.APPROVED)
        RequestFactory(status=RequestStatus.DRAFT)  # must be excluded

        resp = client.get("/api/requests/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert all(r["status"] != "draft" for r in data)

    def test_list_requests_draft_hidden_from_manager(
        self, client, auth_headers, lab_manager
    ):
        """Lab managers never see draft requests in the listing."""
        RequestFactory(status=RequestStatus.DRAFT)
        RequestFactory(status=RequestStatus.PENDING_APPROVAL)

        resp = client.get("/api/requests/", **auth_headers(lab_manager))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["status"] == "pending_approval"

    def test_list_requests_filter_by_status(self, client, auth_headers, lab_staff):
        """Can filter requests by status (non-draft statuses work normally)."""
        RequestFactory(status=RequestStatus.PENDING_APPROVAL)
        RequestFactory(status=RequestStatus.APPROVED)

        resp = client.get(
            "/api/requests/?status=pending_approval", **auth_headers(lab_staff)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["status"] == "pending_approval"

    def test_list_requests_unauthenticated(self, client):
        """Unauthenticated request returns 401."""
        resp = client.get("/api/requests/")
        assert resp.status_code == 401

    def test_list_requests_includes_urgency(self, client, auth_headers, lab_staff):
        """List response exposes the urgency field."""
        RequestFactory(status=RequestStatus.PENDING_APPROVAL, urgency="3d")

        resp = client.get("/api/requests/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["urgency"] == "3d"

    def test_list_requests_filter_by_urgency(self, client, auth_headers, lab_staff):
        """Can filter requests by urgency."""
        RequestFactory(status=RequestStatus.PENDING_APPROVAL, urgency="3d")
        RequestFactory(status=RequestStatus.PENDING_APPROVAL, urgency="1w")
        RequestFactory(status=RequestStatus.PENDING_APPROVAL, urgency="2w")

        resp = client.get("/api/requests/?urgency=3d", **auth_headers(lab_staff))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["urgency"] == "3d"

    def test_list_requests_includes_sample_count(self, client, auth_headers, lab_staff):
        """Each list row exposes sample_count so the SPA's Fab Dashboard
        can render the wafers-per-row count without a second round-trip."""
        req_with = RequestFactory(status=RequestStatus.PENDING_APPROVAL)
        SampleFactory(request=req_with)
        SampleFactory(request=req_with)
        req_empty = RequestFactory(status=RequestStatus.PENDING_APPROVAL)

        resp = client.get("/api/requests/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        rows = {row["id"]: row for row in resp.json()}
        assert rows[req_with.pk]["sample_count"] == 2
        assert rows[req_empty.pk]["sample_count"] == 0


@pytest.mark.django_db
class TestRequestCreate:
    def test_create_request_as_fab_user(
        self, client, auth_headers, fab_user, experiment_type
    ):
        """Fab user can create a draft request with samples and experiment types."""
        payload = {
            "title": "Test Commission",
            "note": "Please complete ASAP",
            "experiment_type_ids": [experiment_type.pk],
            "experiment_parameters": {str(experiment_type.pk): {"duration_hours": 300}},
            "samples": [
                {"wafer_id": "WF-001", "wafer_size": "300mm"},
                {"wafer_id": "WF-002", "wafer_size": "200mm"},
            ],
        }
        resp = client.post(
            "/api/requests/",
            data=payload,
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Test Commission"
        assert data["status"] == "draft"
        assert len(data["samples"]) == 2
        assert len(data["experiment_types"]) == 1

        # Verify DB state
        req = Request.objects.get(pk=data["id"])
        assert req.requester == fab_user
        assert req.samples.count() == 2
        assert req.request_experiments.count() == 1
        re = req.request_experiments.first()
        assert re.parameters == {"duration_hours": 300}

    def test_create_request_as_lab_staff_forbidden(
        self, client, auth_headers, lab_staff, experiment_type
    ):
        """Lab staff cannot create requests (only fab users can)."""
        payload = {
            "title": "Should Fail",
            "experiment_type_ids": [experiment_type.pk],
            "samples": [{"wafer_id": "WF-001", "wafer_size": "300mm"}],
        }
        resp = client.post(
            "/api/requests/",
            data=payload,
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 403

    def test_create_request_invalid_experiment_type(
        self, client, auth_headers, fab_user
    ):
        """Creating request with non-existent experiment type returns 400."""
        payload = {
            "title": "Bad Request",
            "experiment_type_ids": [9999],
            "samples": [{"wafer_id": "WF-001", "wafer_size": "300mm"}],
        }
        resp = client.post(
            "/api/requests/",
            data=payload,
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 400

    def test_create_request_empty_samples_rejected(
        self, client, auth_headers, fab_user, experiment_type
    ):
        """Request must have at least one sample."""
        payload = {
            "title": "No Samples",
            "experiment_type_ids": [experiment_type.pk],
            "samples": [],
        }
        resp = client.post(
            "/api/requests/",
            data=payload,
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 422

    def test_create_request_round_trips_urgency(
        self, client, auth_headers, fab_user, experiment_type
    ):
        """Urgency provided on create is persisted and returned in detail response."""
        payload = {
            "title": "Urgent",
            "urgency": "3d",
            "experiment_type_ids": [experiment_type.pk],
            "samples": [{"wafer_id": "WF-001", "wafer_size": "300mm"}],
        }
        resp = client.post(
            "/api/requests/",
            data=payload,
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["urgency"] == "3d"

        req = Request.objects.get(pk=data["id"])
        assert req.urgency == "3d"

    def test_create_request_defaults_urgency_to_one_week(
        self, client, auth_headers, fab_user, experiment_type
    ):
        """Urgency omitted on create defaults to '1w'."""
        payload = {
            "title": "Default urgency",
            "experiment_type_ids": [experiment_type.pk],
            "samples": [{"wafer_id": "WF-001", "wafer_size": "300mm"}],
        }
        resp = client.post(
            "/api/requests/",
            data=payload,
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 201
        assert resp.json()["urgency"] == "1w"


@pytest.mark.django_db
class TestRequestDetail:
    def test_get_request_detail(self, client, auth_headers, fab_user, experiment_type):
        """Get request detail includes samples, experiment_types, approval_logs."""
        req = RequestFactory(requester=fab_user)
        RequestExperiment.objects.create(
            request=req,
            experiment_type=experiment_type,
            parameters={"temp": 150},
        )
        SampleFactory(request=req, wafer_id="WF-001")

        resp = client.get(f"/api/requests/{req.pk}", **auth_headers(fab_user))
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == req.pk
        assert len(data["samples"]) == 1
        assert len(data["experiment_types"]) == 1
        assert data["experiment_types"][0]["parameters"] == {"temp": 150}
        assert "approval_logs" in data

    def test_get_request_not_found(self, client, auth_headers, fab_user):
        """Non-existent request returns 404."""
        resp = client.get("/api/requests/9999", **auth_headers(fab_user))
        assert resp.status_code == 404

    def test_fab_user_cannot_see_others_request(self, client, auth_headers, fab_user):
        """Fab user cannot access another user's request."""
        other_req = RequestFactory()  # different user
        resp = client.get(f"/api/requests/{other_req.pk}", **auth_headers(fab_user))
        assert resp.status_code == 404

    def test_request_detail_includes_urgency(self, client, auth_headers, fab_user):
        """Detail response exposes the urgency field."""
        req = RequestFactory(requester=fab_user, urgency="2w")
        resp = client.get(f"/api/requests/{req.pk}", **auth_headers(fab_user))
        assert resp.status_code == 200
        assert resp.json()["urgency"] == "2w"


@pytest.mark.django_db
class TestRequestUpdate:
    def test_update_draft_request(self, client, auth_headers, fab_user):
        """Fab user can update their draft request."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.DRAFT)
        payload = {"title": "Updated Title", "note": "Updated note"}
        resp = client.patch(
            f"/api/requests/{req.pk}",
            data=payload,
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"

    def test_update_returned_request(self, client, auth_headers, fab_user):
        """Fab user can update their returned request."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.RETURNED)
        payload = {"title": "Fixed Title"}
        resp = client.patch(
            f"/api/requests/{req.pk}",
            data=payload,
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 200

    def test_update_non_draft_request_rejected(self, client, auth_headers, fab_user):
        """Cannot update a request that is not in draft or returned status."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.PENDING_APPROVAL)
        payload = {"title": "Should Fail"}
        resp = client.patch(
            f"/api/requests/{req.pk}",
            data=payload,
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 400

    def test_update_urgency(self, client, auth_headers, fab_user):
        """Fab user can patch urgency on a draft request."""
        req = RequestFactory(
            requester=fab_user, status=RequestStatus.DRAFT, urgency="1w"
        )
        resp = client.patch(
            f"/api/requests/{req.pk}",
            data={"urgency": "3d"},
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 200
        assert resp.json()["urgency"] == "3d"
        req.refresh_from_db()
        assert req.urgency == "3d"

    # ------------------------------------------------------------------
    # INTEGRATION_GAPS §2.9 — PATCH samples + experiment_type_ids on
    # draft requests. Draft is the only state where samples can change;
    # other states (RETURNED, PENDING_APPROVAL, …) must 422.
    # ------------------------------------------------------------------

    def test_update_returned_request_with_samples_rejected(
        self, client, auth_headers, fab_user, experiment_type
    ):
        """RETURNED is editable for title/note/urgency but NOT for samples —
        once a request has been seen by a reviewer, the sample list is
        locked. 422 with a clear detail string."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.RETURNED)
        SampleFactory(request=req, wafer_id="WF-OLD")
        before_ids = list(req.samples.values_list("pk", flat=True))

        resp = client.patch(
            f"/api/requests/{req.pk}",
            data={
                "samples": [{"wafer_id": "WF-NEW", "wafer_size": "300mm"}],
            },
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 422
        assert "draft" in resp.json()["detail"].lower()
        # Samples untouched.
        assert list(req.samples.values_list("pk", flat=True)) == before_ids

    def test_update_draft_request_samples_replaces_set(
        self, client, auth_headers, fab_user
    ):
        """Draft PATCH samples wipes the existing set and rebuilds from
        payload (full replacement, not partial)."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.DRAFT)
        SampleFactory(request=req, wafer_id="WF-A")
        SampleFactory(request=req, wafer_id="WF-B")
        assert req.samples.count() == 2

        resp = client.patch(
            f"/api/requests/{req.pk}",
            data={
                "samples": [
                    {"wafer_id": "WF-NEW-1", "wafer_size": "300mm"},
                    {"wafer_id": "WF-NEW-2", "wafer_size": "200mm"},
                    {"wafer_id": "WF-NEW-3", "wafer_size": "300mm"},
                ],
            },
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 200, resp.json()
        req.refresh_from_db()
        wafer_ids = sorted(req.samples.values_list("wafer_id", flat=True))
        assert wafer_ids == ["WF-NEW-1", "WF-NEW-2", "WF-NEW-3"]
        # Old samples are gone, not co-existing.
        assert not req.samples.filter(wafer_id__in=["WF-A", "WF-B"]).exists()

    def test_update_draft_request_experiment_type_ids_replaces_set(
        self, client, auth_headers, fab_user, experiment_type
    ):
        """Draft PATCH experiment_type_ids resets the RequestExperiment
        through-table."""
        from apps.experiments.factories import ExperimentTypeFactory

        req = RequestFactory(requester=fab_user, status=RequestStatus.DRAFT)
        # Start with experiment_type already attached.
        RequestExperiment.objects.create(request=req, experiment_type=experiment_type)
        new_et_a = ExperimentTypeFactory(name="ET-NEW-A")
        new_et_b = ExperimentTypeFactory(name="ET-NEW-B")

        resp = client.patch(
            f"/api/requests/{req.pk}",
            data={"experiment_type_ids": [new_et_a.pk, new_et_b.pk]},
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 200, resp.json()
        attached_ids = sorted(
            req.request_experiments.values_list("experiment_type_id", flat=True)
        )
        assert attached_ids == sorted([new_et_a.pk, new_et_b.pk])
        # Original experiment_type is gone.
        assert experiment_type.pk not in attached_ids

    def test_update_draft_combined_patch_applies_all(
        self, client, auth_headers, fab_user
    ):
        """Title + samples + experiment_type_ids in one PATCH all land
        atomically."""
        from apps.experiments.factories import ExperimentTypeFactory

        req = RequestFactory(
            requester=fab_user, status=RequestStatus.DRAFT, title="Original"
        )
        SampleFactory(request=req, wafer_id="WF-OLD")
        new_et = ExperimentTypeFactory(name="ET-COMBO")

        resp = client.patch(
            f"/api/requests/{req.pk}",
            data={
                "title": "Combined Update",
                "samples": [{"wafer_id": "WF-COMBO", "wafer_size": "300mm"}],
                "experiment_type_ids": [new_et.pk],
            },
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 200, resp.json()
        req.refresh_from_db()
        assert req.title == "Combined Update"
        assert list(req.samples.values_list("wafer_id", flat=True)) == ["WF-COMBO"]
        assert list(
            req.request_experiments.values_list("experiment_type_id", flat=True)
        ) == [new_et.pk]

    def test_update_draft_samples_empty_list_rejected(
        self, client, auth_headers, fab_user
    ):
        """Empty samples list violates the business rule (every request
        needs at least one sample, same as on create)."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.DRAFT)
        SampleFactory(request=req, wafer_id="WF-EXISTING")

        resp = client.patch(
            f"/api/requests/{req.pk}",
            data={"samples": []},
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 422
        req.refresh_from_db()
        # Original sample untouched (atomic).
        assert req.samples.count() == 1

    def test_update_draft_invalid_experiment_type_rolls_back(
        self, client, auth_headers, fab_user, experiment_type
    ):
        """An invalid experiment_type_id in a combined PATCH must roll
        back EVERY change — no partial application."""
        req = RequestFactory(
            requester=fab_user, status=RequestStatus.DRAFT, title="Untouched"
        )
        SampleFactory(request=req, wafer_id="WF-ORIG")
        RequestExperiment.objects.create(request=req, experiment_type=experiment_type)

        resp = client.patch(
            f"/api/requests/{req.pk}",
            data={
                "title": "Should Not Land",
                "samples": [{"wafer_id": "WF-SHOULD-NOT-LAND", "wafer_size": "300mm"}],
                "experiment_type_ids": [experiment_type.pk, 99999],
            },
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 422
        req.refresh_from_db()
        assert req.title == "Untouched"
        assert list(req.samples.values_list("wafer_id", flat=True)) == ["WF-ORIG"]
        assert list(
            req.request_experiments.values_list("experiment_type_id", flat=True)
        ) == [experiment_type.pk]


@pytest.mark.django_db
class TestRequestSubmit:
    def test_submit_draft_request(self, client, auth_headers, fab_user):
        """Fab user can submit a draft request."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.DRAFT)
        SampleFactory(request=req)

        resp = client.post(
            f"/api/requests/{req.pk}/submit",
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending_approval"

        req.refresh_from_db()
        assert req.submitted_at is not None

    def test_submit_returned_request(self, client, auth_headers, fab_user):
        """Fab user can resubmit a returned request."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.RETURNED)
        SampleFactory(request=req)

        resp = client.post(
            f"/api/requests/{req.pk}/submit",
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending_approval"

    def test_submit_approved_request_rejected(self, client, auth_headers, fab_user):
        """Cannot submit an already approved request."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.APPROVED)
        resp = client.post(
            f"/api/requests/{req.pk}/submit",
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 400

    def test_submit_by_non_requester_forbidden(self, client, auth_headers, lab_staff):
        """Non-requester cannot submit another user's request."""
        req = RequestFactory(status=RequestStatus.DRAFT)
        resp = client.post(
            f"/api/requests/{req.pk}/submit",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestRequestApprove:
    def test_approve_request(self, client, auth_headers, lab_manager):
        """Lab manager can approve a pending request."""
        req = RequestFactory(status=RequestStatus.PENDING_APPROVAL)

        resp = client.post(
            f"/api/requests/{req.pk}/approve",
            content_type="application/json",
            **auth_headers(lab_manager),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"

        # Verify approval log created
        assert ApprovalLog.objects.filter(
            request=req, action=ApprovalLog.Action.APPROVE
        ).exists()

    def test_approve_as_fab_user_forbidden(self, client, auth_headers, fab_user):
        """Fab user cannot approve requests."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.PENDING_APPROVAL)
        resp = client.post(
            f"/api/requests/{req.pk}/approve",
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 403

    def test_approve_draft_request_rejected(self, client, auth_headers, lab_manager):
        """Cannot approve a draft request."""
        req = RequestFactory(status=RequestStatus.DRAFT)
        resp = client.post(
            f"/api/requests/{req.pk}/approve",
            content_type="application/json",
            **auth_headers(lab_manager),
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestRequestReturn:
    def test_return_request_with_comment(self, client, auth_headers, lab_manager):
        """Lab manager can return a pending request with comment."""
        req = RequestFactory(status=RequestStatus.PENDING_APPROVAL)

        resp = client.post(
            f"/api/requests/{req.pk}/return",
            data={"comment": "Please fix sample count"},
            content_type="application/json",
            **auth_headers(lab_manager),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "returned"

        log = ApprovalLog.objects.get(request=req)
        assert log.action == ApprovalLog.Action.RETURN
        assert log.comment == "Please fix sample count"

    def test_return_without_comment_rejected(self, client, auth_headers, lab_manager):
        """Return requires a non-empty comment."""
        req = RequestFactory(status=RequestStatus.PENDING_APPROVAL)
        resp = client.post(
            f"/api/requests/{req.pk}/return",
            data={"comment": ""},
            content_type="application/json",
            **auth_headers(lab_manager),
        )
        assert resp.status_code == 422


@pytest.mark.django_db
class TestRequestReject:
    def test_reject_request_with_comment(self, client, auth_headers, lab_manager):
        """Lab manager can reject a pending request with comment."""
        req = RequestFactory(status=RequestStatus.PENDING_APPROVAL)

        resp = client.post(
            f"/api/requests/{req.pk}/reject",
            data={"comment": "Not a valid experiment"},
            content_type="application/json",
            **auth_headers(lab_manager),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"

        log = ApprovalLog.objects.get(request=req)
        assert log.action == ApprovalLog.Action.REJECT

    def test_reject_as_lab_staff_forbidden(self, client, auth_headers, lab_staff):
        """Lab staff cannot reject requests (only manager)."""
        req = RequestFactory(status=RequestStatus.PENDING_APPROVAL)
        resp = client.post(
            f"/api/requests/{req.pk}/reject",
            data={"comment": "reason"},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestRequestShip:
    def test_ship_approved_request(self, client, auth_headers, fab_user):
        """Fab user can mark an approved request as shipped."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.APPROVED)
        s1 = SampleFactory(request=req, status=SampleStatus.CREATED)
        s2 = SampleFactory(request=req, status=SampleStatus.CREATED)

        resp = client.post(
            f"/api/requests/{req.pk}/ship",
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "sample_shipped"

        # Samples should be marked as shipped
        s1.refresh_from_db()
        s2.refresh_from_db()
        assert s1.status == SampleStatus.SHIPPED
        assert s2.status == SampleStatus.SHIPPED

    def test_ship_draft_request_rejected(self, client, auth_headers, fab_user):
        """Cannot ship a draft request."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.DRAFT)
        resp = client.post(
            f"/api/requests/{req.pk}/ship",
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 400

    def test_ship_by_non_requester_forbidden(self, client, auth_headers, lab_staff):
        """Non-requester cannot ship another user's request."""
        req = RequestFactory(status=RequestStatus.APPROVED)
        resp = client.post(
            f"/api/requests/{req.pk}/ship",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestRequestCancel:
    def test_cancel_draft_request(self, client, auth_headers, fab_user):
        """Fab user can cancel their draft request."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.DRAFT)

        resp = client.post(
            f"/api/requests/{req.pk}/cancel",
            data={"reason": "No longer needed"},
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"

    def test_cancel_in_progress_by_manager(self, client, auth_headers, lab_manager):
        """Lab manager can cancel an in_progress request."""
        req = RequestFactory(status=RequestStatus.IN_PROGRESS)
        resp = client.post(
            f"/api/requests/{req.pk}/cancel",
            data={"reason": "Cancelled by manager"},
            content_type="application/json",
            **auth_headers(lab_manager),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"

    def test_cancel_closed_request_rejected(self, client, auth_headers, lab_manager):
        """Cannot cancel a closed request."""
        req = RequestFactory(status=RequestStatus.CLOSED)
        resp = client.post(
            f"/api/requests/{req.pk}/cancel",
            data={"reason": "Too late"},
            content_type="application/json",
            **auth_headers(lab_manager),
        )
        assert resp.status_code == 400

    def test_cancel_without_reason_rejected(self, client, auth_headers, fab_user):
        """Cancel requires a reason."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.DRAFT)
        resp = client.post(
            f"/api/requests/{req.pk}/cancel",
            data={"reason": ""},
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 422

    def test_cancel_by_lab_staff_forbidden(self, client, auth_headers, lab_staff):
        """Lab staff cannot cancel requests."""
        req = RequestFactory(status=RequestStatus.DRAFT)
        resp = client.post(
            f"/api/requests/{req.pk}/cancel",
            data={"reason": "some reason"},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestRequestClose:
    def test_close_completed_request(self, client, auth_headers, lab_manager):
        """Lab manager can close a completed request."""
        req = RequestFactory(status=RequestStatus.COMPLETED)
        resp = client.post(
            f"/api/requests/{req.pk}/close",
            content_type="application/json",
            **auth_headers(lab_manager),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "closed"

        req.refresh_from_db()
        assert req.closed_at is not None

    def test_close_as_fab_user_forbidden(self, client, auth_headers, fab_user):
        """Fab user cannot close requests."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.COMPLETED)
        resp = client.post(
            f"/api/requests/{req.pk}/close",
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 403

    def test_close_in_progress_rejected(self, client, auth_headers, lab_manager):
        """Cannot close a request that is still in progress."""
        req = RequestFactory(status=RequestStatus.IN_PROGRESS)
        resp = client.post(
            f"/api/requests/{req.pk}/close",
            content_type="application/json",
            **auth_headers(lab_manager),
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestRequestDeleteDraft:
    def test_delete_draft_returns_204(self, client, auth_headers, fab_user):
        """Fab user can delete their own draft request — returns 204 No Content."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.DRAFT)
        resp = client.delete(
            f"/api/requests/{req.pk}",
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 204

    def test_delete_draft_removes_record(self, client, auth_headers, fab_user):
        """Deleting a draft hard-deletes the DB record and returns 204."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.DRAFT)
        pk = req.pk
        resp = client.delete(
            f"/api/requests/{pk}",
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 204
        assert not Request.objects.filter(pk=pk).exists()

    def test_delete_non_draft_rejected(self, client, auth_headers, fab_user):
        """Cannot delete a request that is not in draft status."""
        req = RequestFactory(requester=fab_user, status=RequestStatus.PENDING_APPROVAL)
        resp = client.delete(
            f"/api/requests/{req.pk}",
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 400
        assert Request.objects.filter(pk=req.pk).exists()

    def test_delete_other_users_draft_not_found(self, client, auth_headers, fab_user):
        """Fab user cannot delete another user's draft — returns 404."""
        other_req = RequestFactory(status=RequestStatus.DRAFT)
        resp = client.delete(
            f"/api/requests/{other_req.pk}",
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 404
        assert Request.objects.filter(pk=other_req.pk).exists()

    def test_delete_as_lab_manager_forbidden(self, client, auth_headers, lab_manager):
        """Lab manager cannot delete draft requests."""
        req = RequestFactory(status=RequestStatus.DRAFT)
        resp = client.delete(
            f"/api/requests/{req.pk}",
            content_type="application/json",
            **auth_headers(lab_manager),
        )
        assert resp.status_code == 403

    def test_delete_as_lab_staff_forbidden(self, client, auth_headers, lab_staff):
        """Lab staff cannot delete draft requests."""
        req = RequestFactory(status=RequestStatus.DRAFT)
        resp = client.delete(
            f"/api/requests/{req.pk}",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 403

    def test_delete_nonexistent_not_found(self, client, auth_headers, fab_user):
        """Deleting a non-existent request returns 404."""
        resp = client.delete(
            "/api/requests/9999",
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 404


# =============================================================================
# Sample API Tests
# =============================================================================


@pytest.mark.django_db
class TestSampleList:
    def test_list_samples(self, client, auth_headers, lab_staff):
        """Lab staff can list all samples."""
        req = RequestFactory()
        SampleFactory(request=req, wafer_id="WF-001")
        SampleFactory(request=req, wafer_id="WF-002")

        resp = client.get("/api/samples/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_list_samples_filter_by_request_id(self, client, auth_headers, lab_staff):
        """Can filter samples by request_id."""
        req1 = RequestFactory()
        req2 = RequestFactory()
        SampleFactory(request=req1, wafer_id="WF-001")
        SampleFactory(request=req2, wafer_id="WF-002")

        resp = client.get(
            f"/api/samples/?request_id={req1.pk}", **auth_headers(lab_staff)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["request_id"] == req1.pk

    def test_list_samples_filter_by_status(self, client, auth_headers, lab_staff):
        """Can filter samples by status."""
        req = RequestFactory()
        SampleFactory(request=req, wafer_id="WF-001", status=SampleStatus.SHIPPED)
        SampleFactory(request=req, wafer_id="WF-002", status=SampleStatus.RECEIVED)

        resp = client.get("/api/samples/?status=shipped", **auth_headers(lab_staff))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["status"] == "shipped"

    def test_list_samples_exposes_has_wip(self, client, auth_headers, lab_staff):
        """has_wip is True iff the sample is in at least one non-terminal
        WIP (CREATED or IN_PROGRESS); terminal WIPs (COMPLETED, ABORTED)
        don't count. Lets the SPA's Lab Samples page derive the in_wip
        pill without a second round-trip."""
        from apps.experiments.factories import ExperimentTypeFactory
        from apps.wip.factories import WIPFactory
        from apps.wip.models import WIPSample, WIPStatus

        req = RequestFactory()
        et = ExperimentTypeFactory()
        s_active = SampleFactory(request=req, wafer_id="WF-ACTIVE")
        s_terminal = SampleFactory(request=req, wafer_id="WF-DONE")
        s_idle = SampleFactory(request=req, wafer_id="WF-IDLE")

        WIPSample.objects.create(
            wip=WIPFactory(experiment_type=et, status=WIPStatus.IN_PROGRESS),
            sample=s_active,
        )
        WIPSample.objects.create(
            wip=WIPFactory(experiment_type=et, status=WIPStatus.COMPLETED),
            sample=s_terminal,
        )

        resp = client.get("/api/samples/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        by_id = {row["id"]: row for row in resp.json()}
        assert by_id[s_active.pk]["has_wip"] is True
        assert by_id[s_terminal.pk]["has_wip"] is False
        assert by_id[s_idle.pk]["has_wip"] is False


@pytest.mark.django_db
class TestSampleExperimentsRollup:
    """GET /samples/:id/experiments — INTEGRATION_GAPS §2.8 resolution A."""

    URL_TEMPLATE = "/api/samples/{}/experiments"

    def _setup_sample_with_experiments(self):
        """Build a sample whose request requires three experiment types
        and return (sample, et_pending, et_in_progress, et_done, equipment,
        recipe_factory_args). Each test wires its own dispatch state."""
        from apps.equipment.factories import EquipmentFactory, RecipeFactory
        from apps.equipment.models import EquipmentCapability
        from apps.experiments.factories import ExperimentTypeFactory
        from apps.wip.factories import WIPFactory
        from apps.wip.models import WIPSample, WIPStatus

        et_pending = ExperimentTypeFactory(name="ET-PENDING")
        et_in_progress = ExperimentTypeFactory(name="ET-IN-PROGRESS")
        et_done = ExperimentTypeFactory(name="ET-DONE")

        req = RequestFactory(status=RequestStatus.IN_PROGRESS)
        for et in (et_pending, et_in_progress, et_done):
            RequestExperiment.objects.create(request=req, experiment_type=et)
        sample = SampleFactory(request=req, status=SampleStatus.PROCESSING)

        equipment = EquipmentFactory()
        for et in (et_pending, et_in_progress, et_done):
            EquipmentCapability.objects.create(equipment=equipment, experiment_type=et)

        # Build a WIP for the in-progress experiment.
        wip_in_progress = WIPFactory(
            experiment_type=et_in_progress, status=WIPStatus.IN_PROGRESS
        )
        WIPSample.objects.create(wip=wip_in_progress, sample=sample)

        # And another WIP for the done experiment.
        wip_done = WIPFactory(experiment_type=et_done, status=WIPStatus.IN_PROGRESS)
        WIPSample.objects.create(wip=wip_done, sample=sample)

        recipes = {
            "in_progress": RecipeFactory(experiment_type=et_in_progress),
            "done": RecipeFactory(experiment_type=et_done),
        }

        return {
            "sample": sample,
            "et_pending": et_pending,
            "et_in_progress": et_in_progress,
            "et_done": et_done,
            "equipment": equipment,
            "wip_in_progress": wip_in_progress,
            "wip_done": wip_done,
            "recipes": recipes,
        }

    def test_pending_in_progress_done(self, client, auth_headers, lab_staff):
        """One sample exercises all three states in a single response.

        Verdict now lives top-level per-(sample, experiment_type) on the
        rollup row (was nested in result.verdict before — the result
        block now only carries the operator comment).
        """
        from apps.wip.factories import DispatchFactory, ExperimentResultFactory
        from apps.wip.models import (
            DispatchStatus,
            SampleExperimentStatus,
            SampleExperimentVerdict,
        )

        ctx = self._setup_sample_with_experiments()
        sample = ctx["sample"]

        # in-progress: dispatch in RUNNING
        DispatchFactory(
            wip=ctx["wip_in_progress"],
            experiment_type=ctx["et_in_progress"],
            equipment=ctx["equipment"],
            recipe=ctx["recipes"]["in_progress"],
            status=DispatchStatus.RUNNING,
        )
        # done: dispatch COMPLETED with a result + per-wafer verdict.
        done_dispatch = DispatchFactory(
            wip=ctx["wip_done"],
            experiment_type=ctx["et_done"],
            equipment=ctx["equipment"],
            recipe=ctx["recipes"]["done"],
            status=DispatchStatus.COMPLETED,
        )
        ExperimentResultFactory(dispatch=done_dispatch, comment="OK")
        SampleExperimentStatus.objects.create(
            sample=sample,
            experiment_type=ctx["et_done"],
            verdict=SampleExperimentVerdict.PASS,
            dispatch=done_dispatch,
        )

        resp = client.get(
            self.URL_TEMPLATE.format(sample.pk), **auth_headers(lab_staff)
        )
        assert resp.status_code == 200
        rows = {row["experiment_type"]["name"]: row for row in resp.json()}

        assert rows["ET-PENDING"]["status"] == "pending"
        assert rows["ET-PENDING"]["verdict"] is None
        assert rows["ET-PENDING"]["dispatch_id"] is None
        assert rows["ET-PENDING"]["result"] is None

        assert rows["ET-IN-PROGRESS"]["status"] == "in_progress"
        assert rows["ET-IN-PROGRESS"]["verdict"] is None
        assert rows["ET-IN-PROGRESS"]["dispatch_id"] is not None
        assert rows["ET-IN-PROGRESS"]["result"] is None

        assert rows["ET-DONE"]["status"] == "done"
        assert rows["ET-DONE"]["verdict"] == "pass"
        assert rows["ET-DONE"]["dispatch_id"] == done_dispatch.pk
        assert rows["ET-DONE"]["result"]["comment"] == "OK"

    def test_not_found(self, client, auth_headers, lab_staff):
        resp = client.get(self.URL_TEMPLATE.format(99999), **auth_headers(lab_staff))
        assert resp.status_code == 404

    def test_fab_user_cannot_see_other_users_sample(
        self, client, auth_headers, fab_user
    ):
        """Fab user only sees their own request's samples."""
        from apps.experiments.factories import ExperimentTypeFactory

        other_req = RequestFactory()  # not fab_user
        RequestExperiment.objects.create(
            request=other_req, experiment_type=ExperimentTypeFactory()
        )
        other_sample = SampleFactory(request=other_req)

        resp = client.get(
            self.URL_TEMPLATE.format(other_sample.pk), **auth_headers(fab_user)
        )
        assert resp.status_code == 404


@pytest.mark.django_db
class TestSampleDetail:
    def test_get_sample_detail(self, client, auth_headers, lab_staff):
        """Get sample detail includes request info."""
        req = RequestFactory()
        sample = SampleFactory(request=req, wafer_id="WF-001")

        resp = client.get(f"/api/samples/{sample.pk}", **auth_headers(lab_staff))
        assert resp.status_code == 200
        data = resp.json()
        assert data["wafer_id"] == "WF-001"
        assert data["request"]["id"] == req.pk

    def test_get_sample_not_found(self, client, auth_headers, lab_staff):
        """Non-existent sample returns 404."""
        resp = client.get("/api/samples/9999", **auth_headers(lab_staff))
        assert resp.status_code == 404


@pytest.mark.django_db
class TestSampleReceive:
    def test_receive_shipped_sample(self, client, auth_headers, lab_staff):
        """Lab staff can receive a shipped sample."""
        req = RequestFactory(status=RequestStatus.SAMPLE_SHIPPED)
        sample = SampleFactory(
            request=req, wafer_id="WF-001", status=SampleStatus.SHIPPED
        )

        resp = client.post(
            f"/api/samples/{sample.pk}/receive",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "received"

    def test_receive_non_shipped_sample_rejected(self, client, auth_headers, lab_staff):
        """Cannot receive a sample that is not in shipped status."""
        sample = SampleFactory(status=SampleStatus.CREATED)
        resp = client.post(
            f"/api/samples/{sample.pk}/receive",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400

    def test_receive_as_fab_user_forbidden(self, client, auth_headers, fab_user):
        """Fab user cannot receive samples."""
        sample = SampleFactory(status=SampleStatus.SHIPPED)
        resp = client.post(
            f"/api/samples/{sample.pk}/receive",
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 403

    def test_receive_all_samples_auto_transitions_request(
        self, client, auth_headers, lab_staff
    ):
        """When all samples are received, request auto-transitions to in_progress."""
        req = RequestFactory(status=RequestStatus.SAMPLE_SHIPPED)
        s1 = SampleFactory(request=req, wafer_id="WF-001", status=SampleStatus.SHIPPED)
        SampleFactory(request=req, wafer_id="WF-002", status=SampleStatus.RECEIVED)

        resp = client.post(
            f"/api/samples/{s1.pk}/receive",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200

        req.refresh_from_db()
        assert req.status == RequestStatus.IN_PROGRESS

    def test_no_auto_transition_when_samples_in_exception(
        self, client, auth_headers, lab_staff
    ):
        """Request stays sample_shipped if remaining samples are in exception/lost."""
        req = RequestFactory(status=RequestStatus.SAMPLE_SHIPPED)
        s1 = SampleFactory(request=req, wafer_id="WF-001", status=SampleStatus.SHIPPED)
        SampleFactory(
            request=req, wafer_id="WF-002", status=SampleStatus.RECEIVING_EXCEPTION
        )

        resp = client.post(
            f"/api/samples/{s1.pk}/receive",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200

        req.refresh_from_db()
        assert req.status == RequestStatus.SAMPLE_SHIPPED

    def test_receive_stamps_received_at(self, client, auth_headers, lab_staff):
        """Receiving a sample sets received_at to the current time and the
        list/detail responses expose it."""
        from django.utils import timezone

        sample = SampleFactory(status=SampleStatus.SHIPPED)
        assert sample.received_at is None

        before = timezone.now()
        resp = client.post(
            f"/api/samples/{sample.pk}/receive",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        after = timezone.now()
        assert resp.status_code == 200

        sample.refresh_from_db()
        assert sample.received_at is not None
        assert before <= sample.received_at <= after

        # Detail response exposes received_at.
        assert resp.json()["received_at"] is not None

        # List response also exposes it.
        list_resp = client.get(
            "/api/samples/",
            **auth_headers(lab_staff),
        )
        assert list_resp.status_code == 200
        rows = {row["id"]: row for row in list_resp.json()}
        assert rows[sample.pk]["received_at"] is not None

    def test_received_at_not_overwritten_by_later_transition(
        self, client, auth_headers, lab_staff
    ):
        """Transitioning past 'received' (e.g. to voided) must preserve the
        original received_at — it's a once-stamped clock, not a status timer."""
        sample = SampleFactory(status=SampleStatus.SHIPPED)

        # First, receive the sample.
        client.post(
            f"/api/samples/{sample.pk}/receive",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        sample.refresh_from_db()
        original_received_at = sample.received_at
        assert original_received_at is not None

        # State machine: received -> split -> processing_exception -> voided.
        sample.status = SampleStatus.PROCESSING_EXCEPTION
        sample.save(update_fields=["status"])

        resp = client.post(
            f"/api/samples/{sample.pk}/void",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200

        sample.refresh_from_db()
        assert sample.received_at == original_received_at


@pytest.mark.django_db
class TestSampleRejectReceiving:
    def test_reject_receiving_shipped_sample(self, client, auth_headers, lab_staff):
        """Lab staff can reject receiving a shipped sample."""
        sample = SampleFactory(status=SampleStatus.SHIPPED)

        resp = client.post(
            f"/api/samples/{sample.pk}/reject-receiving",
            data={"reason": "Wafer damaged"},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "receiving_exception"

    def test_reject_receiving_non_shipped_rejected(
        self, client, auth_headers, lab_staff
    ):
        """Cannot reject receiving a non-shipped sample."""
        sample = SampleFactory(status=SampleStatus.RECEIVED)
        resp = client.post(
            f"/api/samples/{sample.pk}/reject-receiving",
            data={"reason": "some reason"},
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestSampleReportLost:
    def test_report_lost_shipped_sample(self, client, auth_headers, lab_staff):
        """Lab staff can report a shipped sample as lost."""
        sample = SampleFactory(status=SampleStatus.SHIPPED)

        resp = client.post(
            f"/api/samples/{sample.pk}/report-lost",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "lost"

    def test_report_lost_non_shipped_rejected(self, client, auth_headers, lab_staff):
        """Cannot report lost for a non-shipped sample."""
        sample = SampleFactory(status=SampleStatus.RECEIVED)
        resp = client.post(
            f"/api/samples/{sample.pk}/report-lost",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestSampleVoid:
    def test_void_receiving_exception_sample(self, client, auth_headers, lab_staff):
        """Lab staff can void a sample with receiving exception."""
        sample = SampleFactory(status=SampleStatus.RECEIVING_EXCEPTION)

        resp = client.post(
            f"/api/samples/{sample.pk}/void",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "voided"

    def test_void_lost_sample(self, client, auth_headers, lab_staff):
        """Lab staff can void a lost sample."""
        sample = SampleFactory(status=SampleStatus.LOST)
        resp = client.post(
            f"/api/samples/{sample.pk}/void",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "voided"

    def test_void_shipped_sample_rejected(self, client, auth_headers, lab_staff):
        """Cannot void a sample that is only shipped."""
        sample = SampleFactory(status=SampleStatus.SHIPPED)
        resp = client.post(
            f"/api/samples/{sample.pk}/void",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400

    def test_void_as_fab_user_forbidden(self, client, auth_headers, fab_user):
        """Fab user cannot void samples."""
        sample = SampleFactory(status=SampleStatus.RECEIVING_EXCEPTION)
        resp = client.post(
            f"/api/samples/{sample.pk}/void",
            content_type="application/json",
            **auth_headers(fab_user),
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestSampleReturn:
    def test_return_receiving_exception_sample(self, client, auth_headers, lab_staff):
        """Lab staff can return a sample with receiving exception."""
        sample = SampleFactory(status=SampleStatus.RECEIVING_EXCEPTION)

        resp = client.post(
            f"/api/samples/{sample.pk}/return",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "returned"

    def test_return_processing_exception_sample(self, client, auth_headers, lab_staff):
        """Lab staff can return a sample with processing exception."""
        sample = SampleFactory(status=SampleStatus.PROCESSING_EXCEPTION)
        resp = client.post(
            f"/api/samples/{sample.pk}/return",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "returned"

    def test_return_completed_sample_rejected(self, client, auth_headers, lab_staff):
        """Cannot return a completed sample."""
        sample = SampleFactory(status=SampleStatus.COMPLETED)
        resp = client.post(
            f"/api/samples/{sample.pk}/return",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400

    def test_return_lost_sample_rejected(self, client, auth_headers, lab_staff):
        """Cannot return a lost sample (can only void)."""
        sample = SampleFactory(status=SampleStatus.LOST)
        resp = client.post(
            f"/api/samples/{sample.pk}/return",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestVoidReturnRequestAutoTransition:
    """Voiding or returning a sample should auto-transition the parent request."""

    def test_void_last_sample_in_progress_completes_request(
        self, client, auth_headers, lab_staff
    ):
        """Voiding the last non-terminal sample completes the request."""
        req = RequestFactory(status=RequestStatus.IN_PROGRESS)
        SampleFactory(request=req, wafer_id="WF-001", status=SampleStatus.COMPLETED)
        s2 = SampleFactory(
            request=req, wafer_id="WF-002", status=SampleStatus.PROCESSING_EXCEPTION
        )

        resp = client.post(
            f"/api/samples/{s2.pk}/void",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200

        req.refresh_from_db()
        assert req.status == RequestStatus.COMPLETED

    def test_void_sample_in_shipped_request_transitions_to_in_progress(
        self, client, auth_headers, lab_staff
    ):
        """Voiding a receiving-exception sample counts as accounted-for,
        allowing the request to move to in_progress when all others are received."""
        req = RequestFactory(status=RequestStatus.SAMPLE_SHIPPED)
        SampleFactory(request=req, wafer_id="WF-001", status=SampleStatus.RECEIVED)
        s2 = SampleFactory(
            request=req, wafer_id="WF-002", status=SampleStatus.RECEIVING_EXCEPTION
        )

        resp = client.post(
            f"/api/samples/{s2.pk}/void",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200

        req.refresh_from_db()
        assert req.status == RequestStatus.IN_PROGRESS

    def test_return_last_sample_in_progress_completes_request(
        self, client, auth_headers, lab_staff
    ):
        """Returning the last non-terminal sample completes the request."""
        req = RequestFactory(status=RequestStatus.IN_PROGRESS)
        SampleFactory(request=req, wafer_id="WF-001", status=SampleStatus.COMPLETED)
        s2 = SampleFactory(
            request=req, wafer_id="WF-002", status=SampleStatus.PROCESSING_EXCEPTION
        )

        resp = client.post(
            f"/api/samples/{s2.pk}/return",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200

        req.refresh_from_db()
        assert req.status == RequestStatus.COMPLETED

    def test_void_partial_samples_does_not_complete_request(
        self, client, auth_headers, lab_staff
    ):
        """Request stays in_progress if some samples are still active."""
        req = RequestFactory(status=RequestStatus.IN_PROGRESS)
        SampleFactory(request=req, wafer_id="WF-001", status=SampleStatus.RECEIVED)
        s2 = SampleFactory(
            request=req, wafer_id="WF-002", status=SampleStatus.PROCESSING_EXCEPTION
        )

        resp = client.post(
            f"/api/samples/{s2.pk}/void",
            content_type="application/json",
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 200

        req.refresh_from_db()
        assert req.status == RequestStatus.IN_PROGRESS
