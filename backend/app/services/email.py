import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


def send_email(*, to: str, subject: str, html: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    """Send an email. Mock mode logs to stdout; real providers can be wired later."""
    mode = (settings.email_mode or "mock").strip().lower()
    from_addr = settings.certificate_from_email

    if mode == "mock":
        logger.info(
            "[MOCK EMAIL] from=%s to=%s subject=%s metadata=%s html_len=%d",
            from_addr,
            to,
            subject,
            metadata,
            len(html),
        )
        print(f"\n--- MOCK EMAIL ---\nFrom: {from_addr}\nTo: {to}\nSubject: {subject}\n---\n")
        return {"mode": "mock", "to": to, "subject": subject, "sent": True}

    raise NotImplementedError(f"Email mode '{mode}' is not configured yet")
