"""State machine validation for WIP and Dispatch status transitions."""

from apps.wip.models import DispatchStatus, WIPStatus


class InvalidTransitionError(Exception):
    """Raised when a state transition is not allowed."""

    def __init__(self, model_name: str, current: str, action: str) -> None:
        self.model_name = model_name
        self.current = current
        self.action = action
        super().__init__(
            f"{model_name} cannot perform '{action}' from status '{current}'"
        )


# Mapping: action -> set of allowed source statuses
WIP_TRANSITIONS: dict[str, set[str]] = {
    "complete": {WIPStatus.IN_PROGRESS},
    "abort": {WIPStatus.CREATED, WIPStatus.IN_PROGRESS},
}

WIP_TARGET: dict[str, str] = {
    "complete": WIPStatus.COMPLETED,
    "abort": WIPStatus.ABORTED,
}

DISPATCH_TRANSITIONS: dict[str, set[str]] = {
    "dispatch": {DispatchStatus.PENDING},
    "start": {DispatchStatus.DISPATCHED},
    "unload": {DispatchStatus.DISPATCHED, DispatchStatus.RUNNING},
    # record_result is the terminal step for a successful dispatch —
    # it lands straight in COMPLETED. The intermediate RESULT_RECORDED
    # status (and its "complete" action) was removed because operators
    # treat result entry as the end of the run. The enum value
    # DispatchStatus.RESULT_RECORDED is preserved to keep historical
    # rows / migrations untouched.
    "record_result": {DispatchStatus.UNLOADED},
    "report_exception": {DispatchStatus.DISPATCHED, DispatchStatus.RUNNING},
    "redispatch": {DispatchStatus.EXECUTION_EXCEPTION},
    "abort": {DispatchStatus.EXECUTION_EXCEPTION, DispatchStatus.PENDING},
}

DISPATCH_TARGET: dict[str, str] = {
    "dispatch": DispatchStatus.DISPATCHED,
    "start": DispatchStatus.RUNNING,
    "unload": DispatchStatus.UNLOADED,
    "record_result": DispatchStatus.COMPLETED,
    "report_exception": DispatchStatus.EXECUTION_EXCEPTION,
    "redispatch": DispatchStatus.PENDING_REDISPATCH,
    "abort": DispatchStatus.ABORTED,
}


def validate_wip_transition(current_status: str, action: str) -> str:
    """Validate and return the target status for a WIP action.

    Raises InvalidTransitionError if the transition is not allowed.
    """
    allowed = WIP_TRANSITIONS.get(action)
    if allowed is None:
        raise InvalidTransitionError("WIP", current_status, action)
    if current_status not in allowed:
        raise InvalidTransitionError("WIP", current_status, action)
    return WIP_TARGET[action]


def validate_dispatch_transition(current_status: str, action: str) -> str:
    """Validate and return the target status for a Dispatch action.

    Raises InvalidTransitionError if the transition is not allowed.
    """
    allowed = DISPATCH_TRANSITIONS.get(action)
    if allowed is None:
        raise InvalidTransitionError("Dispatch", current_status, action)
    if current_status not in allowed:
        raise InvalidTransitionError("Dispatch", current_status, action)
    return DISPATCH_TARGET[action]
