"""Tests for demo equipment and recipe seed commands."""

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.equipment.management.commands.seed_equipment import EQUIPMENT_SEEDS
from apps.equipment.management.commands.seed_recipes import RECIPE_SEEDS
from apps.equipment.models import Equipment, EquipmentCapability, Recipe
from apps.experiments.models import ExperimentType, LabCategory


@pytest.mark.django_db
class TestSeedEquipmentCommand:
    def test_seed_creates_equipment_and_capabilities(self):
        out = StringIO()

        call_command("seed_equipment", stdout=out)

        assert Equipment.objects.count() == len(EQUIPMENT_SEEDS)
        assert EquipmentCapability.objects.count() == sum(
            len(seed.capabilities) for seed in EQUIPMENT_SEEDS
        )
        assert ExperimentType.objects.filter(name="Temperature Cycling Test").exists()

        tct = ExperimentType.objects.get(name="Temperature Cycling Test")
        tct_equipment = set(
            Equipment.objects.filter(capabilities=tct).values_list("name", flat=True)
        )
        assert {"QA-TCT-01", "QA-TCT-02"} <= tct_equipment
        assert "Equipment seeded" in out.getvalue()

    def test_rerun_is_idempotent_and_refreshes_equipment_fields(self):
        call_command("seed_equipment")
        first_equipment_ids = set(Equipment.objects.values_list("pk", flat=True))

        Equipment.objects.filter(name="QA-TCT-01").update(capacity=99)

        call_command("seed_equipment")

        assert Equipment.objects.count() == len(EQUIPMENT_SEEDS)
        assert (
            set(Equipment.objects.values_list("pk", flat=True)) == first_equipment_ids
        )
        assert Equipment.objects.get(name="QA-TCT-01").capacity == 6

    def test_rerun_removes_stale_capabilities(self):
        call_command("seed_equipment")
        equipment = Equipment.objects.get(name="QA-TCT-01")
        stale_type = ExperimentType.objects.create(
            name="Temporary Seed Capability",
            lab_category=LabCategory.FA,
        )
        EquipmentCapability.objects.create(
            equipment=equipment,
            experiment_type=stale_type,
        )

        call_command("seed_equipment")

        assert not EquipmentCapability.objects.filter(
            equipment=equipment,
            experiment_type=stale_type,
        ).exists()

    def test_missing_experiment_types_raise_command_error(self):
        with pytest.raises(CommandError, match="Temperature Cycling Test"):
            call_command("seed_equipment", skip_experiment_types=True)


@pytest.mark.django_db
class TestSeedRecipesCommand:
    def test_seed_creates_recipes(self):
        out = StringIO()

        call_command("seed_recipes", stdout=out)

        assert Recipe.objects.count() == len(RECIPE_SEEDS)
        assert ExperimentType.objects.filter(name="Temperature Cycling Test").exists()

        tct = ExperimentType.objects.get(name="Temperature Cycling Test")
        recipe = Recipe.objects.get(name="TCT_Standard_500_v1")
        assert recipe.experiment_type == tct
        assert recipe.parameters["cycles"] == 500
        assert recipe.is_active is True
        assert "Recipes seeded" in out.getvalue()

        htol_recipe = Recipe.objects.get(name="HTOL_125C_1000h")
        assert htol_recipe.experiment_type.name == "High Temperature Operating Life"

    def test_rerun_is_idempotent_and_refreshes_recipe_fields(self):
        call_command("seed_recipes")
        first_recipe_ids = set(Recipe.objects.values_list("pk", flat=True))

        Recipe.objects.filter(name="TCT_Standard_500_v1").update(is_active=False)

        call_command("seed_recipes")

        assert Recipe.objects.count() == len(RECIPE_SEEDS)
        assert set(Recipe.objects.values_list("pk", flat=True)) == first_recipe_ids
        assert Recipe.objects.get(name="TCT_Standard_500_v1").is_active is True

    def test_missing_experiment_types_raise_command_error(self):
        with pytest.raises(CommandError, match="Temperature Cycling Test"):
            call_command("seed_recipes", skip_experiment_types=True)
