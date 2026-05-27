"""Admin view tests for the reports app (equipment utilization, request statistics)."""

from datetime import date, timedelta

import pytest
from django.contrib.auth.models import User
from django.urls import reverse

from apps.commissions.factories import RequestFactory
from apps.equipment.factories import EquipmentFactory
from apps.wip.factories import DispatchFactory, WIPFactory


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(
        username="admin_test", password="password", email="admin@test.com"
    )


@pytest.fixture
def admin_client(client, superuser):
    client.force_login(superuser)
    return client


@pytest.mark.django_db
class TestEquipmentUtilizationAdmin:
    def test_page_loads_without_params(self, admin_client):
        url = reverse("admin:reports_equipmentutilizationreport_changelist")
        response = admin_client.get(url)
        assert response.status_code == 200

    def test_page_contains_title(self, admin_client):
        url = reverse("admin:reports_equipmentutilizationreport_changelist")
        response = admin_client.get(url)
        assert b"Equipment Utilization" in response.content

    def test_query_with_date_range_shows_rows_in_context(self, admin_client):
        url = reverse("admin:reports_equipmentutilizationreport_changelist")
        start = (date.today() - timedelta(days=30)).isoformat()
        end = date.today().isoformat()
        response = admin_client.get(url, {"start_date": start, "end_date": end})
        assert response.status_code == 200
        assert "rows" in response.context

    def test_query_aggregates_dispatch_data(self, admin_client):
        equipment = EquipmentFactory()
        wip = WIPFactory()
        DispatchFactory(wip=wip, equipment=equipment)
        url = reverse("admin:reports_equipmentutilizationreport_changelist")
        start = (date.today() - timedelta(days=1)).isoformat()
        end = date.today().isoformat()
        response = admin_client.get(url, {"start_date": start, "end_date": end})
        rows = response.context["rows"]
        assert len(rows) == 1
        assert rows[0]["equipment__name"] == equipment.name
        assert rows[0]["wip_count"] == 1

    def test_equipment_filter_narrows_results(self, admin_client):
        eq1 = EquipmentFactory()
        eq2 = EquipmentFactory()
        wip1 = WIPFactory()
        wip2 = WIPFactory()
        DispatchFactory(wip=wip1, equipment=eq1)
        DispatchFactory(wip=wip2, equipment=eq2)
        url = reverse("admin:reports_equipmentutilizationreport_changelist")
        start = (date.today() - timedelta(days=1)).isoformat()
        end = date.today().isoformat()
        response = admin_client.get(
            url, {"start_date": start, "end_date": end, "equipment": eq1.pk}
        )
        rows = response.context["rows"]
        assert len(rows) == 1
        assert rows[0]["equipment_id"] == eq1.pk

    def test_requires_login(self, client):
        url = reverse("admin:reports_equipmentutilizationreport_changelist")
        response = client.get(url)
        assert response.status_code == 302

    def test_no_add_permission(self, admin_client):
        url = reverse("admin:reports_equipmentutilizationreport_add")
        response = admin_client.get(url)
        assert response.status_code == 403


@pytest.mark.django_db
class TestRequestStatisticsAdmin:
    def test_page_loads_without_params(self, admin_client):
        url = reverse("admin:reports_requeststatisticsreport_changelist")
        response = admin_client.get(url)
        assert response.status_code == 200

    def test_page_contains_title(self, admin_client):
        url = reverse("admin:reports_requeststatisticsreport_changelist")
        response = admin_client.get(url)
        assert b"Request Statistics" in response.content

    def test_query_with_date_range_shows_stats_in_context(self, admin_client):
        url = reverse("admin:reports_requeststatisticsreport_changelist")
        start = (date.today() - timedelta(days=30)).isoformat()
        end = date.today().isoformat()
        response = admin_client.get(url, {"start_date": start, "end_date": end})
        assert response.status_code == 200
        assert "stats" in response.context
        assert response.context["stats"] is not None

    def test_query_counts_requests(self, admin_client):
        RequestFactory()
        RequestFactory()
        url = reverse("admin:reports_requeststatisticsreport_changelist")
        start = (date.today() - timedelta(days=1)).isoformat()
        end = date.today().isoformat()
        response = admin_client.get(url, {"start_date": start, "end_date": end})
        stats = response.context["stats"]
        assert stats["total"] == 2

    def test_query_shows_status_distribution(self, admin_client):
        RequestFactory()
        url = reverse("admin:reports_requeststatisticsreport_changelist")
        start = (date.today() - timedelta(days=1)).isoformat()
        end = date.today().isoformat()
        response = admin_client.get(url, {"start_date": start, "end_date": end})
        stats = response.context["stats"]
        assert len(stats["status_distribution"]) > 0

    def test_no_data_in_range_returns_zero_total(self, admin_client):
        url = reverse("admin:reports_requeststatisticsreport_changelist")
        # use a date range far in the future
        start = "2099-01-01"
        end = "2099-01-31"
        response = admin_client.get(url, {"start_date": start, "end_date": end})
        stats = response.context["stats"]
        assert stats["total"] == 0
        assert stats["avg_tat_hours"] is None

    def test_requires_login(self, client):
        url = reverse("admin:reports_requeststatisticsreport_changelist")
        response = client.get(url)
        assert response.status_code == 302

    def test_no_add_permission(self, admin_client):
        url = reverse("admin:reports_requeststatisticsreport_add")
        response = admin_client.get(url)
        assert response.status_code == 403
