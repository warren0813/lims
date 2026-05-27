"""Shared permission helpers for Django Ninja endpoints."""

from django.http import HttpRequest

from apps.accounts.models import Role, UserProfile


def has_lab_role(request: HttpRequest) -> bool:
    """Return True if the user is lab_staff or lab_manager."""
    try:
        role = request.auth.profile.role
    except (UserProfile.DoesNotExist, AttributeError):
        return False
    return role in (Role.LAB_STAFF, Role.LAB_MANAGER)
