"""Accounts and sessions in Cloud SQL (tables in deploy/gcp/db/01_supabase_compat.sql).

A person is one auth.users row (same ids as on Supabase, so profiles and every
foreign key survive the move) with one auth.identities row per way they sign
in: "email" (provider_id = the address), "google" (provider_id = Google's
stable subject id) and/or "workos" (provider_id = the WorkOS user id). The
signup trigger restored from Supabase (on_auth_user_created) creates their
identity.profiles row, tier free.
"""
from __future__ import annotations

import datetime as dt
import json
import uuid

import asyncpg

from ..config import settings
from . import tokens

UTC = dt.timezone.utc


class AccountError(Exception):
    pass


async def upsert_user(conn: asyncpg.Connection, email: str, *, provider: str, provider_id: str,
                      identity_data: dict | None = None, meta: dict | None = None) -> tuple[asyncpg.Record, bool]:
    """Find-or-create the person for a verified email; link this sign-in method."""
    email = email.strip().lower()
    async with conn.transaction():
        user = await conn.fetchrow(
            "select id, email, created_at, banned_until from auth.users "
            "where lower(email) = $1 and deleted_at is null for update", email)
        created = user is None
        if created:
            user = await conn.fetchrow(
                "insert into auth.users (email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data) "
                "values ($1, now(), $2::jsonb, $3::jsonb) returning id, email, created_at, banned_until",
                email, json.dumps(meta or {}), json.dumps({"provider": provider, "providers": [provider]}))
        else:
            if user["banned_until"] and user["banned_until"] > dt.datetime.now(UTC):
                raise AccountError("this account is suspended")
            await conn.execute(
                "update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()), "
                "raw_app_meta_data = jsonb_set(raw_app_meta_data, '{providers}', "
                "  (select coalesce(jsonb_agg(distinct p), '[]'::jsonb) from jsonb_array_elements_text("
                "     coalesce(raw_app_meta_data->'providers', '[]'::jsonb) || to_jsonb($2::text)) p)), "
                "updated_at = now() where id = $1", user["id"], provider)
        await conn.execute(
            "insert into auth.identities (user_id, provider, provider_id, identity_data, email, last_sign_in_at) "
            "values ($1, $2, $3, $4::jsonb, $5, now()) "
            "on conflict (provider, provider_id) do update set last_sign_in_at = now(), "
            "  identity_data = excluded.identity_data, updated_at = now()",
            user["id"], provider, provider_id, json.dumps(identity_data or {}), email)
        await conn.execute("update auth.users set last_sign_in_at = now() where id = $1", user["id"])
    return user, created


async def _follow_email(conn: asyncpg.Connection, user_id: uuid.UUID, email: str) -> None:
    """Move an account to its new verified address, unless another account holds it."""
    taken = await conn.fetchval(
        "select 1 from auth.users where lower(email) = $1 and id <> $2 and deleted_at is null", email, user_id)
    if not taken:
        await conn.execute("update auth.users set email = $2, updated_at = now() "
                           "where id = $1 and lower(coalesce(email, '')) <> $2", user_id, email)


async def upsert_workos_user(conn: asyncpg.Connection, workos_id: str, email: str, *,
                             identity_data: dict | None = None, meta: dict | None = None) -> tuple[asyncpg.Record, bool]:
    """The person behind a WorkOS user (whose email WorkOS has verified).

    Someone already linked keeps their account even if WorkOS changed their
    address since; the account follows it. Anyone else is found or created by
    email, like the other sign-ins, so accounts copied from Supabase keep their
    id, tier and profile on their first WorkOS sign-in."""
    email = email.strip().lower()
    async with conn.transaction():
        user = await conn.fetchrow(
            "select u.id, u.email, u.created_at, u.banned_until from auth.identities i "
            "join auth.users u on u.id = i.user_id where i.provider = 'workos' and i.provider_id = $1 "
            "and u.deleted_at is null for update of u", workos_id)
        if user is None:
            user, created = await upsert_user(conn, email, provider="workos", provider_id=workos_id,
                                              identity_data=identity_data, meta=meta)
            # A link left on a deleted account moves to the one the address found.
            await conn.execute("update auth.identities set user_id = $2, updated_at = now() "
                               "where provider = 'workos' and provider_id = $1 and user_id <> $2", workos_id, user["id"])
            return user, created
        if user["banned_until"] and user["banned_until"] > dt.datetime.now(UTC):
            raise AccountError("this account is suspended")
        await _follow_email(conn, user["id"], email)
        await conn.execute(
            "update auth.identities set identity_data = $2::jsonb, email = $3, last_sign_in_at = now(), updated_at = now() "
            "where provider = 'workos' and provider_id = $1", workos_id, json.dumps(identity_data or {}), email)
        await conn.execute("update auth.users set last_sign_in_at = now() where id = $1", user["id"])
    return user, False


async def follow_workos_email(conn: asyncpg.Connection, workos_id: str, email: str | None, verified: object) -> None:
    """WorkOS changed a user's address (user.updated): the linked account follows a verified one."""
    email = (email or "").strip().lower()
    if not email or verified is not True:
        return
    async with conn.transaction():
        uid = await conn.fetchval("select user_id from auth.identities where provider = 'workos' and provider_id = $1", workos_id)
        if uid is None:
            return
        await _follow_email(conn, uid, email)
        await conn.execute("update auth.identities set email = $2, updated_at = now() "
                           "where provider = 'workos' and provider_id = $1", workos_id, email)


async def forget_workos_user(conn: asyncpg.Connection, workos_id: str) -> None:
    """WorkOS deleted the user (user.deleted): sign the person out everywhere.
    Their account, tier and profile stay. The link stays too but goes inert
    (WorkOS never reuses a user id); signing in again as a new WorkOS user
    links them back by verified email."""
    uid = await conn.fetchval("select user_id from auth.identities where provider = 'workos' and provider_id = $1", workos_id)
    if uid is not None:
        await revoke_session(conn, None, everywhere_for=uid)


async def create_session(conn: asyncpg.Connection, user_id: uuid.UUID, method: str,
                         user_agent: str | None, ip: str | None) -> tuple[str, asyncpg.Record]:
    raw = tokens.new_session_token()
    expires = dt.datetime.now(UTC) + dt.timedelta(days=settings.session_days)
    row = await conn.fetchrow(
        "insert into auth.sessions (user_id, token_hash, method, expires_at, user_agent, ip) "
        "values ($1, $2, $3, $4, $5, $6::inet) returning id, user_id, method, created_at, expires_at",
        user_id, tokens.hash_session_token(raw), method, expires, (user_agent or "")[:400] or None, ip)
    return raw, row


async def session_from_token(conn: asyncpg.Connection, raw: str | None) -> asyncpg.Record | None:
    """The live session (and its person) for a cookie value, or None."""
    if not raw or len(raw) > 200:
        return None
    row = await conn.fetchrow(
        "select s.id, s.user_id, s.method, s.created_at, s.expires_at, s.last_seen_at, u.email "
        "from auth.sessions s join auth.users u on u.id = s.user_id "
        "where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now() "
        "  and u.deleted_at is null and (u.banned_until is null or u.banned_until < now())",
        tokens.hash_session_token(raw))
    if row and row["last_seen_at"] < dt.datetime.now(UTC) - dt.timedelta(minutes=5):
        await conn.execute("update auth.sessions set last_seen_at = now() where id = $1", row["id"])
    return row


async def revoke_session(conn: asyncpg.Connection, session_id: uuid.UUID | None, everywhere_for: uuid.UUID | None = None) -> None:
    if everywhere_for:
        await conn.execute("update auth.sessions set revoked_at = now() where user_id = $1 and revoked_at is null", everywhere_for)
    else:
        await conn.execute("update auth.sessions set revoked_at = now() where id = $1 and revoked_at is null", session_id)
