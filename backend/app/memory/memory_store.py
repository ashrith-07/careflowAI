"""Async SQLite memory store for CareFlow AI."""

from __future__ import annotations

import json
from typing import Any

import aiosqlite

from app.core.config import settings


def _row_to_dict(row: aiosqlite.Row) -> dict[str, Any]:
    return {k: row[k] for k in row.keys()}


async def init_db() -> None:
    """Create all tables if they do not exist."""
    async with aiosqlite.connect(settings.DATABASE_URL) as db:
        await db.executescript(
            """
            CREATE TABLE IF NOT EXISTS patient_profiles (
                id INTEGER PRIMARY KEY,
                patient_name TEXT,
                doctor_name TEXT,
                preferred_transport TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY,
                patient_name TEXT,
                doctor_name TEXT,
                appointment_date TEXT,
                appointment_time TEXT,
                status TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY,
                session_id TEXT,
                agent_name TEXT,
                input_data TEXT,
                output_data TEXT,
                duration_ms INTEGER,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS workflow_sessions (
                id TEXT PRIMARY KEY,
                email_content TEXT,
                status TEXT,
                result_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        await db.commit()


async def list_patient_profiles() -> list[dict[str, Any]]:
    """Return all patient profile rows (for demo / diagnostics)."""
    async with aiosqlite.connect(settings.DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT * FROM patient_profiles ORDER BY patient_name ASC",
        )
        rows = await cur.fetchall()
        return [_row_to_dict(r) for r in rows]


async def get_patient_profile(patient_name: str) -> dict[str, Any] | None:
    async with aiosqlite.connect(settings.DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT * FROM patient_profiles WHERE patient_name = ? LIMIT 1",
            (patient_name,),
        )
        row = await cur.fetchone()
        return _row_to_dict(row) if row else None


async def upsert_patient_profile(data: dict[str, Any]) -> None:
    patient_name = data["patient_name"]
    doctor_name = data.get("doctor_name")
    preferred_transport = data.get("preferred_transport")
    notes = data.get("notes")

    async with aiosqlite.connect(settings.DATABASE_URL) as db:
        cur = await db.execute(
            "SELECT id FROM patient_profiles WHERE patient_name = ? LIMIT 1",
            (patient_name,),
        )
        existing = await cur.fetchone()
        if existing:
            await db.execute(
                """
                UPDATE patient_profiles SET
                    doctor_name = ?,
                    preferred_transport = ?,
                    notes = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE patient_name = ?
                """,
                (doctor_name, preferred_transport, notes, patient_name),
            )
        else:
            await db.execute(
                """
                INSERT INTO patient_profiles
                    (patient_name, doctor_name, preferred_transport, notes)
                VALUES (?, ?, ?, ?)
                """,
                (patient_name, doctor_name, preferred_transport, notes),
            )
        await db.commit()


async def get_recent_appointments(
    patient_name: str,
    limit: int = 5,
) -> list[dict[str, Any]]:
    async with aiosqlite.connect(settings.DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            """
            SELECT * FROM appointments
            WHERE patient_name = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (patient_name, limit),
        )
        rows = await cur.fetchall()
        return [_row_to_dict(r) for r in rows]


async def add_appointment(data: dict[str, Any]) -> None:
    async with aiosqlite.connect(settings.DATABASE_URL) as db:
        await db.execute(
            """
            INSERT INTO appointments
                (patient_name, doctor_name, appointment_date, appointment_time, status)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                data["patient_name"],
                data["doctor_name"],
                data["appointment_date"],
                data["appointment_time"],
                data["status"],
            ),
        )
        await db.commit()


async def log_agent_action(
    session_id: str,
    agent_name: str,
    input_data: dict[str, Any],
    output_data: dict[str, Any],
    duration_ms: int,
) -> None:
    async with aiosqlite.connect(settings.DATABASE_URL) as db:
        await db.execute(
            """
            INSERT INTO audit_log
                (session_id, agent_name, input_data, output_data, duration_ms)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                session_id,
                agent_name,
                json.dumps(input_data),
                json.dumps(output_data),
                duration_ms,
            ),
        )
        await db.commit()


async def get_audit_log(session_id: str) -> list[dict[str, Any]]:
    async with aiosqlite.connect(settings.DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            """
            SELECT * FROM audit_log
            WHERE session_id = ?
            ORDER BY id ASC
            """,
            (session_id,),
        )
        rows = await cur.fetchall()
        out: list[dict[str, Any]] = []
        for r in rows:
            d = _row_to_dict(r)
            try:
                d["input_data"] = json.loads(d["input_data"])
            except (TypeError, json.JSONDecodeError):
                pass
            try:
                d["output_data"] = json.loads(d["output_data"])
            except (TypeError, json.JSONDecodeError):
                pass
            out.append(d)
        return out


async def create_session(session_id: str, email_content: str) -> None:
    async with aiosqlite.connect(settings.DATABASE_URL) as db:
        await db.execute(
            """
            INSERT INTO workflow_sessions (id, email_content, status)
            VALUES (?, ?, 'running')
            """,
            (session_id, email_content),
        )
        await db.commit()


async def update_session_status(
    session_id: str,
    status: str,
    result_data: dict[str, Any] | None = None,
) -> None:
    async with aiosqlite.connect(settings.DATABASE_URL) as db:
        if result_data is None:
            await db.execute(
                """
                UPDATE workflow_sessions
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (status, session_id),
            )
        else:
            await db.execute(
                """
                UPDATE workflow_sessions
                SET status = ?, result_data = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (status, json.dumps(result_data), session_id),
            )
        await db.commit()


async def get_session(session_id: str) -> dict[str, Any] | None:
    async with aiosqlite.connect(settings.DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT * FROM workflow_sessions WHERE id = ? LIMIT 1",
            (session_id,),
        )
        row = await cur.fetchone()
        if not row:
            return None
        d = _row_to_dict(row)
        raw = d.get("result_data")
        if raw is not None and isinstance(raw, str):
            try:
                d["result_data"] = json.loads(raw)
            except json.JSONDecodeError:
                pass
        return d


async def seed_demo_data() -> None:
    """Idempotent seed: Father / Dr. Patel profile and two completed past appointments."""
    if await get_patient_profile("Father"):
        return

    await upsert_patient_profile(
        {
            "patient_name": "Father",
            "doctor_name": "Dr. Patel",
            "preferred_transport": "Medical Transport Service",
            "notes": "Neurology patient. Requires wheelchair assistance.",
        }
    )

    await add_appointment(
        {
            "patient_name": "Father",
            "doctor_name": "Dr. Patel",
            "appointment_date": "2025-10-08",
            "appointment_time": "09:30",
            "status": "completed",
        }
    )
    await add_appointment(
        {
            "patient_name": "Father",
            "doctor_name": "Dr. Patel",
            "appointment_date": "2025-11-19",
            "appointment_time": "11:00",
            "status": "completed",
        }
    )
