"""Django Ninja router for authentication endpoints."""

from django.contrib.auth import authenticate
from django.db import transaction
from django.http import HttpRequest
from ninja import Router

from apps.accounts.auth import JWTAuth, create_access_token, create_refresh_token
from apps.accounts.models import RefreshToken, UserProfile
from apps.accounts.schemas import (
    ErrorOut,
    LoginIn,
    RefreshIn,
    RefreshOut,
    TokenOut,
    UserOut,
)

router = Router(tags=["Auth"])

# Single constant prevents info leakage by returning the same message
# for both wrong credentials and valid credentials without a profile.
_INVALID_CREDENTIALS = "Invalid credentials"


@router.post("/login", response={200: TokenOut, 401: ErrorOut}, auth=None)
def login_view(request: HttpRequest, payload: LoginIn):
    """Authenticate a user and return JWT tokens.

    Returns access token, refresh token, and user information on success,
    or 401 on invalid credentials.
    """
    user = authenticate(request, username=payload.username, password=payload.password)
    if user is None:
        return 401, {"detail": _INVALID_CREDENTIALS}
    try:
        profile = user.profile
    except UserProfile.DoesNotExist:
        return 401, {"detail": _INVALID_CREDENTIALS}

    access_token = create_access_token(user.pk)
    refresh_token = create_refresh_token(user)
    return 200, TokenOut.to_dict(user, profile, access_token, refresh_token)


@router.post("/logout", response={200: ErrorOut, 401: ErrorOut}, auth=JWTAuth())
def logout_view(request: HttpRequest, payload: RefreshIn):
    """Revoke a refresh token. Requires authentication."""
    RefreshToken.objects.filter(user=request.auth, token=payload.refresh_token).delete()
    return 200, {"detail": "Logged out"}


@router.get("/me", response={200: UserOut, 401: ErrorOut}, auth=JWTAuth())
def me_view(request: HttpRequest):
    """Return the currently authenticated user's information."""
    user = request.auth
    try:
        profile = user.profile
    except UserProfile.DoesNotExist:
        return 401, {"detail": _INVALID_CREDENTIALS}
    return 200, UserOut.to_dict(user, profile)


@router.post(
    "/refresh",
    response={200: RefreshOut, 401: ErrorOut},
    auth=None,
)
def refresh_view(request: HttpRequest, payload: RefreshIn):
    """Exchange a valid refresh token for a new access + refresh token pair.

    Implements refresh token rotation: the old token is deleted and a new
    one is created. This limits the window of abuse if a token is leaked.
    """
    try:
        token_obj = RefreshToken.objects.select_related("user").get(
            token=payload.refresh_token
        )
    except RefreshToken.DoesNotExist:
        return 401, {"detail": "Invalid refresh token"}

    if token_obj.is_expired:
        token_obj.delete()
        return 401, {"detail": "Refresh token expired"}

    if not token_obj.user.is_active:
        token_obj.delete()
        return 401, {"detail": "Invalid refresh token"}

    user = token_obj.user

    # Rotate atomically: if create fails, the old token is preserved.
    with transaction.atomic():
        token_obj.delete()
        new_access = create_access_token(user.pk)
        new_refresh = create_refresh_token(user)

    return 200, {"access_token": new_access, "refresh_token": new_refresh}
