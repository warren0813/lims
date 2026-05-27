"""Factory classes for the accounts app, used in tests."""

import factory
from django.contrib.auth.models import User
from factory.django import DjangoModelFactory

from apps.accounts.models import Role, UserProfile


class UserFactory(DjangoModelFactory):
    """Factory for Django User instances with a sequenced username."""

    class Meta:
        model = User
        skip_postgeneration_save = True

    username = factory.Sequence(lambda n: f"user{n}")

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        """Set the user password after creation; defaults to 'testpass123'."""
        pwd = extracted if extracted is not None else "testpass123"
        self.set_password(pwd)
        if create:
            self.save()


class UserProfileFactory(DjangoModelFactory):
    """Factory for UserProfile instances, default role is FAB_USER.

    Uses update_or_create so the profile auto-created by the post_save signal
    is updated in-place rather than triggering an IntegrityError.
    """

    class Meta:
        model = UserProfile

    user = factory.SubFactory(UserFactory)
    role = Role.FAB_USER
    department = ""

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        user = kwargs.pop("user")
        profile, _ = model_class.objects.update_or_create(
            user=user,
            defaults=kwargs,
        )
        return profile


class FabUserFactory(UserProfileFactory):
    """UserProfile factory with the FAB_USER role (explicit alias)."""

    role = Role.FAB_USER


class LabStaffFactory(UserProfileFactory):
    """UserProfile factory with the LAB_STAFF role."""

    role = Role.LAB_STAFF


class LabManagerFactory(UserProfileFactory):
    """UserProfile factory with the LAB_MANAGER role."""

    role = Role.LAB_MANAGER
