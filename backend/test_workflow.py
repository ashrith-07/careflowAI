"""Smoke-test the LangGraph workflow (run from repo root: python backend/test_workflow.py)."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

# Ensure `app.*` imports resolve when executed as `python backend/test_workflow.py`
_BACKEND = Path(__file__).resolve().parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))


async def _main() -> None:
    os.environ.setdefault("GROQ_API_KEY", "test")
    os.environ.setdefault("DATABASE_URL", str(_BACKEND / "_test_workflow_run.db"))

    from app.memory.memory_store import init_db, seed_demo_data

    await init_db()
    await seed_demo_data()

    from app.graph.workflow import run_workflow, run_workflow_stream

    session_id = "test-session-workflow-1"
    email = (
        "Subject: Reschedule\n\nPlease move Father's visit with Dr. Patel "
        "from Tuesday 10am to Friday 3pm. Wheelchair transport must be updated."
    )

    print("--- stream ---")
    async for evt in run_workflow_stream(email, session_id):
        print(evt)

    print("--- invoke (second run, new session) ---")
    out = await run_workflow(
        email,
        "test-session-workflow-2",
    )
    print("status", out.get("status"))
    print("current_agent", out.get("current_agent"))
    print("errors", out.get("errors"))


if __name__ == "__main__":
    asyncio.run(_main())
