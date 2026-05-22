import pytest
from django.contrib.auth.models import User
from django.db import IntegrityError


@pytest.fixture
def lab_user():
    return User.objects.create_user(username="lab_staff", password="pass")


@pytest.fixture
def experiment_type():
    from apps.experiments.models import ExperimentType, LabCategory

    return ExperimentType.objects.create(name="高溫烘烤", lab_category=LabCategory.RA)


@pytest.fixture
def equipment(experiment_type):
    from apps.equipment.models import Equipment, EquipmentCapability

    equip = Equipment.objects.create(
        name="烤箱 A-01", model_name="OV-3000", capacity=25
    )
    EquipmentCapability.objects.create(equipment=equip, experiment_type=experiment_type)
    return equip


@pytest.fixture
def recipe(experiment_type):
    from apps.equipment.models import Recipe

    return Recipe.objects.create(
        name="測試 Recipe",
        experiment_type=experiment_type,
    )


@pytest.fixture
def request_obj(lab_user):
    from apps.commissions.models import Request

    return Request.objects.create(title="測試委託", requester=lab_user)


@pytest.fixture
def sample(request_obj):
    from apps.commissions.models import Sample, WaferSize

    return Sample.objects.create(
        request=request_obj, wafer_id="WF-001", wafer_size=WaferSize.SIZE_300MM
    )


@pytest.mark.django_db
class TestWIP:
    def test_create_wip(self, lab_user, equipment, experiment_type, sample):
        """WIP can be created with experiment_type and samples via M2M."""
        from apps.wip.models import WIP, WIPSample, WIPStatus

        wip = WIP.objects.create(experiment_type=experiment_type, created_by=lab_user)
        WIPSample.objects.create(wip=wip, sample=sample)

        assert wip.experiment_type == experiment_type
        assert wip.status == WIPStatus.CREATED
        assert wip.created_by == lab_user
        assert wip.completed_at is None
        assert wip.samples.count() == 1
        assert wip.samples.first() == sample

    def test_wip_multiple_samples(
        self, lab_user, equipment, experiment_type, request_obj
    ):
        """A WIP can have multiple samples from different requests."""
        from apps.commissions.models import Request, Sample, WaferSize
        from apps.wip.models import WIP, WIPSample

        s1 = Sample.objects.create(
            request=request_obj, wafer_id="WF-001", wafer_size=WaferSize.SIZE_300MM
        )
        req2 = Request.objects.create(title="另一筆委託", requester=lab_user)
        s2 = Sample.objects.create(
            request=req2, wafer_id="WF-002", wafer_size=WaferSize.SIZE_200MM
        )

        wip = WIP.objects.create(experiment_type=experiment_type, created_by=lab_user)
        WIPSample.objects.create(wip=wip, sample=s1)
        WIPSample.objects.create(wip=wip, sample=s2)

        assert wip.samples.count() == 2

    def test_sample_in_multiple_wips(
        self, lab_user, equipment, experiment_type, sample
    ):
        """A sample can participate in multiple WIPs."""
        from apps.wip.models import WIP, WIPSample

        wip1 = WIP.objects.create(experiment_type=experiment_type, created_by=lab_user)
        WIPSample.objects.create(wip=wip1, sample=sample)

        wip2 = WIP.objects.create(experiment_type=experiment_type, created_by=lab_user)
        WIPSample.objects.create(wip=wip2, sample=sample)

        assert sample.wips.count() == 2

    def test_wip_sample_unique_together(
        self, lab_user, equipment, experiment_type, sample
    ):
        """Same sample cannot be added to same WIP twice."""
        from apps.wip.models import WIP, WIPSample

        wip = WIP.objects.create(experiment_type=experiment_type, created_by=lab_user)
        WIPSample.objects.create(wip=wip, sample=sample)

        with pytest.raises(IntegrityError):
            WIPSample.objects.create(wip=wip, sample=sample)

    def test_wip_status_choices(self):
        """WIPStatus has exactly 4 states."""
        from apps.wip.models import WIPStatus

        values = [c.value for c in WIPStatus]
        assert values == ["created", "in_progress", "completed", "aborted"]

    def test_wip_db_table_name(self):
        """Database table name is wip."""
        from apps.wip.models import WIP

        assert WIP._meta.db_table == "wip"

    def test_wip_experiment_type_required(self, lab_user, experiment_type):
        """WIP.experiment_type is required (chat-design: every WIP is bound
        to exactly one experiment_type at creation time)."""
        from apps.wip.models import WIP

        wip = WIP.objects.create(experiment_type=experiment_type, created_by=lab_user)
        assert wip.experiment_type == experiment_type


@pytest.mark.django_db
class TestDispatch:
    def test_create_dispatch(
        self, lab_user, sample, experiment_type, equipment, recipe
    ):
        """Dispatch links WIP to recipe + experiment_type (equipment on WIP)."""
        from apps.wip.models import WIP, Dispatch, DispatchStatus, WIPSample

        wip = WIP.objects.create(experiment_type=experiment_type, created_by=lab_user)
        WIPSample.objects.create(wip=wip, sample=sample)
        dispatch = Dispatch.objects.create(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            created_by=lab_user,
        )

        assert dispatch.wip == wip
        assert dispatch.experiment_type == experiment_type
        assert dispatch.recipe == recipe
        assert dispatch.status == DispatchStatus.PENDING
        assert dispatch.dispatched_at is None
        assert dispatch.completed_at is None

    def test_multiple_dispatches_per_wip(
        self, lab_user, sample, experiment_type, equipment, recipe
    ):
        """A single WIP can have multiple Dispatches (different experiments)."""
        from apps.equipment.models import EquipmentCapability, Recipe
        from apps.experiments.models import ExperimentType, LabCategory
        from apps.wip.models import WIP, Dispatch, WIPSample

        wip = WIP.objects.create(experiment_type=experiment_type, created_by=lab_user)
        WIPSample.objects.create(wip=wip, sample=sample)
        Dispatch.objects.create(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            created_by=lab_user,
        )

        et2 = ExperimentType.objects.create(
            name="材料分析", lab_category=LabCategory.MA
        )
        EquipmentCapability.objects.create(equipment=equipment, experiment_type=et2)
        recipe2 = Recipe.objects.create(name="Recipe 2", experiment_type=et2)
        Dispatch.objects.create(
            wip=wip,
            experiment_type=et2,
            equipment=equipment,
            recipe=recipe2,
            created_by=lab_user,
        )

        assert wip.dispatches.count() == 2

    def test_dispatch_status_choices(self):
        """DispatchStatus has exactly 9 states."""
        from apps.wip.models import DispatchStatus

        values = [c.value for c in DispatchStatus]
        assert values == [
            "pending",
            "dispatched",
            "running",
            "execution_exception",
            "unloaded",
            "result_recorded",
            "completed",
            "pending_redispatch",
            "aborted",
        ]

    def test_dispatch_db_table_name(self):
        """Database table name is dispatch."""
        from apps.wip.models import Dispatch

        assert Dispatch._meta.db_table == "dispatch"

    def test_dispatch_equipment_required(
        self, lab_user, sample, experiment_type, equipment, recipe
    ):
        """Dispatch.equipment is required (chat-design: equipment is chosen
        per-dispatch and stored on the Dispatch row directly)."""
        from apps.wip.models import WIP, Dispatch, WIPSample

        wip = WIP.objects.create(experiment_type=experiment_type, created_by=lab_user)
        WIPSample.objects.create(wip=wip, sample=sample)
        dispatch = Dispatch.objects.create(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            created_by=lab_user,
        )
        assert dispatch.equipment == equipment

    def test_dispatch_estimated_duration_round_trip(
        self, lab_user, sample, experiment_type, equipment, recipe
    ):
        """estimated_duration_seconds is nullable and round-trips. Large
        values (e.g. multi-day burn-in runs) are accepted — it's a
        PositiveIntegerField with no upper cap by design."""
        from apps.wip.models import WIP, Dispatch, WIPSample

        wip = WIP.objects.create(experiment_type=experiment_type, created_by=lab_user)
        WIPSample.objects.create(wip=wip, sample=sample)

        no_estimate = Dispatch.objects.create(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            created_by=lab_user,
        )
        assert no_estimate.estimated_duration_seconds is None

        seven_days = 7 * 24 * 60 * 60
        long_run = Dispatch.objects.create(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            estimated_duration_seconds=seven_days,
            created_by=lab_user,
        )
        assert (
            Dispatch.objects.get(pk=long_run.pk).estimated_duration_seconds
            == seven_days
        )


@pytest.mark.django_db
class TestExperimentResult:
    def test_create_experiment_result(
        self, lab_user, sample, experiment_type, equipment, recipe
    ):
        """ExperimentResult can be created with OneToOne relation to Dispatch."""
        from apps.wip.models import WIP, Dispatch, ExperimentResult, WIPSample

        wip = WIP.objects.create(experiment_type=experiment_type, created_by=lab_user)
        WIPSample.objects.create(wip=wip, sample=sample)
        dispatch = Dispatch.objects.create(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            created_by=lab_user,
        )
        result = ExperimentResult.objects.create(
            dispatch=dispatch,
            comment="測試完成，所有樣品通過",
        )

        assert result.dispatch == dispatch
        assert result.comment == "測試完成，所有樣品通過"

    def test_experiment_result_one_to_one(
        self, lab_user, sample, experiment_type, equipment, recipe
    ):
        """A Dispatch can have at most one ExperimentResult."""
        from apps.wip.models import WIP, Dispatch, ExperimentResult, WIPSample

        wip = WIP.objects.create(experiment_type=experiment_type, created_by=lab_user)
        WIPSample.objects.create(wip=wip, sample=sample)
        dispatch = Dispatch.objects.create(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            created_by=lab_user,
        )
        ExperimentResult.objects.create(dispatch=dispatch, comment="第一次結果")

        with pytest.raises(IntegrityError):
            ExperimentResult.objects.create(dispatch=dispatch, comment="重複結果")

    def test_experiment_result_comment_round_trip(
        self, lab_user, sample, experiment_type, equipment, recipe
    ):
        """comment TextField can be written and read back correctly —
        replaces the old test_experiment_result_json_data (data field gone)."""
        from apps.wip.models import WIP, Dispatch, ExperimentResult, WIPSample

        wip = WIP.objects.create(experiment_type=experiment_type, created_by=lab_user)
        WIPSample.objects.create(wip=wip, sample=sample)
        dispatch = Dispatch.objects.create(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            created_by=lab_user,
        )
        comment = "Run completed cleanly. Wafer 2 had minor visual artefacts."
        result = ExperimentResult.objects.create(dispatch=dispatch, comment=comment)

        fresh = ExperimentResult.objects.get(pk=result.pk)
        assert fresh.comment == comment

    def test_experiment_result_db_table_name(self):
        """Database table name is experiment_result."""
        from apps.wip.models import ExperimentResult

        assert ExperimentResult._meta.db_table == "experiment_result"


@pytest.mark.django_db
class TestSampleExperimentStatus:
    def test_create_status(self, sample, experiment_type):
        """SampleExperimentStatus can be created."""
        from apps.wip.models import SampleExperimentProgress, SampleExperimentStatus

        ses = SampleExperimentStatus.objects.create(
            sample=sample, experiment_type=experiment_type
        )
        assert ses.status == SampleExperimentProgress.PENDING
        assert ses.dispatch is None

    def test_unique_together(self, sample, experiment_type):
        """Same sample + experiment_type combination is unique."""
        from apps.wip.models import SampleExperimentStatus

        SampleExperimentStatus.objects.create(
            sample=sample, experiment_type=experiment_type
        )
        with pytest.raises(IntegrityError):
            SampleExperimentStatus.objects.create(
                sample=sample, experiment_type=experiment_type
            )

    def test_db_table_name(self):
        from apps.wip.models import SampleExperimentStatus

        assert SampleExperimentStatus._meta.db_table == "sample_experiment_status"
