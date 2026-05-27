import django
import pytest
from django.conf import settings
from django.contrib.auth.models import User

from apps.accounts.auth import create_access_token


def pytest_configure():
    if not settings.configured:
        django.setup()


@pytest.fixture
def auth_headers():
    """Return a factory function that creates JWT Bearer auth headers.

    Usage in tests:
        response = client.get("/api/...", **auth_headers(user))
    """

    def _make_headers(user: User) -> dict[str, str]:
        token = create_access_token(user.pk)
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    return _make_headers
