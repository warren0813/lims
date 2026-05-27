"""Seed demo experiment recipes."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.equipment.models import Recipe
from apps.experiments.models import ExperimentType


@dataclass(frozen=True)
class RecipeSeed:
    name: str
    experiment_type: str
    parameters: dict[str, Any]
    description: str


RECIPE_SEEDS: tuple[RecipeSeed, ...] = (
    RecipeSeed(
        name="TCT_Standard_500_v1",
        experiment_type="Temperature Cycling Test",
        parameters={
            "cycles": 500,
            "t_min": "-55 degC",
            "t_max": "125 degC",
            "dwell": "15 min",
            "ramp": "15 degC/min",
        },
        description="Standard Temperature Cycling Test recipe",
    ),
    RecipeSeed(
        name="TCT_Extended_1000_v2",
        experiment_type="Temperature Cycling Test",
        parameters={
            "cycles": 1000,
            "t_min": "-65 degC",
            "t_max": "150 degC",
            "dwell": "10 min",
            "ramp": "20 degC/min",
        },
        description="Extended Temperature Cycling Test recipe",
    ),
    RecipeSeed(
        name="HAST_85_85_168h",
        experiment_type="Highly Accelerated Stress Test",
        parameters={
            "temperature": "85 degC",
            "humidity": "85% RH",
            "duration": "168 h",
            "bias": "5V",
        },
        description="Standard Highly Accelerated Stress Test recipe",
    ),
    RecipeSeed(
        name="HTOL_125C_1000h",
        experiment_type="High Temperature Operating Life",
        parameters={
            "temperature": "125 degC",
            "duration": "1000 h",
            "bias": "nominal Vdd",
            "readpoint": "168 h",
        },
        description="Standard High Temperature Operating Life recipe",
    ),
    RecipeSeed(
        name="CP_Full_Sweep_v3",
        experiment_type="Circuit Probe",
        parameters={
            "sites": 1024,
            "touchdowns": 24,
            "vdd": "1.0V",
            "clock": "100MHz",
        },
        description="Standard Circuit Probe recipe",
    ),
    RecipeSeed(
        name="FT_Basic_Functional",
        experiment_type="Final Test",
        parameters={
            "tests": 240,
            "voltage": "1.2V",
            "temp": "25 degC",
        },
        description="Standard Final Test recipe",
    ),
)


class Command(BaseCommand):
    help = (
        "Seed demo recipes. Also ensures the canonical experiment-type "
        "catalogue exists."
    )

    def add_arguments(self, parser: argparse.ArgumentParser) -> None:
        parser.add_argument(
            "--skip-experiment-types",
            action="store_true",
            help="Do not seed experiment types first. Intended for tests.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        if not options["skip_experiment_types"]:
            call_command("seed_experiment_types", verbosity=0)

        experiment_types = {
            et.name: et for et in ExperimentType.objects.filter(is_active=True)
        }
        required_names = {recipe.experiment_type for recipe in RECIPE_SEEDS}
        missing = sorted(required_names - experiment_types.keys())
        if missing:
            raise CommandError(
                "Missing experiment types required for recipe seed: "
                + ", ".join(missing)
            )

        recipes_created = 0
        recipes_updated = 0

        with transaction.atomic():
            for seed in RECIPE_SEEDS:
                _, was_created = Recipe.objects.update_or_create(
                    name=seed.name,
                    defaults={
                        "description": seed.description,
                        "parameters": seed.parameters,
                        "experiment_type": experiment_types[seed.experiment_type],
                        "is_active": True,
                    },
                )
                if was_created:
                    recipes_created += 1
                else:
                    recipes_updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Recipes seeded: {recipes_created} created, {recipes_updated} updated."
            )
        )
