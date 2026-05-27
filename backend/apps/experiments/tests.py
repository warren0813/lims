import json

import pytest
from django.contrib.auth.models import User
from django.db import IntegrityError

from apps.accounts.factories import FabUserFactory, LabManagerFactory, LabStaffFactory
from apps.experiments.factories import ExperimentTypeFactory


@pytest.mark.django_db
class TestExperimentType:
    def test_create_experiment_type(self):
        """ExperimentType can be created successfully."""
        from apps.experiments.models import ExperimentType, LabCategory

        exp = ExperimentType.objects.create(
            name="高溫烘烤測試",
            description="在高溫環境下測試晶圓可靠度",
            lab_category=LabCategory.RA,
        )

        assert exp.name == "高溫烘烤測試"
        assert exp.lab_category == LabCategory.RA
        assert exp.is_active is True
        assert exp.created_at is not None
        assert exp.updated_at is not None

    def test_name_unique_constraint(self):
        """ExperimentType name must be unique."""
        from apps.experiments.models import ExperimentType, LabCategory

        ExperimentType.objects.create(name="測試項目 A", lab_category=LabCategory.MA)

        with pytest.raises(IntegrityError):
            ExperimentType.objects.create(
                name="測試項目 A", lab_category=LabCategory.FA
            )

    def test_soft_delete(self):
        """Setting is_active=False soft-deletes the record while keeping it in the DB."""
        from apps.experiments.models import ExperimentType, LabCategory

        exp = ExperimentType.objects.create(
            name="已停用項目", lab_category=LabCategory.TM
        )
        exp.is_active = False
        exp.save()

        assert ExperimentType.objects.filter(name="已停用項目").exists()
        assert not ExperimentType.objects.get(name="已停用項目").is_active

    def test_description_optional(self):
        """description field defaults to an empty string."""
        from apps.experiments.models import ExperimentType, LabCategory

        exp = ExperimentType.objects.create(
            name="無描述項目", lab_category=LabCategory.RA
        )
        assert exp.description == ""

    def test_db_table_name(self):
        """Database table name is experiment_type."""
        from apps.experiments.models import ExperimentType

        assert ExperimentType._meta.db_table == "experiment_type"


@pytest.mark.django_db
class TestLabCategory:
    def test_lab_category_values(self):
        """LabCategory contains the four expected values."""
        from apps.experiments.models import LabCategory

        assert LabCategory.RA == "RA"
        assert LabCategory.MA == "MA"
        assert LabCategory.FA == "FA"
        assert LabCategory.TM == "TM"


# ---------------------------------------------------------------------------
# Factory tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestExperimentTypeFactory:
    def test_factory_creates_valid_instance(self):
        """ExperimentTypeFactory creates a valid ExperimentType."""
        exp = ExperimentTypeFactory()
        assert exp.pk is not None
        assert exp.is_active is True
        assert exp.lab_category == "RA"

    def test_factory_creates_unique_names(self):
        """Each factory call produces a unique name."""
        exp1 = ExperimentTypeFactory()
        exp2 = ExperimentTypeFactory()
        assert exp1.name != exp2.name


# ---------------------------------------------------------------------------
# API tests — GET /api/experiment-types/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestListExperimentTypes:
    """Tests for GET /api/experiment-types/ endpoint."""

    def test_list_returns_200_for_authenticated_user(self, client, auth_headers):
        """Any authenticated user can list experiment types."""
        profile = FabUserFactory()
        ExperimentTypeFactory(name="Test A")
        ExperimentTypeFactory(name="Test B")

        response = client.get("/api/experiment-types/", **auth_headers(profile.user))

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_list_returns_401_for_unauthenticated(self, client):
        """Unauthenticated request returns 401."""
        response = client.get("/api/experiment-types/")
        assert response.status_code == 401

    def test_list_filters_by_lab_category(self, client, auth_headers):
        """Filtering by lab_category returns only matching items."""
        profile = LabStaffFactory()
        ExperimentTypeFactory(name="RA Test", lab_category="RA")
        ExperimentTypeFactory(name="MA Test", lab_category="MA")

        response = client.get(
            "/api/experiment-types/?lab_category=RA", **auth_headers(profile.user)
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["lab_category"] == "RA"

    def test_list_filters_by_is_active(self, client, auth_headers):
        """Filtering by is_active returns only matching items."""
        profile = LabStaffFactory()
        ExperimentTypeFactory(name="Active", is_active=True)
        ExperimentTypeFactory(name="Inactive", is_active=False)

        response = client.get(
            "/api/experiment-types/?is_active=true", **auth_headers(profile.user)
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Active"

    def test_list_search_by_name(self, client, auth_headers):
        """Search parameter filters by name (case-insensitive contains)."""
        profile = LabStaffFactory()
        ExperimentTypeFactory(name="高溫烘烤測試")
        ExperimentTypeFactory(name="材料分析")

        response = client.get(
            "/api/experiment-types/?search=烘烤", **auth_headers(profile.user)
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert "烘烤" in data[0]["name"]

    def test_list_only_active_by_default(self, client, auth_headers):
        """Without is_active filter, returns only active items."""
        profile = FabUserFactory()
        ExperimentTypeFactory(name="Active", is_active=True)
        ExperimentTypeFactory(name="Inactive", is_active=False)

        response = client.get("/api/experiment-types/", **auth_headers(profile.user))

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Active"


# ---------------------------------------------------------------------------
# API tests — POST /api/experiment-types/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCreateExperimentType:
    """Tests for POST /api/experiment-types/ endpoint."""

    def test_lab_staff_can_create(self, client, auth_headers):
        """Lab staff can create a new experiment type."""
        profile = LabStaffFactory()

        response = client.post(
            "/api/experiment-types/",
            data=json.dumps(
                {
                    "name": "新測試項目",
                    "description": "描述",
                    "lab_category": "RA",
                }
            ),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "新測試項目"
        assert data["lab_category"] == "RA"
        assert data["is_active"] is True

    def test_lab_manager_can_create(self, client, auth_headers):
        """Lab manager can create a new experiment type."""
        profile = LabManagerFactory()

        response = client.post(
            "/api/experiment-types/",
            data=json.dumps(
                {
                    "name": "管理員測試項目",
                    "description": "",
                    "lab_category": "MA",
                }
            ),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 201

    def test_fab_user_cannot_create(self, client, auth_headers):
        """Fab user cannot create experiment types (403)."""
        profile = FabUserFactory()

        response = client.post(
            "/api/experiment-types/",
            data=json.dumps(
                {
                    "name": "禁止建立",
                    "description": "",
                    "lab_category": "FA",
                }
            ),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 403

    def test_create_duplicate_name_returns_409(self, client, auth_headers):
        """Creating with a duplicate name returns 409."""
        profile = LabStaffFactory()
        ExperimentTypeFactory(name="已存在")

        response = client.post(
            "/api/experiment-types/",
            data=json.dumps(
                {
                    "name": "已存在",
                    "description": "",
                    "lab_category": "RA",
                }
            ),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 409

    def test_unauthenticated_cannot_create(self, client):
        """Unauthenticated request returns 401."""
        response = client.post(
            "/api/experiment-types/",
            data=json.dumps({"name": "test", "description": "", "lab_category": "RA"}),
            content_type="application/json",
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# API tests — GET /api/experiment-types/{id}
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGetExperimentType:
    """Tests for GET /api/experiment-types/{id} endpoint."""

    def test_get_detail_returns_200(self, client, auth_headers):
        """Any authenticated user can get experiment type detail."""
        profile = FabUserFactory()
        exp = ExperimentTypeFactory(name="詳情測試")

        response = client.get(
            f"/api/experiment-types/{exp.pk}", **auth_headers(profile.user)
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == exp.pk
        assert data["name"] == "詳情測試"

    def test_get_nonexistent_returns_404(self, client, auth_headers):
        """Requesting a non-existent ID returns 404."""
        profile = FabUserFactory()

        response = client.get(
            "/api/experiment-types/99999", **auth_headers(profile.user)
        )

        assert response.status_code == 404

    def test_unauthenticated_returns_401(self, client):
        """Unauthenticated request returns 401."""
        exp = ExperimentTypeFactory()
        response = client.get(f"/api/experiment-types/{exp.pk}")
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# API tests — PATCH /api/experiment-types/{id}
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUpdateExperimentType:
    """Tests for PATCH /api/experiment-types/{id} endpoint."""

    def test_lab_staff_can_update(self, client, auth_headers):
        """Lab staff can update an experiment type."""
        profile = LabStaffFactory()
        exp = ExperimentTypeFactory(name="原名稱")

        response = client.patch(
            f"/api/experiment-types/{exp.pk}",
            data=json.dumps({"name": "新名稱"}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "新名稱"

    def test_partial_update_only_changes_provided_fields(self, client, auth_headers):
        """PATCH only updates provided fields, leaving others unchanged."""
        profile = LabStaffFactory()
        exp = ExperimentTypeFactory(
            name="不變", description="原描述", lab_category="RA"
        )

        response = client.patch(
            f"/api/experiment-types/{exp.pk}",
            data=json.dumps({"description": "新描述"}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "不變"
        assert data["description"] == "新描述"
        assert data["lab_category"] == "RA"

    def test_fab_user_cannot_update(self, client, auth_headers):
        """Fab user cannot update experiment types (403)."""
        profile = FabUserFactory()
        exp = ExperimentTypeFactory()

        response = client.patch(
            f"/api/experiment-types/{exp.pk}",
            data=json.dumps({"name": "禁止修改"}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 403

    def test_update_nonexistent_returns_404(self, client, auth_headers):
        """Updating a non-existent ID returns 404."""
        profile = LabStaffFactory()

        response = client.patch(
            "/api/experiment-types/99999",
            data=json.dumps({"name": "ghost"}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 404

    def test_update_duplicate_name_returns_409(self, client, auth_headers):
        """Renaming to an existing name returns 409."""
        profile = LabStaffFactory()
        ExperimentTypeFactory(name="已存在名稱")
        exp = ExperimentTypeFactory(name="待改名")

        response = client.patch(
            f"/api/experiment-types/{exp.pk}",
            data=json.dumps({"name": "已存在名稱"}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 409


# ---------------------------------------------------------------------------
# API tests — DELETE /api/experiment-types/{id}
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDeleteExperimentType:
    """Tests for DELETE /api/experiment-types/{id} endpoint (soft delete)."""

    def test_lab_staff_can_soft_delete(self, client, auth_headers):
        """Lab staff can soft-delete an experiment type."""
        profile = LabStaffFactory()
        exp = ExperimentTypeFactory(name="待停用")

        response = client.delete(
            f"/api/experiment-types/{exp.pk}", **auth_headers(profile.user)
        )

        assert response.status_code == 200
        exp.refresh_from_db()
        assert exp.is_active is False

    def test_fab_user_cannot_delete(self, client, auth_headers):
        """Fab user cannot delete experiment types (403)."""
        profile = FabUserFactory()
        exp = ExperimentTypeFactory()

        response = client.delete(
            f"/api/experiment-types/{exp.pk}", **auth_headers(profile.user)
        )

        assert response.status_code == 403

    def test_delete_nonexistent_returns_404(self, client, auth_headers):
        """Deleting a non-existent ID returns 404."""
        profile = LabStaffFactory()

        response = client.delete(
            "/api/experiment-types/99999", **auth_headers(profile.user)
        )

        assert response.status_code == 404

    def test_soft_deleted_not_in_default_list(self, client, auth_headers):
        """Soft-deleted items do not appear in the default list."""
        profile = LabStaffFactory()
        ExperimentTypeFactory(name="已停用", is_active=False)
        ExperimentTypeFactory(name="仍啟用", is_active=True)

        response = client.get("/api/experiment-types/", **auth_headers(profile.user))

        assert response.status_code == 200
        names = [item["name"] for item in response.json()]
        assert "已停用" not in names
        assert "仍啟用" in names


# ---------------------------------------------------------------------------
# API tests — Edge cases
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestExperimentTypeEdgeCases:
    """Edge case tests for experiment type endpoints."""

    def test_user_without_profile_gets_403_on_create(self, client, auth_headers):
        """A user without a UserProfile gets 403 instead of 500."""
        user = User.objects.create_user(username="noprofile", password="pass")
        user.profile.delete()

        response = client.post(
            "/api/experiment-types/",
            data=json.dumps({"name": "test", "description": "", "lab_category": "RA"}),
            content_type="application/json",
            **auth_headers(user),
        )

        assert response.status_code == 403


@pytest.mark.django_db
class TestSeedExperimentTypesCommand:
    """seed_experiment_types is idempotent — second run should be a no-op."""

    def test_first_run_creates_all_seed_types(self):
        from io import StringIO

        from django.core.management import call_command

        from apps.experiments.management.commands.seed_experiment_types import (
            SEED_TYPES,
        )
        from apps.experiments.models import ExperimentType

        out = StringIO()
        call_command("seed_experiment_types", stdout=out)

        # Every catalogue row landed.
        assert ExperimentType.objects.count() == len(SEED_TYPES)
        names = set(ExperimentType.objects.values_list("name", flat=True))
        assert names == {name for name, _, _ in SEED_TYPES}

    def test_rerun_is_idempotent_and_updates_in_place(self):
        from django.core.management import call_command

        from apps.experiments.models import ExperimentType

        call_command("seed_experiment_types")
        first_count = ExperimentType.objects.count()
        first_ids = set(ExperimentType.objects.values_list("pk", flat=True))

        # Mutate a description to verify update_or_create refreshes it.
        ExperimentType.objects.filter(name="Temperature Cycling Test").update(
            description="stale"
        )

        call_command("seed_experiment_types")
        assert ExperimentType.objects.count() == first_count
        # PKs preserved — update_or_create, not delete+recreate.
        assert set(ExperimentType.objects.values_list("pk", flat=True)) == first_ids
        # Description refreshed to seed value.
        assert ExperimentType.objects.get(
            name="Temperature Cycling Test"
        ).description.startswith("JESD22-A104")


@pytest.mark.django_db
class TestConsolidateExperimentTypesMigration:
    """0002_consolidate_experiment_types — collapses pre-existing
    abbreviation-named rows into the canonical full-name set, merges
    family-related deprecated rows (BTC → TCT family), and either
    drops or aborts on unrecognised deprecated rows."""

    def _forwards(self):
        """Import + call the migration's forwards function with the
        real ORM (test DB is migrated, so no historical models needed)."""
        from importlib import import_module

        from django.apps import apps as django_apps

        mod = import_module(
            "apps.experiments.migrations.0002_consolidate_experiment_types"
        )
        mod.forwards(django_apps, None)

    def test_merges_abbreviation_into_full_name_keeping_fks(self):
        from apps.commissions.factories import RequestFactory
        from apps.commissions.models import RequestExperiment
        from apps.experiments.models import ExperimentType, LabCategory

        # Pre-existing duplicates: an abbreviation row + a full-name row.
        tct_abbrev = ExperimentType.objects.create(
            name="TCT", lab_category=LabCategory.RA
        )
        tct_full = ExperimentType.objects.create(
            name="Temperature Cycling Test", lab_category=LabCategory.RA
        )

        # FKs split across both — both should end up on the full-name row.
        req_a = RequestFactory()
        req_b = RequestFactory()
        RequestExperiment.objects.create(request=req_a, experiment_type=tct_abbrev)
        RequestExperiment.objects.create(request=req_b, experiment_type=tct_full)

        self._forwards()

        # Abbreviation row gone; full-name row keeps the canonical name.
        assert not ExperimentType.objects.filter(name="TCT").exists()
        survivor = ExperimentType.objects.get(name="Temperature Cycling Test")
        # Both RequestExperiment rows point to the survivor.
        assert RequestExperiment.objects.filter(experiment_type=survivor).count() == 2

    def test_renames_abbreviation_in_place_when_no_full_name_exists(self):
        from apps.experiments.models import ExperimentType, LabCategory

        et = ExperimentType.objects.create(name="HAST", lab_category=LabCategory.RA)
        original_pk = et.pk

        self._forwards()

        # Same PK, new name. No FK churn.
        survivor = ExperimentType.objects.get(pk=original_pk)
        assert survivor.name == "Highly Accelerated Stress Test"
        assert not ExperimentType.objects.filter(name="HAST").exists()

    def test_drops_deprecated_without_references(self):
        from apps.experiments.models import ExperimentType, LabCategory

        ExperimentType.objects.create(name="THB", lab_category=LabCategory.RA)
        ExperimentType.objects.create(name="FIB", lab_category=LabCategory.FA)

        self._forwards()

        assert not ExperimentType.objects.filter(name="THB").exists()
        assert not ExperimentType.objects.filter(name="FIB").exists()

    def test_auto_merges_family_related_deprecated_with_fks(self):
        """BTC has an in-family merge target (Temperature Cycling Test).
        Existing FKs migrate to the target rather than aborting."""
        from apps.commissions.factories import RequestFactory
        from apps.commissions.models import RequestExperiment
        from apps.experiments.models import ExperimentType, LabCategory

        btc = ExperimentType.objects.create(name="BTC", lab_category=LabCategory.RA)
        req = RequestFactory()
        RequestExperiment.objects.create(request=req, experiment_type=btc)

        self._forwards()

        assert not ExperimentType.objects.filter(name="BTC").exists()
        survivor = ExperimentType.objects.get(name="Temperature Cycling Test")
        assert RequestExperiment.objects.filter(
            request=req, experiment_type=survivor
        ).exists()

    def test_aborts_on_unmergeable_deprecated_with_references(self):
        """FIB / XRD have no in-family canonical target. If they still
        have FK refs at migration time, the migration aborts with an
        informative message rather than silently dropping data."""
        from apps.commissions.factories import RequestFactory
        from apps.commissions.models import RequestExperiment
        from apps.experiments.models import ExperimentType, LabCategory

        fib = ExperimentType.objects.create(name="FIB", lab_category=LabCategory.FA)
        req = RequestFactory()
        RequestExperiment.objects.create(request=req, experiment_type=fib)

        with pytest.raises(RuntimeError, match="FIB"):
            self._forwards()

        # Nothing dropped on abort.
        assert ExperimentType.objects.filter(name="FIB").exists()


@pytest.mark.django_db
class TestSeedExperimentTypesUsesFullNames:
    """After the consolidation, seed_experiment_types only lists the 7
    canonical full names."""

    EXPECTED_NAMES = {
        "Temperature Cycling Test",
        "Highly Accelerated Stress Test",
        "High Temperature Operating Life",
        "Circuit Probe",
        "Final Test",
        "Scanning Electron Microscopy",
        "Energy Dispersive X-ray Spectroscopy",
    }

    def test_seed_creates_exactly_the_canonical_set(self):
        from django.core.management import call_command

        from apps.experiments.models import ExperimentType

        call_command("seed_experiment_types")
        names = set(ExperimentType.objects.values_list("name", flat=True))
        assert names == self.EXPECTED_NAMES
