"""POST /ingest — the sweeper's write path (replaces the guard-ingest edge function).

Body: {"table": "incidents", "rows": [ {...}, ... ]}
Auth: header x-ingest-token equal to INGEST_TOKEN on the API. The token lives
on the operator's machine and in the API's environment only — never in the
public repo (the old one was committed; rotate it when you switch over).

Only the tables in INGEST_TABLES may be written, with the service-role key,
so RLS can stay fully closed to the public.
"""
from __future__ import annotations

import hmac
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .. import db
from ..config import settings

router = APIRouter(tags=["ingest"])


class IngestBody(BaseModel):
    table: str
    rows: list[dict[str, Any]] = Field(min_length=1, max_length=2000)


@router.post("/ingest")
async def ingest(body: IngestBody, x_ingest_token: str | None = Header(default=None)):
    if not settings.ingest_token:
        raise HTTPException(503, "INGEST_TOKEN is not configured on the API")
    if not x_ingest_token or not hmac.compare_digest(x_ingest_token, settings.ingest_token):
        raise HTTPException(401, "bad ingest token")
    if body.table not in settings.ingest_table_set:
        raise HTTPException(400, f"table not allowed: {body.table}")
    n = await db.insert(body.table, body.rows)
    return {"table": body.table, "inserted": n}
