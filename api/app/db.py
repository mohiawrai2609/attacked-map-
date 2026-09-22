"""Data access — PostgREST over HTTP, the same API the browser uses today.

Two modes, chosen per request:
  as the server — when SUPABASE_SECRET_KEY (or the legacy service_role key) is
                  set: reads bypass RLS and the API applies the tier rules
                  itself. This is what lets RLS lock the subscriber tables to
                  the public in phase 2.
  as the reader — otherwise the reader's own JWT is forwarded and RLS applies
                  exactly as if the browser had asked. Fine for development.
RPC calls are ALWAYS as the reader (auth.uid() must be theirs).

No DB connection string is needed; everything goes through /rest/v1 with the
column lists the frontend already uses (src/dashboard/data.js).
"""
from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException

from .config import settings

REST = f"{settings.supabase_url}/rest/v1"
_client: httpx.AsyncClient | None = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=20.0)
    return _client


def _auth(as_server: bool, user_token: str | None) -> dict[str, str]:
    """PostgREST headers.

    New-style keys (sb_publishable_ / sb_secret_) are sent in `apikey` ONLY —
    they are not JWTs and PostgREST rejects them as a Bearer. The legacy JWT
    keys (anon / service_role) go in both headers, as supabase-js does. A
    reader's session token is always a JWT and always goes in Authorization.
    """
    key = settings.server_key if (as_server and settings.server_key) else settings.public_key
    h = {"apikey": key, "Accept": "application/json"}
    if as_server and settings.server_key:
        if not settings.server_key.startswith("sb_"):
            h["Authorization"] = f"Bearer {settings.server_key}"
    elif user_token:
        h["Authorization"] = f"Bearer {user_token}"
    elif not settings.public_key.startswith("sb_"):
        h["Authorization"] = f"Bearer {settings.public_key}"
    return h


def _headers(user_token: str | None, prefer: str | None = None) -> dict[str, str]:
    h = _auth(as_server=True, user_token=user_token)
    if prefer:
        h["Prefer"] = prefer
    return h


async def get(table: str, params: dict[str, str], user_token: str | None = None) -> list[dict[str, Any]]:
    r = await client().get(f"{REST}/{table}", params=params, headers=_headers(user_token))
    if r.status_code >= 400:
        raise HTTPException(502, f"database read failed ({r.status_code}): {r.text[:200]}")
    return r.json()


async def rpc(name: str, body: dict[str, Any], user_token: str | None) -> Any:
    """Call a SQL function AS THE READER (auth.uid() must be theirs), never as the server."""
    h = {**_auth(as_server=False, user_token=user_token), "Content-Type": "application/json"}
    r = await client().post(f"{REST}/rpc/{name}", json=body, headers=h)
    if r.status_code >= 400:
        raise HTTPException(502, f"{name} failed ({r.status_code}): {r.text[:200]}")
    return r.json()


async def insert(table: str, rows: list[dict[str, Any]]) -> int:
    """Server-side write; requires the service role."""
    if not settings.server_key:
        raise HTTPException(503, "writes need SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) on the API")
    h = {**_auth(as_server=True, user_token=None), "Content-Type": "application/json", "Prefer": "return=minimal,resolution=merge-duplicates"}
    r = await client().post(f"{REST}/{table}", json=rows, headers=h)
    if r.status_code >= 400:
        raise HTTPException(502, f"insert into {table} failed ({r.status_code}): {r.text[:300]}")
    return len(rows)


# ── what the routes need ──────────────────────────────────────────────────
# "*" on the own-row profiles view: never a named list, which PostgREST rejects
# outright when one column is missing (see fetchProfile in src/auth/AuthProvider.jsx).
PROFILE_COLS = "*"


async def get_profile(user_id: str, user_token: str | None) -> dict[str, Any] | None:
    rows = await get("profiles", {"select": PROFILE_COLS, "id": f"eq.{user_id}", "limit": "1"}, user_token)
    return rows[0] if rows else None


LAYER = {
    "blast_radius": "id,name,type,country,exposure_group,reason,impact_score,transmission_mechanism,impact_horizon,recommended_action_for_them",
    "adaptive_controls": "id,control_id,parent_mc_id,statement,rationale,kind",
    "peer_watchlist": "id,name,country,exposure_reason",
    "historical_analogues": "id,event_name,entity,year,summary,outcome",
    "sources": "id,title,url,publisher",
}


async def subscriber_layer(incident_id: int, user_token: str | None) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    for table, cols in LAYER.items():
        out[table] = await get(table, {"select": cols, "incident_id": f"eq.{incident_id}"}, user_token)
    return out


async def incident_exists(incident_id: int, user_token: str | None) -> bool:
    rows = await get("incidents", {"select": "id", "id": f"eq.{incident_id}", "limit": "1"}, user_token)
    return bool(rows)
