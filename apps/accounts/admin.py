from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from unfold.admin import ModelAdmin, StackedInline

from apps.accounts.models import UserProfile


class UserProfileInline(StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name = "使用者資料"
    verbose_name_plural = "使用者資料"
    fields = ("role", "department")


class UserAdmin(BaseUserAdmin, ModelAdmin):
    inlines = (UserProfileInline,)
    list_display = ("username", "email", "get_role", "get_department", "is_staff")
    list_select_related = ("profile",)

    @admin.display(description="角色")
    def get_role(self, obj):
        try:
            return obj.profile.get_role_display()
        except UserProfile.DoesNotExist:
            return "-"

    @admin.display(description="部門")
    def get_department(self, obj):
        try:
            return obj.profile.department or "-"
        except UserProfile.DoesNotExist:
            return "-"


admin.site.unregister(User)
admin.site.register(User, UserAdmin)
