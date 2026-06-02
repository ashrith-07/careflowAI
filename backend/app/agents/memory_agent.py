"""Memory agent: SQLite-backed context enrichment."""

from __future__ import annotations

import asyncio
import json
import time
import traceback
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_llm
from app.graph.state import EmailAnalysis, MemoryContext, WorkflowState
from app.memory.memory_store import (
    get_patient_profile,
    get_recent_appointments,
    log_agent_action,
)


class MemoryAgent:
    """
    Retrieves and enriches context from the persistent SQLite memory store.
    Matches extracted entities to stored patient profiles and appointment history.
    """

    _SYSTEM = """You are a clinical memory assistant for a Caregiver-CEO workflow.

You receive:
1) Structured email analysis (JSON)
2) Optional patient profile row from SQLite (JSON or null)
3) Recent appointment rows from SQLite (JSON array)

Produce a MemoryContext:
- patient_found: true only if the profile row matched the person from the email (same person / clear match).
- preferred_transport, patient_notes, last_appointment: from profile/appointments when available; otherwise null or empty lists as appropriate.
- appointment_history: copy of the appointment rows you relied on (same structure as input), may be truncated but preserve key fields.
- doctor_history: deduplicated list of doctor names seen in profile + appointments + email analysis.
- Enrich patient_notes only by synthesizing from provided data — do not invent clinical facts not supported by inputs."""

    def __init__(self) -> None:
        self._llm = get_llm()

    async def run(self, state: WorkflowState) -> dict[str, Any]:
        session_id = state["session_id"]
        t0 = time.perf_counter()
        email_analysis = state.get("email_analysis")

        if state.get("status") == "failed" or email_analysis is None:
            duration_ms = int((time.perf_counter() - t0) * 1000)
            empty = MemoryContext(
                patient_found=False,
                preferred_transport=None,
                last_appointment=None,
                appointment_history=[],
                patient_notes=None,
                doctor_history=[],
            )
            await log_agent_action(
                session_id,
                "memory_agent",
                {"reason": "skipped_no_email_analysis", "status": state.get("status")},
                {"ok": True, "memory_context": empty.model_dump()},
                duration_ms,
            )
            return {
                "memory_context": empty,
                "current_agent": "logistics_agent",
                "audit_trail": [
                    {
                        "agent": "memory_agent",
                        "duration_ms": duration_ms,
                        "ok": True,
                        "skipped": True,
                    }
                ],
            }

        ea = email_analysis if isinstance(email_analysis, EmailAnalysis) else EmailAnalysis.model_validate(email_analysis)
        person = (ea.person or "").strip() or "unknown"

        try:
            profile, appointments = await asyncio.gather(
                get_patient_profile(person),
                get_recent_appointments(person, limit=5),
            )

            structured = self._llm.with_structured_output(MemoryContext)
            human = json.dumps(
                {
                    "email_analysis": ea.model_dump(),
                    "patient_profile": profile,
                    "recent_appointments": appointments,
                },
                default=str,
            )
            messages = [
                SystemMessage(content=self._SYSTEM),
                HumanMessage(content=f"Context JSON:\n{human}\n\nReturn MemoryContext."),
            ]
            raw = await structured.ainvoke(messages)
            result = MemoryContext.model_validate(raw)

            result = result.model_copy(
                update={"patient_found": bool(profile)},
            )

            duration_ms = int((time.perf_counter() - t0) * 1000)
            await log_agent_action(
                session_id,
                "memory_agent",
                {"person": person, "had_profile": profile is not None},
                {"ok": True, "memory_context": result.model_dump()},
                duration_ms,
            )
            return {
                "memory_context": result,
                "current_agent": "logistics_agent",
                "audit_trail": [
                    {
                        "agent": "memory_agent",
                        "duration_ms": duration_ms,
                        "ok": True,
                    }
                ],
            }
        except Exception as exc:
            duration_ms = int((time.perf_counter() - t0) * 1000)
            err_msg = f"MemoryAgent: {type(exc).__name__}: {exc}"
            fallback = MemoryContext(
                patient_found=False,
                preferred_transport=None,
                last_appointment=None,
                appointment_history=[],
                patient_notes=None,
                doctor_history=[],
            )
            await log_agent_action(
                session_id,
                "memory_agent",
                {"person": person},
                {
                    "ok": False,
                    "error": err_msg,
                    "traceback": traceback.format_exc(),
                    "memory_context": fallback.model_dump(),
                },
                duration_ms,
            )
            return {
                "status": "failed",
                "errors": [err_msg],
                "memory_context": fallback,
                "current_agent": "logistics_agent",
                "audit_trail": [
                    {
                        "agent": "memory_agent",
                        "duration_ms": duration_ms,
                        "ok": False,
                        "error": err_msg,
                    }
                ],
            }


memory_agent = MemoryAgent()
