"""Idempotent superuser seeding for cloud deployments (Railway, etc.).

Reads credentials from environment variables and creates a superuser if a user
with that username does not already exist. Safe to run on every deploy.
"""

from __future__ import annotations

import os
from typing import Any

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import Role, UserProfile

ENV_USERNAME = "DJANGO_SUPERUSER_USERNAME"
ENV_EMAIL = "DJANGO_SUPERUSER_EMAIL"
ENV_PASSWORD = "DJANGO_SUPERUSER_PASSWORD"


class Command(BaseCommand):
    help = (
        "Create a superuser from environment variables if it does not already exist. "
        "Required env vars: "
        f"{ENV_USERNAME}, {ENV_PASSWORD}. Optional: {ENV_EMAIL}."
    )

    def handle(self, *args: Any, **options: Any) -> None:
        username = os.environ.get(ENV_USERNAME)
        password = os.environ.get(ENV_PASSWORD)
        email = os.environ.get(ENV_EMAIL, "")

        if not username or not password:
            raise CommandError(
                f"Missing required env vars: {ENV_USERNAME} and {ENV_PASSWORD} "
                f"must both be set."
            )

        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING(
                    f"Superuser '{username}' already exists, skipping creation."
                )
            )
            return

        with transaction.atomic():
            user = User.objects.create_superuser(
                username=username, email=email, password=password
            )
            # The post_save signal creates a UserProfile with default FAB_USER role;
            # the seeded admin should be LAB_MANAGER.
            UserProfile.objects.update_or_create(
                user=user,
                defaults={"role": Role.LAB_MANAGER},
            )

        self.stdout.write(
            self.style.SUCCESS(f"Created superuser '{username}' with LAB_MANAGER role.")
        )
