"""Django admin custom views for reports (equipment utilization, request statistics).

Both pages are read-only; no CRUD operations are permitted.
"""

from datetime import date, timedelta

from django import forms
from django.contrib import admin
from django.db.models import Count
from django.shortcuts import render
from unfold.admin import ModelAdmin

from apps.commissions.models import Request, RequestStatus
from apps.equipment.models import Equipment
from apps.reports.models import EquipmentUtilizationReport, RequestStatisticsReport
from apps.wip.models import Dispatch


class DateRangeForm(forms.Form):
    """Date range picker used by both report views."""

    start_date = forms.DateField(widget=forms.DateInput(attrs={"type": "date"}))
    end_date = forms.DateField(widget=forms.DateInput(attrs={"type": "date"}))

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Provide sensible defaults so the form pre-fills on first visit.
        self.fields["start_date"].initial = date.today() - timedelta(days=30)
        self.fields["end_date"].initial = date.today()


class EquipmentUtilizationForm(DateRangeForm):
    """Date range + optional equipment filter for the utilization report."""

    equipment = forms.ModelChoiceField(
        queryset=Equipment.objects.all(),
        required=False,
        empty_label="— All Equipment —",
    )


def _aggregate_dispatches(start_date, end_date, equipment_obj=None):
    """Return per-equipment dispatch aggregation for the given date range."""
    qs = Dispatch.objects.filter(
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    )
    if equipment_obj is not None:
        qs = qs.filter(equipment=equipment_obj)
    return list(
        qs.values("equipment_id", "equipment__name")
        .annotate(
            wip_count=Count("id"),
            sample_count=Count("wip_id", distinct=True),
        )
        .order_by("equipment__name")
    )


def _compute_request_stats(start_date, end_date):
    """Return request statistics dict for the given date range."""
    base_qs = Request.objects.filter(
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    )
    total = base_qs.count()
    status_distribution = list(
        base_qs.values("status")
        .annotate(count=Count("id"))
        .filter(count__gt=0)
        .order_by("status")
    )
    terminal = list(
        base_qs.filter(
            status__in=[RequestStatus.COMPLETED, RequestStatus.CLOSED]
        ).values("created_at", "updated_at")
    )
    avg_tat_hours = None
    if terminal:
        total_seconds = sum(
            (r["updated_at"] - r["created_at"]).total_seconds() for r in terminal
        )
        avg_tat_hours = round(total_seconds / len(terminal) / 3600, 1)
    return {
        "total": total,
        "status_distribution": status_distribution,
        "avg_tat_hours": avg_tat_hours,
    }


@admin.register(EquipmentUtilizationReport)
class EquipmentUtilizationAdmin(ModelAdmin):
    """Read-only admin page for the equipment utilization report."""

    change_list_template = "admin/reports/equipment_utilization.html"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        form = EquipmentUtilizationForm(request.GET or None)
        rows = []
        if form.is_valid():
            rows = _aggregate_dispatches(
                form.cleaned_data["start_date"],
                form.cleaned_data["end_date"],
                form.cleaned_data.get("equipment"),
            )
        context = {
            **self.admin_site.each_context(request),
            "title": "Equipment Utilization Report",
            "form": form,
            "rows": rows,
            "opts": self.model._meta,
        }
        return render(request, self.change_list_template, context)


@admin.register(RequestStatisticsReport)
class RequestStatisticsAdmin(ModelAdmin):
    """Read-only admin page for the request statistics report."""

    change_list_template = "admin/reports/request_statistics.html"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        form = DateRangeForm(request.GET or None)
        stats = None
        if form.is_valid():
            stats = _compute_request_stats(
                form.cleaned_data["start_date"],
                form.cleaned_data["end_date"],
            )
        context = {
            **self.admin_site.each_context(request),
            "title": "Request Statistics Report",
            "form": form,
            "stats": stats,
            "opts": self.model._meta,
        }
        return render(request, self.change_list_template, context)
