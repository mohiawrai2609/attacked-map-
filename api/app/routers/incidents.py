"""Subscriber layer for one incident — the rows behind the counts.

GET /incidents/{id}/subscriber-layer  (subscriber or admin only)
  → { blast_radius: [...], adaptive_controls: [...], peer_watchlist: [...],
      historical_analogues: [...], sources: [...] }

Free readers get 403 with a plain message; the dashboard shows the locked
panel with the counts instead (the counts come from public.incidents, which
stays readable).
"""
from fastapi import APIRouter, Depends, HTTPException

from .. import db
from ..auth import User, subscriber

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("/{incident_id}/subscriber-layer")
async def subscriber_layer(incident_id: int, user: User = Depends(subscriber)):
    if not await db.incident_exists(incident_id, user.token):
        raise HTTPException(404, "no such incident")
    layer = await db.subscriber_layer(incident_id, user.token)
    return {"incident_id": incident_id, **layer}
