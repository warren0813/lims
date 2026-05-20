"""Smoke tests for the layered chat-design backfill migrations.

These call the migration ``forwards`` functions directly against real
ORM models (rather than historical models) so we can assert behaviour
end-to-end without having to wire up Django's migration executor.

Run-time semantics differ slightly from a real migration application
(historical models don't have the model-level managers, etc.) but for
these particular backfills the logic only touches FKs and aggregations
that work identically against current models.
"""

from __future__ import annotations

import importlib

import pytest
from django.apps import apps as django_apps

_backfill_wip_experiment_type = importlib.import_module(
    "apps.wip.migrations.0008_backfill_wip_experiment_type"
)
_backfill_dispatch_equipment = importlib.import_module(
    "apps.wip.migrations.0010_backfill_dispatch_equipment"
)


@pytest.mark.django_db
class TestWIPExperimentTypeBackfill:
    """Migration 0008_backfill_wip_experiment_type."""

    def test_backfill_copies_from_first_dispatch(self):
        from apps.commissions.factories import RequestFactory, SampleFactory
        from apps.commissions.models import RequestStatus
        from apps.equipment.factories import EquipmentFactory, RecipeFactory
        from apps.experiments.factories import ExperimentTypeFactory
        from apps.wip.factories import DispatchFactory, WIPFactory

        et = ExperimentTypeFactory()
        equipment = EquipmentFactory()
        recipe = RecipeFactory(equipment=equipment, experiment_type=et)
        req = RequestFactory(status=RequestStatus.IN_PROGRESS)
        sample = SampleFactory(request=req)
        wip = WIPFactory(equipment=equipment, samples=[sample])
        DispatchFactory(wip=wip, experiment_type=et, recipe=recipe)
        wip.experiment_type = None
        wip.save(update_fields=["experiment_type"])

        _backfill_wip_experiment_type.forwards(django_apps, None)

        wip.refresh_from_db()
        assert wip.experiment_type_id == et.pk

    def test_backfill_falls_back_to_request_experiments(self):
        from apps.commissions.factories import (
            RequestExperimentFactory,
            RequestFactory,
            SampleFactory,
        )
        from apps.commissions.models import RequestStatus
        from apps.equipment.factories import EquipmentFactory
        from apps.experiments.factories import ExperimentTypeFactory
        from apps.wip.factories import WIPFactory

        et = ExperimentTypeFactory()
        equipment = EquipmentFactory()
        req = RequestFactory(status=RequestStatus.IN_PROGRESS)
        RequestExperimentFactory(request=req, experiment_type=et)
        sample = SampleFactory(request=req)
        wip = WIPFactory(equipment=equipment, samples=[sample])
        wip.experiment_type = None
        wip.save(update_fields=["experiment_type"])

        _backfill_wip_experiment_type.forwards(django_apps, None)

        wip.refresh_from_db()
        assert wip.experiment_type_id == et.pk

    def test_backfill_leaves_wip_without_data_untouched(self):
        from apps.equipment.factories import EquipmentFactory
        from apps.wip.factories import WIPFactory

        equipment = EquipmentFactory()
        wip = WIPFactory(equipment=equipment)
        assert wip.experiment_type is None

        _backfill_wip_experiment_type.forwards(django_apps, None)

        wip.refresh_from_db()
        assert wip.experiment_type is None


@pytest.mark.django_db
class TestDispatchEquipmentBackfill:
    """Migration 0010_backfill_dispatch_equipment."""

    def test_backfill_copies_from_parent_wip(self):
        from apps.equipment.factories import EquipmentFactory, RecipeFactory
        from apps.experiments.factories import ExperimentTypeFactory
        from apps.wip.factories import DispatchFactory, WIPFactory

        et = ExperimentTypeFactory()
        equipment = EquipmentFactory()
        recipe = RecipeFactory(equipment=equipment, experiment_type=et)
        wip = WIPFactory(equipment=equipment)
        dispatch = DispatchFactory(
            wip=wip,
            experiment_type=et,
            recipe=recipe,
            equipment=None,
        )

        _backfill_dispatch_equipment.forwards(django_apps, None)

        dispatch.refresh_from_db()
        assert dispatch.equipment_id == equipment.pk

    def test_backfill_skips_dispatch_whose_wip_has_no_equipment(self):
        from apps.equipment.factories import EquipmentFactory, RecipeFactory
        from apps.experiments.factories import ExperimentTypeFactory
        from apps.wip.factories import DispatchFactory, WIPFactory

        et = ExperimentTypeFactory()
        equipment = EquipmentFactory()
        recipe = RecipeFactory(equipment=equipment, experiment_type=et)
        # WIP without equipment (legacy state for in-flight rows).
        wip = WIPFactory(equipment=None)
        dispatch = DispatchFactory(
            wip=wip,
            experiment_type=et,
            recipe=recipe,
            equipment=None,
        )

        _backfill_dispatch_equipment.forwards(django_apps, None)

        dispatch.refresh_from_db()
        assert dispatch.equipment is None
