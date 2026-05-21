"""FastAPI webhook server.

Twilio calls these endpoints during a live phone call:
  POST /voice    -> first contact; returns the opening line
  POST /respond  -> after the student speaks; returns the agent's reply
  POST /status   -> call lifecycle events (completed / no-answer / busy ...)

Each response is TwiML (XML) telling Twilio what to say and to listen next.
"""
from fastapi import FastAPI, Request, Response
from twilio.twiml.voice_response import VoiceResponse, Gather

import config
from caller import db, brain
from iitm_facts import SENTIMENTS

app = FastAPI(title="IITM Call System")
db.init_db()


def _xml(twiml: VoiceResponse) -> Response:
    return Response(content=str(twiml), media_type="application/xml")


def _say_and_gather(vr: VoiceResponse, text: str) -> None:
    """Speak `text`, then open a speech gather pointed back at /respond."""
    gather = Gather(
        input="speech",
        action=f"{config.PUBLIC_URL}/respond",
        method="POST",
        speech_timeout="auto",
        language=config.SPEECH_LANGUAGE,
        speech_model="phone_call",
    )
    gather.say(text, voice=config.TTS_VOICE, language=config.SPEECH_LANGUAGE)
    vr.append(gather)
    # if the student stays silent, gather finishes with no result -> nudge
    vr.redirect(f"{config.PUBLIC_URL}/respond?silent=1", method="POST")


def _hang_up(vr: VoiceResponse, text: str) -> None:
    vr.say(text, voice=config.TTS_VOICE, language=config.SPEECH_LANGUAGE)
    vr.hangup()


@app.get("/")
def health():
    return {"ok": True, "service": "iitm-call-system"}


@app.post("/voice")
async def voice(request: Request):
    """First webhook of the call — produce the opening line."""
    form = await request.form()
    qp = request.query_params
    call_sid = form.get("CallSid", "unknown")
    phone = form.get("To", "")
    name = qp.get("name", "there")
    contact_id = qp.get("contact_id", "")

    db.start_call(call_sid, contact_id, name, phone)

    result = brain.next_line(name, history=[], student_said=None)
    db.add_turn(call_sid, "agent", result["say"])

    vr = VoiceResponse()
    _say_and_gather(vr, result["say"])
    return _xml(vr)


@app.post("/respond")
async def respond(request: Request):
    """Every subsequent turn — feed the student's words to the agent."""
    form = await request.form()
    call_sid = form.get("CallSid", "unknown")
    call = db.get_call(call_sid)
    name = call["name"] if call else "there"

    silent = request.query_params.get("silent") == "1"
    student_said = (form.get("SpeechResult") or "").strip()

    vr = VoiceResponse()

    # student said nothing
    if silent or not student_said:
        nudge = "Sorry, I could not hear you. Could you please say that again?"
        _say_and_gather(vr, nudge)
        return _xml(vr)

    db.add_turn(call_sid, "student", student_said)

    # turn-limit guard
    history = db.get_history(call_sid)
    agent_turns = sum(1 for m in history if m["role"] == "assistant")
    if agent_turns >= config.MAX_TURNS:
        result = brain.closing_line()
    else:
        result = brain.next_line(name, history=history, student_said=student_said)

    db.add_turn(call_sid, "agent", result["say"])

    if result.get("end_call"):
        remark = SENTIMENTS.get(result["sentiment"], "Others")
        db.finish_call(call_sid, result["sentiment"], remark)
        _hang_up(vr, result["say"])
    else:
        _say_and_gather(vr, result["say"])
    return _xml(vr)


@app.post("/status")
async def status(request: Request):
    """Call lifecycle callback (no-answer, busy, failed, completed)."""
    form = await request.form()
    call_sid = form.get("CallSid", "unknown")
    call_status = form.get("CallStatus", "")
    call = db.get_call(call_sid)

    if call and call["status"] == "in-progress":
        if call_status in ("no-answer", "busy", "failed", "canceled"):
            db.finish_call(call_sid, "neutral", f"Others ({call_status})",
                           status=call_status)
        elif call_status == "completed":
            # completed but never ended cleanly by the agent
            db.finish_call(call_sid, "neutral", "Others (call ended)",
                           status="completed")
    return {"ok": True}
