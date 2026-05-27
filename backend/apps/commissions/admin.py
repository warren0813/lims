from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from apps.commissions.models import (
    ApprovalLog,
    Request,
    RequestExperiment,
    Sample,
)


class RequestExperimentInline(TabularInline):
    model = RequestExperiment
    extra = 1
    autocomplete_fields = ("experiment_type",)


class SampleInline(TabularInline):
    model = Sample
    extra = 0
    fields = ("wafer_id", "wafer_size", "status", "note", "created_at")
    readonly_fields = ("created_at",)


class ApprovalLogInline(TabularInline):
    model = ApprovalLog
    extra = 0
    fields = ("reviewer", "action", "comment", "created_at")
    readonly_fields = ("reviewer", "action", "comment", "created_at")

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Request)
class RequestAdmin(ModelAdmin):
    list_display = ("title", "requester", "status", "submitted_at", "created_at")
    list_filter = ("status",)
    search_fields = ("title", "requester__username")
    readonly_fields = (
        "submitted_at",
        "completed_at",
        "closed_at",
        "created_at",
        "updated_at",
    )
    list_select_related = ("requester",)
    list_per_page = 25
    inlines = (RequestExperimentInline, SampleInline, ApprovalLogInline)


@admin.register(Sample)
class SampleAdmin(ModelAdmin):
    list_display = ("wafer_id", "request", "wafer_size", "status", "created_at")
    list_filter = ("status", "wafer_size")
    search_fields = ("wafer_id", "request__title")
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("request",)
    list_per_page = 25


@admin.register(ApprovalLog)
class ApprovalLogAdmin(ModelAdmin):
    list_display = ("request", "reviewer", "action", "created_at")
    list_filter = ("action",)
    search_fields = ("request__title", "reviewer__username", "comment")
    readonly_fields = ("request", "reviewer", "action", "comment", "created_at")
    list_select_related = ("request", "reviewer")
    list_per_page = 25

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
