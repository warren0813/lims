"""Idempotent experiment-type seeding for dev / staging / demo.

Covers the lab's working set: classic reliability stress tests under
RA, electrical characterisation under TM, and the FA + MA categories
that the SPA's demo flow exercises. Safe to re-run; uses update_or_create
keyed on name.

The catalogue here is intentionally Western-industry standard so the
demo reads cleanly to anyone familiar with JEDEC / JESD22 / MIL-STD
reliability vocabulary.
"""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.experiments.models import ExperimentType, LabCategory

# (name, category, description). Order is display-stable; the unique
# constraint on name keeps re-runs idempotent across deploys. Seven
# canonical full names — the consolidation migration
# (0002_consolidate_experiment_types) merges any pre-existing
# abbreviation-named or deprecated rows into this set before the seed
# runs, so a re-seed never produces duplicates.
SEED_TYPES: list[tuple[str, str, str]] = [
    # --- Reliability Analysis (RA) ---
    (
        "Temperature Cycling Test",
        LabCategory.RA,
        "JESD22-A104 — accelerated thermal cycling stress between hot and "
        "cold extremes to expose CTE-mismatch failure modes.",
    ),
    (
        "Highly Accelerated Stress Test",
        LabCategory.RA,
        "JESD22-A110 — high-pressure / high-humidity bias stress used to "
        "compress months of moisture-related field exposure into hours.",
    ),
    (
        "High Temperature Operating Life",
        LabCategory.RA,
        "JESD22-A108 — sustained high-temperature electrical operation to "
        "estimate intrinsic lifetime and infant-mortality rates.",
    ),
    # --- Test & Measurement (TM) ---
    (
        "Circuit Probe",
        LabCategory.TM,
        "Wafer-level functional and parametric test before dicing.",
    ),
    (
        "Final Test",
        LabCategory.TM,
        "Packaged-device functional and parametric test before ship.",
    ),
    # --- Failure Analysis (FA) ---
    (
        "Scanning Electron Microscopy",
        LabCategory.FA,
        "High-resolution surface imaging using a focused electron beam — "
        "primary tool for visualising structural defects.",
    ),
    # --- Material Analysis (MA) ---
    (
        "Energy Dispersive X-ray Spectroscopy",
        LabCategory.MA,
        "Elemental composition analysis via characteristic X-ray emission, "
        "typically paired with SEM.",
    ),
]


class Command(BaseCommand):
    help = (
        "Seed (or refresh) the standard reliability-lab experiment-type "
        "catalogue. Idempotent — re-running updates descriptions in place "
        "but never duplicates rows."
    )

    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        updated = 0
        with transaction.atomic():
            for name, category, description in SEED_TYPES:
                _, was_created = ExperimentType.objects.update_or_create(
                    name=name,
                    defaults={
                        "lab_category": category,
                        "description": description,
                        "is_active": True,
                    },
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Experiment types seeded: {created} created, {updated} updated, "
                f"{len(SEED_TYPES)} total."
            )
        )
