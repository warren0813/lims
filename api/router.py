from ninja import NinjaAPI

api = NinjaAPI(
    title="LIMS API",
    version="1.0.0",
    description="Laboratory Information Management System API",
)


@api.get("/health", tags=["System"])
def health_check(request):
    return {"status": "ok"}
