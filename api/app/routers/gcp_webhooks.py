"""Calls from WorkOS (mounted under /api/webhooks on the GCP backend).

  POST /api/webhooks/workos   WorkOS-Signature checked (gcp/workos.py); unsigned,
                              wrongly signed or stale calls get 400.

  user.deleted   sign the person out everywhere here (account, tier and profile
                 stay; signing in again as a new WorkOS user re-links them by
                 verified email)
  user.updated   the account follows a changed, verified email address
  anything else  acknowledged and ignored

Both handlers can safely run twice: WorkOS retries failed deliveries, so the
same event can arrive more than once.

Setup: WorkOS dashboard → Webhooks → endpoint <PUBLIC_URL>/api/webhooks/workos
with the user.updated and user.deleted events; its signing secret goes in Secret
Manager as workos-webhook-secret (WORKOS_WEBHOOK_SECRET).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request

from ..config import settings
from ..gcp import accounts, pg, workos

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
log = logging.getLogger("uvicorn.error")


@router.post("/workos")
async def workos_webhook(request: Request):
    if not settings.workos_webhook_secret:
        raise HTTPException(503, "webhooks are not configured")
    try:
        event = workos.verify_webhook(await request.body(), request.headers.get("workos-signature"))
    except workos.WorkOSError as e:
        log.warning("workos webhook refused: %s", e)
        raise HTTPException(400, "invalid signature")
    kind, data = event["event"], event.get("data")
    wid = str(data.get("id") or "") if isinstance(data, dict) else ""
    if wid and kind in ("user.deleted", "user.updated"):
        p = await pg.pool()
        async with p.acquire() as conn:
            if kind == "user.deleted":
                await accounts.forget_workos_user(conn, wid)
            else:
                await accounts.follow_workos_email(conn, wid, data.get("email"), data.get("email_verified"))
    return {"ok": True}
