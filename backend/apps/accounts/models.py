from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    FAB_USER = "fab_user", "廠區使用者"
    LAB_STAFF = "lab_staff", "實驗室人員"
    LAB_MANAGER = "lab_manager", "實驗室主管"


class UserProfile(models.Model):
    """Extends Django User with role and department fields."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.FAB_USER)
    department = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_profile"

    def __str__(self) -> str:
        return f"{self.user.username} ({self.role})"


class RefreshToken(models.Model):
    """Stores refresh tokens for JWT authentication.

    Each row represents one active session. Deleting a row revokes that session.
    """

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="refresh_tokens"
    )
    token = models.CharField(max_length=255, unique=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "refresh_token"
        indexes = [
            models.Index(
                fields=["user", "expires_at"], name="idx_refresh_user_expires"
            ),
        ]

    def __str__(self) -> str:
        return f"RefreshToken(user={self.user.username}, expires={self.expires_at})"

    @property
    def is_expired(self) -> bool:
        """Return True if this token has passed its expiry time."""
        return timezone.now() >= self.expires_at
