# CareFlow AI

Multi-agent care workflow orchestration with a FastAPI + LangGraph backend and a React (Vite) frontend.

## Prerequisites

- Python 3.11+
- Node.js 20+
- A [Groq](https://groq.com) API key

## Quick start (local)

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set GROQ_API_KEY
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API health check: `http://localhost:8000/api/health`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The dev server proxies `/api` to the backend on port 8000.

## Docker

```bash
cp backend/.env.example backend/.env
# Set GROQ_API_KEY in backend/.env
docker compose up --build
```

## Project layout

- `backend/app/agents/` — specialized agents (email, memory, logistics, council)
- `backend/app/graph/` — LangGraph workflow and shared state
- `backend/app/api/` — HTTP routes
- `backend/app/memory/` — persistence helpers
- `backend/app/core/` — configuration and LLM factories
- `frontend/src/` — React UI, hooks, and API client
