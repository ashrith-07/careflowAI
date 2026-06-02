"""Logistics agent: scheduling, transport, and coordination analysis."""

from __future__ import annotations

import json
import time
import traceback
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_llm
from app.graph.state import (
    EmailAnalysis,
    LogisticsAnalysis,
    MemoryContext,
    WorkflowState,
)
from app.memory.memory_store import log_agent_action


def _derive_risk_level(
    transportation_needs_rebooking: bool,
    urgency_level: str,
) -> str:
    """Combine transport rebooking signal with email urgency."""
    u = (urgency_level or "low").strip().lower()
    tr = transportation_needs_rebooking
    if tr and u == "high":
        return "high"
    if tr and u == "medium":
        return "high"
    if tr:
        return "medium"
    if u == "high":
        return "medium"
    if u == "medium":
        return "low"
    return "low"


class LogisticsAgent:
    """
    Analyzes scheduling conflicts, transportation requirements, and family coordination needs.
    Reasons about the practical impact of the appointment change.
    """

    _SYSTEM = """You are a logistics coordinator analyzing a specific caregiving situation for Patrick.

You receive structured analysis of a specific email. Your job is to identify
the PRACTICAL OPERATIONAL IMPACT of this specific email/event.

IMPORTANT:
- Analyze what THIS SPECIFIC EVENT requires, not what appointments generally require
- conflict_detected: only true if there is an ACTUAL scheduling conflict evident
- transportation_needs_rebooking: true ONLY if transport is mentioned or was previously booked for a time that's now changed
- family_notification_required: true if timing affects other family members' schedules
- recommended_actions: must be specific to this event (mention actual times, services, people from the email)
- If the email is a new booking request, focus on what needs to be arranged
- If it's a reschedule, focus on what needs to be changed
- If it's informational, focus on what needs to be communicated

Be specific. Generic advice is unhelpful to an overwhelmed caregiver."""

    def __init__(self) -> None:
        self._llm = get_llm()

    async def run(self, state: WorkflowState) -> dict[str, Any]:
        session_id = state["session_id"]
        t0 = time.perf_counter()

        if state.get("status") == "failed":
            duration_ms = int((time.perf_counter() - t0) * 1000)
            await log_agent_action(
                session_id,
                "logistics_agent",
                {"skipped": True},
                {"ok": True, "skipped": True},
                duration_ms,
            )
            return {
                "current_agent": "council_agent",
                "audit_trail": [
                    {
                        "agent": "logistics_agent",
                        "duration_ms": duration_ms,
                        "ok": True,
                        "skipped": True,
                    }
                ],
            }

        email_analysis = state.get("email_analysis")
        memory_context = state.get("memory_context")

        if email_analysis is None or memory_context is None:
            duration_ms = int((time.perf_counter() - t0) * 1000)
            err = "LogisticsAgent: missing email_analysis or memory_context"
            await log_agent_action(
                session_id,
                "logistics_agent",
                {},
                {"ok": False, "error": err},
                duration_ms,
            )
            return {
                "status": "failed",
                "errors": [err],
                "current_agent": "logistics_agent",
                "audit_trail": [
                    {
                        "agent": "logistics_agent",
                        "duration_ms": duration_ms,
                        "ok": False,
                        "error": err,
                    }
                ],
            }

        ea = (
            email_analysis
            if isinstance(email_analysis, EmailAnalysis)
            else EmailAnalysis.model_validate(email_analysis)
        )
        mc = (
            memory_context
            if isinstance(memory_context, MemoryContext)
            else MemoryContext.model_validate(memory_context)
        )

        try:
            structured = self._llm.with_structured_output(LogisticsAnalysis)
            payload = json.dumps(
                {"email_analysis": ea.model_dump(), "memory_context": mc.model_dump()},
                default=str,
            )
            messages = [
                SystemMessage(content=self._SYSTEM),
                HumanMessage(
                    content=f"You are a logistics coordinator for a family caregiving operation. "
                    f"Given this appointment change and memory context, analyze scheduling, transport, and family coordination.\n\n{payload}"
                ),
            ]
            raw = await structured.ainvoke(messages)
            result = LogisticsAnalysis.model_validate(raw)
            derived = _derive_risk_level(
                result.transportation_needs_rebooking,
                ea.urgency_level,
            )
            result = result.model_copy(update={"risk_level": derived})

            duration_ms = int((time.perf_counter() - t0) * 1000)
            await log_agent_action(
                session_id,
                "logistics_agent",
                {"urgency_level": ea.urgency_level},
                {"ok": True, "logistics_analysis": result.model_dump()},
                duration_ms,
            )
            return {
                "logistics_analysis": result,
                "current_agent": "council_agent",
                "audit_trail": [
                    {
                        "agent": "logistics_agent",
                        "duration_ms": duration_ms,
                        "ok": True,
                    }
                ],
            }
        except Exception as exc:
            duration_ms = int((time.perf_counter() - t0) * 1000)
            err_msg = f"LogisticsAgent: {type(exc).__name__}: {exc}"
            await log_agent_action(
                session_id,
                "logistics_agent",
                {"email_analysis": ea.model_dump()},
                {
                    "ok": False,
                    "error": err_msg,
                    "traceback": traceback.format_exc(),
                },
                duration_ms,
            )
            return {
                "status": "failed",
                "errors": [err_msg],
                "current_agent": "logistics_agent",
                "audit_trail": [
                    {
                        "agent": "logistics_agent",
                        "duration_ms": duration_ms,
                        "ok": False,
                        "error": err_msg,
                    }
                ],
            }


logistics_agent = LogisticsAgent()
