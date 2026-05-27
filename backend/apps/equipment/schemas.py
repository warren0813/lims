"""Ninja schemas for the equipment app."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Literal

from ninja import Field, Schema

if TYPE_CHECKING:
    from apps.equipment.models import Equipment, Recipe


# ---------------------------------------------------------------------------
# Equipment schemas
# ---------------------------------------------------------------------------


class CapabilityOut(Schema):
    """Nested output for an equipment capability (experiment type summary)."""

    id: int
    name: str


class EquipmentIn(Schema):
    """Input schema for creating equipment."""

    name: str = Field(..., min_length=1, max_length=200)
    model_name: str = Field(..., min_length=1, max_length=200)
    capacity: int = Field(..., gt=0)
    experiment_type_ids: list[int] = []
    parameters: dict[str, Any] = {}


EquipmentStatusLiteral = Literal["available", "maintenance", "disabled"]


class EquipmentUpdate(Schema):
    """Input schema for partially updating equipment."""

    name: str | None = Field(None, min_length=1, max_length=200)
    model_name: str | None = Field(None, min_length=1, max_length=200)
    capacity: int | None = Field(None, gt=0)
    status: EquipmentStatusLiteral | None = None
    parameters: dict[str, Any] | None = None


class EquipmentOut(Schema):
    """Output schema for equipment responses."""

    id: int
    name: str
    model_name: str
    capacity: int
    status: EquipmentStatusLiteral
    capabilities: list[CapabilityOut] = []
    parameters: dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def from_equipment(equipment: Equipment) -> dict:
        """Build a dict from an Equipment instance with nested capabilities."""
        caps = [{"id": et.pk, "name": et.name} for et in equipment.capabilities.all()]
        return {
            "id": equipment.pk,
            "name": equipment.name,
            "model_name": equipment.model_name,
            "capacity": equipment.capacity,
            "status": equipment.status,
            "capabilities": caps,
            "parameters": equipment.parameters,
            "created_at": equipment.created_at,
            "updated_at": equipment.updated_at,
        }


class CapabilitySetIn(Schema):
    """Input schema for setting equipment capabilities."""

    experiment_type_ids: list[int]


# ---------------------------------------------------------------------------
# Recipe schemas
# ---------------------------------------------------------------------------


class RecipeExperimentTypeOut(Schema):
    """Nested experiment type summary for recipe responses."""

    id: int
    name: str


class RecipeIn(Schema):
    """Input schema for creating a recipe.

    Chat-design: no equipment_id — recipes are equipment-agnostic.
    """

    name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    experiment_type_id: int
    parameters: dict[str, Any] = {}


class RecipeUpdate(Schema):
    """Input schema for partially updating a recipe.

    All fields are optional. Omit a field to leave it unchanged.
    """

    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    parameters: dict[str, Any] | None = None


class RecipeOut(Schema):
    """Output schema for recipe responses."""

    id: int
    name: str
    description: str
    experiment_type: RecipeExperimentTypeOut
    parameters: dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def from_recipe(recipe: Recipe) -> dict:
        """Build a dict from a Recipe instance with nested relations."""
        return {
            "id": recipe.pk,
            "name": recipe.name,
            "description": recipe.description,
            "experiment_type": {
                "id": recipe.experiment_type_id,
                "name": recipe.experiment_type.name,
            },
            "parameters": recipe.parameters,
            "is_active": recipe.is_active,
            "created_at": recipe.created_at,
            "updated_at": recipe.updated_at,
        }
