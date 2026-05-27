"""Django template views for the LIMS web frontend.

All views query models directly (no JWT API calls). Authentication uses
Django sessions. Role-based access is enforced via the role_required decorator.
"""

import json
from datetime import date, timedelta
from typing import Any

from django.conf import settings
from django.contrib.auth import (
    BACKEND_SESSION_KEY,
    HASH_SESSION_KEY,
    SESSION_KEY,
    authenticate,
    login,
    logout,
)
from django.contrib.sessions.backends.db import SessionStore
from django.db import transaction
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Prefetch
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from apps.accounts.models import Role
from apps.commissions.models import (
    ApprovalLog,
    Request,
    RequestExperiment,
    RequestStatus,
    Sample,
    SampleStatus,
    WaferSize,
)
from apps.commissions.services import (
    check_all_samples_received,
    check_request_completed,
)
from apps.commissions.state_machine import (
    InvalidTransitionError,
    validate_request_transition,
    validate_sample_transition,
)
from apps.equipment.models import (
    Equipment,
    EquipmentCapability,
    EquipmentStatus,
    Recipe,
)
from apps.experiments.models import ExperimentType
from apps.wip.models import (
    WIP,
    Dispatch,
    DispatchStatus,
    ExperimentResult,
    SampleExperimentProgress,
    SampleExperimentStatus,
    WIPSample,
    WIPStatus,
)
from apps.wip.services import update_experiment_statuses_on_unload
from apps.wip.state_machine import (
    InvalidTransitionError as WIPInvalidTransitionError,
)
from apps.wip.state_machine import validate_dispatch_transition, validate_wip_transition

from .decorators import role_required

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_htmx(request: HttpRequest) -> bool:
    return request.headers.get("HX-Request") == "true"


def _user_role(request: HttpRequest) -> str | None:
    profile = getattr(request.user, "profile", None)
    return profile.role if profile else None


def _request_prefetch_qs() -> Any:
    return Request.objects.select_related("requester__profile").prefetch_related(
        "samples",
        Prefetch(
            "request_experiments",
            queryset=RequestExperiment.objects.select_related("experiment_type"),
        ),
        Prefetch(
            "approval_logs",
            queryset=ApprovalLog.objects.select_related("reviewer__profile").order_by(
                "-created_at"
            ),
        ),
    )


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def login_view(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("web:dashboard")

    error = None
    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "")
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect("web:dashboard")
        error = "Invalid username or password."

    return render(request, "web/login.html", {"error": error})


def logout_view(request: HttpRequest) -> HttpResponse:
    logout(request)
    return redirect("web:login")


# ---------------------------------------------------------------------------
# Multi-account helpers
# ---------------------------------------------------------------------------


def _account_entry(user: Any, session_key: str) -> dict:
    profile = getattr(user, "profile", None)
    return {
        "session_key": session_key,
        "user_id": user.pk,
        "username": user.username,
        "role_display": profile.get_role_display() if profile else "",
    }


def _sync_linked_sessions(session: SessionStore, new_entries: list[dict]) -> None:
    """Replace _linked_sessions in the given session and save."""
    session["_linked_sessions"] = new_entries
    session.save()


# ---------------------------------------------------------------------------
# Multi-account views
# ---------------------------------------------------------------------------


def add_account_view(request: HttpRequest) -> HttpResponse:
    """Add a second (or more) account to the current browser session."""
    if not request.user.is_authenticated:
        return redirect("web:login")

    error = None
    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "")
        new_user = authenticate(request, username=username, password=password)

        if new_user is None:
            error = "Invalid username or password."
        elif new_user.pk == request.user.pk:
            error = "This account is already active."
        else:
            # Check if already linked
            current_linked: list[dict] = request.session.get("_linked_sessions", [])
            if any(a["user_id"] == new_user.pk for a in current_linked):
                error = "This account is already added."
            else:
                # Build the new session for new_user
                new_session = SessionStore()
                new_session[SESSION_KEY] = str(new_user.pk)
                new_session[BACKEND_SESSION_KEY] = (
                    "django.contrib.auth.backends.ModelBackend"
                )
                new_session[HASH_SESSION_KEY] = new_user.get_session_auth_hash()

                # New session's linked list = current user + existing linked
                current_entry = _account_entry(
                    request.user, request.session.session_key
                )
                new_session["_linked_sessions"] = [current_entry] + current_linked
                new_session.create()

                # Add new user to current session's linked list
                current_linked.append(_account_entry(new_user, new_session.session_key))
                request.session["_linked_sessions"] = current_linked

                return redirect("web:dashboard")

    return render(request, "web/add_account.html", {"error": error})


def switch_account_view(request: HttpRequest, user_id: int) -> HttpResponse:
    """Switch the active session to a linked account."""
    if not request.user.is_authenticated:
        return redirect("web:login")

    linked: list[dict] = request.session.get("_linked_sessions", [])
    target = next((a for a in linked if a["user_id"] == user_id), None)
    if target is None:
        return redirect("web:dashboard")

    # Verify target session is still alive
    target_session = SessionStore(session_key=target["session_key"])
    if not target_session.exists(target["session_key"]):
        # Session expired — remove stale entry
        request.session["_linked_sessions"] = [
            a for a in linked if a["user_id"] != user_id
        ]
        return redirect("web:dashboard")

    # Sync target session's linked list so it includes the current user
    target_linked: list[dict] = target_session.get("_linked_sessions", [])
    current_entry = _account_entry(request.user, request.session.session_key)
    target_linked = [a for a in target_linked if a["user_id"] != request.user.pk]
    target_linked.append(current_entry)
    _sync_linked_sessions(target_session, target_linked)

    # Switch cookie to target session
    cookie_settings = {
        "max_age": settings.SESSION_COOKIE_AGE,
        "path": settings.SESSION_COOKIE_PATH,
        "domain": settings.SESSION_COOKIE_DOMAIN,
        "secure": settings.SESSION_COOKIE_SECURE,
        "httponly": settings.SESSION_COOKIE_HTTPONLY,
        "samesite": settings.SESSION_COOKIE_SAMESITE,
    }
    response = redirect("web:dashboard")
    response.set_cookie(
        settings.SESSION_COOKIE_NAME, target["session_key"], **cookie_settings
    )
    return response


@require_POST
def remove_account_view(request: HttpRequest, user_id: int) -> HttpResponse:
    """Remove a linked account from the current browser session."""
    if not request.user.is_authenticated:
        return redirect("web:login")

    linked: list[dict] = request.session.get("_linked_sessions", [])
    target = next((a for a in linked if a["user_id"] == user_id), None)
    if target:
        # Delete that session from the database
        target_session = SessionStore(session_key=target["session_key"])
        target_session.delete()
        request.session["_linked_sessions"] = [
            a for a in linked if a["user_id"] != user_id
        ]

    return redirect("web:dashboard")


def dashboard_view(request: HttpRequest) -> HttpResponse:
    if not request.user.is_authenticated:
        return redirect("web:login")

    role = _user_role(request)
    today = date.today()
    chart_ctx = {
        "chart_start_date": (today - timedelta(days=13)).isoformat(),
        "chart_end_date": today.isoformat(),
    }
    if role == Role.FAB_USER:
        requests_qs = Request.objects.filter(requester=request.user).order_by(
            "-created_at"
        )[:5]
        return render(
            request,
            "web/dashboard/fab_user.html",
            {
                "title": "Dashboard",
                "recent_requests": requests_qs,
                "total_requests": Request.objects.filter(
                    requester=request.user
                ).count(),
                "pending_count": Request.objects.filter(
                    requester=request.user,
                    status=RequestStatus.PENDING_APPROVAL,
                ).count(),
                **chart_ctx,
            },
        )
    elif role == Role.LAB_STAFF:
        return render(
            request,
            "web/dashboard/lab_staff.html",
            {
                "title": "Dashboard",
                "samples_to_receive": Sample.objects.filter(
                    status=SampleStatus.SHIPPED
                ).count(),
                "active_wips": WIP.objects.filter(
                    status__in=[WIPStatus.CREATED, WIPStatus.IN_PROGRESS]
                ).count(),
                "pending_dispatches": Dispatch.objects.filter(
                    status__in=[
                        DispatchStatus.PENDING,
                        DispatchStatus.DISPATCHED,
                        DispatchStatus.RUNNING,
                        DispatchStatus.UNLOADED,
                    ]
                ).count(),
                "exception_dispatches": Dispatch.objects.filter(
                    status=DispatchStatus.EXECUTION_EXCEPTION
                ).count(),
                **chart_ctx,
            },
        )
    elif role == Role.LAB_MANAGER:
        return render(
            request,
            "web/dashboard/lab_manager.html",
            {
                "title": "Dashboard",
                "pending_approvals": Request.objects.filter(
                    status=RequestStatus.PENDING_APPROVAL
                ).count(),
                "in_progress": Request.objects.filter(
                    status=RequestStatus.IN_PROGRESS
                ).count(),
                "completed": Request.objects.filter(
                    status=RequestStatus.COMPLETED
                ).count(),
                "total_equipment": Equipment.objects.count(),
                **chart_ctx,
            },
        )

    # No profile / unknown role
    return render(request, "web/dashboard/fab_user.html", {"title": "Dashboard"})


# ---------------------------------------------------------------------------
# Dashboard chart helpers
# ---------------------------------------------------------------------------


def _parse_chart_dates(request: HttpRequest) -> tuple[date, date]:
    """Parse start_date/end_date GET params; default to last 14 days on error."""
    today = date.today()
    try:
        start = date.fromisoformat(request.GET.get("start_date", ""))
        end = date.fromisoformat(request.GET.get("end_date", ""))
    except (ValueError, TypeError):
        start = today - timedelta(days=13)
        end = today
    return start, end


def _build_daily_series(
    start: date,
    end: date,
    qs_by_day: dict,
    default: float | int | None = 0,
) -> tuple[list[str], list]:
    """Return (labels, values) for every day in [start, end], filling gaps with default."""
    day_count = (end - start).days + 1
    labels = [(start + timedelta(days=i)).isoformat() for i in range(day_count)]
    values = [qs_by_day.get(label, default) for label in labels]
    return labels, values


# ---------------------------------------------------------------------------
# Dashboard chart views
# ---------------------------------------------------------------------------


@role_required("fab_user")
def dashboard_chart_tat(request: HttpRequest) -> HttpResponse:
    """HTMX partial: TAT stability trend for the current fab user."""
    start, end = _parse_chart_dates(request)

    qs = (
        Request.objects.filter(
            requester=request.user,
            status__in=[RequestStatus.COMPLETED, RequestStatus.CLOSED],
            completed_at__date__gte=start,
            completed_at__date__lte=end,
        )
        .values("completed_at__date")
        .annotate(
            avg_duration=Avg(
                ExpressionWrapper(
                    F("completed_at") - F("created_at"),
                    output_field=DurationField(),
                )
            )
        )
        .order_by("completed_at__date")
    )

    day_map: dict[str, float | None] = {}
    for row in qs:
        day_str = row["completed_at__date"].isoformat()
        if row["avg_duration"] is not None:
            day_map[day_str] = round(row["avg_duration"].total_seconds() / 3600, 1)

    labels, values = _build_daily_series(start, end, day_map, default=None)
    chart_json = json.dumps({"labels": labels, "values": values})
    return render(request, "web/dashboard/_tat_chart.html", {"chart_json": chart_json})


@role_required("lab_staff")
def dashboard_chart_workload(request: HttpRequest) -> HttpResponse:
    """HTMX partial: workload chart (new vs completed WIPs) for lab staff."""
    start, end = _parse_chart_dates(request)

    new_qs = (
        WIP.objects.filter(
            created_at__date__gte=start,
            created_at__date__lte=end,
        )
        .values("created_at__date")
        .annotate(count=Count("id"))
        .order_by("created_at__date")
    )
    new_map = {row["created_at__date"].isoformat(): row["count"] for row in new_qs}

    completed_qs = (
        WIP.objects.filter(
            status=WIPStatus.COMPLETED,
            completed_at__date__gte=start,
            completed_at__date__lte=end,
        )
        .values("completed_at__date")
        .annotate(count=Count("id"))
        .order_by("completed_at__date")
    )
    completed_map = {
        row["completed_at__date"].isoformat(): row["count"] for row in completed_qs
    }

    labels, new_values = _build_daily_series(start, end, new_map)
    _, completed_values = _build_daily_series(start, end, completed_map)

    chart_json = json.dumps(
        {"labels": labels, "new_wips": new_values, "completed_wips": completed_values}
    )
    return render(
        request, "web/dashboard/_workload_chart.html", {"chart_json": chart_json}
    )


@role_required("lab_manager")
def dashboard_chart_capacity(request: HttpRequest) -> HttpResponse:
    """HTMX partial: capacity/utilization trend for lab manager."""
    start, end = _parse_chart_dates(request)
    total_equipment = Equipment.objects.count()

    throughput_qs = (
        Dispatch.objects.filter(
            dispatched_at__isnull=False,
            dispatched_at__date__gte=start,
            dispatched_at__date__lte=end,
        )
        .values("dispatched_at__date")
        .annotate(count=Count("id"))
        .order_by("dispatched_at__date")
    )
    throughput_map = {
        row["dispatched_at__date"].isoformat(): row["count"] for row in throughput_qs
    }

    active_qs = (
        Dispatch.objects.filter(
            dispatched_at__isnull=False,
            dispatched_at__date__gte=start,
            dispatched_at__date__lte=end,
        )
        .values("dispatched_at__date")
        .annotate(active=Count("equipment_id", distinct=True))
        .order_by("dispatched_at__date")
    )
    utilization_map = {
        row["dispatched_at__date"].isoformat(): round(
            row["active"] / max(total_equipment, 1) * 100, 1
        )
        for row in active_qs
    }

    labels, throughput_values = _build_daily_series(start, end, throughput_map)
    _, utilization_values = _build_daily_series(
        start, end, utilization_map, default=0.0
    )

    chart_json = json.dumps(
        {
            "labels": labels,
            "throughput": throughput_values,
            "utilization_pct": utilization_values,
        }
    )
    return render(
        request, "web/dashboard/_capacity_chart.html", {"chart_json": chart_json}
    )


# ---------------------------------------------------------------------------
# FAB_USER — Commission Requests
# ---------------------------------------------------------------------------


@role_required("fab_user")
def my_requests_list(request: HttpRequest) -> HttpResponse:
    status_filter = request.GET.get("status", "")
    qs = Request.objects.filter(requester=request.user).order_by("-created_at")
    if status_filter:
        qs = qs.filter(status=status_filter)
    return render(
        request,
        "web/requests/list.html",
        {
            "title": "My Requests",
            "requests": qs,
            "status_choices": RequestStatus.choices,
            "current_status": status_filter,
        },
    )


@role_required("fab_user")
def request_create(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        exp_types = ExperimentType.objects.filter(is_active=True).order_by(
            "lab_category", "name"
        )
        return render(
            request,
            "web/requests/create.html",
            {
                "title": "New Request",
                "experiment_types": exp_types,
                "wafer_sizes": WaferSize.choices,
            },
        )

    # POST — create the request
    title = request.POST.get("title", "").strip()
    note = request.POST.get("note", "").strip()
    exp_type_ids = request.POST.getlist("experiment_type_ids")
    samples_json = request.POST.get("samples_json", "[]")

    errors = []
    if not title:
        errors.append("Title is required.")
    if not exp_type_ids:
        errors.append("At least one experiment type must be selected.")

    try:
        samples_data = json.loads(samples_json)
    except json.JSONDecodeError:
        samples_data = []

    if not samples_data:
        errors.append("At least one sample is required.")

    if errors:
        exp_types = ExperimentType.objects.filter(is_active=True).order_by(
            "lab_category", "name"
        )
        return render(
            request,
            "web/requests/create.html",
            {
                "title": "New Request",
                "experiment_types": exp_types,
                "wafer_sizes": WaferSize.choices,
                "errors": errors,
                "form_data": request.POST,
            },
        )

    exp_types = list(ExperimentType.objects.filter(pk__in=exp_type_ids, is_active=True))
    if len(exp_types) != len(exp_type_ids):
        errors.append("One or more selected experiment types are invalid.")
        return render(
            request,
            "web/requests/create.html",
            {
                "title": "New Request",
                "experiment_types": ExperimentType.objects.filter(
                    is_active=True
                ).order_by("lab_category", "name"),
                "wafer_sizes": WaferSize.choices,
                "errors": errors,
            },
        )

    with transaction.atomic():
        req = Request.objects.create(
            title=title,
            note=note,
            requester=request.user,
        )
        for et in exp_types:
            params_key = f"params_{et.pk}"
            raw_params = request.POST.get(params_key, "{}").strip()
            try:
                params = json.loads(raw_params) if raw_params else {}
            except json.JSONDecodeError:
                params = {}
            RequestExperiment.objects.create(
                request=req, experiment_type=et, parameters=params
            )
        for s in samples_data:
            Sample.objects.create(
                request=req,
                wafer_id=s.get("wafer_id", ""),
                wafer_size=s.get("wafer_size", WaferSize.SIZE_200MM),
            )

    return redirect("web:request-detail", request_id=req.pk)


@role_required("fab_user")
def request_detail(request: HttpRequest, request_id: int) -> HttpResponse:
    req = get_object_or_404(
        _request_prefetch_qs(), pk=request_id, requester=request.user
    )
    return render(
        request,
        "web/requests/detail.html",
        {"title": f"Request #{req.pk}", "req": req},
    )


@role_required("fab_user")
@require_POST
def request_submit(request: HttpRequest, request_id: int) -> HttpResponse:
    with transaction.atomic():
        req = get_object_or_404(
            Request.objects.select_for_update(), pk=request_id, requester=request.user
        )
        try:
            target = validate_request_transition(req.status, "submit")
        except InvalidTransitionError as e:
            return _action_error(
                request, str(e), redirect_url=f"/requests/{request_id}/"
            )
        req.status = target
        req.submitted_at = timezone.now()
        req.save()
    return redirect("web:request-detail", request_id=request_id)


@role_required("fab_user")
@require_POST
def request_ship(request: HttpRequest, request_id: int) -> HttpResponse:
    with transaction.atomic():
        req = get_object_or_404(
            Request.objects.select_for_update(), pk=request_id, requester=request.user
        )
        try:
            target = validate_request_transition(req.status, "ship")
        except InvalidTransitionError as e:
            return _action_error(
                request, str(e), redirect_url=f"/requests/{request_id}/"
            )
        req.status = target
        req.save()
        # Transition all created samples to shipped
        req.samples.filter(status=SampleStatus.CREATED).update(
            status=SampleStatus.SHIPPED
        )
    return redirect("web:request-detail", request_id=request_id)


@role_required("fab_user")
@require_POST
def request_cancel_fab(request: HttpRequest, request_id: int) -> HttpResponse:
    reason = request.POST.get("reason", "").strip()
    with transaction.atomic():
        req = get_object_or_404(
            Request.objects.select_for_update(), pk=request_id, requester=request.user
        )
        try:
            target = validate_request_transition(req.status, "cancel")
        except InvalidTransitionError as e:
            return _action_error(
                request, str(e), redirect_url=f"/requests/{request_id}/"
            )
        req.status = target
        if reason:
            req.note = (req.note + f"\n[Cancelled] {reason}").strip()
        req.save()
    return redirect("web:my-requests")


# ---------------------------------------------------------------------------
# LAB_MANAGER — Request approval
# ---------------------------------------------------------------------------


@role_required("lab_manager")
def all_requests_list(request: HttpRequest) -> HttpResponse:
    status_filter = request.GET.get("status", "")
    qs = Request.objects.select_related("requester__profile").order_by("-created_at")
    if status_filter:
        qs = qs.filter(status=status_filter)
    return render(
        request,
        "web/requests/all_list.html",
        {
            "title": "All Requests",
            "requests": qs,
            "status_choices": RequestStatus.choices,
            "current_status": status_filter,
        },
    )


@role_required("lab_manager")
def manager_request_detail(request: HttpRequest, request_id: int) -> HttpResponse:
    req = get_object_or_404(_request_prefetch_qs(), pk=request_id)
    return render(
        request,
        "web/requests/manager_detail.html",
        {"title": f"Request #{req.pk}", "req": req},
    )


@role_required("lab_manager")
@require_POST
def request_approve(request: HttpRequest, request_id: int) -> HttpResponse:
    with transaction.atomic():
        req = get_object_or_404(Request.objects.select_for_update(), pk=request_id)
        try:
            target = validate_request_transition(req.status, "approve")
        except InvalidTransitionError as e:
            return _action_error(
                request, str(e), redirect_url=f"/requests/all/{request_id}/"
            )
        req.status = target
        req.save()
        ApprovalLog.objects.create(
            request=req,
            reviewer=request.user,
            action=ApprovalLog.Action.APPROVE,
            comment=request.POST.get("comment", ""),
        )
    return redirect("web:manager-request-detail", request_id=request_id)


@role_required("lab_manager")
@require_POST
def request_return(request: HttpRequest, request_id: int) -> HttpResponse:
    comment = request.POST.get("comment", "").strip()
    with transaction.atomic():
        req = get_object_or_404(Request.objects.select_for_update(), pk=request_id)
        try:
            target = validate_request_transition(req.status, "return")
        except InvalidTransitionError as e:
            return _action_error(
                request, str(e), redirect_url=f"/requests/all/{request_id}/"
            )
        req.status = target
        req.save()
        ApprovalLog.objects.create(
            request=req,
            reviewer=request.user,
            action=ApprovalLog.Action.RETURN,
            comment=comment,
        )
    return redirect("web:manager-request-detail", request_id=request_id)


@role_required("lab_manager")
@require_POST
def request_reject(request: HttpRequest, request_id: int) -> HttpResponse:
    comment = request.POST.get("comment", "").strip()
    with transaction.atomic():
        req = get_object_or_404(Request.objects.select_for_update(), pk=request_id)
        try:
            target = validate_request_transition(req.status, "reject")
        except InvalidTransitionError as e:
            return _action_error(
                request, str(e), redirect_url=f"/requests/all/{request_id}/"
            )
        req.status = target
        req.save()
        ApprovalLog.objects.create(
            request=req,
            reviewer=request.user,
            action=ApprovalLog.Action.REJECT,
            comment=comment,
        )
    return redirect("web:manager-request-detail", request_id=request_id)


@role_required("lab_manager")
@require_POST
def request_close(request: HttpRequest, request_id: int) -> HttpResponse:
    with transaction.atomic():
        req = get_object_or_404(Request.objects.select_for_update(), pk=request_id)
        try:
            target = validate_request_transition(req.status, "close")
        except InvalidTransitionError as e:
            return _action_error(
                request, str(e), redirect_url=f"/requests/all/{request_id}/"
            )
        req.status = target
        req.closed_at = timezone.now()
        req.save()
    return redirect("web:manager-request-detail", request_id=request_id)


@role_required("lab_manager")
@require_POST
def request_cancel_manager(request: HttpRequest, request_id: int) -> HttpResponse:
    reason = request.POST.get("reason", "").strip()
    with transaction.atomic():
        req = get_object_or_404(Request.objects.select_for_update(), pk=request_id)
        try:
            target = validate_request_transition(req.status, "cancel")
        except InvalidTransitionError as e:
            return _action_error(
                request, str(e), redirect_url=f"/requests/all/{request_id}/"
            )
        req.status = target
        if reason:
            req.note = (req.note + f"\n[Cancelled] {reason}").strip()
        req.save()
    return redirect("web:all-requests")


# ---------------------------------------------------------------------------
# LAB_STAFF — Sample management
# ---------------------------------------------------------------------------


@role_required("lab_staff", "lab_manager")
def samples_list(request: HttpRequest) -> HttpResponse:
    status_filter = request.GET.get("status", "")
    request_id_filter = request.GET.get("request_id", "")
    qs = Sample.objects.select_related("request__requester").order_by("-created_at")
    if status_filter:
        qs = qs.filter(status=status_filter)
    if request_id_filter:
        qs = qs.filter(request_id=request_id_filter)
    return render(
        request,
        "web/samples/list.html",
        {
            "title": "Samples",
            "samples": qs,
            "status_choices": SampleStatus.choices,
            "current_status": status_filter,
        },
    )


def _sample_action(
    request: HttpRequest, sample_id: int, action: str, redirect_url: str, **extra_fields
) -> HttpResponse:
    """Shared helper for sample state transitions."""
    with transaction.atomic():
        sample = get_object_or_404(Sample.objects.select_for_update(), pk=sample_id)
        try:
            target = validate_sample_transition(sample.status, action)
        except InvalidTransitionError as e:
            return _action_error(request, str(e), redirect_url=redirect_url)
        sample.status = target
        for field, value in extra_fields.items():
            setattr(sample, field, value)
        sample.save()

        # Auto-transition request if all samples received
        if action == "receive":
            req = Request.objects.select_for_update().get(pk=sample.request_id)
            check_all_samples_received(req)

    if _is_htmx(request):
        sample = Sample.objects.select_related("request").get(pk=sample_id)
        return render(request, "web/samples/_row.html", {"sample": sample})
    return redirect(redirect_url)


@role_required("lab_staff", "lab_manager")
@require_POST
def sample_receive(request: HttpRequest, sample_id: int) -> HttpResponse:
    return _sample_action(request, sample_id, "receive", "/samples/")


@role_required("lab_staff", "lab_manager")
@require_POST
def sample_reject_receiving(request: HttpRequest, sample_id: int) -> HttpResponse:
    note = request.POST.get("reason", "").strip()
    return _sample_action(
        request, sample_id, "reject_receiving", "/samples/", note=note
    )


@role_required("lab_staff", "lab_manager")
@require_POST
def sample_report_lost(request: HttpRequest, sample_id: int) -> HttpResponse:
    return _sample_action(request, sample_id, "report_lost", "/samples/")


@role_required("lab_staff", "lab_manager")
@require_POST
def sample_void(request: HttpRequest, sample_id: int) -> HttpResponse:
    return _sample_action(request, sample_id, "void", "/samples/")


@role_required("lab_staff", "lab_manager")
@require_POST
def sample_return(request: HttpRequest, sample_id: int) -> HttpResponse:
    return _sample_action(request, sample_id, "return", "/samples/")


# ---------------------------------------------------------------------------
# LAB_STAFF — WIP management
# ---------------------------------------------------------------------------


@role_required("lab_staff", "lab_manager")
def wips_list(request: HttpRequest) -> HttpResponse:
    status_filter = request.GET.get("status", "")
    qs = (
        WIP.objects.select_related("experiment_type")
        .prefetch_related("samples")
        .order_by("-created_at")
    )
    if status_filter:
        qs = qs.filter(status=status_filter)
    # Samples eligible for WIP: received/processing with request in_progress
    available_samples = Sample.objects.filter(
        status__in=[SampleStatus.RECEIVED, SampleStatus.PROCESSING],
        request__status=RequestStatus.IN_PROGRESS,
    ).select_related("request")
    experiment_types = ExperimentType.objects.filter(is_active=True).order_by("name")
    return render(
        request,
        "web/wips/list.html",
        {
            "title": "WIP",
            "wips": qs,
            "status_choices": WIPStatus.choices,
            "current_status": status_filter,
            "available_samples": available_samples,
            "experiment_types": experiment_types,
        },
    )


@role_required("lab_staff", "lab_manager")
@require_POST
def wip_create(request: HttpRequest) -> HttpResponse:
    sample_ids = request.POST.getlist("sample_ids")
    experiment_type_id = request.POST.get("experiment_type_id", "").strip()
    note = request.POST.get("note", "").strip()

    try:
        experiment_type = ExperimentType.objects.get(
            pk=experiment_type_id, is_active=True
        )
    except (ExperimentType.DoesNotExist, ValueError):
        return _action_error(request, "Invalid experiment type.", redirect_url="/wips/")

    samples = list(Sample.objects.select_related("request").filter(pk__in=sample_ids))
    if not samples:
        return _action_error(request, "No samples selected.", redirect_url="/wips/")

    for sample in samples:
        if sample.request.status != RequestStatus.IN_PROGRESS:
            return _action_error(
                request,
                f"Sample {sample.wafer_id}: request is not in_progress.",
                redirect_url="/wips/",
            )
        if sample.status not in (SampleStatus.RECEIVED, SampleStatus.PROCESSING):
            return _action_error(
                request,
                f"Sample {sample.wafer_id}: invalid status '{sample.status}'.",
                redirect_url="/wips/",
            )

    # Every sample's request must include the chosen experiment_type
    # (chat-design constraint).
    request_ids = {s.request_id for s in samples}
    covered_request_ids = set(
        Request.objects.filter(
            pk__in=request_ids,
            request_experiments__experiment_type=experiment_type,
        ).values_list("pk", flat=True)
    )
    missing = request_ids - covered_request_ids
    if missing:
        bad = ", ".join(s.wafer_id for s in samples if s.request_id in missing)
        return _action_error(
            request,
            f"Sample(s) {bad}: parent request does not include experiment type "
            f"'{experiment_type.name}'.",
            redirect_url="/wips/",
        )

    for sample in samples:
        if sample.status != SampleStatus.RECEIVED:
            continue
        try:
            validate_sample_transition(sample.status, "start_processing")
        except InvalidTransitionError as e:
            return _action_error(
                request,
                f"Sample {sample.wafer_id}: {e}",
                redirect_url="/wips/",
            )

    with transaction.atomic():
        wip = WIP.objects.create(
            experiment_type=experiment_type,
            note=note,
            created_by=request.user,
        )
        for sample in samples:
            WIPSample.objects.create(wip=wip, sample=sample)
            if sample.status == SampleStatus.RECEIVED:
                # Re-raise unexpected transition failures so the WIP create
                # transaction rolls back instead of leaving a stuck sample.
                try:
                    sample.status = validate_sample_transition(
                        sample.status, "start_processing"
                    )
                except InvalidTransitionError:
                    raise
                sample.save(update_fields=["status", "updated_at"])

    return redirect("web:wip-detail", wip_id=wip.pk)


@role_required("lab_staff", "lab_manager")
def wip_detail(request: HttpRequest, wip_id: int) -> HttpResponse:
    wip = get_object_or_404(
        WIP.objects.select_related("experiment_type").prefetch_related(
            "samples__request",
            Prefetch(
                "dispatches",
                queryset=Dispatch.objects.select_related(
                    "experiment_type", "equipment", "recipe"
                )
                .prefetch_related("result")
                .order_by("created_at"),
            ),
        ),
        pk=wip_id,
    )
    # Chat-design: recipes are equipment-agnostic, filtered only by
    # the WIP's experiment_type.
    recipes = Recipe.objects.filter(experiment_type=wip.experiment_type, is_active=True)
    # Equipment options for the dispatch form: those with capability for
    # the WIP's experiment_type and currently available.
    equipment_list = Equipment.objects.filter(
        capabilities=wip.experiment_type,
        status=EquipmentStatus.AVAILABLE,
    ).order_by("name")
    return render(
        request,
        "web/wips/detail.html",
        {
            "title": f"WIP #{wip.pk}",
            "wip": wip,
            "recipes": recipes,
            "equipment_list": equipment_list,
        },
    )


@role_required("lab_staff", "lab_manager")
@require_POST
def wip_complete(request: HttpRequest, wip_id: int) -> HttpResponse:
    with transaction.atomic():
        wip = get_object_or_404(WIP.objects.select_for_update(), pk=wip_id)
        # Check all dispatches done
        active_statuses = {
            DispatchStatus.PENDING,
            DispatchStatus.DISPATCHED,
            DispatchStatus.RUNNING,
            DispatchStatus.UNLOADED,
            DispatchStatus.RESULT_RECORDED,
        }
        if wip.dispatches.filter(status__in=active_statuses).exists():
            return _action_error(
                request,
                "All dispatches must be completed or aborted first.",
                redirect_url=f"/wips/{wip_id}/",
            )
        try:
            target = validate_wip_transition(wip.status, "complete")
        except WIPInvalidTransitionError as e:
            return _action_error(request, str(e), redirect_url=f"/wips/{wip_id}/")
        wip.status = target
        wip.completed_at = timezone.now()
        wip.save()

        # Auto-complete samples whose all experiment statuses are done,
        # then cascade per-request completion via the canonical service.
        for sample in Sample.objects.select_for_update().filter(
            pk__in=wip.samples.values_list("pk", flat=True)
        ):
            if sample.status != SampleStatus.PROCESSING:
                continue
            total = SampleExperimentStatus.objects.filter(sample=sample).count()
            completed = SampleExperimentStatus.objects.filter(
                sample=sample, status=SampleExperimentProgress.COMPLETED
            ).count()
            if total > 0 and completed >= total:
                try:
                    s_target = validate_sample_transition(sample.status, "complete")
                    sample.status = s_target
                    sample.save(update_fields=["status", "updated_at"])
                    req = Request.objects.select_for_update().get(pk=sample.request_id)
                    check_request_completed(req)
                except InvalidTransitionError:
                    pass

    return redirect("web:wip-detail", wip_id=wip_id)


@role_required("lab_staff", "lab_manager")
@require_POST
def wip_abort(request: HttpRequest, wip_id: int) -> HttpResponse:
    with transaction.atomic():
        wip = get_object_or_404(WIP.objects.select_for_update(), pk=wip_id)
        try:
            target = validate_wip_transition(wip.status, "abort")
        except WIPInvalidTransitionError as e:
            return _action_error(request, str(e), redirect_url=f"/wips/{wip_id}/")
        wip.status = target
        wip.save()

        # Mark all PROCESSING samples as processing_exception.
        for sample in Sample.objects.select_for_update().filter(
            pk__in=wip.samples.values_list("pk", flat=True)
        ):
            try:
                s_target = validate_sample_transition(
                    sample.status, "processing_exception"
                )
                sample.status = s_target
                sample.save(update_fields=["status", "updated_at"])
            except InvalidTransitionError:
                pass
    return redirect("web:wip-detail", wip_id=wip_id)


# ---------------------------------------------------------------------------
# LAB_STAFF — Dispatch management
# ---------------------------------------------------------------------------


@role_required("lab_staff", "lab_manager")
def dispatches_list(request: HttpRequest) -> HttpResponse:
    status_filter = request.GET.get("status", "")
    qs = Dispatch.objects.select_related(
        "equipment", "experiment_type", "recipe", "wip"
    ).order_by("-created_at")
    if status_filter:
        qs = qs.filter(status=status_filter)
    return render(
        request,
        "web/dispatches/list.html",
        {
            "title": "Dispatches",
            "dispatches": qs,
            "status_choices": DispatchStatus.choices,
            "current_status": status_filter,
        },
    )


@role_required("lab_staff", "lab_manager")
def dispatch_detail(request: HttpRequest, dispatch_id: int) -> HttpResponse:
    dispatch = get_object_or_404(
        Dispatch.objects.select_related(
            "equipment",
            "experiment_type",
            "recipe",
            "created_by",
            "wip__experiment_type",
        ).prefetch_related("result", "wip__samples__request"),
        pk=dispatch_id,
    )
    return render(
        request,
        "web/dispatches/detail.html",
        {"title": f"Dispatch #{dispatch.pk}", "dispatch": dispatch},
    )


@role_required("lab_staff", "lab_manager")
@require_POST
def dispatch_create(request: HttpRequest, wip_id: int) -> HttpResponse:
    wip = get_object_or_404(WIP.objects.select_related("experiment_type"), pk=wip_id)
    equipment_id = request.POST.get("equipment_id", "").strip()
    recipe_id = request.POST.get("recipe_id", "").strip()
    note = request.POST.get("note", "").strip()

    try:
        equipment = Equipment.objects.get(pk=equipment_id)
    except (Equipment.DoesNotExist, ValueError):
        return _action_error(
            request, "Invalid equipment.", redirect_url=f"/wips/{wip_id}/"
        )
    if equipment.status != EquipmentStatus.AVAILABLE:
        return _action_error(
            request, "Equipment is not available.", redirect_url=f"/wips/{wip_id}/"
        )
    if not EquipmentCapability.objects.filter(
        equipment=equipment, experiment_type=wip.experiment_type
    ).exists():
        return _action_error(
            request,
            "Equipment does not support this WIP's experiment type.",
            redirect_url=f"/wips/{wip_id}/",
        )

    try:
        recipe = Recipe.objects.get(pk=recipe_id, is_active=True)
    except (Recipe.DoesNotExist, ValueError):
        return _action_error(
            request, "Invalid recipe.", redirect_url=f"/wips/{wip_id}/"
        )
    if recipe.experiment_type_id != wip.experiment_type_id:
        return _action_error(
            request,
            "Recipe experiment type does not match the WIP.",
            redirect_url=f"/wips/{wip_id}/",
        )

    with transaction.atomic():
        wip = (
            WIP.objects.select_for_update()
            .select_related("experiment_type")
            .get(pk=wip_id)
        )
        Dispatch.objects.create(
            wip=wip,
            experiment_type=wip.experiment_type,
            equipment=equipment,
            recipe=recipe,
            note=note,
            created_by=request.user,
        )
        if wip.status == WIPStatus.CREATED:
            wip.status = WIPStatus.IN_PROGRESS
            wip.save()

        # Mark experiment statuses as in_progress.
        sample_ids = list(wip.samples.values_list("pk", flat=True))
        SampleExperimentStatus.objects.filter(
            sample_id__in=sample_ids,
            experiment_type=wip.experiment_type,
            status=SampleExperimentProgress.PENDING,
        ).update(status=SampleExperimentProgress.IN_PROGRESS)

    return redirect("web:wip-detail", wip_id=wip_id)


@role_required("lab_staff", "lab_manager")
def recipes_for_equipment(request: HttpRequest) -> HttpResponse:
    """HTMX endpoint: return recipe options for an experiment type.

    Chat-design: recipes are equipment-agnostic, so the equipment_id
    parameter (still sent by older clients) is ignored.
    """
    exp_type_id = request.GET.get("experiment_type_id", "")
    recipes = Recipe.objects.filter(
        experiment_type_id=exp_type_id,
        is_active=True,
    ).order_by("name")
    return render(request, "web/wips/_recipe_options.html", {"recipes": recipes})


def _dispatch_action(
    request: HttpRequest, dispatch_id: int, action: str
) -> HttpResponse:
    with transaction.atomic():
        dispatch = get_object_or_404(
            Dispatch.objects.select_for_update().select_related(
                "wip", "experiment_type"
            ),
            pk=dispatch_id,
        )
        # Special case: start auto-handles PENDING → DISPATCHED → RUNNING
        if action == "start" and dispatch.status == DispatchStatus.PENDING:
            dispatch.status = DispatchStatus.DISPATCHED
            dispatch.dispatched_at = timezone.now()
        try:
            target = validate_dispatch_transition(dispatch.status, action)
        except WIPInvalidTransitionError as e:
            return _action_error(
                request,
                str(e),
                redirect_url=f"/dispatches/{dispatch_id}/",
            )
        dispatch.status = target
        if action == "start" and not dispatch.dispatched_at:
            dispatch.dispatched_at = timezone.now()
        if action == "complete":
            dispatch.completed_at = timezone.now()
        dispatch.save()

        # Mirror the API: per-wafer verdict roll fires at unload time so
        # the legacy UI's Record Result modal can show the outcomes
        # before the operator finalises a comment.
        if action == "unload":
            update_experiment_statuses_on_unload(dispatch)
    return redirect("web:dispatch-detail", dispatch_id=dispatch_id)


@role_required("lab_staff", "lab_manager")
@require_POST
def dispatch_start(request: HttpRequest, dispatch_id: int) -> HttpResponse:
    return _dispatch_action(request, dispatch_id, "start")


@role_required("lab_staff", "lab_manager")
@require_POST
def dispatch_unload(request: HttpRequest, dispatch_id: int) -> HttpResponse:
    return _dispatch_action(request, dispatch_id, "unload")


@role_required("lab_staff", "lab_manager")
@require_POST
def dispatch_record_result(request: HttpRequest, dispatch_id: int) -> HttpResponse:
    """Record-result via the legacy Django-templated UI.

    Comment-only payload. Per-wafer verdicts were already rolled at
    unload (see _dispatch_action's unload branch) so this endpoint
    only persists the comment and finalises the dispatch.
    """
    comment = request.POST.get("comment", request.POST.get("note", "")).strip()

    with transaction.atomic():
        dispatch = get_object_or_404(
            Dispatch.objects.select_for_update().select_related(
                "wip", "experiment_type"
            ),
            pk=dispatch_id,
        )
        try:
            target = validate_dispatch_transition(dispatch.status, "record_result")
        except WIPInvalidTransitionError as e:
            return _action_error(
                request, str(e), redirect_url=f"/dispatches/{dispatch_id}/"
            )
        dispatch.status = target
        dispatch.completed_at = timezone.now()
        dispatch.save()
        ExperimentResult.objects.create(
            dispatch=dispatch,
            comment=comment,
            recorded_by=request.user,
        )
    return redirect("web:dispatch-detail", dispatch_id=dispatch_id)


@role_required("lab_staff", "lab_manager")
@require_POST
def dispatch_complete(request: HttpRequest, dispatch_id: int) -> HttpResponse:
    return dispatch_record_result(request, dispatch_id)


@role_required("lab_staff", "lab_manager")
@require_POST
def dispatch_report_exception(request: HttpRequest, dispatch_id: int) -> HttpResponse:
    note = request.POST.get("note", "").strip()
    with transaction.atomic():
        dispatch = get_object_or_404(
            Dispatch.objects.select_for_update(), pk=dispatch_id
        )
        try:
            target = validate_dispatch_transition(dispatch.status, "report_exception")
        except WIPInvalidTransitionError as e:
            return _action_error(
                request, str(e), redirect_url=f"/dispatches/{dispatch_id}/"
            )
        dispatch.status = target
        if note:
            dispatch.note = (dispatch.note + f"\n[Exception] {note}").strip()
        dispatch.save()
    return redirect("web:dispatch-detail", dispatch_id=dispatch_id)


@role_required("lab_staff", "lab_manager")
@require_POST
def dispatch_redispatch(request: HttpRequest, dispatch_id: int) -> HttpResponse:
    with transaction.atomic():
        old_dispatch = get_object_or_404(
            Dispatch.objects.select_for_update(), pk=dispatch_id
        )
        try:
            target = validate_dispatch_transition(old_dispatch.status, "redispatch")
        except WIPInvalidTransitionError as e:
            return _action_error(
                request, str(e), redirect_url=f"/dispatches/{dispatch_id}/"
            )
        old_dispatch.status = target
        old_dispatch.save()
        # Create a new dispatch with same parameters
        new_dispatch = Dispatch.objects.create(
            wip=old_dispatch.wip,
            experiment_type=old_dispatch.experiment_type,
            equipment=old_dispatch.equipment,
            recipe=old_dispatch.recipe,
            estimated_duration_seconds=old_dispatch.estimated_duration_seconds,
            note=f"Redispatch of #{old_dispatch.pk}",
            created_by=request.user,
        )
    return redirect("web:dispatch-detail", dispatch_id=new_dispatch.pk)


@role_required("lab_staff", "lab_manager")
@require_POST
def dispatch_abort(request: HttpRequest, dispatch_id: int) -> HttpResponse:
    return _dispatch_action(request, dispatch_id, "abort")


# ---------------------------------------------------------------------------
# LAB_MANAGER — Equipment management
# ---------------------------------------------------------------------------


@role_required("lab_staff", "lab_manager")
def equipment_list(request: HttpRequest) -> HttpResponse:
    qs = Equipment.objects.prefetch_related("capabilities").order_by("name")
    role = _user_role(request)
    return render(
        request,
        "web/equipment/list.html",
        {
            "title": "Equipment",
            "equipment_list": qs,
            "status_choices": EquipmentStatus.choices,
            "can_manage": role == Role.LAB_MANAGER,
        },
    )


@role_required("lab_manager")
def equipment_detail(request: HttpRequest, equipment_id: int) -> HttpResponse:
    equipment = get_object_or_404(
        Equipment.objects.prefetch_related(
            Prefetch(
                "capabilities",
                queryset=ExperimentType.objects.order_by("lab_category", "name"),
            ),
            Prefetch(
                "recipes",
                queryset=Recipe.objects.select_related("experiment_type").filter(
                    is_active=True
                ),
            ),
        ),
        pk=equipment_id,
    )
    all_exp_types = ExperimentType.objects.filter(is_active=True).order_by(
        "lab_category", "name"
    )
    capability_ids = set(equipment.capabilities.values_list("id", flat=True))
    return render(
        request,
        "web/equipment/detail.html",
        {
            "title": f"Equipment: {equipment.name}",
            "equipment": equipment,
            "all_exp_types": all_exp_types,
            "capability_ids": capability_ids,
            "status_choices": EquipmentStatus.choices,
        },
    )


@role_required("lab_manager")
def equipment_create(request: HttpRequest) -> HttpResponse:
    if request.method == "GET":
        exp_types = ExperimentType.objects.filter(is_active=True).order_by(
            "lab_category", "name"
        )
        return render(
            request,
            "web/equipment/create.html",
            {
                "title": "New Equipment",
                "exp_types": exp_types,
                "status_choices": EquipmentStatus.choices,
            },
        )
    name = request.POST.get("name", "").strip()
    model_name = request.POST.get("model_name", "").strip()
    capacity = request.POST.get("capacity", "1").strip()
    status = request.POST.get("status", EquipmentStatus.AVAILABLE)
    exp_type_ids = request.POST.getlist("exp_type_ids")

    errors = []
    if not name:
        errors.append("Name is required.")
    if not model_name:
        errors.append("Model name is required.")
    try:
        capacity_int = int(capacity)
        if capacity_int < 1:
            raise ValueError
    except (ValueError, TypeError):
        capacity_int = None
        errors.append("Capacity must be a positive integer.")

    if errors:
        exp_types = ExperimentType.objects.filter(is_active=True).order_by(
            "lab_category", "name"
        )
        return render(
            request,
            "web/equipment/create.html",
            {
                "title": "New Equipment",
                "exp_types": exp_types,
                "status_choices": EquipmentStatus.choices,
                "errors": errors,
            },
        )

    with transaction.atomic():
        equipment = Equipment.objects.create(
            name=name,
            model_name=model_name,
            capacity=capacity_int,
            status=status,
        )
        if exp_type_ids:
            for et_id in exp_type_ids:
                try:
                    et = ExperimentType.objects.get(pk=et_id, is_active=True)
                    EquipmentCapability.objects.create(
                        equipment=equipment, experiment_type=et
                    )
                except ExperimentType.DoesNotExist:
                    pass

    return redirect("web:equipment-detail", equipment_id=equipment.pk)


@role_required("lab_manager")
@require_POST
def equipment_update(request: HttpRequest, equipment_id: int) -> HttpResponse:
    equipment = get_object_or_404(Equipment, pk=equipment_id)
    name = request.POST.get("name", "").strip()
    model_name = request.POST.get("model_name", "").strip()
    capacity = request.POST.get("capacity", "").strip()
    status = request.POST.get("status", "").strip()

    if name:
        equipment.name = name
    if model_name:
        equipment.model_name = model_name
    if capacity:
        try:
            equipment.capacity = int(capacity)
        except ValueError:
            pass
    if status:
        equipment.status = status
    equipment.save()
    return redirect("web:equipment-detail", equipment_id=equipment_id)


@role_required("lab_manager")
@require_POST
def equipment_set_capabilities(request: HttpRequest, equipment_id: int) -> HttpResponse:
    equipment = get_object_or_404(Equipment, pk=equipment_id)
    exp_type_ids = request.POST.getlist("exp_type_ids")
    with transaction.atomic():
        EquipmentCapability.objects.filter(equipment=equipment).delete()
        for et_id in exp_type_ids:
            try:
                et = ExperimentType.objects.get(pk=et_id, is_active=True)
                EquipmentCapability.objects.create(
                    equipment=equipment, experiment_type=et
                )
            except ExperimentType.DoesNotExist:
                pass
    return redirect("web:equipment-detail", equipment_id=equipment_id)


# ---------------------------------------------------------------------------
# LAB_MANAGER — Recipe management
# ---------------------------------------------------------------------------


@role_required("lab_manager")
def recipes_list(request: HttpRequest) -> HttpResponse:
    qs = Recipe.objects.select_related("experiment_type").order_by(
        "experiment_type__name", "name"
    )
    exp_types_all = ExperimentType.objects.filter(is_active=True).order_by(
        "lab_category", "name"
    )
    return render(
        request,
        "web/recipes/list.html",
        {
            "title": "Recipes",
            "recipes": qs,
            "exp_types_all": exp_types_all,
        },
    )


@role_required("lab_manager")
@require_POST
def recipe_create(request: HttpRequest) -> HttpResponse:
    name = request.POST.get("name", "").strip()
    description = request.POST.get("description", "").strip()
    exp_type_id = request.POST.get("experiment_type_id", "").strip()
    params_raw = request.POST.get("parameters", "{}").strip()

    try:
        exp_type = ExperimentType.objects.get(pk=exp_type_id, is_active=True)
    except (ExperimentType.DoesNotExist, ValueError):
        return redirect("web:recipes")

    try:
        params = json.loads(params_raw) if params_raw else {}
    except json.JSONDecodeError:
        params = {}

    Recipe.objects.create(
        name=name,
        description=description,
        experiment_type=exp_type,
        parameters=params,
    )
    return redirect("web:recipes")


@role_required("lab_manager")
@require_POST
def recipe_update(request: HttpRequest, recipe_id: int) -> HttpResponse:
    recipe = get_object_or_404(Recipe, pk=recipe_id)
    name = request.POST.get("name", "").strip()
    description = request.POST.get("description", "").strip()
    params_raw = request.POST.get("parameters", "").strip()

    if name:
        recipe.name = name
    if description is not None:
        recipe.description = description
    if params_raw:
        try:
            recipe.parameters = json.loads(params_raw)
        except json.JSONDecodeError:
            pass
    recipe.save()
    return redirect("web:recipes")


@role_required("lab_manager")
@require_POST
def recipe_delete(request: HttpRequest, recipe_id: int) -> HttpResponse:
    recipe = get_object_or_404(Recipe, pk=recipe_id)
    recipe.is_active = False
    recipe.save()
    return redirect("web:recipes")


# ---------------------------------------------------------------------------
# LAB_MANAGER — Reports
# ---------------------------------------------------------------------------


@role_required("lab_manager")
def reports_index(request: HttpRequest) -> HttpResponse:
    return render(request, "web/reports/index.html", {"title": "Reports"})


@role_required("lab_manager")
def reports_utilization(request: HttpRequest) -> HttpResponse:
    period = request.GET.get("period", "custom")
    start_str = request.GET.get("start_date", "")
    end_str = request.GET.get("end_date", "")
    equipment_id = request.GET.get("equipment_id") or None

    try:
        start_date = date.fromisoformat(start_str)
        end_date = date.fromisoformat(end_str)
    except (ValueError, TypeError):
        return render(
            request,
            "web/reports/_utilization.html",
            {"error": "Invalid date range."},
        )

    dispatch_qs = Dispatch.objects.filter(
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    )
    if equipment_id:
        dispatch_qs = dispatch_qs.filter(equipment_id=equipment_id)

    aggregated = (
        dispatch_qs.values("equipment_id", "equipment__name")
        .annotate(
            wip_count=Count("id"),
            sample_count=Count("wip_id", distinct=True),
        )
        .order_by("equipment_id")
    )

    return render(
        request,
        "web/reports/_utilization.html",
        {
            "data": list(aggregated),
            "period": period,
            "start_date": start_date,
            "end_date": end_date,
        },
    )


@role_required("lab_manager")
def reports_statistics(request: HttpRequest) -> HttpResponse:
    start_str = request.GET.get("start_date", "")
    end_str = request.GET.get("end_date", "")

    try:
        start_date = date.fromisoformat(start_str)
        end_date = date.fromisoformat(end_str)
    except (ValueError, TypeError):
        return render(
            request,
            "web/reports/_statistics.html",
            {"error": "Invalid date range."},
        )

    base_qs = Request.objects.filter(
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    )
    total_requests = base_qs.count()
    status_rows = (
        base_qs.values("status")
        .annotate(count=Count("id"))
        .filter(count__gt=0)
        .order_by("status")
    )
    status_distribution = {row["status"]: row["count"] for row in status_rows}

    terminal_statuses = [RequestStatus.COMPLETED, RequestStatus.CLOSED]
    terminal_requests = list(
        base_qs.filter(status__in=terminal_statuses).values("created_at", "updated_at")
    )
    avg_tat_hours = None
    if terminal_requests:
        total_seconds = sum(
            (r["updated_at"] - r["created_at"]).total_seconds()
            for r in terminal_requests
        )
        avg_tat_hours = round(total_seconds / len(terminal_requests) / 3600, 1)

    return render(
        request,
        "web/reports/_statistics.html",
        {
            "status_distribution": status_distribution,
            "avg_tat_hours": avg_tat_hours,
            "total_requests": total_requests,
            "start_date": start_date,
            "end_date": end_date,
        },
    )


# ---------------------------------------------------------------------------
# Shared error handler
# ---------------------------------------------------------------------------


def _action_error(
    request: HttpRequest, message: str, redirect_url: str = "/"
) -> HttpResponse:
    """Return a simple error page or HTMX error response."""
    if _is_htmx(request):
        return HttpResponse(
            f'<div class="text-red-600 text-sm p-2">{message}</div>',
            status=400,
        )
    return render(
        request,
        "web/error.html",
        {"message": message, "redirect_url": redirect_url},
        status=400,
    )
