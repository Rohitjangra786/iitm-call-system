"""SQLite persistence: one row per call, one row per conversation turn,
plus a contacts table managed from the React PWA.

Tables
------
calls    : call_sid (PK), contact_id, name, phone, status, sentiment,
           remark, started_at, ended_at
turns    : id (PK), call_sid (FK), turn_no, role ('agent'|'student'),
           text, created_at
contacts : id (PK), name, phone, notes, do_not_call, created_at, updated_at
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
CREATE TABLE IF NOT EXISTS contacts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    phone        TEXT NOT NULL,
    notes        TEXT DEFAULT '',
    do_not_call  INTEGER DEFAULT 0,
    created_at   TEXT,
    updated_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
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


# ----------------------------- calls + turns ------------------------------

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


def active_calls() -> list[dict]:
    with _conn() as con:
        rows = con.execute(
            "SELECT * FROM calls WHERE status='in-progress' ORDER BY started_at DESC"
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


def summary_counts() -> dict:
    with _conn() as con:
        total = con.execute("SELECT COUNT(*) AS n FROM calls").fetchone()["n"]
        active = con.execute(
            "SELECT COUNT(*) AS n FROM calls WHERE status='in-progress'"
        ).fetchone()["n"]
        completed = con.execute(
            "SELECT COUNT(*) AS n FROM calls WHERE status='completed'"
        ).fetchone()["n"]
        rows = con.execute(
            "SELECT remark, COUNT(*) AS n FROM calls "
            "WHERE remark IS NOT NULL GROUP BY remark"
        ).fetchall()
    buckets = {r["remark"] or "Pending": r["n"] for r in rows}
    return {
        "total": total,
        "active": active,
        "completed": completed,
        "buckets": buckets,
    }


# ----------------------------- contacts CRUD ------------------------------

def list_contacts() -> list[dict]:
    with _conn() as con:
        rows = con.execute(
            "SELECT * FROM contacts ORDER BY id ASC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_contact(contact_id: int) -> dict | None:
    with _conn() as con:
        row = con.execute(
            "SELECT * FROM contacts WHERE id=?", (contact_id,)
        ).fetchone()
    return dict(row) if row else None


def create_contact(name: str, phone: str, notes: str = "",
                   do_not_call: bool = False) -> dict:
    now = _now()
    with _conn() as con:
        cur = con.execute(
            "INSERT INTO contacts (name, phone, notes, do_not_call, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?)",
            (name, phone, notes, 1 if do_not_call else 0, now, now),
        )
        cid = cur.lastrowid
    return get_contact(cid)


def update_contact(contact_id: int, **fields) -> dict | None:
    if not fields:
        return get_contact(contact_id)
    allowed = {"name", "phone", "notes", "do_not_call"}
    sets, vals = [], []
    for k, v in fields.items():
        if k not in allowed:
            continue
        sets.append(f"{k}=?")
        vals.append(1 if k == "do_not_call" and v else (0 if k == "do_not_call" else v))
    if not sets:
        return get_contact(contact_id)
    sets.append("updated_at=?")
    vals.append(_now())
    vals.append(contact_id)
    with _conn() as con:
        con.execute(f"UPDATE contacts SET {', '.join(sets)} WHERE id=?", vals)
    return get_contact(contact_id)


def delete_contact(contact_id: int) -> bool:
    with _conn() as con:
        cur = con.execute("DELETE FROM contacts WHERE id=?", (contact_id,))
        return cur.rowcount > 0


def upsert_contacts_from_rows(rows: list[dict]) -> int:
    """Bulk insert contacts. Skips rows missing name or phone. Returns count."""
    now = _now()
    n = 0
    with _conn() as con:
        for r in rows:
            name = (r.get("name") or "").strip()
            phone = (r.get("phone") or "").strip()
            if not name or not phone:
                continue
            existing = con.execute(
                "SELECT id FROM contacts WHERE phone=?", (phone,)
            ).fetchone()
            if existing:
                con.execute(
                    "UPDATE contacts SET name=?, notes=?, updated_at=? WHERE id=?",
                    (name, r.get("notes", ""), now, existing["id"]),
                )
            else:
                con.execute(
                    "INSERT INTO contacts (name, phone, notes, do_not_call, "
                    "created_at, updated_at) VALUES (?,?,?,0,?,?)",
                    (name, phone, r.get("notes", ""), now, now),
                )
            n += 1
    return n
