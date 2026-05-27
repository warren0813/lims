"""State machine validation for Request and Sample status transitions."""

from apps.commissions.models import RequestStatus, SampleStatus


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
REQUEST_TRANSITIONS: dict[str, set[str]] = {
    "submit": {RequestStatus.DRAFT, RequestStatus.RETURNED},
    "approve": {RequestStatus.PENDING_APPROVAL},
    "return": {RequestStatus.PENDING_APPROVAL},
    "reject": {RequestStatus.PENDING_APPROVAL},
    "ship": {RequestStatus.APPROVED},
    "cancel": {
        RequestStatus.DRAFT,
        RequestStatus.PENDING_APPROVAL,
        RequestStatus.APPROVED,
        RequestStatus.RETURNED,
        RequestStatus.SAMPLE_SHIPPED,
        RequestStatus.IN_PROGRESS,
    },
    "close": {RequestStatus.COMPLETED},
}

# Mapping: action -> target status
REQUEST_TARGET: dict[str, str] = {
    "submit": RequestStatus.PENDING_APPROVAL,
    "approve": RequestStatus.APPROVED,
    "return": RequestStatus.RETURNED,
    "reject": RequestStatus.REJECTED,
    "ship": RequestStatus.SAMPLE_SHIPPED,
    "cancel": RequestStatus.CANCELLED,
    "close": RequestStatus.CLOSED,
}

SAMPLE_TRANSITIONS: dict[str, set[str]] = {
    "ship": {SampleStatus.CREATED},
    "receive": {SampleStatus.SHIPPED},
    "reject_receiving": {SampleStatus.SHIPPED},
    "report_lost": {SampleStatus.SHIPPED},
    "start_processing": {SampleStatus.RECEIVED},
    "complete": {SampleStatus.PROCESSING},
    "processing_exception": {SampleStatus.PROCESSING},
    "void": {
        SampleStatus.RECEIVING_EXCEPTION,
        SampleStatus.PROCESSING_EXCEPTION,
        SampleStatus.LOST,
    },
    "return": {
        SampleStatus.RECEIVING_EXCEPTION,
        SampleStatus.PROCESSING_EXCEPTION,
    },
}

SAMPLE_TARGET: dict[str, str] = {
    "ship": SampleStatus.SHIPPED,
    "receive": SampleStatus.RECEIVED,
    "reject_receiving": SampleStatus.RECEIVING_EXCEPTION,
    "report_lost": SampleStatus.LOST,
    "start_processing": SampleStatus.PROCESSING,
    "complete": SampleStatus.COMPLETED,
    "processing_exception": SampleStatus.PROCESSING_EXCEPTION,
    "void": SampleStatus.VOIDED,
    "return": SampleStatus.RETURNED,
}


def validate_request_transition(current_status: str, action: str) -> str:
    """Validate and return the target status for a request action.

    Raises InvalidTransitionError if the transition is not allowed.
    """
    allowed = REQUEST_TRANSITIONS.get(action)
    if allowed is None:
        raise InvalidTransitionError("Request", current_status, action)
    if current_status not in allowed:
        raise InvalidTransitionError("Request", current_status, action)
    return REQUEST_TARGET[action]


def validate_sample_transition(current_status: str, action: str) -> str:
    """Validate and return the target status for a sample action.

    Raises InvalidTransitionError if the transition is not allowed.
    """
    allowed = SAMPLE_TRANSITIONS.get(action)
    if allowed is None:
        raise InvalidTransitionError("Sample", current_status, action)
    if current_status not in allowed:
        raise InvalidTransitionError("Sample", current_status, action)
    return SAMPLE_TARGET[action]
