"""Custom middleware for the LIMS backend."""

from collections.abc import Callable

from django.http import HttpRequest, HttpResponse
from django.middleware.csrf import CsrfViewMiddleware


class CsrfExemptApiMiddleware:
    """Skip CSRF checks for API endpoints using JWT Bearer authentication.

    The Django admin and other non-API paths still receive full CSRF protection.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response
        self.csrf_middleware = CsrfViewMiddleware(get_response)

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if request.path.startswith("/api/"):
            return self.get_response(request)
        return self.csrf_middleware(request)
