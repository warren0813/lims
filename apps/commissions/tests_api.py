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

    def test_list_requests_as_lab_staff_sees_all(self, client, auth_headers, lab_staff):
        """Lab staff should see all requests."""
        RequestFactory()
        RequestFactory()

        resp = client.get("/api/requests/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_list_requests_filter_by_status(self, client, auth_headers, lab_staff):
        """Can filter requests by status."""
        RequestFactory(status=RequestStatus.DRAFT)
        RequestFactory(status=RequestStatus.PENDING_APPROVAL)

        resp = client.get("/api/requests/?status=draft", **auth_headers(lab_staff))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["status"] == "draft"

    def test_list_requests_unauthenticated(self, client):
        """Unauthenticated request returns 401."""
        resp = client.get("/api/requests/")
        assert resp.status_code == 401

    def test_list_requests_includes_urgency(self, client, auth_headers, lab_staff):
        """List response exposes the urgency field."""
        RequestFactory(urgency="3d")

        resp = client.get("/api/requests/", **auth_headers(lab_staff))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["urgency"] == "3d"

    def test_list_requests_filter_by_urgency(self, client, auth_headers, lab_staff):
        """Can filter requests by urgency."""
        RequestFactory(urgency="3d")
        RequestFactory(urgency="1w")
        RequestFactory(urgency="2w")

        resp = client.get("/api/requests/?urgency=3d", **auth_headers(lab_staff))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["urgency"] == "3d"


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
