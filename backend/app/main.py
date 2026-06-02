import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings
from app.memory.memory_store import init_db, seed_demo_data
from app.middleware.request_logging import RequestLoggingMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting CareFlow AI...")
    await init_db()
    await seed_demo_data()
    print("Database ready. Seed data loaded.")
    yield
    print("Shutting down CareFlow AI...")


app = FastAPI(
    title="CareFlow AI",
    description="Multi-Agent AI Operating System for Caregiver-CEOs",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/")
def root_health() -> dict[str, str]:
    return {"status": "healthy", "app": "CareFlow AI"}


app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
