"""SQLite-backed memory store (minimal placeholder)."""

import aiosqlite

from app.core.config import settings


async def get_connection() -> aiosqlite.Connection:
    return await aiosqlite.connect(settings.DATABASE_URL)
