"""Tests for Request and Sample state machine transitions."""

import pytest

from apps.commissions.models import RequestStatus, SampleStatus
from apps.commissions.state_machine import (
    InvalidTransitionError,
    validate_request_transition,
    validate_sample_transition,
)


class TestRequestStateMachine:
    """Test Request state transition validation."""

    # --- Legal transitions ---

    @pytest.mark.parametrize(
        "source,action,expected",
        [
            (RequestStatus.DRAFT, "submit", RequestStatus.PENDING_APPROVAL),
            (RequestStatus.RETURNED, "submit", RequestStatus.PENDING_APPROVAL),
            (RequestStatus.PENDING_APPROVAL, "approve", RequestStatus.APPROVED),
            (RequestStatus.PENDING_APPROVAL, "return", RequestStatus.RETURNED),
            (RequestStatus.PENDING_APPROVAL, "reject", RequestStatus.REJECTED),
            (RequestStatus.APPROVED, "ship", RequestStatus.SAMPLE_SHIPPED),
            (RequestStatus.COMPLETED, "close", RequestStatus.CLOSED),
        ],
    )
    def test_legal_transition(self, source, action, expected):
        """Legal transitions return the correct target status."""
        assert validate_request_transition(source, action) == expected

    @pytest.mark.parametrize(
        "source",
        [
            RequestStatus.DRAFT,
            RequestStatus.PENDING_APPROVAL,
            RequestStatus.APPROVED,
            RequestStatus.RETURNED,
            RequestStatus.SAMPLE_SHIPPED,
            RequestStatus.IN_PROGRESS,
        ],
    )
    def test_cancel_from_allowed_statuses(self, source):
        """Cancel is allowed from draft through in_progress."""
        assert validate_request_transition(source, "cancel") == RequestStatus.CANCELLED

    # --- Illegal transitions ---

    @pytest.mark.parametrize(
        "source,action",
        [
            (RequestStatus.DRAFT, "approve"),
            (RequestStatus.DRAFT, "ship"),
            (RequestStatus.DRAFT, "close"),
            (RequestStatus.PENDING_APPROVAL, "ship"),
            (RequestStatus.APPROVED, "approve"),
            (RequestStatus.APPROVED, "submit"),
            (RequestStatus.REJECTED, "submit"),
            (RequestStatus.REJECTED, "approve"),
            (RequestStatus.COMPLETED, "submit"),
            (RequestStatus.CLOSED, "cancel"),
            (RequestStatus.CANCELLED, "submit"),
            (RequestStatus.CANCELLED, "cancel"),
        ],
    )
    def test_illegal_transition_raises(self, source, action):
        """Illegal transitions raise InvalidTransitionError."""
        with pytest.raises(InvalidTransitionError) as exc_info:
            validate_request_transition(source, action)
        assert source in str(exc_info.value)
        assert action in str(exc_info.value)

    def test_unknown_action_raises(self):
        """Unknown action raises InvalidTransitionError."""
        with pytest.raises(InvalidTransitionError):
            validate_request_transition(RequestStatus.DRAFT, "fly_to_moon")


class TestSampleStateMachine:
    """Test Sample state transition validation."""

    # --- Legal transitions ---

    @pytest.mark.parametrize(
        "source,action,expected",
        [
            (SampleStatus.CREATED, "ship", SampleStatus.SHIPPED),
            (SampleStatus.SHIPPED, "receive", SampleStatus.RECEIVED),
            (
                SampleStatus.SHIPPED,
                "reject_receiving",
                SampleStatus.RECEIVING_EXCEPTION,
            ),
            (SampleStatus.SHIPPED, "report_lost", SampleStatus.LOST),
            (SampleStatus.RECEIVED, "start_processing", SampleStatus.PROCESSING),
            (SampleStatus.PROCESSING, "complete", SampleStatus.COMPLETED),
            (
                SampleStatus.PROCESSING,
                "processing_exception",
                SampleStatus.PROCESSING_EXCEPTION,
            ),
        ],
    )
    def test_legal_transition(self, source, action, expected):
        """Legal transitions return the correct target status."""
        assert validate_sample_transition(source, action) == expected

    @pytest.mark.parametrize(
        "source",
        [
            SampleStatus.RECEIVING_EXCEPTION,
            SampleStatus.PROCESSING_EXCEPTION,
            SampleStatus.LOST,
        ],
    )
    def test_void_from_allowed_statuses(self, source):
        """Void is allowed from exception and lost states."""
        assert validate_sample_transition(source, "void") == SampleStatus.VOIDED

    @pytest.mark.parametrize(
        "source",
        [
            SampleStatus.RECEIVING_EXCEPTION,
            SampleStatus.PROCESSING_EXCEPTION,
        ],
    )
    def test_return_from_allowed_statuses(self, source):
        """Return is allowed from exception states."""
        assert validate_sample_transition(source, "return") == SampleStatus.RETURNED

    # --- Illegal transitions ---

    @pytest.mark.parametrize(
        "source,action",
        [
            (SampleStatus.CREATED, "receive"),
            (SampleStatus.CREATED, "void"),
            (SampleStatus.SHIPPED, "start_processing"),
            (SampleStatus.SHIPPED, "complete"),
            (SampleStatus.RECEIVED, "receive"),
            (SampleStatus.RECEIVED, "void"),
            (SampleStatus.PROCESSING, "receive"),
            (SampleStatus.COMPLETED, "void"),
            (SampleStatus.COMPLETED, "return"),
            (SampleStatus.VOIDED, "return"),
            (SampleStatus.LOST, "return"),
        ],
    )
    def test_illegal_transition_raises(self, source, action):
        """Illegal transitions raise InvalidTransitionError."""
        with pytest.raises(InvalidTransitionError):
            validate_sample_transition(source, action)

    def test_unknown_action_raises(self):
        """Unknown action raises InvalidTransitionError."""
        with pytest.raises(InvalidTransitionError):
            validate_sample_transition(SampleStatus.CREATED, "teleport")
