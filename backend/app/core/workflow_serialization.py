"""Serialize LangGraph / Pydantic workflow state for JSON APIs."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


def jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, BaseModel):
        return value.model_dump()
    if isinstance(value, dict):
        return {k: jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [jsonable(v) for v in value]
    return value


def build_process_email_response(session_id: str, state: dict[str, Any]) -> dict[str, Any]:
    """Shape returned by POST /process-email and stored in workflow_sessions.result_data."""
    return {
        "session_id": session_id,
        "status": state.get("status"),
        "email_analysis": jsonable(state.get("email_analysis")),
        "memory_context": jsonable(state.get("memory_context")),
        "logistics_analysis": jsonable(state.get("logistics_analysis")),
        "council_recommendation": jsonable(state.get("council_recommendation")),
        "audit_trail": jsonable(state.get("audit_trail")),
        "errors": jsonable(state.get("errors")),
        "current_agent": state.get("current_agent"),
    }
