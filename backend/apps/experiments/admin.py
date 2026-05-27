from django.contrib import admin
from unfold.admin import ModelAdmin

from apps.experiments.models import ExperimentType


@admin.register(ExperimentType)
class ExperimentTypeAdmin(ModelAdmin):
    list_display = ("name", "lab_category", "is_active", "created_at")
    list_filter = ("lab_category", "is_active")
    search_fields = ("name", "description")
    readonly_fields = ("created_at", "updated_at")
    list_per_page = 25
