"""Who is asking.

Supabase Auth stays the identity provider. The browser sends the session's
access token as `Authorization: Bearer <jwt>`; we verify it against the
project's published signing keys (ES256 JWKS at
/auth/v1/.well-known/jwks.json — no shared secret) and read the user's tier
and industry from profiles. Nothing here issues tokens.

Dependencies:
  current_user   → 401 unless a valid token
  optional_user  → None for anonymous readers (the report route uses this)
  subscriber     → 403 unless tier is in SUBSCRIBER_TIERS
"""
from __future__ import annotations

import time
from dataclasses import dataclass

import httpx
import jwt
from fastapi import Depends, HTTPException, Request
from jwt import PyJWKClient

from .config import settings
from . import db

_jwks_client: PyJWKClient | None = None


def _jwks() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json", cache_keys=True, lifespan=600)
    return _jwks_client


@dataclass
class User:
    id: str
    email: str | None
    tier: str
    industry: str | None
    full_name: str | None
    company: str | None
    role: str | None
    token: str

    @property
    def subscriber(self) -> bool:
        return self.tier in settings.subscriber_tier_set


def decode_token(token: str) -> dict:
    """Verify signature, audience and expiry; return the claims."""
    try:
        alg = jwt.get_unverified_header(token).get("alg", "")
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise HTTPException(401, "token uses HS256 but SUPABASE_JWT_SECRET is not configured")
            return jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], audience="authenticated")
        key = _jwks().get_signing_key_from_jwt(token).key
        return jwt.decode(token, key, algorithms=["ES256", "RS256"], audience="authenticated")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "session expired — sign in again")
    except (jwt.PyJWTError, httpx.HTTPError) as e:
        raise HTTPException(401, f"invalid token: {e.__class__.__name__}")


def _bearer(request: Request) -> str | None:
    h = request.headers.get("authorization", "")
    return h[7:].strip() if h.lower().startswith("bearer ") and len(h) > 7 else None


async def _user_from_token(token: str) -> User:
    claims = decode_token(token)
    uid = claims.get("sub")
    if not uid:
        raise HTTPException(401, "token has no subject")
    profile = await db.get_profile(uid, token) or {}
    return User(
        id=uid, email=claims.get("email") or profile.get("email"),
        tier=profile.get("tier") or "free", industry=profile.get("industry"),
        full_name=profile.get("full_name"), company=profile.get("company"), role=profile.get("role"),
        token=token,
    )


async def current_user(request: Request) -> User:
    token = _bearer(request)
    if not token:
        raise HTTPException(401, "sign in required")
    return await _user_from_token(token)


async def optional_user(request: Request) -> User | None:
    token = _bearer(request)
    if not token:
        return None
    try:
        return await _user_from_token(token)
    except HTTPException:
        return None


async def subscriber(user: User = Depends(current_user)) -> User:
    if not user.subscriber:
        raise HTTPException(403, "subscriber layer — subscribe to open it")
    return user


def now() -> int:
    return int(time.time())
