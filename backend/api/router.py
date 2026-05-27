"""Main NinjaAPI router for the LIMS backend."""

from ninja import NinjaAPI

from apps.accounts.api import router as auth_router
from apps.commissions.api import router as requests_router
from apps.commissions.api import sample_router
from apps.equipment.api import recipe_router
from apps.equipment.api import router as equipment_router
from apps.experiments.api import router as experiment_types_router
from apps.reports.api import router as reports_router
from apps.wip.api import automation_router, dispatch_router
from apps.wip.api import router as wip_router

api = NinjaAPI(
    title="LIMS API",
    version="1.0.0",
    description="Laboratory Information Management System API",
)

api.add_router("/auth/", auth_router)
api.add_router("/experiment-types/", experiment_types_router)
api.add_router("/equipment/", equipment_router)
api.add_router("/recipes/", recipe_router)
api.add_router("/requests/", requests_router)
api.add_router("/samples/", sample_router)
api.add_router("/wips/", wip_router)
api.add_router("/dispatches/", dispatch_router)
api.add_router("/automation/", automation_router)
api.add_router("/reports/", reports_router)


@api.get("/health", tags=["System"])
def health_check(request):
    """Return the health status of the API."""
    return {"status": "ok"}
