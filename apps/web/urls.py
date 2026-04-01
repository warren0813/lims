"""URL routes for the LIMS web frontend."""

from django.urls import path

from apps.web import views

app_name = "web"

urlpatterns = [
    # ── Auth ──────────────────────────────────────────────────────────────
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("dashboard/", views.dashboard_view, name="dashboard"),
    # Redirect root to login
    path("", views.login_view, name="root"),
    # ── Multi-account ──────────────────────────────────────────────────────
    path("accounts/add/", views.add_account_view, name="account-add"),
    path(
        "accounts/switch/<int:user_id>/",
        views.switch_account_view,
        name="account-switch",
    ),
    path(
        "accounts/remove/<int:user_id>/",
        views.remove_account_view,
        name="account-remove",
    ),
    # ── FAB_USER: commission requests ──────────────────────────────────────
    path("requests/", views.my_requests_list, name="my-requests"),
    path("requests/new/", views.request_create, name="request-create"),
    path("requests/<int:request_id>/", views.request_detail, name="request-detail"),
    path(
        "requests/<int:request_id>/submit/", views.request_submit, name="request-submit"
    ),
    path("requests/<int:request_id>/ship/", views.request_ship, name="request-ship"),
    path(
        "requests/<int:request_id>/cancel/",
        views.request_cancel_fab,
        name="request-cancel",
    ),
    # ── LAB_MANAGER: request approval ─────────────────────────────────────
    path("requests/all/", views.all_requests_list, name="all-requests"),
    path(
        "requests/all/<int:request_id>/",
        views.manager_request_detail,
        name="manager-request-detail",
    ),
    path(
        "requests/all/<int:request_id>/approve/",
        views.request_approve,
        name="request-approve",
    ),
    path(
        "requests/all/<int:request_id>/return/",
        views.request_return,
        name="request-return",
    ),
    path(
        "requests/all/<int:request_id>/reject/",
        views.request_reject,
        name="request-reject",
    ),
    path(
        "requests/all/<int:request_id>/close/",
        views.request_close,
        name="request-close",
    ),
    path(
        "requests/all/<int:request_id>/cancel/",
        views.request_cancel_manager,
        name="request-cancel-manager",
    ),
    # ── LAB_STAFF: samples ─────────────────────────────────────────────────
    path("samples/", views.samples_list, name="samples"),
    path(
        "samples/<int:sample_id>/receive/", views.sample_receive, name="sample-receive"
    ),
    path(
        "samples/<int:sample_id>/reject-receiving/",
        views.sample_reject_receiving,
        name="sample-reject-receiving",
    ),
    path(
        "samples/<int:sample_id>/report-lost/",
        views.sample_report_lost,
        name="sample-report-lost",
    ),
    path("samples/<int:sample_id>/void/", views.sample_void, name="sample-void"),
    path("samples/<int:sample_id>/return/", views.sample_return, name="sample-return"),
    # ── LAB_STAFF: WIP ────────────────────────────────────────────────────
    path("wips/", views.wips_list, name="wips"),
    path("wips/create/", views.wip_create, name="wip-create"),
    path("wips/<int:wip_id>/", views.wip_detail, name="wip-detail"),
    path("wips/<int:wip_id>/complete/", views.wip_complete, name="wip-complete"),
    path("wips/<int:wip_id>/abort/", views.wip_abort, name="wip-abort"),
    path(
        "wips/<int:wip_id>/dispatches/create/",
        views.dispatch_create,
        name="dispatch-create",
    ),
    # ── LAB_STAFF: dispatches ─────────────────────────────────────────────
    path("dispatches/", views.dispatches_list, name="dispatches"),
    path(
        "dispatches/<int:dispatch_id>/", views.dispatch_detail, name="dispatch-detail"
    ),
    path(
        "dispatches/<int:dispatch_id>/start/",
        views.dispatch_start,
        name="dispatch-start",
    ),
    path(
        "dispatches/<int:dispatch_id>/unload/",
        views.dispatch_unload,
        name="dispatch-unload",
    ),
    path(
        "dispatches/<int:dispatch_id>/record-result/",
        views.dispatch_record_result,
        name="dispatch-record-result",
    ),
    path(
        "dispatches/<int:dispatch_id>/complete/",
        views.dispatch_complete,
        name="dispatch-complete",
    ),
    path(
        "dispatches/<int:dispatch_id>/report-exception/",
        views.dispatch_report_exception,
        name="dispatch-report-exception",
    ),
    path(
        "dispatches/<int:dispatch_id>/redispatch/",
        views.dispatch_redispatch,
        name="dispatch-redispatch",
    ),
    path(
        "dispatches/<int:dispatch_id>/abort/",
        views.dispatch_abort,
        name="dispatch-abort",
    ),
    # ── Dashboard chart partials (HTMX) ──────────────────────────────────
    path(
        "dashboard/charts/tat/",
        views.dashboard_chart_tat,
        name="dashboard-chart-tat",
    ),
    path(
        "dashboard/charts/workload/",
        views.dashboard_chart_workload,
        name="dashboard-chart-workload",
    ),
    path(
        "dashboard/charts/capacity/",
        views.dashboard_chart_capacity,
        name="dashboard-chart-capacity",
    ),
    # ── HTMX helpers ──────────────────────────────────────────────────────
    path("htmx/recipes/", views.recipes_for_equipment, name="htmx-recipes"),
    # ── LAB_STAFF/MANAGER: equipment ──────────────────────────────────────
    path("equipment/", views.equipment_list, name="equipment"),
    path("equipment/new/", views.equipment_create, name="equipment-create"),
    path(
        "equipment/<int:equipment_id>/", views.equipment_detail, name="equipment-detail"
    ),
    path(
        "equipment/<int:equipment_id>/update/",
        views.equipment_update,
        name="equipment-update",
    ),
    path(
        "equipment/<int:equipment_id>/capabilities/",
        views.equipment_set_capabilities,
        name="equipment-capabilities",
    ),
    # ── LAB_MANAGER: recipes ──────────────────────────────────────────────
    path("recipes/", views.recipes_list, name="recipes"),
    path("recipes/create/", views.recipe_create, name="recipe-create"),
    path("recipes/<int:recipe_id>/update/", views.recipe_update, name="recipe-update"),
    path("recipes/<int:recipe_id>/delete/", views.recipe_delete, name="recipe-delete"),
    # ── LAB_MANAGER: reports ──────────────────────────────────────────────
    path("reports/", views.reports_index, name="reports"),
    path("reports/utilization/", views.reports_utilization, name="reports-utilization"),
    path("reports/statistics/", views.reports_statistics, name="reports-statistics"),
]
