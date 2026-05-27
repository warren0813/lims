"""Django Ninja router for experiment type endpoints."""

from django.db import IntegrityError
from django.http import HttpRequest
from ninja import Query, Router

from api.schemas import ErrorOut
from apps.accounts.auth import JWTAuth
from apps.accounts.permissions import has_lab_role
from apps.experiments.models import ExperimentType
from apps.experiments.schemas import (
    ExperimentTypeIn,
    ExperimentTypeOut,
    ExperimentTypeUpdate,
)

router = Router(tags=["Experiment Types"], auth=JWTAuth())


@router.get("/", response=list[ExperimentTypeOut])
def list_experiment_types(
    request: HttpRequest,
    search: str | None = Query(None),
    lab_category: str | None = Query(None),
    is_active: bool | None = Query(None),
):
    """List experiment types with optional search and filters.

    By default only active items are returned.
    """
    qs = ExperimentType.objects.all().order_by("name")

    # Default to active-only unless explicitly specified
    if is_active is None:
        qs = qs.filter(is_active=True)
    else:
        qs = qs.filter(is_active=is_active)

    if search:
        qs = qs.filter(name__icontains=search)

    if lab_category:
        qs = qs.filter(lab_category=lab_category)

    return qs


@router.post("/", response={201: ExperimentTypeOut, 403: ErrorOut, 409: ErrorOut})
def create_experiment_type(request: HttpRequest, payload: ExperimentTypeIn):
    """Create a new experiment type. Only lab staff and managers allowed."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    try:
        exp = ExperimentType.objects.create(
            name=payload.name,
            description=payload.description,
            lab_category=payload.lab_category,
        )
    except IntegrityError:
        return 409, {"detail": "Experiment type with this name already exists"}

    return 201, exp


@router.get("/{experiment_type_id}", response={200: ExperimentTypeOut, 404: ErrorOut})
def get_experiment_type(request: HttpRequest, experiment_type_id: int):
    """Get a single experiment type by ID."""
    try:
        exp = ExperimentType.objects.get(pk=experiment_type_id, is_active=True)
    except ExperimentType.DoesNotExist:
        return 404, {"detail": "Not found"}

    return 200, exp


@router.patch(
    "/{experiment_type_id}",
    response={200: ExperimentTypeOut, 403: ErrorOut, 404: ErrorOut, 409: ErrorOut},
)
def update_experiment_type(
    request: HttpRequest,
    experiment_type_id: int,
    payload: ExperimentTypeUpdate,
):
    """Partially update an experiment type. Only lab staff and managers allowed."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    try:
        exp = ExperimentType.objects.get(pk=experiment_type_id, is_active=True)
    except ExperimentType.DoesNotExist:
        return 404, {"detail": "Not found"}

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(exp, field, value)

    try:
        exp.save()
    except IntegrityError:
        return 409, {"detail": "Experiment type with this name already exists"}

    return 200, exp


@router.delete(
    "/{experiment_type_id}",
    response={200: ExperimentTypeOut, 403: ErrorOut, 404: ErrorOut},
)
def delete_experiment_type(request: HttpRequest, experiment_type_id: int):
    """Soft-delete an experiment type. Only lab staff and managers allowed."""
    if not has_lab_role(request):
        return 403, {"detail": "Permission denied"}

    try:
        exp = ExperimentType.objects.get(pk=experiment_type_id, is_active=True)
    except ExperimentType.DoesNotExist:
        return 404, {"detail": "Not found"}

    exp.is_active = False
    exp.save()

    return 200, exp
