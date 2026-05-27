"""Tests for the seed_admin management command."""

from io import StringIO

import pytest
from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.accounts.models import Role


def _set_env(
    monkeypatch,
    username: str = "admin",
    email: str = "admin@example.com",
    password: str = "strong-pw",
) -> None:
    monkeypatch.setenv("DJANGO_SUPERUSER_USERNAME", username)
    monkeypatch.setenv("DJANGO_SUPERUSER_EMAIL", email)
    monkeypatch.setenv("DJANGO_SUPERUSER_PASSWORD", password)


@pytest.mark.django_db
class TestSeedAdminCommand:
    def test_creates_superuser_when_none_exists(self, monkeypatch):
        _set_env(monkeypatch)
        out = StringIO()

        call_command("seed_admin", stdout=out)

        user = User.objects.get(username="admin")
        assert user.is_superuser is True
        assert user.is_staff is True
        assert user.email == "admin@example.com"
        assert user.check_password("strong-pw")
        assert user.profile.role == Role.LAB_MANAGER
        assert "Created superuser" in out.getvalue()

    def test_skips_when_user_already_exists(self, monkeypatch):
        User.objects.create_user(username="admin", password="old-pw")
        _set_env(monkeypatch, password="new-pw")
        out = StringIO()

        call_command("seed_admin", stdout=out)

        user = User.objects.get(username="admin")
        # Existing password must NOT be overwritten on subsequent runs.
        assert user.check_password("old-pw")
        assert "already exists" in out.getvalue()

    def test_idempotent_on_repeated_runs(self, monkeypatch):
        _set_env(monkeypatch)

        call_command("seed_admin", stdout=StringIO())
        call_command("seed_admin", stdout=StringIO())

        assert User.objects.filter(username="admin").count() == 1

    def test_raises_when_username_missing(self, monkeypatch):
        monkeypatch.delenv("DJANGO_SUPERUSER_USERNAME", raising=False)
        monkeypatch.setenv("DJANGO_SUPERUSER_PASSWORD", "pw")

        with pytest.raises(CommandError, match="Missing required env vars"):
            call_command("seed_admin")

    def test_raises_when_password_missing(self, monkeypatch):
        monkeypatch.setenv("DJANGO_SUPERUSER_USERNAME", "admin")
        monkeypatch.delenv("DJANGO_SUPERUSER_PASSWORD", raising=False)

        with pytest.raises(CommandError, match="Missing required env vars"):
            call_command("seed_admin")

    def test_email_is_optional(self, monkeypatch):
        monkeypatch.setenv("DJANGO_SUPERUSER_USERNAME", "admin")
        monkeypatch.setenv("DJANGO_SUPERUSER_PASSWORD", "pw")
        monkeypatch.delenv("DJANGO_SUPERUSER_EMAIL", raising=False)

        call_command("seed_admin", stdout=StringIO())

        user = User.objects.get(username="admin")
        assert user.email == ""
