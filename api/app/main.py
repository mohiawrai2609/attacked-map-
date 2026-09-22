"""Attacked.ai API — FastAPI in front of the Supabase database.

Supabase Auth stays the identity provider; this service verifies its tokens
and owns everything that must not be decided in the browser: who may read the
subscriber layer, the report lock, subscription switching, and the sweeper's
write path. Public reads (incident lists, map dots) stay on PostgREST.

Run locally:   uvicorn app.main:app --reload --port 8000   (from api/)
Docs:          http://localhost:8000/docs
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import incidents, ingest, me, reports, subscription

app = FastAPI(title="Attacked.ai API", version="0.1.0", docs_url="/docs", redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "x-ingest-token"],
)

app.include_router(me.router)
app.include_router(incidents.router)
app.include_router(subscription.router)
app.include_router(reports.router)
app.include_router(ingest.router)


@app.get("/health", tags=["ops"])
async def health():
    return {
        "ok": True,
        "supabase": settings.supabase_url,
        "server_key": bool(settings.server_key),
        "ingest": bool(settings.ingest_token),
    }
