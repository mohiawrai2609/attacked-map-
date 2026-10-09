"""WorkOS sign-in (AUTH_PROVIDER=workos) and its webhooks on the GCP backend
(see conftest.py). WorkOS itself is faked; nothing leaves the machine."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qs, urlparse

import jwt
import pytest

from app.config import settings
from app.gcp import workos

H = {"X-Requested-With": "attacked"}


@pytest.fixture
def workos_on(monkeypatch):
    """WorkOS switched on; returns the WorkOS sessions the API ended."""
    monkeypatch.setattr(settings, "auth_provider", "workos")
    monkeypatch.setattr(settings, "workos_api_key", "sk_test_key")
    monkeypatch.setattr(settings, "workos_client_id", "client_test")
    monkeypatch.setattr(settings, "workos_webhook_secret", "whsec_test")
    ended: list[str] = []

    async def fake_revoke(sid):
        ended.append(sid)

    monkeypatch.setattr(workos, "revoke_session", fake_revoke)
    return ended


def fake_workos(monkeypatch, user: dict, sid: str = "session_1", **extra) -> dict:
    """WorkOS answers the code exchange with this user; returns what it was sent."""
    seen: dict = {}

    async def fake_authenticate(code, verifier, ip, user_agent):
        seen.update(code=code, verifier=verifier, ip=ip)
        token = jwt.encode({"sid": sid, "sub": user["id"]}, "unchecked", algorithm="HS256")
        return {"user": {"object": "user", **user}, "access_token": token, "refresh_token": "r", **extra}

    monkeypatch.setattr(workos, "authenticate_code", fake_authenticate)
    return seen


async def start_state(client, **params) -> str:
    r = await client.get("/api/auth/workos/start", params=params, follow_redirects=False)
    assert r.status_code == 302, r.text
    return parse_qs(urlparse(r.headers["location"]).query)["state"][0]


async def sign_in(client, monkeypatch, user: dict, **kw):
    seen = fake_workos(monkeypatch, user, **kw)
    state = await start_state(client)
    cb = await client.get("/api/auth/workos/callback", params={"state": state, "code": "wos-code"}, follow_redirects=False)
    return cb, seen


def signed(event: dict, secret: str = "whsec_test", t: int | None = None):
    raw = json.dumps(event).encode()
    ts = str(int(time.time() * 1000) if t is None else t)
    sig = hmac.new(secret.encode(), ts.encode() + b"." + raw, hashlib.sha256).hexdigest()
    return raw, {"WorkOS-Signature": f"t={ts}, v1={sig}", "Content-Type": "application/json"}


async def test_off_unless_switched_on(client):
    c = await client.get("/api/auth/config")
    assert c.json() == {"provider": "own"} and c.headers["cache-control"] == "no-store"
    r = await client.get("/api/auth/workos/start", follow_redirects=False)
    assert r.status_code == 302 and r.headers["location"] == "/?home&signin_error=unavailable"


async def test_start_sends_to_authkit_with_pkce_and_state(client, admin_conn, workos_on):
    assert (await client.get("/api/auth/config")).json() == {"provider": "workos"}
    r = await client.get("/api/auth/workos/start", params={"redirect": "//evil.test/x"}, follow_redirects=False)
    u = urlparse(r.headers["location"])
    q = parse_qs(u.query)
    assert f"{u.scheme}://{u.netloc}{u.path}" == "https://api.workos.com/user_management/authorize"
    assert q["provider"] == ["authkit"] and q["client_id"] == ["client_test"] and q["response_type"] == ["code"]
    assert q["redirect_uri"] == ["http://localhost:5173/api/auth/workos/callback"]
    assert q["screen_hint"] == ["sign-up"] and q["code_challenge_method"] == ["S256"]
    st = await admin_conn.fetchrow("select redirect_to, code_verifier from auth.oauth_states where state = $1", q["state"][0])
    assert st["redirect_to"] == "/?dashboard"                                  # open redirect refused
    want = base64.urlsafe_b64encode(hashlib.sha256(st["code_verifier"].encode()).digest()).rstrip(b"=").decode()
    assert q["code_challenge"] == [want]
    r = await client.get("/api/auth/workos/start", params={"screen": "sign-in"}, follow_redirects=False)
    assert parse_qs(urlparse(r.headers["location"]).query)["screen_hint"] == ["sign-in"]


async def test_workos_switches_the_code_and_google_routes_off(client, workos_on):
    assert (await client.post("/api/auth/email/start", json={"email": "a@example.test"})).status_code == 404
    assert (await client.post("/api/auth/email/verify", json={"email": "a@example.test", "code": "123456"})).status_code == 404
    assert (await client.get("/api/auth/google/start", follow_redirects=False)).status_code == 404
    assert (await client.get("/api/auth/google/callback", params={"state": "s", "code": "c"},
                             follow_redirects=False)).status_code == 404


async def test_callback_creates_account_and_session_and_ends_workos_session(client, admin_conn, monkeypatch, workos_on):
    user = {"id": "user_new1", "email": "Wos.New@Example.test", "email_verified": True,
            "first_name": "Ada", "last_name": "Lovelace"}
    seen = fake_workos(monkeypatch, user, sid="session_new1", authentication_method="MagicAuth")
    state = await start_state(client, redirect="/?subscribe&activate=subscriber")
    cb = await client.get("/api/auth/workos/callback", params={"state": state, "code": "wos-code"}, follow_redirects=False)
    assert cb.status_code == 302 and cb.headers["location"] == "/?subscribe&activate=subscriber"
    assert cb.headers["set-cookie"].startswith("__session=") and "HttpOnly" in cb.headers["set-cookie"]
    assert seen["code"] == "wos-code" and seen["verifier"] and seen["ip"] == "127.0.0.1"
    assert workos_on == ["session_new1"]                                       # WorkOS's own session ended at once
    row = await admin_conn.fetchrow(
        "select u.id, u.raw_user_meta_data, i.provider_id, i.identity_data, s.method from auth.users u "
        "join auth.identities i on i.user_id = u.id join auth.sessions s on s.user_id = u.id "
        "where u.email = 'wos.new@example.test'")
    assert row["provider_id"] == "user_new1" and row["method"] == "workos"
    assert "Ada Lovelace" in row["raw_user_meta_data"] and "MagicAuth" in row["identity_data"]
    me = (await client.get("/api/auth/me")).json()
    assert me["user"]["email"] == "wos.new@example.test"
    assert me["name"] == {"first_name": "Ada", "last_name": "Lovelace", "full_name": "Ada Lovelace"}
    t = await client.post("/api/auth/token", headers=H)
    assert t.status_code == 200 and t.json()["user"]["id"] == str(row["id"])
    replay = await client.get("/api/auth/workos/callback", params={"state": state, "code": "wos-code"}, follow_redirects=False)
    assert replay.headers["location"] == "/?home&signin_error=expired"        # state is single use


async def test_first_workos_sign_in_keeps_an_existing_account(client, admin_conn, monkeypatch, workos_on):
    # An account from before the switch (made here by the local testing sign-in).
    r = await client.post("/api/auth/dev/direct", json={"email": "keep@example.test"}, headers=H)
    old_id = r.json()["user"]["id"]
    client.cookies.clear()
    cb, _ = await sign_in(client, monkeypatch, {"id": "user_keep", "email": "KEEP@example.test", "email_verified": True})
    assert cb.status_code == 302 and cb.headers["location"] == "/?dashboard"
    assert (await client.post("/api/auth/token", headers=H)).json()["user"]["id"] == old_id
    providers = await admin_conn.fetch("select provider from auth.identities i join auth.users u on u.id = i.user_id "
                                       "where u.email = 'keep@example.test' order by provider")
    assert [p["provider"] for p in providers] == ["email", "workos"]


async def test_known_workos_user_keeps_account_when_email_changes(client, admin_conn, monkeypatch, workos_on):
    await sign_in(client, monkeypatch, {"id": "user_move", "email": "before@example.test", "email_verified": True})
    first = (await client.post("/api/auth/token", headers=H)).json()["user"]["id"]
    client.cookies.clear()
    await sign_in(client, monkeypatch, {"id": "user_move", "email": "after@example.test", "email_verified": True})
    second = (await client.post("/api/auth/token", headers=H)).json()["user"]
    assert second == {"id": first, "email": "after@example.test"}
    assert await admin_conn.fetchval(
        "select count(*) from auth.users where email in ('before@example.test', 'after@example.test')") == 1


async def test_link_on_a_deleted_account_moves_to_the_live_one(client, admin_conn, monkeypatch, workos_on):
    await sign_in(client, monkeypatch, {"id": "user_re", "email": "re@example.test", "email_verified": True})
    await admin_conn.execute("update auth.users set deleted_at = now() where email = 're@example.test'")
    client.cookies.clear()
    cb, _ = await sign_in(client, monkeypatch, {"id": "user_re", "email": "re@example.test", "email_verified": True})
    assert cb.headers["location"] == "/?dashboard"
    live = await admin_conn.fetchval("select id from auth.users where email = 're@example.test' and deleted_at is null")
    linked = await admin_conn.fetchval("select user_id from auth.identities where provider = 'workos' and provider_id = 'user_re'")
    assert live is not None and linked == live
    assert (await client.post("/api/auth/token", headers=H)).json()["user"]["id"] == str(live)


async def test_unverified_email_is_refused(client, admin_conn, monkeypatch, workos_on):
    cb, _ = await sign_in(client, monkeypatch, {"id": "user_unv", "email": "unv@example.test", "email_verified": False},
                          sid="session_unv")
    assert cb.headers["location"] == "/?home&signin_error=unverified" and "set-cookie" not in cb.headers
    assert await admin_conn.fetchval("select count(*) from auth.users where email = 'unv@example.test'") == 0
    assert workos_on == ["session_unv"]


async def test_suspended_account_is_refused(client, admin_conn, monkeypatch, workos_on):
    await client.post("/api/auth/dev/direct", json={"email": "banned@example.test"}, headers=H)
    client.cookies.clear()
    await admin_conn.execute("update auth.users set banned_until = now() + interval '1 day' where email = 'banned@example.test'")
    cb, _ = await sign_in(client, monkeypatch, {"id": "user_banned", "email": "banned@example.test", "email_verified": True})
    assert cb.headers["location"] == "/?home&signin_error=suspended" and "set-cookie" not in cb.headers


async def test_callback_refusals(client, monkeypatch, workos_on):
    r = await client.get("/api/auth/workos/callback", params={"error": "access_denied", "state": "wos.x"}, follow_redirects=False)
    assert r.headers["location"] == "/?home&signin_error=cancelled"
    r = await client.get("/api/auth/workos/callback", params={"state": "not-ours", "code": "c"}, follow_redirects=False)
    assert r.headers["location"] == "/?home&signin_error=workos"

    async def refuse(*a, **k):
        raise workos.WorkOSError("refused")

    monkeypatch.setattr(workos, "authenticate_code", refuse)
    state = await start_state(client)
    r = await client.get("/api/auth/workos/callback", params={"state": state, "code": "c"}, follow_redirects=False)
    assert r.headers["location"] == "/?home&signin_error=workos"


async def test_consent_is_recorded_on_the_account(client, admin_conn, monkeypatch, workos_on):
    await sign_in(client, monkeypatch, {"id": "user_opt", "email": "opt@example.test", "email_verified": True})
    assert (await client.post("/api/auth/consent", json={"marketing_opt_in": True})).status_code == 403   # no CSRF header
    assert (await client.post("/api/auth/consent", json={"marketing_opt_in": True}, headers=H)).status_code == 200
    meta = json.loads(await admin_conn.fetchval("select raw_user_meta_data from auth.users where email = 'opt@example.test'"))
    assert meta["marketing_opt_in"] is True and meta["marketing_opt_in_at"]


async def test_webhook_needs_its_secret(client):
    raw, hdr = signed({"id": "event_0", "event": "user.deleted", "data": {"id": "user_x"}})
    assert (await client.post("/api/webhooks/workos", content=raw, headers=hdr)).status_code == 503


async def test_webhook_user_deleted_signs_the_person_out(client, admin_conn, monkeypatch, workos_on):
    await sign_in(client, monkeypatch, {"id": "user_gone", "email": "gone@example.test", "email_verified": True})
    assert (await client.get("/api/auth/me")).status_code == 200
    event = {"id": "event_1", "event": "user.deleted", "data": {"object": "user", "id": "user_gone"}}
    raw, hdr = signed(event, secret="someone-else")
    assert (await client.post("/api/webhooks/workos", content=raw, headers=hdr)).status_code == 400   # wrong signature
    raw, hdr = signed(event, t=int(time.time() * 1000) - 3_600_000)
    assert (await client.post("/api/webhooks/workos", content=raw, headers=hdr)).status_code == 400   # replayed later
    raw, hdr = signed(event)
    assert (await client.post("/api/webhooks/workos", content=raw, headers=hdr)).status_code == 200
    assert (await client.get("/api/auth/me")).status_code == 401
    live = await admin_conn.fetchval("select count(*) from auth.sessions s join auth.users u on u.id = s.user_id "
                                     "where u.email = 'gone@example.test' and s.revoked_at is null")
    assert live == 0
    assert (await client.post("/api/webhooks/workos", content=raw, headers=hdr)).status_code == 200   # a repeat is harmless
    assert await admin_conn.fetchval("select count(*) from auth.users where email = 'gone@example.test'") == 1
    # Signing up again as a new WorkOS user finds the same account by verified email.
    client.cookies.clear()
    await sign_in(client, monkeypatch, {"id": "user_back", "email": "gone@example.test", "email_verified": True})
    assert (await client.get("/api/auth/me")).json()["user"]["email"] == "gone@example.test"
    assert await admin_conn.fetchval("select count(*) from auth.users where email = 'gone@example.test'") == 1


async def test_webhook_user_updated_follows_a_verified_email(client, admin_conn, monkeypatch, workos_on):
    await sign_in(client, monkeypatch, {"id": "user_upd", "email": "old.addr@example.test", "email_verified": True})
    raw, hdr = signed({"id": "event_2", "event": "user.updated",
                       "data": {"id": "user_upd", "email": "New.Addr@example.test", "email_verified": True}})
    assert (await client.post("/api/webhooks/workos", content=raw, headers=hdr)).status_code == 200
    assert await admin_conn.fetchval("select count(*) from auth.users where email = 'new.addr@example.test'") == 1
    raw, hdr = signed({"id": "event_3", "event": "user.updated",
                       "data": {"id": "user_upd", "email": "unchecked@example.test", "email_verified": False}})
    assert (await client.post("/api/webhooks/workos", content=raw, headers=hdr)).status_code == 200
    assert await admin_conn.fetchval("select count(*) from auth.users where email = 'unchecked@example.test'") == 0


def test_the_switch_needs_its_keys(monkeypatch):
    from app.config import load_settings
    monkeypatch.setenv("AUTH_PROVIDER", "workos")
    monkeypatch.delenv("WORKOS_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="WORKOS_API_KEY"):
        load_settings()
    monkeypatch.setenv("AUTH_PROVIDER", "okta")
    with pytest.raises(RuntimeError, match="own or workos"):
        load_settings()
    monkeypatch.setenv("AUTH_PROVIDER", "WorkOS")
    monkeypatch.setenv("WORKOS_API_KEY", "sk_test_key")
    monkeypatch.setenv("WORKOS_CLIENT_ID", "client_test")
    assert load_settings().workos
