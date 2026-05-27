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

    def save_formset(self, request, form, formset, change):
        # On user add, the post_save signal already created a UserProfile.
        # Use update_or_create to avoid duplicate key errors.
        if formset.model is UserProfile:
            instances = formset.save(commit=False)
            for obj in instances:
                UserProfile.objects.update_or_create(
                    user=obj.user,
                    defaults={"role": obj.role, "department": obj.department},
                )
        else:
            super().save_formset(request, form, formset, change)

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
