"""GET /me — who the token belongs to, with tier and industry from profiles."""
from fastapi import APIRouter, Depends

from ..auth import User, current_user

router = APIRouter(tags=["account"])


@router.get("/me")
async def me(user: User = Depends(current_user)):
    return {
        "id": user.id, "email": user.email, "tier": user.tier, "subscriber": user.subscriber,
        "industry": user.industry, "full_name": user.full_name, "company": user.company, "role": user.role,
    }
