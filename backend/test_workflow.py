"""Quick end-to-end test for the CareFlow AI multi-agent pipeline."""

from __future__ import annotations

import asyncio
import re


def _pick(obj: object | None, key: str, default: str = "?") -> str:
    if obj is None:
        return default
    if isinstance(obj, dict):
        v = obj.get(key, default)
    else:
        v = getattr(obj, key, default)
    return default if v is None else str(v)


def _rec_snippet(obj: object | None, n: int = 120) -> str:
    raw = _pick(obj, "recommendation", "")
    if raw == "?":
        return "?"
    return raw[:n] + ("…" if len(raw) > n else "")


async def main() -> None:
    from app.graph.workflow import run_workflow
    from app.memory.memory_store import init_db, seed_demo_data

    await init_db()
    await seed_demo_data()

    test_emails = [
        (
            "Assignment email",
            "Hi Patrick,\n\nYour father's neurology appointment has been moved "
            "from Tuesday 10:30 AM to Wednesday 2:00 PM.\n\n"
            "Please confirm transportation arrangements.\n\nRegards,\nDr. Patel's Office",
        ),
        (
            "New booking email",
            "Hi Jyothi,\nI want to book an appointment with you at 9pm",
        ),
    ]

    for label, email in test_emails:
        sid = re.sub(r"[^a-zA-Z0-9]+", "-", f"test-{label}")[:48].strip("-") or "test-run"
        print(f"\n{'=' * 60}")
        print(f"TEST: {label}")
        print(f"{'=' * 60}")
        result = await run_workflow(email, sid)
        ea = result.get("email_analysis")
        cr = result.get("council_recommendation")
        print(f"Email Agent  → event_type={_pick(ea, 'event_type')} person={_pick(ea, 'person')}")
        print(f"Council      → {_rec_snippet(cr)}")
        print(f"Status       → {result.get('status')}")

    print("\n✓ All tests complete")


if __name__ == "__main__":
    asyncio.run(main())
