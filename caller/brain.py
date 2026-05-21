"""The AI agent. Given the conversation so far, asks Claude for the next line.

Returns a dict: {say, sentiment, note, end_call}.
The rest of the system (server.py) turns `say` into speech and decides whether
to keep gathering speech or hang up based on `end_call`.
"""
import json

from anthropic import Anthropic

import config
from iitm_facts import build_system_prompt, SENTIMENTS

_client: Anthropic | None = None


def _client_once() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=config.require_anthropic())
    return _client


def _parse(raw: str) -> dict:
    """Parse Claude's JSON reply, tolerating stray code fences / prose."""
    text = raw.strip()
    if "```" in text:
        text = text.split("```")[1] if text.count("```") >= 2 else text
        text = text.replace("json", "", 1).strip()
    # grab the outermost { ... }
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        text = text[start : end + 1]
    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        # fall back: treat the whole thing as the spoken line
        return {"say": raw.strip(), "sentiment": "neutral",
                "note": "unparsed reply", "end_call": False}

    obj.setdefault("say", "")
    obj.setdefault("sentiment", "neutral")
    obj.setdefault("note", "")
    obj.setdefault("end_call", False)
    if obj["sentiment"] not in SENTIMENTS:
        obj["sentiment"] = "neutral"
    return obj


def next_line(student_name: str, history: list[dict],
              student_said: str | None) -> dict:
    """Compute the agent's next turn.

    history       : prior turns as Anthropic message dicts (from db.get_history)
    student_said  : the latest student utterance, or None to open the call
    """
    messages = list(history)
    if student_said is None:
        messages.append({
            "role": "user",
            "content": (f'The call has just connected. {student_name} is on the '
                        f'line. Greet them and open the conversation.'),
        })
    else:
        messages.append({
            "role": "user",
            "content": f'The student said: "{student_said}"',
        })

    resp = _client_once().messages.create(
        model=config.ANTHROPIC_MODEL,
        max_tokens=400,
        system=build_system_prompt(student_name),
        messages=messages,
    )
    raw = "".join(b.text for b in resp.content if b.type == "text")
    return _parse(raw)


def closing_line() -> dict:
    """A safe, generic close used when the turn limit is hit."""
    return {
        "say": ("Thank you so much for your time. Our IITM admissions team will "
                "share the details with you on WhatsApp. Have a great day!"),
        "sentiment": "neutral",
        "note": "closed on turn limit",
        "end_call": True,
    }
