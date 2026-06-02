"""Email analysis agent: structured extraction from caregiving emails."""

from __future__ import annotations

import time
import traceback
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_llm
from app.graph.state import EmailAnalysis, WorkflowState
from app.memory.memory_store import log_agent_action


class EmailAgent:
    """
    Extracts structured information from caregiving emails using LLM.
    Uses structured output parsing with Pydantic to guarantee schema compliance.
    """

    _PRIMARY_SYSTEM = """You are an AI assistant for Caregiver-CEOs — family members who coordinate medical care, logistics, and emotional support for loved ones.

Your task is to read inbound emails (often from clinics, transport vendors, or family) and extract a precise structured summary.

Guidelines:
- event_type: a short label (e.g. "reschedule", "cancellation", "new_appointment", "transport_update", "other").
- person: who the care is about (use the name or role as written, e.g. "Father", "Mom").
- doctor: primary clinician or department if mentioned; else "unknown".
- old_time and new_time: prior and proposed appointment or event times as free text if present; use empty string only when truly absent for new_time use best available slot text.
- transportation_required: true if wheelchair, ambulette, medical transport, or ride assistance is mentioned.
- urgency_level: "low", "medium", or "high" based on medical risk, time pressure, and dependency on transport.
- action_items: concrete next steps implied by the email (short phrases).

Be conservative: if information is missing, use reasonable defaults and note ambiguity in action_items."""

    _FALLBACK_SYSTEM = """You are the same Caregiver-CEO email parser. The previous parse failed or was invalid.
Re-read the email and output ONLY valid structured fields matching the schema.
Prefer explicit quotes from the email for times and names. If unsure, set urgency_level to "medium" and include "Clarify details with clinic" in action_items."""

    def __init__(self) -> None:
        self._llm = get_llm()

    async def run(self, state: WorkflowState) -> dict[str, Any]:
        session_id = state["session_id"]
        email_content = state["email_content"]
        t0 = time.perf_counter()
        structured = self._llm.with_structured_output(EmailAnalysis)

        input_snapshot: dict[str, Any] = {
            "email_content": email_content,
            "prompt": "primary",
        }
        last_error: str | None = None
        last_traceback: str = ""
        result: EmailAnalysis | None = None

        for attempt in range(3):
            system = self._PRIMARY_SYSTEM if attempt == 0 else self._FALLBACK_SYSTEM
            input_snapshot["prompt"] = "primary" if attempt == 0 else "fallback"
            input_snapshot["attempt"] = attempt
            messages = [
                SystemMessage(content=system),
                HumanMessage(
                    content=f"Email to parse:\n\n---\n{email_content}\n---\n"
                    "Return the structured analysis."
                ),
            ]
            try:
                raw = await structured.ainvoke(messages)
                result = EmailAnalysis.model_validate(raw)
                break
            except Exception as exc:
                last_error = f"{type(exc).__name__}: {exc}"
                last_traceback = traceback.format_exc()
                if attempt == 2:
                    break

        duration_ms = int((time.perf_counter() - t0) * 1000)

        if result is None:
            err_msg = f"EmailAgent failed after retries: {last_error or 'unknown error'}"
            await log_agent_action(
                session_id,
                "email_agent",
                input_snapshot,
                {
                    "ok": False,
                    "error": err_msg,
                    "traceback": last_traceback or "",
                },
                duration_ms,
            )
            return {
                "status": "failed",
                "errors": [err_msg],
                "current_agent": "email_agent",
                "audit_trail": [
                    {
                        "agent": "email_agent",
                        "duration_ms": duration_ms,
                        "ok": False,
                        "error": err_msg,
                    }
                ],
            }

        await log_agent_action(
            session_id,
            "email_agent",
            input_snapshot,
            {"ok": True, "email_analysis": result.model_dump()},
            duration_ms,
        )

        return {
            "email_analysis": result,
            "current_agent": "memory_agent",
            "audit_trail": [
                {
                    "agent": "email_agent",
                    "duration_ms": duration_ms,
                    "ok": True,
                }
            ],
        }


email_agent = EmailAgent()
