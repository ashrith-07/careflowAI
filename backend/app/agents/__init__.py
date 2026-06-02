"""CareFlow AI agent registry."""

from app.agents.council_agent import CouncilAgent, council_agent
from app.agents.email_agent import EmailAgent, email_agent
from app.agents.logistics_agent import LogisticsAgent, logistics_agent
from app.agents.memory_agent import MemoryAgent, memory_agent

__version__ = "1.0.0"

AGENT_REGISTRY = {
    "email_agent": EmailAgent,
    "memory_agent": MemoryAgent,
    "logistics_agent": LogisticsAgent,
    "council_agent": CouncilAgent,
}

__all__ = [
    "CouncilAgent",
    "EmailAgent",
    "LogisticsAgent",
    "MemoryAgent",
    "AGENT_REGISTRY",
    "__version__",
    "council_agent",
    "email_agent",
    "logistics_agent",
    "memory_agent",
]
