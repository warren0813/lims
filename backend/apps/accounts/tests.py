import json
from datetime import timedelta

import jwt
import pytest
from django.conf import settings
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.utils import timezone

from apps.accounts.auth import (
    JWTAuth,
    create_access_token,
    create_refresh_token,
    decode_access_token,
)
from apps.accounts.factories import FabUserFactory, LabStaffFactory, UserProfileFactory
from apps.accounts.models import RefreshToken, Role, UserProfile


@pytest.mark.django_db
class TestUserProfile:
    def test_create_user_profile(self):
        """UserProfile is auto-created by signal; fields can be updated."""
        user = User.objects.create_user(username="fab01", password="pass")
        profile, _ = UserProfile.objects.update_or_create(
            user=user,
            defaults={"role": Role.FAB_USER, "department": "廠區 A"},
        )

        assert profile.user == user
        assert profile.role == Role.FAB_USER
        assert profile.department == "廠區 A"
        assert profile.created_at is not None
        assert profile.updated_at is not None

    def test_one_to_one_relationship(self):
        """UserProfile has a OneToOne relation with User; duplicates are rejected."""
        user = User.objects.create_user(username="lab01", password="pass")
        # Signal already creates a profile; a second explicit create must fail.
        with pytest.raises(IntegrityError):
            UserProfile.objects.create(user=user, role=Role.LAB_MANAGER)

    def test_access_profile_from_user(self):
        """UserProfile is accessible via the reverse relation user.profile."""
        user = User.objects.create_user(username="mgr01", password="pass")
        user.profile.role = Role.LAB_MANAGER
        user.profile.save()

        assert user.profile.role == Role.LAB_MANAGER

    def test_department_optional(self):
        """department field defaults to an empty string."""
        user = User.objects.create_user(username="nodev", password="pass")

        assert user.profile.department == ""

    def test_db_table_name(self):
        """Database table name is user_profile."""
        assert UserProfile._meta.db_table == "user_profile"

    def test_role_default_value(self):
        """role field defaults to FAB_USER at the model level."""
        user = User.objects.create_user(username="default_role", password="pass")

        assert user.profile.role == Role.FAB_USER


@pytest.mark.django_db
class TestUserProfileSignal:
    """Tests for the post_save signal that auto-creates UserProfile."""

    def test_profile_auto_created_on_user_creation(self):
        """UserProfile is automatically created when a User is created."""
        user = User.objects.create_user(username="signaluser", password="pass")

        assert hasattr(user, "profile")
        assert user.profile.role == Role.FAB_USER

    def test_signal_does_not_create_duplicate_profile(self):
        """Signal uses get_or_create; no duplicate profile is created."""
        user = User.objects.create_user(username="signaldup", password="pass")

        assert UserProfile.objects.filter(user=user).count() == 1

    def test_signal_not_fired_on_user_update(self):
        """Saving an existing User does not create or overwrite the profile."""
        user = User.objects.create_user(username="signalupdate", password="pass")
        user.profile.role = Role.LAB_MANAGER
        user.profile.save()

        user.first_name = "Updated"
        user.save()

        user.profile.refresh_from_db()
        assert user.profile.role == Role.LAB_MANAGER


@pytest.mark.django_db
class TestRoleChoices:
    def test_role_values(self):
        """Role contains the three expected values."""
        assert Role.FAB_USER == "fab_user"
        assert Role.LAB_STAFF == "lab_staff"
        assert Role.LAB_MANAGER == "lab_manager"

    def test_all_roles_are_valid_choices(self):
        """All Role values are valid choices on the UserProfile model."""
        valid_values = {choice[0] for choice in UserProfile.role.field.choices}
        assert "fab_user" in valid_values
        assert "lab_staff" in valid_values
        assert "lab_manager" in valid_values


# ---------------------------------------------------------------------------
# RefreshToken model tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestRefreshTokenModel:
    def test_create_refresh_token(self):
        """RefreshToken can be created with required fields."""
        user = User.objects.create_user(username="rt_user", password="pass")
        token = RefreshToken.objects.create(
            user=user,
            token="abc123",
            expires_at=timezone.now() + timedelta(days=7),
        )

        assert token.pk is not None
        assert token.user == user
        assert token.token == "abc123"
        assert token.created_at is not None

    def test_token_unique_constraint(self):
        """Duplicate token values are rejected."""
        user = User.objects.create_user(username="rt_uniq", password="pass")
        RefreshToken.objects.create(
            user=user,
            token="duplicate",
            expires_at=timezone.now() + timedelta(days=7),
        )

        with pytest.raises(IntegrityError):
            RefreshToken.objects.create(
                user=user,
                token="duplicate",
                expires_at=timezone.now() + timedelta(days=7),
            )

    def test_cascade_delete_with_user(self):
        """Deleting the user cascades to refresh tokens."""
        user = User.objects.create_user(username="rt_cascade", password="pass")
        RefreshToken.objects.create(
            user=user,
            token="cascade_tok",
            expires_at=timezone.now() + timedelta(days=7),
        )
        user.delete()

        assert not RefreshToken.objects.filter(token="cascade_tok").exists()

    def test_multiple_tokens_per_user(self):
        """A user can have multiple refresh tokens (multiple sessions)."""
        user = User.objects.create_user(username="rt_multi", password="pass")
        RefreshToken.objects.create(
            user=user, token="tok1", expires_at=timezone.now() + timedelta(days=7)
        )
        RefreshToken.objects.create(
            user=user, token="tok2", expires_at=timezone.now() + timedelta(days=7)
        )

        assert RefreshToken.objects.filter(user=user).count() == 2

    def test_is_expired_property(self):
        """is_expired returns True for past expiry, False for future."""
        user = User.objects.create_user(username="rt_exp", password="pass")
        expired = RefreshToken.objects.create(
            user=user,
            token="expired_tok",
            expires_at=timezone.now() - timedelta(hours=1),
        )
        valid = RefreshToken.objects.create(
            user=user,
            token="valid_tok",
            expires_at=timezone.now() + timedelta(days=7),
        )

        assert expired.is_expired is True
        assert valid.is_expired is False

    def test_db_table_name(self):
        """Database table name is refresh_token."""
        assert RefreshToken._meta.db_table == "refresh_token"


# ---------------------------------------------------------------------------
# JWT token utility tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCreateAccessToken:
    def test_returns_valid_jwt_string(self):
        """create_access_token returns a decodable JWT string."""
        user = User.objects.create_user(username="jwt_user", password="pass")
        token = create_access_token(user.pk)

        assert isinstance(token, str)
        payload = jwt.decode(
            token,
            settings.JWT["SIGNING_KEY"],
            algorithms=[settings.JWT["ALGORITHM"]],
        )
        assert payload["sub"] == str(user.pk)

    def test_token_contains_expected_claims(self):
        """Access token contains sub, type, iat, and exp claims."""
        user = User.objects.create_user(username="jwt_claims", password="pass")
        token = create_access_token(user.pk)
        payload = jwt.decode(
            token,
            settings.JWT["SIGNING_KEY"],
            algorithms=[settings.JWT["ALGORITHM"]],
        )

        assert payload["sub"] == str(user.pk)
        assert payload["type"] == "access"
        assert "iat" in payload
        assert "exp" in payload


@pytest.mark.django_db
class TestDecodeAccessToken:
    def test_decode_valid_token(self):
        """Valid token decodes successfully."""
        user = User.objects.create_user(username="dec_ok", password="pass")
        token = create_access_token(user.pk)
        payload = decode_access_token(token)

        assert payload is not None
        assert payload["sub"] == str(user.pk)

    def test_decode_expired_token_returns_none(self):
        """Expired token returns None."""
        now = timezone.now()
        payload = {
            "sub": "999",
            "type": "access",
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
        }
        token = jwt.encode(
            payload, settings.JWT["SIGNING_KEY"], algorithm=settings.JWT["ALGORITHM"]
        )
        assert decode_access_token(token) is None

    def test_decode_invalid_signature_returns_none(self):
        """Token signed with wrong key returns None."""
        now = timezone.now()
        payload = {
            "sub": "999",
            "type": "access",
            "iat": now,
            "exp": now + timedelta(hours=1),
        }
        token = jwt.encode(payload, "wrong-secret", algorithm="HS256")
        assert decode_access_token(token) is None

    def test_decode_malformed_token_returns_none(self):
        """Completely invalid token string returns None."""
        assert decode_access_token("not.a.jwt") is None
        assert decode_access_token("") is None

    def test_decode_non_access_type_returns_none(self):
        """Token with type != 'access' returns None."""
        now = timezone.now()
        payload = {
            "sub": "999",
            "type": "refresh",
            "iat": now,
            "exp": now + timedelta(hours=1),
        }
        token = jwt.encode(
            payload, settings.JWT["SIGNING_KEY"], algorithm=settings.JWT["ALGORITHM"]
        )
        assert decode_access_token(token) is None


@pytest.mark.django_db
class TestCreateRefreshToken:
    def test_creates_db_record(self):
        """create_refresh_token creates a RefreshToken in the database."""
        user = User.objects.create_user(username="crt_db", password="pass")
        token = create_refresh_token(user)

        assert RefreshToken.objects.filter(token=token, user=user).exists()

    def test_returns_string(self):
        """create_refresh_token returns a hex UUID string."""
        user = User.objects.create_user(username="crt_str", password="pass")
        token = create_refresh_token(user)

        assert isinstance(token, str)
        assert len(token) == 32  # uuid4().hex is 32 characters


@pytest.mark.django_db
class TestJWTAuthClass:
    def test_authenticate_valid_token_returns_user(self):
        """JWTAuth.authenticate returns the User for a valid token."""
        user = User.objects.create_user(username="auth_ok", password="pass")
        token = create_access_token(user.pk)

        auth = JWTAuth()
        result = auth.authenticate(request=None, token=token)

        assert result == user

    def test_authenticate_expired_token_returns_none(self):
        """JWTAuth.authenticate returns None for an expired token."""
        now = timezone.now()
        payload = {
            "sub": "1",
            "type": "access",
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
        }
        token = jwt.encode(
            payload, settings.JWT["SIGNING_KEY"], algorithm=settings.JWT["ALGORITHM"]
        )

        auth = JWTAuth()
        assert auth.authenticate(request=None, token=token) is None

    def test_authenticate_nonexistent_user_returns_none(self):
        """JWTAuth.authenticate returns None if user ID doesn't exist."""
        token = create_access_token(user_id=99999)

        auth = JWTAuth()
        assert auth.authenticate(request=None, token=token) is None

    def test_authenticate_inactive_user_returns_none(self):
        """JWTAuth.authenticate returns None for an inactive user."""
        user = User.objects.create_user(username="inactive", password="pass")
        token = create_access_token(user.pk)
        user.is_active = False
        user.save()

        auth = JWTAuth()
        assert auth.authenticate(request=None, token=token) is None


# ---------------------------------------------------------------------------
# Auth API tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAuthLoginAPI:
    """Tests for POST /api/auth/login endpoint."""

    def test_login_success_returns_200_and_tokens(self, client):
        """Login with valid credentials returns 200, tokens, and user info."""
        profile = FabUserFactory(department="廠區 A")

        response = client.post(
            "/api/auth/login",
            data=json.dumps(
                {"username": profile.user.username, "password": "testpass123"}
            ),
            content_type="application/json",
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["username"] == profile.user.username
        assert data["role"] == "fab_user"
        assert data["department"] == "廠區 A"

    def test_login_creates_refresh_token_in_db(self, client):
        """Login creates a RefreshToken record in the database."""
        profile = FabUserFactory()

        response = client.post(
            "/api/auth/login",
            data=json.dumps(
                {"username": profile.user.username, "password": "testpass123"}
            ),
            content_type="application/json",
        )

        data = response.json()
        assert RefreshToken.objects.filter(
            token=data["refresh_token"], user=profile.user
        ).exists()

    def test_login_wrong_password_returns_401(self, client):
        """Login with wrong password returns 401."""
        profile = UserProfileFactory()

        response = client.post(
            "/api/auth/login",
            data=json.dumps({"username": profile.user.username, "password": "wrong"}),
            content_type="application/json",
        )

        assert response.status_code == 401

    def test_login_nonexistent_user_returns_401(self, client):
        """Login with a nonexistent username returns 401."""
        response = client.post(
            "/api/auth/login",
            data=json.dumps({"username": "nobody", "password": "pass123"}),
            content_type="application/json",
        )

        assert response.status_code == 401

    def test_login_no_profile_returns_same_401_as_wrong_password(self, client):
        """Valid credentials but no UserProfile return 401 with identical message."""
        user = User.objects.create_user(username="noprofile", password="pass123")
        user.profile.delete()  # Remove the auto-created profile.

        wrong_pw_response = client.post(
            "/api/auth/login",
            data=json.dumps({"username": user.username, "password": "wrong"}),
            content_type="application/json",
        )
        no_profile_response = client.post(
            "/api/auth/login",
            data=json.dumps({"username": user.username, "password": "pass123"}),
            content_type="application/json",
        )

        assert wrong_pw_response.status_code == 401
        assert no_profile_response.status_code == 401
        assert (
            wrong_pw_response.json()["detail"] == no_profile_response.json()["detail"]
        )


@pytest.mark.django_db
class TestAuthLogoutAPI:
    """Tests for POST /api/auth/logout endpoint."""

    def test_logout_returns_200_and_deletes_refresh_token(self, client, auth_headers):
        """Logout deletes the refresh token from the database."""
        profile = UserProfileFactory()
        refresh_token = create_refresh_token(profile.user)

        response = client.post(
            "/api/auth/logout",
            data=json.dumps({"refresh_token": refresh_token}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 200
        assert not RefreshToken.objects.filter(token=refresh_token).exists()

    def test_logout_returns_401_when_unauthenticated(self, client):
        """Unauthenticated logout attempt returns 401."""
        response = client.post(
            "/api/auth/logout",
            data=json.dumps({"refresh_token": "fake"}),
            content_type="application/json",
        )

        assert response.status_code == 401

    def test_logout_with_invalid_refresh_token_still_succeeds(
        self, client, auth_headers
    ):
        """Logout with a non-existent refresh token still returns 200."""
        profile = UserProfileFactory()

        response = client.post(
            "/api/auth/logout",
            data=json.dumps({"refresh_token": "nonexistent"}),
            content_type="application/json",
            **auth_headers(profile.user),
        )

        assert response.status_code == 200


@pytest.mark.django_db
class TestAuthMeAPI:
    """Tests for GET /api/auth/me endpoint."""

    def test_me_returns_user_info_when_authenticated(self, client, auth_headers):
        """GET /me returns current user info when authenticated."""
        profile = LabStaffFactory(department="Lab A")

        response = client.get("/api/auth/me", **auth_headers(profile.user))

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == profile.user.username
        assert data["role"] == "lab_staff"
        assert data["department"] == "Lab A"

    def test_me_returns_401_when_unauthenticated(self, client):
        """GET /me returns 401 when no user is authenticated."""
        response = client.get("/api/auth/me")

        assert response.status_code == 401

    def test_me_returns_401_with_expired_token(self, client):
        """GET /me returns 401 when the access token is expired."""
        now = timezone.now()
        payload = {
            "sub": "1",
            "type": "access",
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
        }
        expired_token = jwt.encode(
            payload, settings.JWT["SIGNING_KEY"], algorithm=settings.JWT["ALGORITHM"]
        )

        response = client.get(
            "/api/auth/me",
            HTTP_AUTHORIZATION=f"Bearer {expired_token}",
        )

        assert response.status_code == 401


@pytest.mark.django_db
class TestAuthRefreshAPI:
    """Tests for POST /api/auth/refresh endpoint."""

    def test_refresh_returns_new_tokens(self, client):
        """Valid refresh token returns new access + refresh token pair."""
        user = User.objects.create_user(username="ref_user", password="pass")
        old_refresh = create_refresh_token(user)

        response = client.post(
            "/api/auth/refresh",
            data=json.dumps({"refresh_token": old_refresh}),
            content_type="application/json",
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        # Old token should be rotated (deleted)
        assert data["refresh_token"] != old_refresh

    def test_refresh_rotates_token(self, client):
        """After refresh, the old token is deleted and a new one is created."""
        user = User.objects.create_user(username="ref_rotate", password="pass")
        old_refresh = create_refresh_token(user)

        response = client.post(
            "/api/auth/refresh",
            data=json.dumps({"refresh_token": old_refresh}),
            content_type="application/json",
        )

        data = response.json()
        assert not RefreshToken.objects.filter(token=old_refresh).exists()
        assert RefreshToken.objects.filter(token=data["refresh_token"]).exists()

    def test_refresh_expired_token_returns_401(self, client):
        """Expired refresh token returns 401."""
        user = User.objects.create_user(username="ref_expired", password="pass")
        RefreshToken.objects.create(
            user=user,
            token="expired_refresh",
            expires_at=timezone.now() - timedelta(hours=1),
        )

        response = client.post(
            "/api/auth/refresh",
            data=json.dumps({"refresh_token": "expired_refresh"}),
            content_type="application/json",
        )

        assert response.status_code == 401

    def test_refresh_nonexistent_token_returns_401(self, client):
        """Non-existent refresh token returns 401."""
        response = client.post(
            "/api/auth/refresh",
            data=json.dumps({"refresh_token": "doesnotexist"}),
            content_type="application/json",
        )

        assert response.status_code == 401

    def test_refresh_inactive_user_returns_401(self, client):
        """Refresh token for an inactive user returns 401."""
        user = User.objects.create_user(username="ref_inactive", password="pass")
        refresh = create_refresh_token(user)
        user.is_active = False
        user.save()

        response = client.post(
            "/api/auth/refresh",
            data=json.dumps({"refresh_token": refresh}),
            content_type="application/json",
        )

        assert response.status_code == 401
