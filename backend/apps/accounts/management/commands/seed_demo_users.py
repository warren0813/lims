"""Idempotent demo user seeding for local development + demos.

Creates three pre-set accounts (fab_user, lab_member, lab_manager) with
fixed passwords so the frontend's "demo accounts" chips work out of the
box. Safe to run repeatedly — existing users have their password + role
refreshed without changing PKs.
"""

from __future__ import annotations

from typing import Any

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Role, UserProfile

DEMO_USERS = [
    {
        "username": "fab_user",
        "password": "mcv8uPKSvqz8Yru",
        "role": Role.FAB_USER,
        "department": "Fab QA",
    },
    {
        "username": "lab_member",
        "password": "t26fnPyedon6aFz",
        "role": Role.LAB_STAFF,
        "department": "Lab Operations",
    },
    {
        "username": "lab_manager",
        "password": "eWoN48kU0QrEV8B",
        "role": Role.LAB_MANAGER,
        "department": "Lab Operations",
    },
]


class Command(BaseCommand):
    help = (
        "Seed three demo accounts (fab_user / lab_member / lab_manager) with "
        "fixed passwords for local dev and demos. Idempotent — re-runs refresh "
        "password + role without changing PKs."
    )

    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        updated = 0

        with transaction.atomic():
            for spec in DEMO_USERS:
                user, was_created = User.objects.get_or_create(
                    username=spec["username"]
                )
                user.set_password(spec["password"])
                user.save()

                UserProfile.objects.update_or_create(
                    user=user,
                    defaults={
                        "role": spec["role"],
                        "department": spec["department"],
                    },
                )

                if was_created:
                    created += 1
                else:
                    updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo users seeded: {created} created, {updated} updated, "
                f"{len(DEMO_USERS)} total."
            )
        )
