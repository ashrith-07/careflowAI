"""Quick test to verify the entire pipeline works end-to-end without the frontend."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from app.graph.workflow import run_workflow
from app.memory.memory_store import init_db, seed_demo_data

TEST_EMAIL = """Hi Patrick,

Your father's neurology appointment has been moved from Tuesday 10:30 AM to Wednesday 2:00 PM.

Please confirm transportation arrangements.

Regards,
Dr. Patel's Office"""


def _dump(label: str, value: Any) -> None:
    print(f"\n=== {label} ===")
    if value is None:
        print("(none)")
        return
    if hasattr(value, "model_dump"):
        print(json.dumps(value.model_dump(), indent=2, default=str))
    elif isinstance(value, (dict, list)):
        print(json.dumps(value, indent=2, default=str))
    else:
        print(repr(value))


async def main() -> None:
    await init_db()
    await seed_demo_data()
    print("Running CareFlow AI workflow...")
    result = await run_workflow(TEST_EMAIL, "test-session-001")
    _dump("EMAIL ANALYSIS", result.get("email_analysis"))
    _dump("MEMORY CONTEXT", result.get("memory_context"))
    _dump("LOGISTICS ANALYSIS", result.get("logistics_analysis"))
    _dump("COUNCIL RECOMMENDATION", result.get("council_recommendation"))
    print("\n✓ Pipeline test complete!")


if __name__ == "__main__":
    asyncio.run(main())
