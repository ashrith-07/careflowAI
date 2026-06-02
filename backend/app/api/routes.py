"""FastAPI routes for CareFlow AI."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.core.workflow_serialization import build_process_email_response, jsonable
from app.graph.workflow import run_workflow, run_workflow_stream
from app.memory.memory_store import (
    create_session,
    get_audit_log,
    get_session,
    update_session_status,
)

log = logging.getLogger("careflow.api")

router = APIRouter(tags=["api"])

class ProcessEmailRequest(BaseModel):
    email: str = Field(..., min_length=1, description="Raw email body to process")


class SessionApproveRequest(BaseModel):
    action: Literal["approve", "reject", "review"]
    notes: str = ""


@router.get("/demo")
async def get_demo() -> dict[str, Any]:
    return {
        "email": (
            "Hi Patrick,\n\n"
            "Your father's neurology appointment has been moved "
            "from Tuesday 10:30 AM to Wednesday 2:00 PM.\n\n"
            "Please confirm transportation arrangements.\n\n"
            "Regards,\n"
            "Dr. Patel's Office"
        ),
        "context": {
            "patient": "Father",
            "doctor": "Dr. Patel",
            "caregiver": "Patrick",
            "scenario": "Appointment rescheduled — transport confirmation needed",
        },
    }


@router.post("/process-email")
async def process_email(body: ProcessEmailRequest) -> dict[str, Any]:
    session_id = str(uuid.uuid4())
    await create_session(session_id, body.email)
    try:
        final = await run_workflow(body.email, session_id)
    except Exception as exc:
        log.exception("Workflow invoke failed: %s", session_id)
        await update_session_status(
            session_id,
            "failed",
            {
                "session_id": session_id,
                "status": "failed",
                "errors": [f"{type(exc).__name__}: {exc}"],
            },
        )
        raise HTTPException(
            status_code=500,
            detail={"message": "LLM or workflow execution failed", "error": str(exc)},
        ) from exc

    payload = build_process_email_response(session_id, dict(final))
    try:
        await update_session_status(session_id, str(final.get("status", "running")), payload)
    except Exception as exc:
        log.exception("Failed to persist session %s", session_id)
        raise HTTPException(
            status_code=500,
            detail={"message": "Failed to save session result", "error": str(exc)},
        ) from exc

    if final.get("status") == "failed":
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Workflow completed with failures",
                "errors": final.get("errors"),
                "session_id": session_id,
            },
        )

    return payload


@router.get("/process-email/stream")
async def process_email_stream(
    email: Annotated[str, Query(..., min_length=1, description="URL-encoded email body")],
) -> EventSourceResponse:
    async def event_generator() -> Any:
        session_id = str(uuid.uuid4())
        try:
            await create_session(session_id, email)
        except Exception as exc:
            log.exception("create_session failed")
            yield {
                "event": "error",
                "data": json.dumps(
                    {
                        "status_code": 500,
                        "message": "Could not create workflow session",
                        "error": str(exc),
                    }
                ),
            }
            return

        final_payload: dict[str, Any] | None = None
        try:
            async for payload in run_workflow_stream(email, session_id):
                ev = payload.get("event", "message")
                raw_data = payload.get("data", {})
                yield {"event": ev, "data": json.dumps(jsonable(raw_data))}
                if ev == "workflow_completed":
                    final_payload = raw_data.get("result")
                elif ev == "workflow_failed":
                    err_body = {
                        "status_code": 500,
                        "message": "Workflow failed",
                        "session_id": session_id,
                        "errors": raw_data.get("errors"),
                        "error": raw_data.get("error"),
                    }
                    yield {"event": "error", "data": json.dumps(jsonable(err_body))}
                    final_payload = raw_data.get("result")
        except Exception as exc:
            log.exception("SSE stream failure: %s", session_id)
            yield {
                "event": "error",
                "data": json.dumps(
                    {
                        "status_code": 500,
                        "message": "Stream processing error",
                        "error": str(exc),
                        "session_id": session_id,
                    }
                ),
            }
            return
        finally:
            if final_payload is not None:
                try:
                    st = str(final_payload.get("status", "running"))
                    await update_session_status(session_id, st, final_payload)
                except Exception:
                    log.exception("Failed to persist streamed session %s", session_id)

    return EventSourceResponse(event_generator())


@router.post("/sessions/{session_id}/approve")
async def approve_session(session_id: str, body: SessionApproveRequest) -> dict[str, Any]:
    row = await get_session(session_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")

    rd_raw = row.get("result_data")
    rd: dict[str, Any] = rd_raw if isinstance(rd_raw, dict) else {}

    notes = body.notes
    if body.action == "approve":
        merged = {**rd, "approval_notes": notes, "action": "approve"}
        await update_session_status(session_id, "approved", merged)
        return {
            "status": "approved",
            "session_id": session_id,
            "message": "Session approved. You may proceed with coordinated actions.",
        }
    if body.action == "reject":
        merged = {**rd, "rejection_notes": notes, "action": "reject"}
        await update_session_status(session_id, "rejected", merged)
        return {
            "status": "rejected",
            "session_id": session_id,
            "message": "Session rejected. Automated follow-ups are halted.",
        }
    # review
    merged = {**rd, "review_notes": notes, "action": "review"}
    await update_session_status(session_id, "awaiting_approval", merged)
    return {
        "status": "review",
        "session_id": session_id,
        "message": "Session flagged for additional human review; notes stored.",
    }


@router.get("/sessions/{session_id}")
async def get_session_detail(session_id: str) -> dict[str, Any]:
    row = await get_session(session_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")
    audit = await get_audit_log(session_id)
    return {**row, "audit_log": audit}


@router.get("/sessions/{session_id}/audit")
async def get_session_audit(session_id: str) -> dict[str, Any]:
    row = await get_session(session_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")
    audit = await get_audit_log(session_id)
    return {"session_id": session_id, "audit_log": audit}


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "healthy", "app": "CareFlow AI", "version": "1.0.0"}
