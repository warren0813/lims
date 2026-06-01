"""Email notifications for the wip app.

Currently a single channel: the dispatch-failure alert fired when a
simulated machine run rolls a failure (or any future path that drives a
dispatch into EXECUTION_EXCEPTION through the shared service layer).

Sending is synchronous via Django's ``send_mail`` — the project wires no
Celery broker, and a lone transactional alert does not justify one. The
helper never raises: a misconfigured SMTP host or an empty recipient list
must not roll back the dispatch state transition that triggered it.
"""

import logging

from django.conf import settings
from django.core.mail import send_mail

from apps.wip.models import Dispatch

logger = logging.getLogger(__name__)


def _build_body(dispatch: Dispatch) -> str:
    """Render the plain-text body describing a failed dispatch."""
    lines = [
        f"Dispatch #{dispatch.pk} 在模擬機台執行時發生異常 (execution_exception)。",
        "",
        f"WIP: #{dispatch.wip_id}",
        f"實驗類型: {dispatch.experiment_type}",
        f"機台: {dispatch.equipment}",
        f"配方: {dispatch.recipe}",
    ]
    if dispatch.note:
        lines += ["", "備註:", dispatch.note]
    lines += ["", "請至 LIMS 重新派貨 (redispatch) 或中止 (abort)。"]
    return "\n".join(lines)


def notify_dispatch_failure(dispatch: Dispatch) -> bool:
    """Email the configured recipients that ``dispatch`` failed execution.

    Returns True iff a message was handed to the mail backend. Returns
    False (after logging) when no recipients are configured or delivery
    raises — notification is best-effort and must never abort the
    surrounding transaction.

    Recipients come from ``settings.DISPATCH_FAILURE_NOTIFY_EMAILS`` (a
    list; empty disables sending). Sender is ``settings.DEFAULT_FROM_EMAIL``.
    """
    recipients = getattr(settings, "DISPATCH_FAILURE_NOTIFY_EMAILS", [])
    if not recipients:
        logger.warning(
            "Dispatch #%s failed but DISPATCH_FAILURE_NOTIFY_EMAILS is empty; "
            "no failure notification sent.",
            dispatch.pk,
        )
        return False

    subject = f"[LIMS] Dispatch #{dispatch.pk} 執行異常"
    try:
        send_mail(
            subject,
            _build_body(dispatch),
            settings.DEFAULT_FROM_EMAIL,
            list(recipients),
            fail_silently=False,
        )
    except Exception:  # noqa: BLE001 — best-effort; never abort the caller
        logger.exception("Failed to send dispatch-failure email for #%s", dispatch.pk)
        return False
    return True
