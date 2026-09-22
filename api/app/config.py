"""Settings for the Attacked.ai API.

Read from the environment or api/.env. For local development the two public
values also fall back to the web app's ../.env (VITE_SUPABASE_URL /
VITE_SUPABASE_ANON_KEY), so `uvicorn app.main:app` works with no api/.env at all.

The service-role key is the only secret here and it must never reach the
browser: it lets the API read the subscriber-only tables once RLS locks them
to anon (phase 2). Without it the API forwards the reader's own token to
PostgREST and RLS applies as if the browser had asked.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import dotenv_values
from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = API_DIR.parent


def _web_env() -> dict[str, str]:
    p = REPO_DIR / ".env"
    return {k: (v or "") for k, v in dotenv_values(p).items()} if p.exists() else {}


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None          # only for projects still on HS256 tokens
    allowed_origins: str = "http://localhost:5173,https://attackedmap.vercel.app"
    reports_dir: str = str(REPO_DIR / "public" / "reports")
    ingest_token: str | None = None
    subscriber_tiers: str = "enterprise,admin"
    ingest_tables: str = "incidents,sources,blast_radius,peer_watchlist,adaptive_controls,historical_analogues,control_objectives,incident_updates"

    model_config = SettingsConfigDict(env_file=str(API_DIR / ".env"), extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def subscriber_tier_set(self) -> set[str]:
        return {t.strip() for t in self.subscriber_tiers.split(",") if t.strip()}

    @property
    def ingest_table_set(self) -> set[str]:
        return {t.strip() for t in self.ingest_tables.split(",") if t.strip()}


def load_settings() -> Settings:
    s = Settings()
    if not s.supabase_url or not s.supabase_anon_key:
        web = _web_env()
        s.supabase_url = s.supabase_url or web.get("VITE_SUPABASE_URL", "")
        s.supabase_anon_key = s.supabase_anon_key or web.get("VITE_SUPABASE_ANON_KEY", "")
    if not s.supabase_url or not s.supabase_anon_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY are required (api/.env), or VITE_* in the repo .env")
    s.supabase_url = s.supabase_url.rstrip("/")
    return s


settings = load_settings()
