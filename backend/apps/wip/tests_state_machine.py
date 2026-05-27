"""Tests for WIP and Dispatch state machine transitions."""

import pytest

from apps.wip.models import DispatchStatus, WIPStatus
from apps.wip.state_machine import (
    InvalidTransitionError,
    validate_dispatch_transition,
    validate_wip_transition,
)


class TestWIPStateMachine:
    """Test WIP state transition validation."""

    @pytest.mark.parametrize(
        "source,action,expected",
        [
            (WIPStatus.IN_PROGRESS, "complete", WIPStatus.COMPLETED),
            (WIPStatus.CREATED, "abort", WIPStatus.ABORTED),
            (WIPStatus.IN_PROGRESS, "abort", WIPStatus.ABORTED),
        ],
    )
    def test_legal_transition(self, source, action, expected):
        """Legal transitions return the correct target status."""
        assert validate_wip_transition(source, action) == expected

    def test_complete_requires_in_progress(self):
        """WIP complete action requires in_progress status."""
        assert (
            validate_wip_transition(WIPStatus.IN_PROGRESS, "complete")
            == WIPStatus.COMPLETED
        )

    def test_abort_from_created(self):
        """WIP abort is allowed from created state."""
        assert validate_wip_transition(WIPStatus.CREATED, "abort") == WIPStatus.ABORTED

    def test_abort_from_in_progress(self):
        """WIP abort is allowed from in_progress state."""
        assert (
            validate_wip_transition(WIPStatus.IN_PROGRESS, "abort") == WIPStatus.ABORTED
        )

    @pytest.mark.parametrize(
        "source,action",
        [
            (WIPStatus.CREATED, "complete"),
            (WIPStatus.COMPLETED, "complete"),
            (WIPStatus.COMPLETED, "abort"),
            (WIPStatus.ABORTED, "complete"),
            (WIPStatus.ABORTED, "abort"),
        ],
    )
    def test_illegal_transition_raises(self, source, action):
        """Illegal transitions raise InvalidTransitionError."""
        with pytest.raises(InvalidTransitionError) as exc_info:
            validate_wip_transition(source, action)
        assert source in str(exc_info.value)
        assert action in str(exc_info.value)

    def test_unknown_action_raises(self):
        """Unknown action raises InvalidTransitionError."""
        with pytest.raises(InvalidTransitionError):
            validate_wip_transition(WIPStatus.CREATED, "fly_to_moon")


class TestDispatchStateMachine:
    """Test Dispatch state transition validation."""

    @pytest.mark.parametrize(
        "source,action,expected",
        [
            (DispatchStatus.PENDING, "dispatch", DispatchStatus.DISPATCHED),
            (DispatchStatus.DISPATCHED, "start", DispatchStatus.RUNNING),
            (DispatchStatus.DISPATCHED, "unload", DispatchStatus.UNLOADED),
            (DispatchStatus.RUNNING, "unload", DispatchStatus.UNLOADED),
            # record_result is now terminal — it lands straight in
            # COMPLETED, bypassing RESULT_RECORDED. The "complete"
            # dispatch action is removed entirely (covered as illegal
            # below by virtue of being an unknown action).
            (DispatchStatus.UNLOADED, "record_result", DispatchStatus.COMPLETED),
            (
                DispatchStatus.DISPATCHED,
                "report_exception",
                DispatchStatus.EXECUTION_EXCEPTION,
            ),
            (
                DispatchStatus.RUNNING,
                "report_exception",
                DispatchStatus.EXECUTION_EXCEPTION,
            ),
            (
                DispatchStatus.EXECUTION_EXCEPTION,
                "redispatch",
                DispatchStatus.PENDING_REDISPATCH,
            ),
            (DispatchStatus.EXECUTION_EXCEPTION, "abort", DispatchStatus.ABORTED),
            (DispatchStatus.PENDING, "abort", DispatchStatus.ABORTED),
        ],
    )
    def test_legal_transition(self, source, action, expected):
        """Legal transitions return the correct target status."""
        assert validate_dispatch_transition(source, action) == expected

    @pytest.mark.parametrize(
        "source,action",
        [
            (DispatchStatus.PENDING, "start"),
            (DispatchStatus.PENDING, "unload"),
            (DispatchStatus.PENDING, "complete"),
            (DispatchStatus.DISPATCHED, "dispatch"),
            (DispatchStatus.DISPATCHED, "complete"),
            (DispatchStatus.RUNNING, "dispatch"),
            (DispatchStatus.RUNNING, "start"),
            (DispatchStatus.RUNNING, "complete"),
            (DispatchStatus.UNLOADED, "complete"),
            (DispatchStatus.UNLOADED, "report_exception"),
            (DispatchStatus.COMPLETED, "complete"),
            (DispatchStatus.COMPLETED, "abort"),
            (DispatchStatus.ABORTED, "abort"),
            (DispatchStatus.ABORTED, "start"),
            (DispatchStatus.PENDING_REDISPATCH, "start"),
            (DispatchStatus.PENDING_REDISPATCH, "abort"),
        ],
    )
    def test_illegal_transition_raises(self, source, action):
        """Illegal transitions raise InvalidTransitionError."""
        with pytest.raises(InvalidTransitionError) as exc_info:
            validate_dispatch_transition(source, action)
        assert source in str(exc_info.value)
        assert action in str(exc_info.value)

    def test_unknown_action_raises(self):
        """Unknown action raises InvalidTransitionError."""
        with pytest.raises(InvalidTransitionError):
            validate_dispatch_transition(DispatchStatus.PENDING, "teleport")
