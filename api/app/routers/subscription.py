"""POST /subscription {"on": true|false} — switch the reader's tier.

Calls the same SQL function the dashboard used directly
(public.set_own_subscription, security definer, admin never touched) AS THE
READER, so auth.uid() is theirs and the rule set stays in one place. When
payment arrives, this route is where Stripe checkout starts instead.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .. import db
from ..auth import User, current_user

router = APIRouter(tags=["account"])


class SwitchBody(BaseModel):
    on: bool


@router.post("/subscription")
async def switch_subscription(body: SwitchBody, user: User = Depends(current_user)):
    tier = await db.rpc("set_own_subscription", {"p_on": body.on}, user.token)
    return {"tier": tier, "subscriber": tier in {"enterprise", "admin"}}
