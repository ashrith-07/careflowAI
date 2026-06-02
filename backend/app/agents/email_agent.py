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

    _PRIMARY_SYSTEM = """You are an intelligent email parser for Patrick, a Caregiver-CEO
who manages medical appointments, transportation, and logistics for his elderly father.

Patrick uses this system to process all inbound caregiving emails and get structured
action plans. YOU ARE GENERATING A PLAN FOR PATRICK — he is the caregiver, not the patient.

When parsing an email:
- "person" = the PATIENT being cared for (usually "Father" or the elderly relative)
- "doctor" = the clinician mentioned in the email
- If the email is from a clinic or doctor's office, it's about Patrick's father's care
- If the email mentions Patrick himself, he is the caregiver, not the patient
- If someone says "Hi Jyothi" or "Dear Dr. X" — the patient is still Father unless explicitly stated otherwise
- transportation_required = true if any medical transport, wheelchair, ambulette, or ride service is mentioned
- urgency_level: "high" if same-day or safety-critical, "medium" if within 48 hours, "low" otherwise
- action_items: what PATRICK needs to do next (concrete, first-person imperative)

If the email is ambiguous about who the patient is, default to person="Father"
and add "Clarify patient identity with sender" to action_items.

Always generate action_items that make sense for the CAREGIVER to execute."""

    _FALLBACK_SYSTEM = """You are the same Caregiver-CEO email parser for Patrick.
The previous parse attempt failed. Re-read the email carefully.
Remember: Patrick is the CAREGIVER. His father is the PATIENT.
Generate action items FOR PATRICK to execute.
If unsure about patient identity, default person="Father".
Set urgency_level="medium" and include "Clarify details with clinic" in action_items."""

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
