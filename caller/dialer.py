"""Outbound dialer. Tells Twilio to place a call and point it at our server."""
from urllib.parse import urlencode

from twilio.rest import Client

import config


def _client() -> Client:
    sid, token, _ = config.require_twilio()
    return Client(sid, token)


def place_call(to_number: str, name: str, contact_id: str = "") -> str:
    """Start an outbound call. Returns the Twilio CallSid.

    Twilio will fetch TwiML from `<PUBLIC_URL>/voice?name=...&contact_id=...`
    and POST lifecycle events to `<PUBLIC_URL>/status`.
    """
    _, _, from_number = config.require_twilio()
    qs = urlencode({"name": name, "contact_id": contact_id})
    voice_url = f"{config.PUBLIC_URL}/voice?{qs}"

    call = _client().calls.create(
        to=to_number,
        from_=from_number,
        url=voice_url,
        method="POST",
        status_callback=f"{config.PUBLIC_URL}/status",
        status_callback_method="POST",
        status_callback_event=["completed", "no-answer", "busy", "failed"],
    )
    return call.sid
