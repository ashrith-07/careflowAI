"""Council agent: deliberative synthesis and recommendations."""

from __future__ import annotations

import json
import time
import traceback
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_llm_creative
from app.graph.state import (
    CouncilRecommendation,
    EmailAnalysis,
    LogisticsAnalysis,
    MemoryContext,
    WorkflowState,
)
from app.memory.memory_store import log_agent_action


def _confidence_from_state(state: WorkflowState) -> float:
    """Score 0.0–1.0 from how complete upstream analyses are."""
    score = 0.1
    ea = state.get("email_analysis")
    if ea is not None:
        score += 0.25
        ea_obj = ea if isinstance(ea, EmailAnalysis) else EmailAnalysis.model_validate(ea)
        if ea_obj.action_items:
            score += 0.05
    mc = state.get("memory_context")
    if mc is not None:
        score += 0.15
        mc_obj = mc if isinstance(mc, MemoryContext) else MemoryContext.model_validate(mc)
        if mc_obj.patient_found:
            score += 0.15
        if mc_obj.appointment_history:
            score += 0.05
    la = state.get("logistics_analysis")
    if la is not None:
        score += 0.2
        la_obj = la if isinstance(la, LogisticsAnalysis) else LogisticsAnalysis.model_validate(la)
        if la_obj.recommended_actions:
            score += 0.05
    return round(min(1.0, max(0.0, score)), 2)


def _ensure_priority_actions(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Guarantee at least three actionable items with deadline and owner."""
    out = [dict(a) for a in actions]
    templates = [
        {
            "action": "Confirm the new appointment time with the clinic or scheduler",
            "deadline": "Within 24 hours",
            "responsible_party": "Caregiver-CEO",
        },
        {
            "action": "Update or cancel medical transport and request revised pickup window",
            "deadline": "Within 12 hours of confirmation",
            "responsible_party": "Primary caregiver / transport coordinator",
        },
        {
            "action": "Notify family members who share driving or coverage duties",
            "deadline": "Same day",
            "responsible_party": "Caregiver-CEO",
        },
    ]
    i = 0
    while len(out) < 3:
        out.append(dict(templates[i % len(templates)]))
        i += 1
    return out


class CouncilAgent:
    """
    The deliberative decision-making body. Synthesizes all agent outputs into
    a final actionable recommendation with explicit reasoning and tradeoffs.
    """

    _SYSTEM = """You are the Council — a wise decision-making body for a Caregiver-CEO.

You receive analysis from three specialized agents (email parsing, institutional memory, logistics).
You must produce a clear, compassionate, actionable recommendation for an exhausted family leader balancing work, children, and elder care.

Requirements:
- recommendation: 2–4 sentences the caregiver can act on today.
- reasoning: bullet-style strings explaining why you chose this path.
- tradeoffs: honest downsides or risks (time, money, stress, clinical ambiguity).
- priority_actions: at least 3 objects, each with keys action, deadline, responsible_party (specific roles or names if known from context).
- confidence_score: your subjective 0.0–1.0 confidence — it will be merged with a data-completeness score, so calibrate honestly.

Never invent clinical facts; ground everything in the provided JSON."""

    def __init__(self) -> None:
        self._llm = get_llm_creative()

    async def run(self, state: WorkflowState) -> dict[str, Any]:
        session_id = state["session_id"]
        t0 = time.perf_counter()

        if state.get("status") == "failed":
            duration_ms = int((time.perf_counter() - t0) * 1000)
            await log_agent_action(
                session_id,
                "council_agent",
                {"skipped": True},
                {"ok": True, "skipped": True},
                duration_ms,
            )
            return {
                "current_agent": "complete",
                "audit_trail": [
                    {
                        "agent": "council_agent",
                        "duration_ms": duration_ms,
                        "ok": True,
                        "skipped": True,
                    }
                ],
            }

        ea = state.get("email_analysis")
        mc = state.get("memory_context")
        la = state.get("logistics_analysis")

        try:
            structured = self._llm.with_structured_output(CouncilRecommendation)
            bundle = {
                "email_analysis": (
                    ea.model_dump()
                    if isinstance(ea, EmailAnalysis)
                    else (EmailAnalysis.model_validate(ea).model_dump() if ea else None)
                ),
                "memory_context": (
                    mc.model_dump()
                    if isinstance(mc, MemoryContext)
                    else (MemoryContext.model_validate(mc).model_dump() if mc else None)
                ),
                "logistics_analysis": (
                    la.model_dump()
                    if isinstance(la, LogisticsAnalysis)
                    else (LogisticsAnalysis.model_validate(la).model_dump() if la else None)
                ),
            }
            messages = [
                SystemMessage(content=self._SYSTEM),
                HumanMessage(
                    content="Synthesize the following agent outputs into a CouncilRecommendation JSON.\n\n"
                    + json.dumps(bundle, default=str)
                ),
            ]
            raw = await structured.ainvoke(messages)
            result = CouncilRecommendation.model_validate(raw)
            completeness = _confidence_from_state(state)
            merged_confidence = round(
                min(1.0, max(0.0, max(result.confidence_score, completeness))),
                2,
            )
            actions = _ensure_priority_actions(
                [dict(x) for x in result.priority_actions]
            )
            result = result.model_copy(
                update={
                    "confidence_score": merged_confidence,
                    "priority_actions": actions,
                }
            )

            duration_ms = int((time.perf_counter() - t0) * 1000)
            await log_agent_action(
                session_id,
                "council_agent",
                {"completeness_score": completeness},
                {"ok": True, "council_recommendation": result.model_dump()},
                duration_ms,
            )
            return {
                "council_recommendation": result,
                "current_agent": "complete",
                "status": "awaiting_approval",
                "audit_trail": [
                    {
                        "agent": "council_agent",
                        "duration_ms": duration_ms,
                        "ok": True,
                    }
                ],
            }
        except Exception as exc:
            duration_ms = int((time.perf_counter() - t0) * 1000)
            err_msg = f"CouncilAgent: {type(exc).__name__}: {exc}"
            await log_agent_action(
                session_id,
                "council_agent",
                {},
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
                "current_agent": "council_agent",
                "audit_trail": [
                    {
                        "agent": "council_agent",
                        "duration_ms": duration_ms,
                        "ok": False,
                        "error": err_msg,
                    }
                ],
            }


council_agent = CouncilAgent()
