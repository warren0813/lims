"""Model and factory tests for the equipment app."""

import pytest
from django.db import IntegrityError

from apps.equipment.factories import EquipmentFactory, RecipeFactory


@pytest.fixture
def experiment_type():
    from apps.experiments.models import ExperimentType, LabCategory

    return ExperimentType.objects.create(
        name="高溫烘烤測試", lab_category=LabCategory.RA
    )


@pytest.mark.django_db
class TestEquipment:
    def test_create_equipment(self):
        """Equipment can be created with default status AVAILABLE."""
        from apps.equipment.models import Equipment, EquipmentStatus

        equip = Equipment.objects.create(
            name="烤箱 A-01",
            model_name="OV-3000",
            capacity=25,
        )

        assert equip.name == "烤箱 A-01"
        assert equip.model_name == "OV-3000"
        assert equip.capacity == 25
        assert equip.status == EquipmentStatus.AVAILABLE
        assert equip.created_at is not None

    def test_capacity_positive_integer(self, experiment_type):
        """capacity must be a positive integer."""
        from django.core.exceptions import ValidationError

        from apps.equipment.models import Equipment

        equip = Equipment(name="測試機台", model_name="X-100", capacity=-1)
        with pytest.raises(ValidationError):
            equip.full_clean()

    def test_equipment_capability_m2m(self, experiment_type):
        """Equipment can be linked to ExperimentTypes via EquipmentCapability."""
        from apps.equipment.models import Equipment, EquipmentCapability

        equip = Equipment.objects.create(
            name="烤箱 B-02", model_name="OV-5000", capacity=10
        )
        EquipmentCapability.objects.create(
            equipment=equip, experiment_type=experiment_type
        )

        assert equip.capabilities.count() == 1
        assert experiment_type in equip.capabilities.all()

    def test_equipment_capability_unique_together(self, experiment_type):
        """Duplicate EquipmentCapability entries for the same pair are rejected."""
        from apps.equipment.models import Equipment, EquipmentCapability

        equip = Equipment.objects.create(
            name="烤箱 C-03", model_name="OV-7000", capacity=5
        )
        EquipmentCapability.objects.create(
            equipment=equip, experiment_type=experiment_type
        )

        with pytest.raises(IntegrityError):
            EquipmentCapability.objects.create(
                equipment=equip, experiment_type=experiment_type
            )

    def test_equipment_db_table_name(self):
        """Database table name is equipment."""
        from apps.equipment.models import Equipment

        assert Equipment._meta.db_table == "equipment"

    def test_equipment_parameters_defaults_to_empty_dict(self):
        """parameters defaults to {} so manager UIs can iterate it safely."""
        from apps.equipment.models import Equipment

        equip = Equipment.objects.create(
            name="Param defaults",
            model_name="P-100",
            capacity=4,
        )
        assert equip.parameters == {}

    def test_equipment_parameters_round_trip(self):
        """Arbitrary JSON-serializable dicts can be stored and read back."""
        from apps.equipment.models import Equipment

        params = {
            "temperature_c": {"min": 25, "max": 200, "step": 5},
            "humidity_percent": [10, 50, 90],
            "note": "managed by tech lead",
        }
        equip = Equipment.objects.create(
            name="Param round-trip",
            model_name="P-200",
            capacity=2,
            parameters=params,
        )
        fresh = Equipment.objects.get(pk=equip.pk)
        assert fresh.parameters == params

    def test_equipment_capability_db_table_name(self):
        """Database table name is equipment_capability."""
        from apps.equipment.models import EquipmentCapability

        assert EquipmentCapability._meta.db_table == "equipment_capability"


@pytest.mark.django_db
class TestRecipe:
    def test_create_recipe(self, experiment_type):
        """Recipe can be created and linked to ExperimentType.

        Chat-design: recipes are equipment-agnostic.
        """
        from apps.equipment.models import Recipe

        recipe = Recipe.objects.create(
            name="RA-OV9000-HTSL-300H",
            experiment_type=experiment_type,
            parameters={"temperature_celsius": 150, "duration_hours": 300},
        )

        assert recipe.name == "RA-OV9000-HTSL-300H"
        assert recipe.experiment_type == experiment_type
        assert recipe.is_active is True

    def test_recipe_fk_relations(self, experiment_type):
        """Recipe FK field correctly references ExperimentType."""
        from apps.equipment.models import Recipe

        recipe = Recipe.objects.create(
            name="測試 Recipe",
            experiment_type=experiment_type,
        )

        assert recipe.experiment_type_id == experiment_type.pk

    def test_recipe_soft_delete(self, experiment_type):
        """Setting is_active=False soft-deletes the record while keeping it in the DB."""
        from apps.equipment.models import Recipe

        recipe = Recipe.objects.create(
            name="停用 Recipe",
            experiment_type=experiment_type,
        )
        recipe.is_active = False
        recipe.save()

        assert Recipe.objects.filter(name="停用 Recipe").exists()
        assert not Recipe.objects.get(name="停用 Recipe").is_active

    def test_recipe_json_parameters(self, experiment_type):
        """parameters JSONField can be written and read back correctly."""
        from apps.equipment.models import Recipe

        params = {"temperature_celsius": 200, "humidity_percent": None}
        recipe = Recipe.objects.create(
            name="JSON 測試 Recipe",
            experiment_type=experiment_type,
            parameters=params,
        )

        fresh = Recipe.objects.get(pk=recipe.pk)
        assert fresh.parameters["temperature_celsius"] == 200
        assert fresh.parameters["humidity_percent"] is None

    def test_recipe_db_table_name(self):
        """Database table name is recipe."""
        from apps.equipment.models import Recipe

        assert Recipe._meta.db_table == "recipe"


# ---------------------------------------------------------------------------
# Factory tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestEquipmentFactory:
    def test_factory_creates_valid_instance(self):
        """EquipmentFactory creates a valid Equipment."""
        equip = EquipmentFactory()
        assert equip.pk is not None
        assert equip.status == "available"
        assert equip.capacity == 25

    def test_factory_creates_unique_names(self):
        """Each factory call produces a unique name."""
        e1 = EquipmentFactory()
        e2 = EquipmentFactory()
        assert e1.name != e2.name


@pytest.mark.django_db
class TestRecipeFactory:
    def test_factory_creates_valid_instance(self):
        """RecipeFactory creates a valid Recipe with related objects."""
        recipe = RecipeFactory()
        assert recipe.pk is not None
        assert recipe.experiment_type is not None
        assert recipe.is_active is True

    def test_factory_creates_unique_names(self):
        """Each factory call produces a unique name."""
        r1 = RecipeFactory()
        r2 = RecipeFactory()
        assert r1.name != r2.name
