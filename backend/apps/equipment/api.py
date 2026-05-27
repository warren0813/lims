"""Django Ninja routers for equipment and recipe endpoints."""

from django.db import transaction
from django.http import HttpRequest
from ninja import Query, Router

from api.schemas import ErrorOut
from apps.accounts.auth import JWTAuth
from apps.accounts.permissions import has_lab_role
from apps.equipment.models import Equipment, EquipmentCapability, Recipe
from apps.equipment.schemas import (
    CapabilitySetIn,
    EquipmentIn,
    EquipmentOut,
    EquipmentStatusLiteral,
    EquipmentUpdate,
    RecipeIn,
    RecipeOut,
    RecipeUpdate,
)
from apps.experiments.models import ExperimentType

router = Router(tags=["Equipment"], auth=JWTAuth())
recipe_router = Router(tags=["Recipes"], auth=JWTAuth())


def _validate_experiment_type_ids(
    experiment_type_ids: list[int],
) -> list[int] | None:
    """Validate and deduplicate experiment type IDs.

    Returns deduplicated list if all IDs exist, or None if any are invalid.
    """
    unique_ids = list(set(experiment_type_ids))
    if not unique_ids:
        return unique_ids
    valid_count = ExperimentType.objects.filter(pk__in=unique_ids).count()
    if valid_count != len(unique_ids):
        return None
    return unique_ids


# ---------------------------------------------------------------------------
# Equipment endpoints
# ---------------------------------------------------------------------------


@router.get("/", response={200: list[EquipmentOut], 403: ErrorOut})
def list_equipment(
    request: HttpRequest,
    search: str | None = Query(None),
    status: EquipmentStatusLiteral | None = Query(None),  # noqa: B008
):
    """List equipment with optional search and filters."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    qs = Equipment.objects.prefetch_related("capabilities").order_by("name")

    if search:
        qs = qs.filter(name__icontains=search)

    if status:
        qs = qs.filter(status=status)

    return 200, [EquipmentOut.from_equipment(e) for e in qs]


@router.post("/", response={201: EquipmentOut, 403: ErrorOut, 404: ErrorOut})
def create_equipment(request: HttpRequest, payload: EquipmentIn):
    """Create a new equipment. Only lab staff and managers allowed."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    if payload.experiment_type_ids:
        valid_ids = _validate_experiment_type_ids(payload.experiment_type_ids)
        if valid_ids is None:
            return 404, {"detail": "One or more experiment type IDs not found"}
    else:
        valid_ids = []

    with transaction.atomic():
        equip = Equipment.objects.create(
            name=payload.name,
            model_name=payload.model_name,
            capacity=payload.capacity,
            parameters=payload.parameters,
        )

        if valid_ids:
            EquipmentCapability.objects.bulk_create(
                [
                    EquipmentCapability(equipment=equip, experiment_type_id=et_id)
                    for et_id in valid_ids
                ]
            )

    return 201, EquipmentOut.from_equipment(equip)


@router.get(
    "/{equipment_id}", response={200: EquipmentOut, 403: ErrorOut, 404: ErrorOut}
)
def get_equipment(request: HttpRequest, equipment_id: int):
    """Get a single equipment by ID."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    try:
        equip = Equipment.objects.prefetch_related("capabilities").get(pk=equipment_id)
    except Equipment.DoesNotExist:
        return 404, {"detail": "Not found"}

    return 200, EquipmentOut.from_equipment(equip)


@router.patch(
    "/{equipment_id}",
    response={200: EquipmentOut, 403: ErrorOut, 404: ErrorOut},
)
def update_equipment(
    request: HttpRequest,
    equipment_id: int,
    payload: EquipmentUpdate,
):
    """Partially update equipment. Only lab staff and managers allowed."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    try:
        equip = Equipment.objects.prefetch_related("capabilities").get(pk=equipment_id)
    except Equipment.DoesNotExist:
        return 404, {"detail": "Not found"}

    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in updates.items():
        setattr(equip, field, value)

    if updates:
        equip.save(update_fields=list(updates.keys()))

    return 200, EquipmentOut.from_equipment(equip)


@router.post(
    "/{equipment_id}/capabilities",
    response={200: EquipmentOut, 403: ErrorOut, 404: ErrorOut},
)
def set_equipment_capabilities(
    request: HttpRequest,
    equipment_id: int,
    payload: CapabilitySetIn,
):
    """Replace all capabilities for an equipment."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    try:
        equip = Equipment.objects.get(pk=equipment_id)
    except Equipment.DoesNotExist:
        return 404, {"detail": "Not found"}

    valid_ids = _validate_experiment_type_ids(payload.experiment_type_ids)
    if valid_ids is None:
        return 404, {"detail": "One or more experiment type IDs not found"}

    with transaction.atomic():
        EquipmentCapability.objects.filter(equipment=equip).delete()
        if valid_ids:
            EquipmentCapability.objects.bulk_create(
                [
                    EquipmentCapability(equipment=equip, experiment_type_id=et_id)
                    for et_id in valid_ids
                ]
            )

    # Re-fetch with fresh prefetch cache
    equip = Equipment.objects.prefetch_related("capabilities").get(pk=equip.pk)

    return 200, EquipmentOut.from_equipment(equip)


# ---------------------------------------------------------------------------
# Recipe endpoints
# ---------------------------------------------------------------------------


@recipe_router.get("/", response={200: list[RecipeOut], 403: ErrorOut})
def list_recipes(
    request: HttpRequest,
    experiment_type_id: int | None = Query(None),
    is_active: bool | None = Query(None),
):
    """List recipes with optional filters."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    qs = Recipe.objects.select_related("experiment_type").order_by("name")

    # Default to active-only unless explicitly specified
    if is_active is None:
        qs = qs.filter(is_active=True)
    else:
        qs = qs.filter(is_active=is_active)

    if experiment_type_id is not None:
        qs = qs.filter(experiment_type_id=experiment_type_id)

    return 200, [RecipeOut.from_recipe(r) for r in qs]


@recipe_router.post("/", response={201: RecipeOut, 403: ErrorOut, 404: ErrorOut})
def create_recipe(request: HttpRequest, payload: RecipeIn):
    """Create a new recipe. Only lab staff and managers allowed."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    try:
        experiment_type = ExperimentType.objects.get(pk=payload.experiment_type_id)
    except ExperimentType.DoesNotExist:
        return 404, {"detail": "Experiment type not found"}

    recipe = Recipe.objects.create(
        name=payload.name,
        description=payload.description,
        experiment_type=experiment_type,
        parameters=payload.parameters,
    )

    return 201, RecipeOut.from_recipe(recipe)


@recipe_router.get(
    "/{recipe_id}", response={200: RecipeOut, 403: ErrorOut, 404: ErrorOut}
)
def get_recipe(request: HttpRequest, recipe_id: int):
    """Get a single recipe by ID."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    try:
        recipe = Recipe.objects.select_related("experiment_type").get(
            pk=recipe_id, is_active=True
        )
    except Recipe.DoesNotExist:
        return 404, {"detail": "Not found"}

    return 200, RecipeOut.from_recipe(recipe)


@recipe_router.patch(
    "/{recipe_id}",
    response={200: RecipeOut, 403: ErrorOut, 404: ErrorOut},
)
def update_recipe(
    request: HttpRequest,
    recipe_id: int,
    payload: RecipeUpdate,
):
    """Partially update a recipe. Only lab staff and managers allowed."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    try:
        recipe = Recipe.objects.select_related("experiment_type").get(
            pk=recipe_id, is_active=True
        )
    except Recipe.DoesNotExist:
        return 404, {"detail": "Not found"}

    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in updates.items():
        setattr(recipe, field, value)

    if updates:
        recipe.save(update_fields=list(updates.keys()))

    return 200, RecipeOut.from_recipe(recipe)


@recipe_router.delete(
    "/{recipe_id}",
    response={200: RecipeOut, 403: ErrorOut, 404: ErrorOut},
)
def delete_recipe(request: HttpRequest, recipe_id: int):
    """Soft-delete a recipe. Only lab staff and managers allowed."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    try:
        recipe = Recipe.objects.select_related("experiment_type").get(
            pk=recipe_id, is_active=True
        )
    except Recipe.DoesNotExist:
        return 404, {"detail": "Not found"}

    recipe.is_active = False
    recipe.save(update_fields=["is_active"])

    return 200, RecipeOut.from_recipe(recipe)
