"""API integration tests for equipment and recipe endpoints."""

import json

import pytest
from django.contrib.auth.models import User

from apps.accounts.factories import FabUserFactory, LabManagerFactory, LabStaffFactory
from apps.equipment.factories import EquipmentFactory, RecipeFactory
from apps.experiments.factories import ExperimentTypeFactory

# ---------------------------------------------------------------------------
# Equipment API tests — GET /api/equipment/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestListEquipment:
    """Tests for GET /api/equipment/ endpoint."""

    def test_list_returns_200_for_lab_staff(self, client, auth_headers):
        """Lab staff can list equipment."""
        profile = LabStaffFactory()
        EquipmentFactory(name="烤箱 A")
        EquipmentFactory(name="烤箱 B")

        response = client.get("/api/equipment/", **auth_headers(profile.user))

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_list_returns_401_for_unauthenticated(self, client):
        """Unauthenticated request returns 401."""
        response = client.get("/api/equipment/")
        assert response.status_code == 401

    def test_fab_user_cannot_list(self, client, auth_headers):
        """Fab user cannot access equipment endpoints (403)."""
        profile = FabUserFactory()

        response = client.get("/api/equipment/", **auth_headers(profile.user))

        assert response.status_code == 403

    def test_list_filters_by_status(self, client, auth_headers):
        """Filtering by status returns only matching equipment."""
        profile = LabStaffFactory()
        EquipmentFactory(name="可用機台", status="available")
        EquipmentFactory(name="維修機台", status="maintenance")

        response = client.get(
            "/api/equipment/?status=available", **auth_headers(profile.user)
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "可用機台"

    def test_list_search_by_name(self, client, auth_headers):
        """Search parameter filters by name (case-insensitive contains)."""
        profile = LabStaffFactory()
        EquipmentFactory(name="烤箱 OV-3000")
        EquipmentFactory(name="離子注入機")

        response = client.get(
            "/api/equipment/?search=烤箱", **auth_headers(profile.user)
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert "烤箱" in data[0]["name"]

    def test_list_invalid_status_returns_422(self, client, auth_headers):
        """Filtering by an invalid status value returns 422."""
        profile = LabStaffFactory()

        response = client.get(
            "/api/equipment/?status=banana", **auth_headers(profile.user)
        )

        assert response.status_code == 422

    def test_list_includes_capabilities(self, client, auth_headers):
        """List response includes capabilities for each equipment."""
        from apps.equipment.models import EquipmentCapability

        profile = LabStaffFactory()
        equip = EquipmentFactory()
        et = ExperimentTypeFactory(name="高溫烘烤")
        EquipmentCapability.objects.create(equipment=equip, experiment_type=et)

        response = client.get("/api/equipment/", **auth_headers(profile.user))

        assert response.status_code == 200
        data = response.json()
        assert len(data[0]["capabilities"]) == 1
        assert data[0]["capabilities"][0]["name"] == "高溫烘烤"


# ---------------------------------------------------------------------------
# Equipment API tests — POST /api/equipment/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCreateEquipment:
    """Tests for POST /api/equipment/ endpoint."""

    def test_lab_staff_can_create(self, client, auth_headers):
        """Lab staff can create equipment."""
        profile = LabStaffFactory()

        response = client.post(
            "/api/equipment/",
            data=json.dumps(
                {
                    "name": "烤箱 A-01",
                    "model_name": "OV-3000",
                    "capacity": 25,
                }
            ),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "烤箱 A-01"
        assert data["model_name"] == "OV-3000"
        assert data["capacity"] == 25
        assert data["status"] == "available"

    def test_lab_manager_can_create(self, client, auth_headers):
        """Lab manager can create equipment."""
        profile = LabManagerFactory()

        response = client.post(
            "/api/equipment/",
            data=json.dumps(
                {
                    "name": "烤箱 B-02",
                    "model_name": "OV-5000",
                    "capacity": 10,
                }
            ),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 201

    def test_create_with_experiment_type_ids(self, client, auth_headers):
        """Creating equipment with experiment_type_ids links experiment types."""
        profile = LabStaffFactory()
        et1 = ExperimentTypeFactory(name="高溫烘烤")
        et2 = ExperimentTypeFactory(name="熱衝擊")

        response = client.post(
            "/api/equipment/",
            data=json.dumps(
                {
                    "name": "烤箱 C-03",
                    "model_name": "OV-7000",
                    "capacity": 5,
                    "experiment_type_ids": [et1.pk, et2.pk],
                }
            ),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 201
        data = response.json()
        assert len(data["capabilities"]) == 2

    def test_create_with_invalid_experiment_type_ids_returns_404(
        self, client, auth_headers
    ):
        """Creating equipment with non-existent capability IDs returns 404."""
        profile = LabStaffFactory()

        response = client.post(
            "/api/equipment/",
            data=json.dumps(
                {
                    "name": "烤箱 D",
                    "model_name": "OV-9000",
                    "capacity": 10,
                    "experiment_type_ids": [99999],
                }
            ),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 404

    def test_fab_user_cannot_create(self, client, auth_headers):
        """Fab user cannot create equipment (403)."""
        profile = FabUserFactory()

        response = client.post(
            "/api/equipment/",
            data=json.dumps(
                {
                    "name": "禁止建立",
                    "model_name": "X-100",
                    "capacity": 1,
                }
            ),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 403

    def test_unauthenticated_cannot_create(self, client):
        """Unauthenticated request returns 401."""
        response = client.post(
            "/api/equipment/",
            data=json.dumps(
                {
                    "name": "test",
                    "model_name": "X-100",
                    "capacity": 1,
                }
            ),
            content_type="application/json",
        )
        assert response.status_code == 401

    def test_create_with_parameters_round_trip(self, client, auth_headers):
        """Equipment parameters (alterable-parameter schema) round-trip
        through create and detail."""
        profile = LabStaffFactory()
        params = {
            "temperature_c": {"min": 25, "max": 200},
            "humidity_percent": [10, 50, 90],
        }

        response = client.post(
            "/api/equipment/",
            data=json.dumps(
                {
                    "name": "Param rig",
                    "model_name": "PR-1",
                    "capacity": 4,
                    "parameters": params,
                }
            ),
            content_type="application/json",
            **auth_headers(profile.user),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["parameters"] == params

        # Detail response also exposes parameters.
        detail = client.get(
            f"/api/equipment/{data['id']}", **auth_headers(profile.user)
        )
        assert detail.status_code == 200
        assert detail.json()["parameters"] == params

    def test_create_without_parameters_defaults_to_empty_dict(
        self, client, auth_headers
    ):
        """parameters is optional on create; defaults to {}."""
        profile = LabStaffFactory()
        response = client.post(
            "/api/equipment/",
            data=json.dumps(
                {
                    "name": "No-param rig",
                    "model_name": "NP-1",
                    "capacity": 1,
                }
            ),
            content_type="application/json",
            **auth_headers(profile.user),
        )
        assert response.status_code == 201
        assert response.json()["parameters"] == {}


# ---------------------------------------------------------------------------
# Equipment API tests — GET /api/equipment/{id}
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGetEquipment:
    """Tests for GET /api/equipment/{id} endpoint."""

    def test_get_detail_returns_200(self, client, auth_headers):
        """Lab staff can get equipment detail."""
        from apps.equipment.models import EquipmentCapability

        profile = LabStaffFactory()
        equip = EquipmentFactory(name="詳情機台")
        et = ExperimentTypeFactory(name="測試項目")
        EquipmentCapability.objects.create(equipment=equip, experiment_type=et)
        RecipeFactory(experiment_type=et, name="測試 Recipe")

        response = client.get(
            f"/api/equipment/{equip.pk}", **auth_headers(profile.user)
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == equip.pk
        assert data["name"] == "詳情機台"
        assert len(data["capabilities"]) == 1

    def test_get_nonexistent_returns_404(self, client, auth_headers):
        """Requesting a non-existent ID returns 404."""
        profile = LabStaffFactory()

        response = client.get("/api/equipment/99999", **auth_headers(profile.user))

        assert response.status_code == 404

    def test_fab_user_cannot_get_detail(self, client, auth_headers):
        """Fab user cannot access equipment detail (403)."""
        profile = FabUserFactory()
        equip = EquipmentFactory()

        response = client.get(
            f"/api/equipment/{equip.pk}", **auth_headers(profile.user)
        )

        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Equipment API tests — PATCH /api/equipment/{id}
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUpdateEquipment:
    """Tests for PATCH /api/equipment/{id} endpoint."""

    def test_lab_staff_can_update(self, client, auth_headers):
        """Lab staff can update equipment."""
        profile = LabStaffFactory()
        equip = EquipmentFactory(name="原名稱")

        response = client.patch(
            f"/api/equipment/{equip.pk}",
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
        equip = EquipmentFactory(name="不變", model_name="OV-1000", capacity=10)

        response = client.patch(
            f"/api/equipment/{equip.pk}",
            data=json.dumps({"capacity": 50}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "不變"
        assert data["model_name"] == "OV-1000"
        assert data["capacity"] == 50

    def test_update_status(self, client, auth_headers):
        """Equipment status can be updated."""
        profile = LabStaffFactory()
        equip = EquipmentFactory(status="available")

        response = client.patch(
            f"/api/equipment/{equip.pk}",
            data=json.dumps({"status": "maintenance"}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 200
        assert response.json()["status"] == "maintenance"

    def test_update_parameters(self, client, auth_headers):
        """PATCH can replace the parameters dict."""
        profile = LabStaffFactory()
        equip = EquipmentFactory()
        new_params = {"voltage_v": {"min": 1.0, "max": 5.0, "default": 3.3}}

        response = client.patch(
            f"/api/equipment/{equip.pk}",
            data=json.dumps({"parameters": new_params}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 200
        assert response.json()["parameters"] == new_params
        equip.refresh_from_db()
        assert equip.parameters == new_params

    def test_update_invalid_status_returns_422(self, client, auth_headers):
        """Updating with an invalid status value returns 422."""
        profile = LabStaffFactory()
        equip = EquipmentFactory()

        response = client.patch(
            f"/api/equipment/{equip.pk}",
            data=json.dumps({"status": "banana"}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 422

    def test_fab_user_cannot_update(self, client, auth_headers):
        """Fab user cannot update equipment (403)."""
        profile = FabUserFactory()
        equip = EquipmentFactory()

        response = client.patch(
            f"/api/equipment/{equip.pk}",
            data=json.dumps({"name": "禁止修改"}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 403

    def test_update_nonexistent_returns_404(self, client, auth_headers):
        """Updating a non-existent ID returns 404."""
        profile = LabStaffFactory()

        response = client.patch(
            "/api/equipment/99999",
            data=json.dumps({"name": "ghost"}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Equipment API tests — POST /api/equipment/{id}/capabilities
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSetEquipmentCapabilities:
    """Tests for POST /api/equipment/{id}/capabilities endpoint."""

    def test_set_capabilities(self, client, auth_headers):
        """Lab staff can set equipment capabilities."""
        profile = LabStaffFactory()
        equip = EquipmentFactory()
        et1 = ExperimentTypeFactory(name="能力 A")
        et2 = ExperimentTypeFactory(name="能力 B")

        response = client.post(
            f"/api/equipment/{equip.pk}/capabilities",
            data=json.dumps({"experiment_type_ids": [et1.pk, et2.pk]}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["capabilities"]) == 2

    def test_set_capabilities_replaces_existing(self, client, auth_headers):
        """Setting capabilities replaces all existing ones."""
        from apps.equipment.models import EquipmentCapability

        profile = LabStaffFactory()
        equip = EquipmentFactory()
        et_old = ExperimentTypeFactory(name="舊能力")
        et_new = ExperimentTypeFactory(name="新能力")
        EquipmentCapability.objects.create(equipment=equip, experiment_type=et_old)

        response = client.post(
            f"/api/equipment/{equip.pk}/capabilities",
            data=json.dumps({"experiment_type_ids": [et_new.pk]}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 200
        caps = response.json()["capabilities"]
        assert len(caps) == 1
        assert caps[0]["name"] == "新能力"

    def test_set_capabilities_with_invalid_ids_returns_404(self, client, auth_headers):
        """Setting capabilities with non-existent IDs returns 404."""
        profile = LabStaffFactory()
        equip = EquipmentFactory()

        response = client.post(
            f"/api/equipment/{equip.pk}/capabilities",
            data=json.dumps({"experiment_type_ids": [99999]}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 404

    def test_fab_user_cannot_set_capabilities(self, client, auth_headers):
        """Fab user cannot set capabilities (403)."""
        profile = FabUserFactory()
        equip = EquipmentFactory()

        response = client.post(
            f"/api/equipment/{equip.pk}/capabilities",
            data=json.dumps({"experiment_type_ids": []}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 403

    def test_set_capabilities_nonexistent_equipment_returns_404(
        self, client, auth_headers
    ):
        """Setting capabilities on non-existent equipment returns 404."""
        profile = LabStaffFactory()

        response = client.post(
            "/api/equipment/99999/capabilities",
            data=json.dumps({"experiment_type_ids": []}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Recipe API tests — GET /api/recipes/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestListRecipes:
    """Tests for GET /api/recipes/ endpoint."""

    def test_list_returns_200_for_lab_staff(self, client, auth_headers):
        """Lab staff can list recipes."""
        profile = LabStaffFactory()
        RecipeFactory(name="Recipe A")
        RecipeFactory(name="Recipe B")

        response = client.get("/api/recipes/", **auth_headers(profile.user))

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_list_returns_401_for_unauthenticated(self, client):
        """Unauthenticated request returns 401."""
        response = client.get("/api/recipes/")
        assert response.status_code == 401

    def test_fab_user_cannot_list_recipes(self, client, auth_headers):
        """Fab user cannot access recipe endpoints (403)."""
        profile = FabUserFactory()

        response = client.get("/api/recipes/", **auth_headers(profile.user))

        assert response.status_code == 403

    def test_list_filters_by_experiment_type_id(self, client, auth_headers):
        """Filtering by experiment_type_id returns only matching recipes."""
        profile = LabStaffFactory()
        et1 = ExperimentTypeFactory(name="項目 A")
        et2 = ExperimentTypeFactory(name="項目 B")
        RecipeFactory(name="Recipe for ET1", experiment_type=et1)
        RecipeFactory(name="Recipe for ET2", experiment_type=et2)

        response = client.get(
            f"/api/recipes/?experiment_type_id={et1.pk}",
            **auth_headers(profile.user),
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Recipe for ET1"

    def test_list_only_active_by_default(self, client, auth_headers):
        """Without is_active filter, returns only active recipes."""
        profile = LabStaffFactory()
        RecipeFactory(name="Active Recipe", is_active=True)
        RecipeFactory(name="Inactive Recipe", is_active=False)

        response = client.get("/api/recipes/", **auth_headers(profile.user))

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Active Recipe"

    def test_list_includes_nested_experiment_type(self, client, auth_headers):
        """Recipe list includes the nested experiment_type."""
        profile = LabStaffFactory()
        et = ExperimentTypeFactory(name="高溫測試")
        RecipeFactory(experiment_type=et)

        response = client.get("/api/recipes/", **auth_headers(profile.user))

        assert response.status_code == 200
        data = response.json()
        assert data[0]["experiment_type"]["name"] == "高溫測試"
        assert "equipment" not in data[0]


# ---------------------------------------------------------------------------
# Recipe API tests — POST /api/recipes/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCreateRecipe:
    """Tests for POST /api/recipes/ endpoint."""

    def test_lab_staff_can_create(self, client, auth_headers):
        """Lab staff can create a recipe."""
        profile = LabStaffFactory()
        et = ExperimentTypeFactory()

        response = client.post(
            "/api/recipes/",
            data=json.dumps(
                {
                    "name": "新 Recipe",
                    "description": "描述",
                    "experiment_type_id": et.pk,
                    "parameters": {"temp": 150},
                }
            ),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "新 Recipe"
        assert data["experiment_type"]["id"] == et.pk
        assert data["parameters"] == {"temp": 150}
        assert "equipment" not in data

    def test_fab_user_cannot_create(self, client, auth_headers):
        """Fab user cannot create recipes (403)."""
        profile = FabUserFactory()
        et = ExperimentTypeFactory()

        response = client.post(
            "/api/recipes/",
            data=json.dumps(
                {
                    "name": "禁止",
                    "experiment_type_id": et.pk,
                }
            ),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 403

    def test_create_with_invalid_experiment_type_returns_404(
        self, client, auth_headers
    ):
        """Creating recipe with non-existent experiment_type_id returns 404."""
        profile = LabStaffFactory()

        response = client.post(
            "/api/recipes/",
            data=json.dumps(
                {
                    "name": "Bad Recipe",
                    "experiment_type_id": 99999,
                }
            ),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 404

    def test_unauthenticated_cannot_create(self, client):
        """Unauthenticated request returns 401."""
        response = client.post(
            "/api/recipes/",
            data=json.dumps(
                {
                    "name": "test",
                    "experiment_type_id": 1,
                }
            ),
            content_type="application/json",
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Recipe API tests — GET /api/recipes/{id}
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGetRecipe:
    """Tests for GET /api/recipes/{id} endpoint."""

    def test_get_detail_returns_200(self, client, auth_headers):
        """Lab staff can get recipe detail."""
        profile = LabStaffFactory()
        recipe = RecipeFactory(name="詳情 Recipe")

        response = client.get(f"/api/recipes/{recipe.pk}", **auth_headers(profile.user))

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == recipe.pk
        assert data["name"] == "詳情 Recipe"

    def test_get_nonexistent_returns_404(self, client, auth_headers):
        """Requesting a non-existent ID returns 404."""
        profile = LabStaffFactory()

        response = client.get("/api/recipes/99999", **auth_headers(profile.user))

        assert response.status_code == 404

    def test_fab_user_cannot_get_detail(self, client, auth_headers):
        """Fab user cannot access recipe detail (403)."""
        profile = FabUserFactory()
        recipe = RecipeFactory()

        response = client.get(f"/api/recipes/{recipe.pk}", **auth_headers(profile.user))

        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Recipe API tests — PATCH /api/recipes/{id}
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUpdateRecipe:
    """Tests for PATCH /api/recipes/{id} endpoint."""

    def test_lab_staff_can_update(self, client, auth_headers):
        """Lab staff can update a recipe."""
        profile = LabStaffFactory()
        recipe = RecipeFactory(name="原名稱")

        response = client.patch(
            f"/api/recipes/{recipe.pk}",
            data=json.dumps({"name": "新名稱"}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "新名稱"

    def test_update_parameters_null_is_ignored(self, client, auth_headers):
        """Sending parameters: null does not cause an error; field is left unchanged."""
        profile = LabStaffFactory()
        recipe = RecipeFactory(parameters={"temp": 100})

        response = client.patch(
            f"/api/recipes/{recipe.pk}",
            data=json.dumps({"parameters": None}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 200
        assert response.json()["parameters"] == {"temp": 100}

    def test_update_description_null_is_ignored(self, client, auth_headers):
        """Sending description: null does not cause an error; field is left unchanged."""
        profile = LabStaffFactory()
        recipe = RecipeFactory(description="原描述")

        response = client.patch(
            f"/api/recipes/{recipe.pk}",
            data=json.dumps({"description": None}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 200
        assert response.json()["description"] == "原描述"

    def test_partial_update_only_changes_provided_fields(self, client, auth_headers):
        """PATCH only updates provided fields."""
        profile = LabStaffFactory()
        recipe = RecipeFactory(
            name="不變",
            description="原描述",
            parameters={"temp": 100},
        )

        response = client.patch(
            f"/api/recipes/{recipe.pk}",
            data=json.dumps({"description": "新描述"}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "不變"
        assert data["description"] == "新描述"
        assert data["parameters"] == {"temp": 100}

    def test_fab_user_cannot_update(self, client, auth_headers):
        """Fab user cannot update recipes (403)."""
        profile = FabUserFactory()
        recipe = RecipeFactory()

        response = client.patch(
            f"/api/recipes/{recipe.pk}",
            data=json.dumps({"name": "禁止修改"}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 403

    def test_update_nonexistent_returns_404(self, client, auth_headers):
        """Updating a non-existent ID returns 404."""
        profile = LabStaffFactory()

        response = client.patch(
            "/api/recipes/99999",
            data=json.dumps({"name": "ghost"}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Recipe API tests — DELETE /api/recipes/{id}
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDeleteRecipe:
    """Tests for DELETE /api/recipes/{id} endpoint (soft delete)."""

    def test_lab_staff_can_soft_delete(self, client, auth_headers):
        """Lab staff can soft-delete a recipe."""
        profile = LabStaffFactory()
        recipe = RecipeFactory(name="待停用")

        response = client.delete(
            f"/api/recipes/{recipe.pk}", **auth_headers(profile.user)
        )

        assert response.status_code == 200
        recipe.refresh_from_db()
        assert recipe.is_active is False

    def test_fab_user_cannot_delete(self, client, auth_headers):
        """Fab user cannot delete recipes (403)."""
        profile = FabUserFactory()
        recipe = RecipeFactory()

        response = client.delete(
            f"/api/recipes/{recipe.pk}", **auth_headers(profile.user)
        )

        assert response.status_code == 403

    def test_delete_nonexistent_returns_404(self, client, auth_headers):
        """Deleting a non-existent ID returns 404."""
        profile = LabStaffFactory()

        response = client.delete("/api/recipes/99999", **auth_headers(profile.user))

        assert response.status_code == 404

    def test_soft_deleted_not_in_default_list(self, client, auth_headers):
        """Soft-deleted recipes do not appear in the default list."""
        profile = LabStaffFactory()
        RecipeFactory(name="已停用", is_active=False)
        RecipeFactory(name="仍啟用", is_active=True)

        response = client.get("/api/recipes/", **auth_headers(profile.user))

        assert response.status_code == 200
        names = [item["name"] for item in response.json()]
        assert "已停用" not in names
        assert "仍啟用" in names


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestEquipmentEdgeCases:
    """Edge case tests for equipment endpoints."""

    def test_user_without_profile_gets_403(self, client, auth_headers):
        """A user without a UserProfile gets 403 instead of 500."""
        user = User.objects.create_user(username="noprofile", password="pass")
        user.profile.delete()

        response = client.get("/api/equipment/", **auth_headers(user))

        assert response.status_code == 403
