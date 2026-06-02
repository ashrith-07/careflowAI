"""LangGraph workflow assembly; extend when agents are implemented."""

from langgraph.graph import END, START, StateGraph


def build_workflow():
    """Minimal valid graph placeholder until agent nodes are registered."""
    graph = StateGraph(dict)

    def noop(state: dict) -> dict:
        return state

    graph.add_node("noop", noop)
    graph.add_edge(START, "noop")
    graph.add_edge("noop", END)
    return graph.compile()
