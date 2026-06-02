"""LangGraph workflow assembly; extend when agents are implemented."""

from langgraph.graph import END, START, StateGraph

from app.graph.state import WorkflowState


def build_workflow():
    """Minimal valid graph placeholder until agent nodes are registered."""
    graph = StateGraph(WorkflowState)

    def noop(state: WorkflowState) -> dict:
        # LangGraph requires at least one channel write per node.
        return {"current_agent": state["current_agent"]}

    graph.add_node("noop", noop)
    graph.add_edge(START, "noop")
    graph.add_edge("noop", END)
    return graph.compile()
