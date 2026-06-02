from __future__ import annotations

import operator
from typing import Annotated, Optional, TypedDict

from pydantic import BaseModel


class EmailAnalysis(BaseModel):
    event_type: str
    person: str
    doctor: str
    old_time: Optional[str] = None
    new_time: str
    transportation_required: bool
    urgency_level: str  # low/medium/high
    action_items: list[str]


class MemoryContext(BaseModel):
    patient_found: bool
    preferred_transport: Optional[str] = None
    last_appointment: Optional[str] = None
    appointment_history: list[dict]
    patient_notes: Optional[str] = None
    doctor_history: list[str]


class LogisticsAnalysis(BaseModel):
    conflict_detected: bool
    transportation_needs_rebooking: bool
    family_notification_required: bool
    estimated_travel_time: Optional[str] = None
    recommended_actions: list[str]
    risk_level: str  # low/medium/high


class CouncilRecommendation(BaseModel):
    recommendation: str
    reasoning: list[str]
    tradeoffs: list[str]
    priority_actions: list[dict]  # [{action, deadline, responsible_party}]
    confidence_score: float  # 0.0 to 1.0


class WorkflowState(TypedDict):
    session_id: str
    email_content: str
    email_analysis: Optional[EmailAnalysis]
    memory_context: Optional[MemoryContext]
    logistics_analysis: Optional[LogisticsAnalysis]
    council_recommendation: Optional[CouncilRecommendation]
    current_agent: str
    errors: Annotated[list[str], operator.add]
    audit_trail: Annotated[list[dict], operator.add]
    status: str  # running/awaiting_approval/completed/failed


def create_initial_workflow_state(
    session_id: str,
    email_content: str,
) -> WorkflowState:
    """Build a LangGraph-compatible initial state with reducer channels initialized."""
    return {
        "session_id": session_id,
        "email_content": email_content,
        "email_analysis": None,
        "memory_context": None,
        "logistics_analysis": None,
        "council_recommendation": None,
        "current_agent": "",
        "errors": [],
        "audit_trail": [],
        "status": "running",
    }
