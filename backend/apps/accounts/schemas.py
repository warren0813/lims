"""Ninja schemas for the accounts app."""

from typing import Any

from django.contrib.auth.models import User
from ninja import Schema

from apps.accounts.models import UserProfile


class LoginIn(Schema):
    """Input schema for the login endpoint."""

    username: str
    password: str


class UserOut(Schema):
    """Output schema representing an authenticated user with role information."""

    id: int
    username: str
    role: str
    department: str

    @staticmethod
    def to_dict(user: User, profile: UserProfile) -> dict[str, Any]:
        """Build a dict matching UserOut fields from a User and its UserProfile.

        Returning a plain dict keeps the response on Ninja's normal
        schema-validation path (Pydantic). Validation is bypassed when
        returning `ninja.responses.Status`, so avoid that pattern here.
        """
        return {
            "id": user.pk,
            "username": user.username,
            "role": profile.role,
            "department": profile.department,
        }


class TokenOut(Schema):
    """Output schema for login response with JWT tokens and user data."""

    access_token: str
    refresh_token: str
    id: int
    username: str
    role: str
    department: str

    @staticmethod
    def to_dict(
        user: User,
        profile: UserProfile,
        access_token: str,
        refresh_token: str,
    ) -> dict[str, Any]:
        """Build a dict matching TokenOut fields."""
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "id": user.pk,
            "username": user.username,
            "role": profile.role,
            "department": profile.department,
        }


class RefreshIn(Schema):
    """Input schema for the token refresh endpoint."""

    refresh_token: str


class RefreshOut(Schema):
    """Output schema for the token refresh response."""

    access_token: str
    refresh_token: str


class ErrorOut(Schema):
    """Output schema for generic detail messages (errors and confirmations)."""

    detail: str
