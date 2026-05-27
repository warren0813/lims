"""Seed demo lab equipment and experiment capabilities."""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field
from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.equipment.models import Equipment, EquipmentCapability, EquipmentStatus
from apps.experiments.models import ExperimentType


@dataclass(frozen=True)
class EquipmentSeed:
    name: str
    model_name: str
    capacity: int
    capabilities: tuple[str, ...]
    status: str = EquipmentStatus.AVAILABLE
    parameters: dict[str, Any] = field(default_factory=dict)


EQUIPMENT_SEEDS: tuple[EquipmentSeed, ...] = (
    EquipmentSeed(
        name="QA-TCT-01",
        model_name="ESPEC ARS-1100",
        capacity=6,
        capabilities=("Temperature Cycling Test",),
    ),
    EquipmentSeed(
        name="QA-TCT-02",
        model_name="ESPEC ARS-1100",
        capacity=6,
        capabilities=("Temperature Cycling Test", "High Temperature Operating Life"),
    ),
    EquipmentSeed(
        name="QA-HAST-01",
        model_name="Hirayama PC-422",
        capacity=12,
        capabilities=(
            "Highly Accelerated Stress Test",
            "High Temperature Operating Life",
        ),
    ),
    EquipmentSeed(
        name="QA-CP-A",
        model_name="Accretech UF3000",
        capacity=1,
        capabilities=("Circuit Probe",),
        status=EquipmentStatus.MAINTENANCE,
    ),
    EquipmentSeed(
        name="QA-FT-01",
        model_name="Advantest V93000",
        capacity=4,
        capabilities=("Final Test",),
    ),
)


class Command(BaseCommand):
    help = (
        "Seed demo lab equipment and capabilities. Also ensures the canonical "
        "experiment-type catalogue exists."
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
        required_names = {
            capability
            for equipment in EQUIPMENT_SEEDS
            for capability in equipment.capabilities
        }
        missing = sorted(required_names - experiment_types.keys())
        if missing:
            raise CommandError(
                "Missing experiment types required for equipment seed: "
                + ", ".join(missing)
            )

        equipment_created = 0
        equipment_updated = 0
        capabilities_created = 0
        capabilities_removed = 0

        with transaction.atomic():
            for seed in EQUIPMENT_SEEDS:
                equipment, was_created = Equipment.objects.update_or_create(
                    name=seed.name,
                    defaults={
                        "model_name": seed.model_name,
                        "capacity": seed.capacity,
                        "status": seed.status,
                        "parameters": seed.parameters,
                    },
                )
                if was_created:
                    equipment_created += 1
                else:
                    equipment_updated += 1

                desired_capability_ids = {
                    experiment_types[capability_name].pk
                    for capability_name in seed.capabilities
                }
                removed_count, _ = (
                    EquipmentCapability.objects.filter(equipment=equipment)
                    .exclude(experiment_type_id__in=desired_capability_ids)
                    .delete()
                )
                capabilities_removed += removed_count

                for capability_name in seed.capabilities:
                    _, cap_created = EquipmentCapability.objects.get_or_create(
                        equipment=equipment,
                        experiment_type=experiment_types[capability_name],
                    )
                    if cap_created:
                        capabilities_created += 1

        self.stdout.write(
            self.style.SUCCESS(
                "Equipment seeded: "
                f"{equipment_created} created, "
                f"{equipment_updated} updated, "
                f"{capabilities_created} capabilities created, "
                f"{capabilities_removed} stale capabilities removed."
            )
        )
