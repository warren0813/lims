import pytest
from django.contrib.auth.models import User
from django.db import IntegrityError


@pytest.fixture
def user():
    return User.objects.create_user(username="fab_user", password="pass")


@pytest.fixture
def experiment_type():
    from apps.experiments.models import ExperimentType, LabCategory

    return ExperimentType.objects.create(
        name="高溫烘烤測試", lab_category=LabCategory.RA
    )


@pytest.mark.django_db
class TestRequest:
    def test_create_request_as_draft(self, user):
        """Request is created with DRAFT status by default."""
        from apps.commissions.models import Request, RequestStatus

        req = Request.objects.create(title="測試委託單", requester=user)

        assert req.title == "測試委託單"
        assert req.requester == user
        assert req.status == RequestStatus.DRAFT
        assert req.created_at is not None

    def test_request_experiment_m2m_with_parameters(self, user, experiment_type):
        """RequestExperiment through model can store per-experiment parameters."""
        from apps.commissions.models import Request, RequestExperiment

        req = Request.objects.create(title="M2M 測試", requester=user)
        re = RequestExperiment.objects.create(
            request=req,
            experiment_type=experiment_type,
            parameters={"duration_hours": 300},
        )

        assert re.request == req
        assert re.experiment_type == experiment_type
        assert re.parameters["duration_hours"] == 300
        assert req.experiment_types.count() == 1

    def test_request_experiment_unique_together(self, user, experiment_type):
        """Duplicate RequestExperiment entries for the same request and type are rejected."""
        from apps.commissions.models import Request, RequestExperiment

        req = Request.objects.create(title="唯一性測試", requester=user)
        RequestExperiment.objects.create(request=req, experiment_type=experiment_type)

        with pytest.raises(IntegrityError):
            RequestExperiment.objects.create(
                request=req, experiment_type=experiment_type
            )

    def test_request_status_default_draft(self, user):
        """status defaults to draft."""
        from apps.commissions.models import Request, RequestStatus

        req = Request.objects.create(title="狀態測試", requester=user)
        assert req.status == RequestStatus.DRAFT

    def test_request_db_table_name(self):
        """Database table name is request."""
        from apps.commissions.models import Request

        assert Request._meta.db_table == "request"

    def test_request_urgency_default_one_week(self, user):
        """urgency defaults to '1w'."""
        from apps.commissions.models import Request, RequestUrgency

        req = Request.objects.create(title="緊急度預設", requester=user)
        assert req.urgency == RequestUrgency.ONE_WEEK
        assert req.urgency == "1w"

    def test_request_urgency_choices(self, user):
        """Request accepts '3d', '1w', '2w' as urgency values."""
        from apps.commissions.models import Request, RequestUrgency

        assert RequestUrgency.THREE_DAYS == "3d"
        assert RequestUrgency.ONE_WEEK == "1w"
        assert RequestUrgency.TWO_WEEKS == "2w"

        req = Request.objects.create(
            title="緊急委託", requester=user, urgency=RequestUrgency.THREE_DAYS
        )
        assert req.urgency == "3d"

    def test_request_factory_default_urgency(self):
        """RequestFactory creates instances with the default urgency."""
        from apps.commissions.factories import RequestFactory
        from apps.commissions.models import RequestUrgency

        req = RequestFactory()
        assert req.urgency == RequestUrgency.ONE_WEEK


@pytest.mark.django_db
class TestSample:
    def test_create_sample(self, user):
        """Sample can be created with CREATED status by default."""
        from apps.commissions.models import Request, Sample, SampleStatus, WaferSize

        req = Request.objects.create(title="樣品委託", requester=user)
        sample = Sample.objects.create(
            request=req,
            wafer_id="WF-2026-001",
            wafer_size=WaferSize.SIZE_300MM,
        )

        assert sample.wafer_id == "WF-2026-001"
        assert sample.wafer_size == WaferSize.SIZE_300MM
        assert sample.status == SampleStatus.CREATED

    def test_wafer_id_unique_per_request(self, user):
        """wafer_id must be unique within the same request."""
        from apps.commissions.models import Request, Sample, WaferSize

        req = Request.objects.create(title="唯一性委託", requester=user)
        Sample.objects.create(
            request=req, wafer_id="WF-001", wafer_size=WaferSize.SIZE_300MM
        )

        with pytest.raises(IntegrityError):
            Sample.objects.create(
                request=req, wafer_id="WF-001", wafer_size=WaferSize.SIZE_200MM
            )

    def test_wafer_id_can_repeat_across_requests(self, user):
        """The same wafer_id may appear in different requests."""
        from apps.commissions.models import Request, Sample, WaferSize

        req1 = Request.objects.create(title="委託 1", requester=user)
        req2 = Request.objects.create(title="委託 2", requester=user)

        Sample.objects.create(
            request=req1, wafer_id="WF-001", wafer_size=WaferSize.SIZE_300MM
        )
        sample2 = Sample.objects.create(
            request=req2, wafer_id="WF-001", wafer_size=WaferSize.SIZE_300MM
        )
        assert sample2.pk is not None

    def test_wafer_size_choices(self):
        """WaferSize contains 200mm and 300mm options."""
        from apps.commissions.models import WaferSize

        assert WaferSize.SIZE_200MM == "200mm"
        assert WaferSize.SIZE_300MM == "300mm"

    def test_sample_status_lost(self, user):
        """Sample can be set to LOST status."""
        from apps.commissions.models import Request, Sample, SampleStatus, WaferSize

        req = Request.objects.create(title="遺失測試", requester=user)
        sample = Sample.objects.create(
            request=req,
            wafer_id="WF-LOST-001",
            wafer_size=WaferSize.SIZE_300MM,
            status=SampleStatus.LOST,
        )

        assert sample.status == SampleStatus.LOST
        assert SampleStatus.LOST.value == "lost"

    def test_sample_received_at_defaults_to_none(self, user):
        """received_at is null until the sample is explicitly received."""
        from apps.commissions.models import Request, Sample, WaferSize

        req = Request.objects.create(title="received_at 預設", requester=user)
        sample = Sample.objects.create(
            request=req, wafer_id="WF-RX-001", wafer_size=WaferSize.SIZE_300MM
        )
        assert sample.received_at is None

    def test_sample_status_choices_count(self):
        """SampleStatus has exactly 10 states."""
        from apps.commissions.models import SampleStatus

        assert len(SampleStatus.choices) == 10

    def test_sample_db_table_name(self):
        """Database table name is sample."""
        from apps.commissions.models import Sample

        assert Sample._meta.db_table == "sample"


@pytest.mark.django_db
class TestApprovalLog:
    def test_create_approval_log(self, user):
        """ApprovalLog can be created successfully."""
        from apps.commissions.models import ApprovalLog, Request

        req = Request.objects.create(title="簽核委託", requester=user)
        reviewer = User.objects.create_user(username="mgr", password="pass")
        log = ApprovalLog.objects.create(
            request=req,
            reviewer=reviewer,
            action=ApprovalLog.Action.APPROVE,
        )

        assert log.request == req
        assert log.reviewer == reviewer
        assert log.action == ApprovalLog.Action.APPROVE
        assert log.created_at is not None

    def test_approval_log_ordering(self, user):
        """ApprovalLog is ordered by created_at descending (newest first)."""
        from apps.commissions.models import ApprovalLog, Request

        req = Request.objects.create(title="排序測試", requester=user)
        reviewer = User.objects.create_user(username="mgr2", password="pass")

        log1 = ApprovalLog.objects.create(
            request=req, reviewer=reviewer, action=ApprovalLog.Action.RETURN
        )
        log2 = ApprovalLog.objects.create(
            request=req, reviewer=reviewer, action=ApprovalLog.Action.APPROVE
        )

        logs = list(ApprovalLog.objects.filter(request=req))
        assert logs[0].pk == log2.pk
        assert logs[1].pk == log1.pk

    def test_approval_log_db_table_name(self):
        """Database table name is approval_log."""
        from apps.commissions.models import ApprovalLog

        assert ApprovalLog._meta.db_table == "approval_log"
