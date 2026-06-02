from typing import Annotated, TypedDict


class WorkflowState(TypedDict, total=False):
    """Shared LangGraph workflow state."""

    messages: list
    thread_id: str


def create_initial_state(thread_id: str) -> WorkflowState:
    return {"thread_id": thread_id, "messages": []}
