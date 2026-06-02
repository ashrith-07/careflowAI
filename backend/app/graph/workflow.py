"""LangGraph workflow: email → memory → logistics → council."""

from langgraph.graph import END, START, StateGraph

from app.agents import council_agent, email_agent, logistics_agent, memory_agent
from app.graph.state import WorkflowState


def route_after_email(state: WorkflowState) -> str:
    if state.get("status") == "failed":
        return END
    return "memory"


def build_workflow():
    graph = StateGraph(WorkflowState)
    graph.add_node("email", email_agent.run)
    graph.add_node("memory", memory_agent.run)
    graph.add_node("logistics", logistics_agent.run)
    graph.add_node("council", council_agent.run)

    graph.add_edge(START, "email")
    graph.add_conditional_edges(
        "email",
        route_after_email,
        {"memory": "memory", END: END},
    )
    graph.add_edge("memory", "logistics")
    graph.add_edge("logistics", "council")
    graph.add_edge("council", END)
    return graph.compile()
