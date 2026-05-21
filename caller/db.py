"""SQLite persistence: one row per call, one row per conversation turn.

Tables
------
calls : call_sid (PK), contact_id, name, phone, status, sentiment,
        remark, started_at, ended_at
turns : id (PK), call_sid (FK), turn_no, role ('agent'|'student'),
        text, created_at
"""
import sqlite3
import datetime as dt
from contextlib import contextmanager

import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS calls (
    call_sid    TEXT PRIMARY KEY,
    contact_id  TEXT,
    name        TEXT,
    phone       TEXT,
    status      TEXT DEFAULT 'in-progress',
    sentiment   TEXT,
    remark      TEXT,
    started_at  TEXT,
    ended_at    TEXT
);
CREATE TABLE IF NOT EXISTS turns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    call_sid    TEXT,
    turn_no     INTEGER,
    role        TEXT,
    text        TEXT,
    created_at  TEXT
);
"""


def _now() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


@contextmanager
def _conn():
    con = sqlite3.connect(config.DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init_db() -> None:
    with _conn() as con:
        con.executescript(SCHEMA)


def start_call(call_sid: str, contact_id: str, name: str, phone: str) -> None:
    with _conn() as con:
        con.execute(
            "INSERT OR REPLACE INTO calls "
            "(call_sid, contact_id, name, phone, status, started_at) "
            "VALUES (?,?,?,?, 'in-progress', ?)",
            (call_sid, contact_id, name, phone, _now()),
        )


def add_turn(call_sid: str, role: str, text: str) -> None:
    with _conn() as con:
        row = con.execute(
            "SELECT COALESCE(MAX(turn_no), 0) AS n FROM turns WHERE call_sid=?",
            (call_sid,),
        ).fetchone()
        con.execute(
            "INSERT INTO turns (call_sid, turn_no, role, text, created_at) "
            "VALUES (?,?,?,?,?)",
            (call_sid, row["n"] + 1, role, text, _now()),
        )


def get_history(call_sid: str) -> list[dict]:
    """Conversation as Anthropic message dicts (agent=assistant, student=user)."""
    with _conn() as con:
        rows = con.execute(
            "SELECT role, text FROM turns WHERE call_sid=? ORDER BY turn_no",
            (call_sid,),
        ).fetchall()
    msgs = []
    for r in rows:
        role = "assistant" if r["role"] == "agent" else "user"
        msgs.append({"role": role, "content": r["text"]})
    return msgs


def get_call(call_sid: str) -> dict | None:
    with _conn() as con:
        row = con.execute(
            "SELECT * FROM calls WHERE call_sid=?", (call_sid,)
        ).fetchone()
    return dict(row) if row else None


def finish_call(call_sid: str, sentiment: str, remark: str, status: str = "completed") -> None:
    with _conn() as con:
        con.execute(
            "UPDATE calls SET status=?, sentiment=?, remark=?, ended_at=? "
            "WHERE call_sid=?",
            (status, sentiment, remark, _now(), call_sid),
        )


def all_results() -> list[dict]:
    with _conn() as con:
        rows = con.execute(
            "SELECT * FROM calls ORDER BY started_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def transcript(call_sid: str) -> list[dict]:
    with _conn() as con:
        rows = con.execute(
            "SELECT turn_no, role, text, created_at FROM turns "
            "WHERE call_sid=? ORDER BY turn_no",
            (call_sid,),
        ).fetchall()
    return [dict(r) for r in rows]


def already_called(contact_id: str) -> bool:
    with _conn() as con:
        row = con.execute(
            "SELECT 1 FROM calls WHERE contact_id=? AND status='completed' LIMIT 1",
            (contact_id,),
        ).fetchone()
    return row is not None
