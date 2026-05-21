"""The AI agent. Given the conversation so far, asks an LLM for the next line.

Backend is selected by AGENT_BACKEND in .env:
  - "anthropic" -> Claude API (caller pays per token)
  - "ollama"    -> local Ollama at OLLAMA_URL (free, offline, your laptop's GPU)

Returns a dict: {say, sentiment, note, end_call}. The rest of the system
(server.py) turns `say` into speech and decides whether to keep gathering
speech or hang up based on `end_call`.

Copyright (c) 2026 Rohit Jangra.
"""
import json
from typing import Any

import httpx

import config
from iitm_facts import build_system_prompt, SENTIMENTS


# ---------------------------- common parser --------------------------------

def _parse(raw: str) -> dict:
    """Parse the LLM's JSON reply, tolerating stray code fences / prose."""
    text = raw.strip()
    if "```" in text:
        text = text.split("```")[1] if text.count("```") >= 2 else text
        text = text.replace("json", "", 1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        text = text[start : end + 1]
    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        return {"say": raw.strip(), "sentiment": "neutral",
                "note": "unparsed reply", "end_call": False}

    obj.setdefault("say", "")
    obj.setdefault("sentiment", "neutral")
    obj.setdefault("note", "")
    obj.setdefault("end_call", False)
    if obj["sentiment"] not in SENTIMENTS:
        obj["sentiment"] = "neutral"
    return obj


def _build_messages(student_name: str, history: list[dict],
                    student_said: str | None) -> list[dict]:
    messages = list(history)
    if student_said is None:
        messages.append({
            "role": "user",
            "content": (f"The call has just connected. {student_name} is on the "
                        f"line. Greet them and open the conversation."),
        })
    else:
        messages.append({
            "role": "user",
            "content": f'The student said: "{student_said}"',
        })
    return messages


# ---------------------------- Anthropic provider ---------------------------

_anthropic_client: Any = None


def _anthropic_call(student_name: str, messages: list[dict]) -> str:
    global _anthropic_client
    if _anthropic_client is None:
        from anthropic import Anthropic
        _anthropic_client = Anthropic(api_key=config.require_anthropic())
    resp = _anthropic_client.messages.create(
        model=config.ANTHROPIC_MODEL,
        max_tokens=400,
        system=build_system_prompt(student_name),
        messages=messages,
    )
    return "".join(b.text for b in resp.content if b.type == "text")


# ---------------------------- Ollama provider ------------------------------

def _ollama_call(student_name: str, messages: list[dict]) -> str:
    """Hit Ollama's OpenAI-compatible chat endpoint at /v1/chat/completions."""
    payload = {
        "model": config.OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": build_system_prompt(student_name)},
            *messages,
        ],
        "temperature": 0.4,
        "max_tokens": 400,
        # Hint the model to emit JSON. Ollama honours `format: "json"`.
        "response_format": {"type": "json_object"},
    }
    # 60s timeout: small models on CPU can take 5-30s for first token.
    with httpx.Client(timeout=60.0) as c:
        r = c.post(f"{config.OLLAMA_URL}/v1/chat/completions", json=payload)
        r.raise_for_status()
        data = r.json()
    return data["choices"][0]["message"]["content"]


# ---------------------------- public API -----------------------------------

def next_line(student_name: str, history: list[dict],
              student_said: str | None) -> dict:
    """Compute the agent's next turn.

    history      : prior turns as message dicts (from db.get_history)
    student_said : the latest student utterance, or None to open the call
    """
    messages = _build_messages(student_name, history, student_said)
    backend = config.AGENT_BACKEND
    if backend == "ollama":
        raw = _ollama_call(student_name, messages)
    else:
        raw = _anthropic_call(student_name, messages)
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


def backend_info() -> dict:
    """Reportable info about which brain backend is in use."""
    if config.AGENT_BACKEND == "ollama":
        return {"backend": "ollama", "model": config.OLLAMA_MODEL,
                "url": config.OLLAMA_URL}
    return {"backend": "anthropic", "model": config.ANTHROPIC_MODEL}
