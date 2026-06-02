"""LangGraph StateGraph orchestrator for CareFlow AI."""

from __future__ import annotations

import traceback
from collections.abc import AsyncIterator
from typing import Any, cast

from langgraph.graph import StateGraph, END

from app.agents.council_agent import CouncilAgent
from app.agents.email_agent import EmailAgent
from app.agents.logistics_agent import LogisticsAgent
from app.agents.memory_agent import MemoryAgent
from app.graph.state import WorkflowState


def route_after_agent(state: WorkflowState, next_agent_name: str) -> str:
    """
    Shared routing: on failure go to END; otherwise continue to the next agent node.
    Per-node wrappers satisfy LangGraph's single-argument conditional signature.
    """
    if state.get("status") == "failed":
        return END
    return next_agent_name


def route_after_email_agent(state: WorkflowState) -> str:
    return route_after_agent(state, "memory_agent")


def route_after_memory_agent(state: WorkflowState) -> str:
    return route_after_agent(state, "logistics_agent")


def route_after_logistics_agent(state: WorkflowState) -> str:
    return route_after_agent(state, "council_agent")


async def email_node(state: WorkflowState) -> dict[str, Any]:
    return await EmailAgent().run(state)


async def memory_node(state: WorkflowState) -> dict[str, Any]:
    return await MemoryAgent().run(state)


async def logistics_node(state: WorkflowState) -> dict[str, Any]:
    return await LogisticsAgent().run(state)


async def council_node(state: WorkflowState) -> dict[str, Any]:
    return await CouncilAgent().run(state)


def _merge_state_update(acc: dict[str, Any], delta: dict[str, Any]) -> None:
    """Merge a node delta into accumulator (handles reducer list fields)."""
    for key, value in delta.items():
        if key in ("errors", "audit_trail") and isinstance(value, list):
            acc[key] = list(acc.get(key, [])) + value
        else:
            acc[key] = value


def _build_graph() -> StateGraph:
    graph = StateGraph(WorkflowState)
    graph.add_node("email_agent", email_node)
    graph.add_node("memory_agent", memory_node)
    graph.add_node("logistics_agent", logistics_node)
    graph.add_node("council_agent", council_node)

    graph.set_entry_point("email_agent")
    graph.add_conditional_edges(
        "email_agent",
        route_after_email_agent,
        {END: END, "memory_agent": "memory_agent"},
    )
    graph.add_conditional_edges(
        "memory_agent",
        route_after_memory_agent,
        {END: END, "logistics_agent": "logistics_agent"},
    )
    graph.add_conditional_edges(
        "logistics_agent",
        route_after_logistics_agent,
        {END: END, "council_agent": "council_agent"},
    )
    graph.add_edge("council_agent", END)
    return graph


# Compiled graph singleton (LangGraph compiled application)
app = _build_graph().compile()


def build_workflow():
    """Return the compiled LangGraph workflow singleton."""
    return app


def _initial_workflow_state(session_id: str, email_content: str) -> WorkflowState:
    """Initial state dict (WorkflowState is a TypedDict, not instantiable as a class)."""
    return {
        "session_id": session_id,
        "email_content": email_content,
        "email_analysis": None,
        "memory_context": None,
        "logistics_analysis": None,
        "council_recommendation": None,
        "current_agent": "email_agent",
        "errors": [],
        "audit_trail": [],
        "status": "running",
    }


async def run_workflow_stream(
    email_content: str,
    session_id: str,
) -> AsyncIterator[dict[str, Any]]:
    """
    Yields Server-Sent Events as each agent completes.
    Each yield is a dict with: {event: str, data: dict}
    Events: agent_started, agent_completed, workflow_completed, workflow_failed
    """
    initial_state = _initial_workflow_state(session_id, email_content)
    acc: dict[str, Any] = dict(initial_state)

    def _next_planned(after: str) -> str | None:
        return {
            "email_agent": "memory_agent",
            "memory_agent": "logistics_agent",
            "logistics_agent": "council_agent",
        }.get(after)

    yield {
        "event": "agent_started",
        "data": {
            "agent": "email_agent",
            "session_id": session_id,
        },
    }

    try:
        async for update in app.astream(
            cast(Any, initial_state),
            stream_mode="updates",
        ):
            if not isinstance(update, dict):
                continue
            for agent_name, delta in update.items():
                if not isinstance(delta, dict):
                    delta = {"value": delta}
                _merge_state_update(acc, delta)
                yield {
                    "event": "agent_completed",
                    "data": {
                        "agent": agent_name,
                        "session_id": session_id,
                        "updates": delta,
                    },
                }
                if delta.get("status") == "failed":
                    yield {
                        "event": "workflow_failed",
                        "data": {
                            "session_id": session_id,
                            "errors": acc.get("errors"),
                            "failed_at_agent": agent_name,
                        },
                    }
                    return
                following = _next_planned(agent_name)
                if following:
                    yield {
                        "event": "agent_started",
                        "data": {
                            "agent": following,
                            "session_id": session_id,
                        },
                    }

        yield {
            "event": "workflow_completed",
            "data": {
                "session_id": session_id,
                "status": acc.get("status"),
                "current_agent": acc.get("current_agent"),
                "audit_trail_len": len(acc.get("audit_trail") or []),
            },
        }
    except Exception as exc:
        yield {
            "event": "workflow_failed",
            "data": {
                "session_id": session_id,
                "error": f"{type(exc).__name__}: {exc}",
                "traceback": traceback.format_exc(),
            },
        }


async def run_workflow(email_content: str, session_id: str) -> WorkflowState:
    """Run full workflow and return final state."""
    initial_state = _initial_workflow_state(session_id, email_content)
    result = await app.ainvoke(cast(Any, initial_state))
    return cast(WorkflowState, result)


__all__ = [
    "app",
    "build_workflow",
    "council_node",
    "email_node",
    "logistics_node",
    "memory_node",
    "route_after_agent",
    "route_after_email_agent",
    "route_after_logistics_agent",
    "route_after_memory_agent",
    "run_workflow",
    "run_workflow_stream",
]
