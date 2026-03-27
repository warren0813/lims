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
def recipe(equipment, experiment_type):
    from apps.equipment.models import Recipe

    return Recipe.objects.create(
        name="測試 Recipe",
        equipment=equipment,
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
    def test_create_wip(self, lab_user, sample):
        """WIP can be created with 1:1 relation to Sample."""
        from apps.wip.models import WIP, WIPStatus

        wip = WIP.objects.create(sample=sample, created_by=lab_user)

        assert wip.sample == sample
        assert wip.status == WIPStatus.CREATED
        assert wip.created_by == lab_user
        assert wip.completed_at is None

    def test_wip_sample_one_to_one(self, lab_user, sample):
        """A Sample can have at most one WIP (OneToOne constraint)."""
        from apps.wip.models import WIP

        WIP.objects.create(sample=sample, created_by=lab_user)

        with pytest.raises(IntegrityError):
            WIP.objects.create(sample=sample, created_by=lab_user)

    def test_wip_status_choices(self):
        """WIPStatus has exactly 4 states."""
        from apps.wip.models import WIPStatus

        values = [c.value for c in WIPStatus]
        assert values == ["created", "in_progress", "completed", "aborted"]

    def test_wip_db_table_name(self):
        """Database table name is wip."""
        from apps.wip.models import WIP

        assert WIP._meta.db_table == "wip"


@pytest.mark.django_db
class TestDispatch:
    def test_create_dispatch(
        self, lab_user, sample, experiment_type, equipment, recipe
    ):
        """Dispatch can be created linking WIP to equipment + recipe + experiment_type."""
        from apps.wip.models import WIP, Dispatch, DispatchStatus

        wip = WIP.objects.create(sample=sample, created_by=lab_user)
        dispatch = Dispatch.objects.create(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            created_by=lab_user,
        )

        assert dispatch.wip == wip
        assert dispatch.experiment_type == experiment_type
        assert dispatch.equipment == equipment
        assert dispatch.recipe == recipe
        assert dispatch.status == DispatchStatus.PENDING
        assert dispatch.dispatched_at is None
        assert dispatch.completed_at is None

    def test_multiple_dispatches_per_wip(
        self, lab_user, sample, experiment_type, equipment, recipe
    ):
        """A single WIP can have multiple Dispatches (different experiments)."""
        from apps.experiments.models import ExperimentType, LabCategory
        from apps.wip.models import WIP, Dispatch

        wip = WIP.objects.create(sample=sample, created_by=lab_user)
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
        from apps.equipment.models import EquipmentCapability, Recipe

        EquipmentCapability.objects.create(equipment=equipment, experiment_type=et2)
        recipe2 = Recipe.objects.create(
            name="Recipe 2", equipment=equipment, experiment_type=et2
        )
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


@pytest.mark.django_db
class TestExperimentResult:
    def test_create_experiment_result(
        self, lab_user, sample, experiment_type, equipment, recipe
    ):
        """ExperimentResult can be created with OneToOne relation to Dispatch."""
        from apps.wip.models import WIP, Dispatch, ExperimentResult

        wip = WIP.objects.create(sample=sample, created_by=lab_user)
        dispatch = Dispatch.objects.create(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            created_by=lab_user,
        )
        result = ExperimentResult.objects.create(
            dispatch=dispatch,
            summary="測試完成，所有樣品通過",
            verdict=ExperimentResult.Verdict.PASS,
        )

        assert result.dispatch == dispatch
        assert result.verdict == ExperimentResult.Verdict.PASS
        assert result.data_source == ExperimentResult.DataSource.MANUAL

    def test_experiment_result_one_to_one(
        self, lab_user, sample, experiment_type, equipment, recipe
    ):
        """A Dispatch can have at most one ExperimentResult."""
        from apps.wip.models import WIP, Dispatch, ExperimentResult

        wip = WIP.objects.create(sample=sample, created_by=lab_user)
        dispatch = Dispatch.objects.create(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            created_by=lab_user,
        )
        ExperimentResult.objects.create(
            dispatch=dispatch,
            summary="第一次結果",
            verdict=ExperimentResult.Verdict.PASS,
        )

        with pytest.raises(IntegrityError):
            ExperimentResult.objects.create(
                dispatch=dispatch,
                summary="重複結果",
                verdict=ExperimentResult.Verdict.FAIL,
            )

    def test_experiment_result_json_data(
        self, lab_user, sample, experiment_type, equipment, recipe
    ):
        """data JSONField can be written and read back correctly."""
        from apps.wip.models import WIP, Dispatch, ExperimentResult

        wip = WIP.objects.create(sample=sample, created_by=lab_user)
        dispatch = Dispatch.objects.create(
            wip=wip,
            experiment_type=experiment_type,
            equipment=equipment,
            recipe=recipe,
            created_by=lab_user,
        )
        data = {"temperature_actual": 150.2, "defect_count": 0}
        result = ExperimentResult.objects.create(
            dispatch=dispatch,
            summary="帶數據的結果",
            verdict=ExperimentResult.Verdict.PASS,
            data=data,
        )

        fresh = ExperimentResult.objects.get(pk=result.pk)
        assert fresh.data["temperature_actual"] == 150.2
        assert fresh.data["defect_count"] == 0

    def test_experiment_result_db_table_name(self):
        """Database table name is experiment_result."""
        from apps.wip.models import ExperimentResult

        assert ExperimentResult._meta.db_table == "experiment_result"
