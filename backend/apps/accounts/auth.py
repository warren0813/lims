"""JWT authentication utilities for Django Ninja."""

import uuid
from datetime import timedelta

import jwt
from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.http import HttpRequest
from django.utils import timezone
from ninja.security import HttpBearer

from apps.accounts.models import RefreshToken


def create_access_token(user_id: int) -> str:
    """Create a short-lived JWT access token for the given user ID."""
    now = timezone.now()
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT["ACCESS_TOKEN_LIFETIME_MINUTES"]),
    }
    return jwt.encode(
        payload, settings.JWT["SIGNING_KEY"], algorithm=settings.JWT["ALGORITHM"]
    )


def decode_access_token(token: str) -> dict | None:
    """Decode and validate a JWT access token.

    Returns the payload dict on success, or None if the token is invalid,
    expired, or not an access token.
    """
    try:
        payload = jwt.decode(
            token, settings.JWT["SIGNING_KEY"], algorithms=[settings.JWT["ALGORITHM"]]
        )
    except jwt.PyJWTError:
        return None

    if payload.get("type") != "access":
        return None

    return payload


def create_refresh_token(user: User) -> str:
    """Create a long-lived refresh token stored in the database.

    Returns the raw token string (UUID hex).
    """
    token = uuid.uuid4().hex
    now = timezone.now()
    expires_at = now + timedelta(days=settings.JWT["REFRESH_TOKEN_LIFETIME_DAYS"])
    with transaction.atomic():
        # Prune expired tokens for this user to prevent unbounded table growth.
        RefreshToken.objects.filter(user=user, expires_at__lt=now).delete()
        RefreshToken.objects.create(user=user, token=token, expires_at=expires_at)
    return token


class JWTAuth(HttpBearer):
    """Django Ninja authentication class using JWT Bearer tokens."""

    def authenticate(self, request: HttpRequest, token: str) -> User | None:
        """Validate the Bearer token and return the associated User.

        Returns None (triggers 401) if the token is invalid, expired,
        or references a non-existent / inactive user.
        """
        payload = decode_access_token(token)
        if payload is None:
            return None

        try:
            user = User.objects.get(pk=int(payload["sub"]), is_active=True)
        except (User.DoesNotExist, ValueError, TypeError):
            return None

        return user
