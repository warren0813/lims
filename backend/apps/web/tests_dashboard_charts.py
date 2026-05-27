"""Tests for role-based dashboard line chart endpoints."""

import json
from datetime import date, timedelta

import pytest
from django.test import Client
from django.utils import timezone

from apps.accounts.factories import FabUserFactory, LabManagerFactory, LabStaffFactory
from apps.commissions.factories import RequestFactory
from apps.commissions.models import RequestStatus
from apps.equipment.factories import EquipmentFactory, RecipeFactory
from apps.wip.factories import DispatchFactory, WIPFactory
from apps.wip.models import DispatchStatus, WIPStatus

# ---------------------------------------------------------------------------
# Fab User — TAT Chart
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestFabUserTATChart:
    URL = "/dashboard/charts/tat/"

    def test_unauthenticated_redirects_to_login(self):
        c = Client()
        response = c.get(self.URL)
        assert response.status_code == 302
        assert "/login/" in response["Location"]

    def test_wrong_role_returns_403(self):
        profile = LabStaffFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        assert response.status_code == 403

    def test_returns_200_with_valid_dates(self):
        profile = FabUserFactory()
        c = Client()
        c.force_login(profile.user)
        today = date.today()
        start = (today - timedelta(days=13)).isoformat()
        end = today.isoformat()
        response = c.get(self.URL, {"start_date": start, "end_date": end})
        assert response.status_code == 200

    def test_response_contains_canvas_element(self):
        profile = FabUserFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        assert b'id="tat-chart-canvas"' in response.content

    def test_response_contains_json_data_script(self):
        profile = FabUserFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        assert b'id="tat-chart-data"' in response.content

    def test_defaults_to_14_day_range(self):
        profile = FabUserFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        assert response.status_code == 200
        content = response.content.decode()
        data = _extract_chart_json(content, "tat-chart-data")
        assert len(data["labels"]) == 14

    def test_filters_only_own_requests(self):
        today = date.today()
        profile = FabUserFactory()
        other_profile = FabUserFactory()

        # Own completed request today
        req_own = RequestFactory(
            requester=profile.user,
            status=RequestStatus.COMPLETED,
        )
        req_own.created_at = timezone.now() - timedelta(hours=2)
        req_own.completed_at = timezone.now()
        req_own.save()

        # Other user's completed request — should NOT appear
        req_other = RequestFactory(
            requester=other_profile.user,
            status=RequestStatus.COMPLETED,
        )
        req_other.created_at = timezone.now() - timedelta(hours=2)
        req_other.completed_at = timezone.now()
        req_other.save()

        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        content = response.content.decode()
        data = _extract_chart_json(content, "tat-chart-data")

        today_str = today.isoformat()
        today_index = data["labels"].index(today_str)
        # Only own request's TAT should be counted (~2h), not the average of two
        assert data["values"][today_index] is not None

    def test_computes_avg_tat_per_day(self):
        today = date.today()
        profile = FabUserFactory()

        # Two completed requests with known TAT
        for hours in [2, 4]:
            req = RequestFactory(
                requester=profile.user,
                status=RequestStatus.COMPLETED,
            )
            req.created_at = timezone.now() - timedelta(hours=hours)
            req.completed_at = timezone.now()
            req.save()

        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        content = response.content.decode()
        data = _extract_chart_json(content, "tat-chart-data")

        today_str = today.isoformat()
        today_index = data["labels"].index(today_str)
        avg = data["values"][today_index]
        # Average of 2h and 4h = 3h (allow 0.5h tolerance for timing)
        assert avg is not None
        assert 2.0 <= avg <= 4.5

    def test_invalid_dates_still_returns_200(self):
        profile = FabUserFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL, {"start_date": "not-a-date", "end_date": "bad"})
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Lab Staff — Workload Chart
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestLabStaffWorkloadChart:
    URL = "/dashboard/charts/workload/"

    def test_unauthenticated_redirects_to_login(self):
        c = Client()
        response = c.get(self.URL)
        assert response.status_code == 302
        assert "/login/" in response["Location"]

    def test_fab_user_returns_403(self):
        profile = FabUserFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        assert response.status_code == 403

    def test_returns_200(self):
        profile = LabStaffFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        assert response.status_code == 200

    def test_response_contains_canvas_element(self):
        profile = LabStaffFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        assert b'id="workload-chart-canvas"' in response.content

    def test_response_contains_json_data_script(self):
        profile = LabStaffFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        assert b'id="workload-chart-data"' in response.content

    def test_defaults_to_14_day_range(self):
        profile = LabStaffFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        content = response.content.decode()
        data = _extract_chart_json(content, "workload-chart-data")
        assert len(data["labels"]) == 14

    def test_new_wips_counted_per_day(self):
        today = date.today()
        profile = LabStaffFactory()

        # Create 3 WIPs today
        for _ in range(3):
            WIPFactory()

        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        content = response.content.decode()
        data = _extract_chart_json(content, "workload-chart-data")

        today_str = today.isoformat()
        today_index = data["labels"].index(today_str)
        assert data["new_wips"][today_index] == 3

    def test_completed_wips_counted_per_day(self):
        today = date.today()
        profile = LabStaffFactory()

        # Create 2 completed WIPs with completed_at = today
        for _ in range(2):
            wip = WIPFactory(status=WIPStatus.COMPLETED)
            wip.completed_at = timezone.now()
            wip.save()

        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        content = response.content.decode()
        data = _extract_chart_json(content, "workload-chart-data")

        today_str = today.isoformat()
        today_index = data["labels"].index(today_str)
        assert data["completed_wips"][today_index] == 2

    def test_invalid_dates_still_returns_200(self):
        profile = LabStaffFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL, {"start_date": "bad", "end_date": "bad"})
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Lab Manager — Capacity Chart
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestLabManagerCapacityChart:
    URL = "/dashboard/charts/capacity/"

    def test_unauthenticated_redirects_to_login(self):
        c = Client()
        response = c.get(self.URL)
        assert response.status_code == 302
        assert "/login/" in response["Location"]

    def test_lab_staff_returns_403(self):
        profile = LabStaffFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        assert response.status_code == 403

    def test_returns_200(self):
        profile = LabManagerFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        assert response.status_code == 200

    def test_response_contains_canvas_element(self):
        profile = LabManagerFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        assert b'id="capacity-chart-canvas"' in response.content

    def test_response_contains_json_data_script(self):
        profile = LabManagerFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        assert b'id="capacity-chart-data"' in response.content

    def test_defaults_to_14_day_range(self):
        profile = LabManagerFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        content = response.content.decode()
        data = _extract_chart_json(content, "capacity-chart-data")
        assert len(data["labels"]) == 14

    def test_throughput_counted_per_day(self):
        today = date.today()
        profile = LabManagerFactory()

        # 2 dispatches with dispatched_at = today
        for _ in range(2):
            d = DispatchFactory(status=DispatchStatus.DISPATCHED)
            d.dispatched_at = timezone.now()
            d.save()

        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        content = response.content.decode()
        data = _extract_chart_json(content, "capacity-chart-data")

        today_str = today.isoformat()
        today_index = data["labels"].index(today_str)
        assert data["throughput"][today_index] == 2

    def test_utilization_pct_computed(self):
        today = date.today()
        profile = LabManagerFactory()

        # 2 equipment total, 1 used today
        eq1 = EquipmentFactory()
        EquipmentFactory()  # unused
        # Use a recipe tied to eq1 so DispatchFactory doesn't create a 3rd equipment
        recipe = RecipeFactory()
        wip = WIPFactory()
        d = DispatchFactory(
            status=DispatchStatus.DISPATCHED, wip=wip, equipment=eq1, recipe=recipe
        )
        d.dispatched_at = timezone.now()
        d.save()

        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL)
        content = response.content.decode()
        data = _extract_chart_json(content, "capacity-chart-data")

        today_str = today.isoformat()
        today_index = data["labels"].index(today_str)
        # 1 out of 2 equipment used = 50%
        assert data["utilization_pct"][today_index] == 50.0

    def test_invalid_dates_still_returns_200(self):
        profile = LabManagerFactory()
        c = Client()
        c.force_login(profile.user)
        response = c.get(self.URL, {"start_date": "bad", "end_date": "bad"})
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_chart_json(html: str, script_id: str) -> dict:
    """Extract and parse the JSON embedded in a <script type="application/json"> tag."""
    import re

    pattern = rf'<script[^>]*id="{script_id}"[^>]*>(.*?)</script>'
    match = re.search(pattern, html, re.DOTALL)
    assert match, f"Could not find script tag with id={script_id!r}"
    return json.loads(match.group(1).strip())
