from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from apps.equipment.models import Equipment, EquipmentCapability, Recipe


class EquipmentCapabilityInline(TabularInline):
    model = EquipmentCapability
    extra = 1
    autocomplete_fields = ("experiment_type",)


@admin.register(Equipment)
class EquipmentAdmin(ModelAdmin):
    list_display = ("name", "model_name", "capacity", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("name", "model_name")
    readonly_fields = ("created_at", "updated_at")
    list_per_page = 25
    inlines = (EquipmentCapabilityInline,)


@admin.register(Recipe)
class RecipeAdmin(ModelAdmin):
    list_display = (
        "name",
        "experiment_type",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "experiment_type")
    search_fields = ("name", "description")
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("experiment_type",)
    list_per_page = 25
