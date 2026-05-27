"""API tests for the reports app (equipment utilization and request statistics)."""

import pytest
from django.test import Client

from apps.accounts.factories import FabUserFactory, LabManagerFactory, LabStaffFactory
from apps.commissions.factories import RequestFactory
from apps.commissions.models import RequestStatus
from apps.equipment.factories import EquipmentFactory
from apps.wip.factories import DispatchFactory, WIPFactory
from apps.wip.models import DispatchStatus


@pytest.fixture
def client():
    return Client()


@pytest.fixture
def auth_headers():
    """Return a factory function that creates JWT Bearer auth headers."""
    from apps.accounts.auth import create_access_token

    def _make_headers(user) -> dict[str, str]:
        token = create_access_token(user.pk)
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    return _make_headers


@pytest.fixture
def fab_user():
    profile = FabUserFactory()
    return profile.user


@pytest.fixture
def lab_staff():
    profile = LabStaffFactory()
    return profile.user


@pytest.fixture
def lab_manager():
    profile = LabManagerFactory()
    return profile.user


# =============================================================================
# Equipment Utilization tests
# =============================================================================


@pytest.mark.django_db
class TestEquipmentUtilization:
    """Tests for GET /api/reports/equipment-utilization."""

    URL = "/api/reports/equipment-utilization"

    def test_lab_manager_can_access(self, client, auth_headers, lab_manager):
        """Lab manager can access the endpoint and get valid utilization data."""
        equipment = EquipmentFactory()
        wip = WIPFactory()
        DispatchFactory(wip=wip, equipment=equipment, status=DispatchStatus.COMPLETED)
        DispatchFactory(wip=wip, equipment=equipment, status=DispatchStatus.COMPLETED)

        params = "?period=week&start_date=2000-01-01&end_date=2099-12-31"
        resp = client.get(
            self.URL + params,
            **auth_headers(lab_manager),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["period"] == "week"
        assert data["start_date"] == "2000-01-01"
        assert data["end_date"] == "2099-12-31"
        assert isinstance(data["data"], list)

        # Find the equipment entry
        entry = next(
            (e for e in data["data"] if e["equipment"]["id"] == equipment.pk), None
        )
        assert entry is not None
        assert entry["equipment"]["name"] == equipment.name
        assert entry["wip_count"] == 2

    def test_fab_user_forbidden(self, client, auth_headers, fab_user):
        """Non-lab-manager users receive a 403 response."""
        params = "?period=day&start_date=2026-01-01&end_date=2026-01-31"
        resp = client.get(
            self.URL + params,
            **auth_headers(fab_user),
        )
        assert resp.status_code == 403

    def test_lab_staff_forbidden(self, client, auth_headers, lab_staff):
        """Lab staff (non-manager) users receive a 403 response."""
        params = "?period=day&start_date=2026-01-01&end_date=2026-01-31"
        resp = client.get(
            self.URL + params,
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 403

    def test_filter_by_equipment_id(self, client, auth_headers, lab_manager):
        """Filtering by equipment_id returns only data for that equipment."""
        equipment_a = EquipmentFactory()
        equipment_b = EquipmentFactory()

        wip_a = WIPFactory()
        wip_b = WIPFactory()
        DispatchFactory(
            wip=wip_a, equipment=equipment_a, status=DispatchStatus.COMPLETED
        )
        DispatchFactory(
            wip=wip_b, equipment=equipment_b, status=DispatchStatus.COMPLETED
        )

        params = (
            f"?period=month&start_date=2000-01-01&end_date=2099-12-31"
            f"&equipment_id={equipment_a.pk}"
        )
        resp = client.get(
            self.URL + params,
            **auth_headers(lab_manager),
        )

        assert resp.status_code == 200
        data = resp.json()
        equipment_ids = [e["equipment"]["id"] for e in data["data"]]
        assert equipment_a.pk in equipment_ids
        assert equipment_b.pk not in equipment_ids

    def test_empty_data(self, client, auth_headers, lab_manager):
        """When no dispatches exist in the date range, data array is empty."""
        params = "?period=day&start_date=1990-01-01&end_date=1990-01-02"
        resp = client.get(
            self.URL + params,
            **auth_headers(lab_manager),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["data"] == []

    def test_sample_count_counts_distinct_wips(self, client, auth_headers, lab_manager):
        """sample_count reflects the number of distinct WIPs (each WIP = 1 sample)."""
        equipment = EquipmentFactory()
        wip_a = WIPFactory()
        wip_b = WIPFactory()
        # Two dispatches on the same WIP — should count as 1 unique WIP/sample
        DispatchFactory(wip=wip_a, equipment=equipment, status=DispatchStatus.COMPLETED)
        DispatchFactory(wip=wip_a, equipment=equipment, status=DispatchStatus.COMPLETED)
        # One dispatch on a different WIP
        DispatchFactory(wip=wip_b, equipment=equipment, status=DispatchStatus.COMPLETED)

        params = "?period=week&start_date=2000-01-01&end_date=2099-12-31"
        resp = client.get(
            self.URL + params,
            **auth_headers(lab_manager),
        )

        assert resp.status_code == 200
        entry = next(
            e for e in resp.json()["data"] if e["equipment"]["id"] == equipment.pk
        )
        assert entry["wip_count"] == 3
        assert entry["sample_count"] == 2

    def test_unauthenticated_returns_401(self, client):
        """Unauthenticated request returns 401."""
        params = "?period=day&start_date=2026-01-01&end_date=2026-01-31"
        resp = client.get(self.URL + params)
        assert resp.status_code == 401


# =============================================================================
# Request Statistics tests
# =============================================================================


@pytest.mark.django_db
class TestRequestStatistics:
    """Tests for GET /api/reports/request-statistics."""

    URL = "/api/reports/request-statistics"

    def test_lab_manager_can_access(self, client, auth_headers, lab_manager):
        """Lab manager can access the endpoint and get valid statistics."""
        RequestFactory(status=RequestStatus.DRAFT)
        RequestFactory(status=RequestStatus.DRAFT)
        RequestFactory(status=RequestStatus.IN_PROGRESS)

        params = "?start_date=2000-01-01&end_date=2099-12-31"
        resp = client.get(
            self.URL + params,
            **auth_headers(lab_manager),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["period"]["start_date"] == "2000-01-01"
        assert data["period"]["end_date"] == "2099-12-31"
        assert isinstance(data["status_distribution"], dict)
        assert isinstance(data["total_requests"], int)
        # draft and in_progress should appear
        assert data["status_distribution"].get("draft", 0) >= 2
        assert data["status_distribution"].get("in_progress", 0) >= 1
        assert data["total_requests"] >= 3

    def test_fab_user_forbidden(self, client, auth_headers, fab_user):
        """Non-lab-manager users receive a 403 response."""
        params = "?start_date=2026-01-01&end_date=2026-01-31"
        resp = client.get(
            self.URL + params,
            **auth_headers(fab_user),
        )
        assert resp.status_code == 403

    def test_lab_staff_forbidden(self, client, auth_headers, lab_staff):
        """Lab staff (non-manager) users receive a 403 response."""
        params = "?start_date=2026-01-01&end_date=2026-01-31"
        resp = client.get(
            self.URL + params,
            **auth_headers(lab_staff),
        )
        assert resp.status_code == 403

    def test_average_tat_hours(self, client, auth_headers, lab_manager):
        """average_tat_hours is computed for completed/closed requests."""
        # Create completed and closed requests; TAT will be computed from
        # created_at to updated_at.
        r1 = RequestFactory(status=RequestStatus.COMPLETED)
        r2 = RequestFactory(status=RequestStatus.CLOSED)
        # Manually push updated_at ahead using update() to bypass auto_now
        from datetime import timedelta

        from apps.commissions.models import Request

        Request.objects.filter(pk=r1.pk).update(
            updated_at=r1.created_at + timedelta(hours=10)
        )
        Request.objects.filter(pk=r2.pk).update(
            updated_at=r2.created_at + timedelta(hours=20)
        )

        params = "?start_date=2000-01-01&end_date=2099-12-31"
        resp = client.get(
            self.URL + params,
            **auth_headers(lab_manager),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["average_tat_hours"] is not None
        # The average should be between 10 and 20 (inclusive of both requests)
        assert 10.0 <= data["average_tat_hours"] <= 20.0

    def test_empty_data(self, client, auth_headers, lab_manager):
        """When no requests exist in the date range, totals are zero and tat is null."""
        params = "?start_date=1990-01-01&end_date=1990-01-02"
        resp = client.get(
            self.URL + params,
            **auth_headers(lab_manager),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["total_requests"] == 0
        assert data["status_distribution"] == {}
        assert data["average_tat_hours"] is None

    def test_status_distribution_only_includes_nonzero(
        self, client, auth_headers, lab_manager
    ):
        """status_distribution only includes statuses with at least one request."""
        RequestFactory(status=RequestStatus.DRAFT)

        params = "?start_date=2000-01-01&end_date=2099-12-31"
        resp = client.get(
            self.URL + params,
            **auth_headers(lab_manager),
        )

        assert resp.status_code == 200
        data = resp.json()
        # All values must be > 0
        for status, count in data["status_distribution"].items():
            assert count > 0, f"Status {status!r} has zero count in distribution"

    def test_unauthenticated_returns_401(self, client):
        """Unauthenticated request returns 401."""
        params = "?start_date=2026-01-01&end_date=2026-01-31"
        resp = client.get(self.URL + params)
        assert resp.status_code == 401


# =============================================================================
# Trends tests
# =============================================================================


@pytest.mark.django_db
class TestTrends:
    """Tests for GET /api/reports/trends — INTEGRATION_GAPS §4."""

    URL = "/api/reports/trends"

    def test_requests_per_day_counts_today(self, client, auth_headers, lab_manager):
        """A request created today shows up in today's bucket."""
        RequestFactory()
        RequestFactory()

        resp = client.get(
            self.URL + "?metric=requests_per_day&days=7",
            **auth_headers(lab_manager),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["metric"] == "requests_per_day"
        assert data["days"] == 7
        assert len(data["points"]) == 7

        from datetime import date

        today_iso = date.today().isoformat()
        today_point = next(p for p in data["points"] if p["date"] == today_iso)
        assert today_point["count"] == 2

    def test_zero_filled_for_days_with_no_data(self, client, auth_headers, lab_manager):
        """Days without any request return count=0 (not omitted), so the
        SPA can plot a continuous series without client-side gap filling."""
        resp = client.get(
            self.URL + "?metric=requests_per_day&days=5",
            **auth_headers(lab_manager),
        )
        assert resp.status_code == 200
        points = resp.json()["points"]
        assert len(points) == 5
        assert all(p["count"] == 0 for p in points)
        # Dates returned in ascending order, ending today.
        from datetime import date

        assert points[-1]["date"] == date.today().isoformat()

    def test_defaults_to_30_days(self, client, auth_headers, lab_manager):
        """Omitting the days param defaults to 30."""
        resp = client.get(
            self.URL + "?metric=requests_per_day",
            **auth_headers(lab_manager),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["days"] == 30
        assert len(data["points"]) == 30

    def test_unknown_metric_returns_400(self, client, auth_headers, lab_manager):
        resp = client.get(self.URL + "?metric=bogus", **auth_headers(lab_manager))
        assert resp.status_code == 400

    def test_lab_staff_forbidden(self, client, auth_headers, lab_staff):
        resp = client.get(
            self.URL + "?metric=requests_per_day", **auth_headers(lab_staff)
        )
        assert resp.status_code == 403

    def test_fab_user_forbidden(self, client, auth_headers, fab_user):
        resp = client.get(
            self.URL + "?metric=requests_per_day", **auth_headers(fab_user)
        )
        assert resp.status_code == 403

    def test_unauthenticated_returns_401(self, client):
        resp = client.get(self.URL + "?metric=requests_per_day")
        assert resp.status_code == 401
