from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from apps.wip.models import (
    WIP,
    Dispatch,
    ExperimentResult,
    SampleExperimentStatus,
    WIPSample,
)


class WIPSampleInline(TabularInline):
    model = WIPSample
    extra = 0
    fields = ("sample", "added_at")
    readonly_fields = ("added_at",)
    raw_id_fields = ("sample",)


class DispatchInline(TabularInline):
    model = Dispatch
    extra = 0
    fields = (
        "experiment_type",
        "recipe",
        "status",
        "dispatched_at",
        "completed_at",
        "created_at",
    )
    readonly_fields = ("dispatched_at", "completed_at", "created_at")
    show_change_link = True


class ExperimentResultInline(TabularInline):
    model = ExperimentResult
    extra = 0
    fields = ("comment", "recorded_by", "created_at")
    readonly_fields = ("comment", "recorded_by", "created_at")

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(WIP)
class WIPAdmin(ModelAdmin):
    list_display = (
        "id",
        "experiment_type",
        "sample_count",
        "status",
        "created_by",
        "completed_at",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = (
        "samples__wafer_id",
        "experiment_type__name",
        "created_by__username",
    )
    readonly_fields = ("completed_at", "created_at", "updated_at")
    list_select_related = ("experiment_type", "created_by")
    list_per_page = 25
    inlines = (WIPSampleInline, DispatchInline)

    @admin.display(description="Samples")
    def sample_count(self, obj):
        return obj.samples.count()


@admin.register(Dispatch)
class DispatchAdmin(ModelAdmin):
    list_display = (
        "id",
        "wip",
        "experiment_type",
        "equipment",
        "status",
        "dispatched_at",
        "completed_at",
        "created_at",
    )
    list_filter = ("status", "experiment_type", "equipment")
    search_fields = (
        "experiment_type__name",
        "equipment__name",
        "created_by__username",
    )
    readonly_fields = ("dispatched_at", "completed_at", "created_at", "updated_at")
    list_select_related = ("wip", "experiment_type", "equipment", "recipe")
    list_per_page = 25
    inlines = (ExperimentResultInline,)


@admin.register(ExperimentResult)
class ExperimentResultAdmin(ModelAdmin):
    list_display = (
        "id",
        "dispatch",
        "recorded_by",
        "created_at",
    )
    search_fields = (
        "comment",
        "recorded_by__username",
    )
    readonly_fields = (
        "dispatch",
        "comment",
        "recorded_by",
        "created_at",
    )
    list_select_related = ("dispatch", "recorded_by")
    list_per_page = 25

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(SampleExperimentStatus)
class SampleExperimentStatusAdmin(ModelAdmin):
    list_display = (
        "id",
        "sample",
        "experiment_type",
        "status",
        "verdict",
        "dispatch",
        "updated_at",
    )
    list_filter = ("status", "verdict")
    search_fields = ("sample__wafer_id", "experiment_type__name")
    list_select_related = ("sample", "experiment_type", "dispatch")
    list_per_page = 25
