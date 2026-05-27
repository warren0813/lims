"""Consolidate ExperimentType rows to the seven canonical full names.

Background: two seed sources accumulated over time —
  * commit 6889b01's seed_experiment_types listed 11 abbreviation rows
    (TCT, HAST, HTOL, THB, BTC, CP, FT, SEM, FIB, EDX, XRD).
  * an older guide-doc seed used full names ("Temperature Cycling Test",
    "Bias Temperature Cycling", "Circuit Probe", "Final Test").
update_or_create keyed on name didn't collide between the two, so dev
DBs ended up with both shapes side by side.

This migration:
  1. For every (abbreviation, full_name) pair in RENAME_MAP:
     - If both rows exist: merge the abbreviation's FKs into the
       full_name row and delete the abbreviation.
     - If only the abbreviation exists: rename it in place (PK preserved).
     - If only the full_name exists or neither exists: no-op.
  2. For every deprecated row name in DROP_NAMES:
     - If it has no FKs: delete.
     - If it has FKs AND has a family-related canonical target in
       MERGE_DEPRECATED: merge FKs over and delete.
     - If it has FKs AND no canonical target: raise RuntimeError with
       a clear error message so the operator can manually resolve.

forwards() is exposed as a module-level function so tests can drive
it directly against the live ORM (the standard migration entry point
goes through Django's executor, which is awkward to test in isolation).
"""

from __future__ import annotations

from django.db import migrations

# Abbreviation → canonical full name. Both shapes may exist in the wild.
RENAME_MAP: dict[str, str] = {
    "TCT": "Temperature Cycling Test",
    "HAST": "Highly Accelerated Stress Test",
    "HTOL": "High Temperature Operating Life",
    "CP": "Circuit Probe",
    "FT": "Final Test",
    "SEM": "Scanning Electron Microscopy",
    "EDX": "Energy Dispersive X-ray Spectroscopy",
}

# Rows that exist in the wild but aren't in the canonical set.
# Some have an in-family canonical target we can safely merge into;
# the rest abort migration if they carry FKs.
MERGE_DEPRECATED: dict[str, str] = {
    "BTC": "Temperature Cycling Test",
    "Bias Temperature Cycling": "Temperature Cycling Test",
    "THB": "Highly Accelerated Stress Test",
}
DROP_NAMES: set[str] = set(MERGE_DEPRECATED) | {"FIB", "XRD"}

# Categories for canonical targets — kept hard-coded in the migration so
# it can create a merge target on demand without depending on the seed
# command's SEED_TYPES (migrations should be self-contained against
# shifting application code).
CANONICAL_CATEGORIES: dict[str, str] = {
    "Temperature Cycling Test": "RA",
    "Highly Accelerated Stress Test": "RA",
    "High Temperature Operating Life": "RA",
    "Circuit Probe": "TM",
    "Final Test": "TM",
    "Scanning Electron Microscopy": "FA",
    "Energy Dispersive X-ray Spectroscopy": "MA",
}


# Models that hold an ExperimentType FK or M2M. Listed explicitly so the
# migration is decoupled from app reload order.
def _fk_targets():
    """Return (model_label, field_name, unique_together) tuples for every
    FK / through-table FK that points at ExperimentType. The
    unique_together field, if non-empty, lets the merge avoid creating
    constraint-violating duplicates on the same (parent, ET) key."""
    return [
        # (app_label, model_name, fk_field, unique_with)
        ("commissions", "RequestExperiment", "experiment_type_id", ("request_id",)),
        ("equipment", "EquipmentCapability", "experiment_type_id", ("equipment_id",)),
        ("equipment", "Recipe", "experiment_type_id", ()),
        ("wip", "WIP", "experiment_type_id", ()),
        ("wip", "Dispatch", "experiment_type_id", ()),
        (
            "wip",
            "SampleExperimentStatus",
            "experiment_type_id",
            ("sample_id",),
        ),
    ]


def _has_fks(apps, et_pk: int) -> bool:
    """True iff any FK / through-table row points at this ExperimentType."""
    for app_label, model_name, fk_field, _ in _fk_targets():
        Model = apps.get_model(app_label, model_name)
        if Model.objects.filter(**{fk_field: et_pk}).exists():
            return True
    return False


def _migrate_fks(apps, from_pk: int, to_pk: int) -> None:
    """Move every FK row from `from_pk` to `to_pk`. Where a
    unique_together constraint would block (the same parent already has
    a row on `to_pk`), the `from` row is deleted instead of moved."""
    for app_label, model_name, fk_field, unique_with in _fk_targets():
        Model = apps.get_model(app_label, model_name)
        rows = Model.objects.filter(**{fk_field: from_pk})

        if unique_with:
            # Find parent-keys that already have a row on the target.
            existing_parents = set(
                Model.objects.filter(**{fk_field: to_pk}).values_list(*unique_with)
            )
            for row in rows:
                key = tuple(getattr(row, f) for f in unique_with)
                if key in existing_parents:
                    row.delete()
                else:
                    setattr(row, fk_field, to_pk)
                    row.save(update_fields=[fk_field])
                    existing_parents.add(key)
        else:
            rows.update(**{fk_field: to_pk})


def forwards(apps, schema_editor):
    ExperimentType = apps.get_model("experiments", "ExperimentType")

    # 1. Merge / rename the abbreviation rows.
    for abbreviation, full_name in RENAME_MAP.items():
        abbr_row = ExperimentType.objects.filter(name=abbreviation).first()
        if abbr_row is None:
            continue

        full_row = ExperimentType.objects.filter(name=full_name).first()
        if full_row is None:
            # Rename in place — preserves PK, no FK churn.
            abbr_row.name = full_name
            abbr_row.save(update_fields=["name"])
            continue

        # Both exist: merge abbreviation INTO full row, then delete.
        _migrate_fks(apps, abbr_row.pk, full_row.pk)
        abbr_row.delete()

    # 2. Handle deprecated rows.
    abort_names: list[str] = []
    for deprecated_name in sorted(DROP_NAMES):
        dep_row = ExperimentType.objects.filter(name=deprecated_name).first()
        if dep_row is None:
            continue

        if not _has_fks(apps, dep_row.pk):
            dep_row.delete()
            continue

        # Has FKs — look for an in-family merge target.
        target_name = MERGE_DEPRECATED.get(deprecated_name)
        if target_name is None:
            abort_names.append(deprecated_name)
            continue

        target_row = ExperimentType.objects.filter(name=target_name).first()
        if target_row is None:
            # Canonical target doesn't exist yet — create it so the
            # merge has somewhere to put the FKs. seed_experiment_types
            # will refresh its description on the next run.
            target_row = ExperimentType.objects.create(
                name=target_name,
                lab_category=CANONICAL_CATEGORIES[target_name],
                is_active=True,
            )

        _migrate_fks(apps, dep_row.pk, target_row.pk)
        dep_row.delete()

    if abort_names:
        raise RuntimeError(
            "Cannot consolidate deprecated experiment types with live FK "
            "references and no in-family merge target. Resolve manually "
            "(reassign or delete the referencing rows) and re-run migrate. "
            f"Offending names: {abort_names}"
        )


def backwards(apps, schema_editor):
    """Best-effort reverse: recreate abbreviation stubs so the migration
    can be rolled back at the schema level, but historical FK pointers
    aren't restored — once merged, original ownership is lost."""
    ExperimentType = apps.get_model("experiments", "ExperimentType")
    for abbreviation, full_name in RENAME_MAP.items():
        full_row = ExperimentType.objects.filter(name=full_name).first()
        if full_row is None:
            continue
        ExperimentType.objects.get_or_create(
            name=abbreviation,
            defaults={
                "lab_category": full_row.lab_category,
                "description": full_row.description,
                "is_active": full_row.is_active,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("experiments", "0001_initial"),
        # We touch FK targets in other apps; declare deps so Django
        # waits until those models exist.
        ("commissions", "0001_initial"),
        ("equipment", "0001_initial"),
        ("wip", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
