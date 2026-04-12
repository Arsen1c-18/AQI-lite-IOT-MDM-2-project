"""
twilio_service.py
─────────────────
Twilio SMS notification service for device on/off events.
"""

import sys
from typing import Optional

from .config import get_settings


def send_sms(message: str, device_name: str = "IoT Device") -> bool:
    """
    Send SMS via Twilio.
    Returns True if sent successfully, False otherwise.
    """
    settings = get_settings()

    if not settings.twilio_enabled:
        print("[twilio] Twilio not configured. Skipping SMS.", file=sys.stderr)
        return False

    try:
        from twilio.rest import Client

        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)

        sms = client.messages.create(
            body=message,
            from_=settings.twilio_phone_from,
            to=settings.twilio_phone_to,
        )

        print(f"[twilio] SMS sent: {sms.sid}", file=sys.stdout)
        return True

    except ImportError:
        print(
            "[twilio] twilio-python not installed. Run: pip install twilio",
            file=sys.stderr,
        )
        return False
    except Exception as exc:
        print(f"[twilio] Failed to send SMS: {exc}", file=sys.stderr)
        return False


def notify_device_on(device_name: str) -> bool:
    """Send SMS when device powers on."""
    message = f"✅ {device_name} POWERED ON"
    return send_sms(message, device_name)


def notify_device_off(device_name: str) -> bool:
    """Send SMS when device powers off / goes offline."""
    message = f"🔴 {device_name} POWERED OFF"
    return send_sms(message, device_name)
