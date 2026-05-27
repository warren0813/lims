from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.models import Role, UserProfile


@receiver(post_save, sender=User)
def create_user_profile(
    sender: type[User], instance: User, created: bool, **kwargs: object
) -> None:
    """Auto-create a UserProfile with default role when a new User is created."""
    if created:
        UserProfile.objects.get_or_create(
            user=instance,
            defaults={"role": Role.FAB_USER},
        )
