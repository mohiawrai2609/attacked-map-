"""WorkOS AuthKit: the hosted sign-in page in front of our own sessions
(AUTH_PROVIDER=workos).

WorkOS proves who someone is (emailed code, Google, Microsoft; company SSO
later) and sends them back with a one-time code. routers/gcp_auth.py turns that
into the same __session cookie and data-API token as every other sign-in, then
ends the session WorkOS opened (revoke_session): ours is the only one, so
sign-out, "sign out everywhere" and the 30-day limit work exactly as before,
and nothing WorkOS issued is ever stored.

Setup (deploy/gcp/README.md → WorkOS): WorkOS dashboard → Redirects:
    redirect URI      <PUBLIC_URL>/api/auth/workos/callback
    sign-in endpoint  <PUBLIC_URL>/api/auth/workos/start
API key → Secret Manager workos-api-key; client id → WORKOS_CLIENT_ID.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

import httpx
import jwt

from ..config import settings


class WorkOSError(Exception):
    pass


def redirect_uri() -> str:
    return f"{settings.public_url.rstrip('/')}/api/auth/workos/callback"


def authorize_url(state: str, challenge: str, screen_hint: str = "sign-up", login_hint: str | None = None) -> str:
    q = {
        "client_id": settings.workos_client_id, "redirect_uri": redirect_uri(), "response_type": "code",
        "provider": "authkit", "screen_hint": screen_hint, "state": state,
        "code_challenge": challenge, "code_challenge_method": "S256",
    }
    if login_hint:
        q["login_hint"] = login_hint
    return f"{settings.workos_api_base}/user_management/authorize?{urlencode(q)}"


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=settings.workos_api_base, timeout=httpx.Timeout(15.0, connect=5.0))


def _error_code(r: httpx.Response) -> str:
    """WorkOS's error code for the log (never the body: it can echo what we sent)."""
    try:
        j = r.json()
        return str(j.get("code") or j.get("error") or "")[:80] if isinstance(j, dict) else ""
    except ValueError:
        return ""


async def authenticate_code(code: str, verifier: str, ip: str | None, user_agent: str | None) -> dict:
    """Code -> {user, organization_id, access_token, authentication_method, …}."""
    body = {"client_id": settings.workos_client_id, "client_secret": settings.workos_api_key,
            "grant_type": "authorization_code", "code": code, "code_verifier": verifier}
    if ip:
        body["ip_address"] = ip
    if user_agent:
        body["user_agent"] = user_agent[:400]
    try:
        async with _client() as c:
            r = await c.post("/user_management/authenticate", json=body)
    except httpx.HTTPError as e:
        raise WorkOSError(f"WorkOS unreachable ({e.__class__.__name__})") from e
    if r.status_code != 200:
        raise WorkOSError(f"WorkOS refused the sign-in code ({r.status_code} {_error_code(r)})")
    data = r.json()
    if not isinstance(data, dict) or not isinstance(data.get("user"), dict) or not data["user"].get("id"):
        raise WorkOSError("WorkOS returned no user")
    return data


def session_id(access_token: str | None) -> str | None:
    """The WorkOS session behind a sign-in: the access token's sid claim.

    Read without checking the signature, on purpose: the token came straight
    from WorkOS in the answer to our own authenticated TLS call, which is the
    check (as OpenID Connect allows for tokens from the token endpoint). It is
    only used to end that session, never to decide who someone is."""
    if not access_token:
        return None
    try:
        sid = jwt.decode(access_token, options={"verify_signature": False}).get("sid")
    except jwt.PyJWTError:
        return None
    return sid if isinstance(sid, str) and sid else None


async def revoke_session(sid: str) -> None:
    try:
        async with _client() as c:
            r = await c.post("/user_management/sessions/revoke", json={"session_id": sid},
                             headers={"Authorization": f"Bearer {settings.workos_api_key}"})
    except httpx.HTTPError as e:
        raise WorkOSError(f"WorkOS unreachable ({e.__class__.__name__})") from e
    if r.status_code >= 300:
        raise WorkOSError(f"WorkOS did not end the session ({r.status_code} {_error_code(r)})")


def verify_webhook(payload: bytes, header: str | None, tolerance_s: int = 300) -> dict:
    """The event in a WorkOS webhook, once its WorkOS-Signature header checks out:
    "t=<ms since epoch>, v1=<hex HMAC-SHA256 of '<t>.<raw body>', keyed with the
    endpoint's secret>". A stale timestamp is refused, so a captured call cannot
    be replayed later."""
    secret = settings.workos_webhook_secret
    if not secret:
        raise WorkOSError("webhook secret not configured")
    parts = dict(p.strip().split("=", 1) for p in (header or "").split(",") if "=" in p)
    t, sig = parts.get("t", ""), parts.get("v1", "")
    if not t.isdigit() or not sig:
        raise WorkOSError("malformed signature header")
    if abs(time.time() * 1000 - int(t)) > tolerance_s * 1000:
        raise WorkOSError("signature too old")
    expected = hmac.new(secret.encode("utf-8"), t.encode("ascii") + b"." + payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise WorkOSError("signature mismatch")
    try:
        event = json.loads(payload)
    except ValueError as e:
        raise WorkOSError("body is not JSON") from e
    if not isinstance(event, dict) or not isinstance(event.get("event"), str):
        raise WorkOSError("not a WorkOS event")
    return event
