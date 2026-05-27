from collections.abc import Callable
from functools import wraps
from typing import Any

from django.http import HttpRequest, HttpResponse, HttpResponseForbidden
from django.shortcuts import redirect
from django.template.loader import render_to_string


def login_required_web(view_func: Callable) -> Callable:
    @wraps(view_func)
    def wrapper(request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        if not request.user.is_authenticated:
            return redirect("web:login")
        return view_func(request, *args, **kwargs)

    return wrapper


def role_required(*roles: str) -> Callable:
    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapper(request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
            if not request.user.is_authenticated:
                return redirect("web:login")
            profile = getattr(request.user, "profile", None)
            if not profile or profile.role not in roles:
                html = render_to_string("web/403.html", request=request)
                return HttpResponseForbidden(html)
            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator
