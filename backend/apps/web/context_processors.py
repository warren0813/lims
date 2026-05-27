"""Template context processors for the LIMS web app."""

from django.http import HttpRequest


def linked_accounts(request: HttpRequest) -> dict:
    """Expose linked accounts from the session to all templates."""
    if not request.user.is_authenticated:
        return {"linked_accounts": []}
    accounts = request.session.get("_linked_sessions", [])
    return {"linked_accounts": accounts}
