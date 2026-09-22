"""POST /auth/send-code — the sign-in code email, sent by US.

Why this exists: whether Supabase's own email carries a code or a link is
decided by two templates in the Supabase dashboard, and only an organisation
Owner can change them. Rather than depend on that, the API generates the
reader's code through the Supabase admin API (the very code Supabase would
have emailed) and sends it itself over the project's Gmail — the same sender
the daily brief uses. Every address, new or returning, gets a code. No link,
ever. Verification is unchanged: the app calls verifyOtp with what the reader
types, exactly as before.

Body:  {"email": "...", "create": true, "meta": {...}}   meta = the sign-up form
Reply: {"sent": true, "length": 8}
"""
from __future__ import annotations

import html
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, parseaddr

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SendCodeBody(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    create: bool = True
    meta: dict | None = None


def _mail_html(code: str) -> str:
    """The code email — Attacked.ai gold on obsidian, the code the only thing on the page."""
    c = html.escape(code)
    return f"""<!doctype html><html><body style="margin:0;background:#0f0f0f;font-family:Inter,Arial,sans-serif;color:#fff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#161616;border:1px solid #2a2a2a;border-radius:14px">
<tr><td style="padding:28px 32px 8px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#F5B800;font-weight:700">Attacked.ai&trade; &middot; Secure sign-in</td></tr>
<tr><td style="padding:0 32px 6px;font-size:22px;font-weight:700">Your sign-in code.</td></tr>
<tr><td style="padding:0 32px 22px;font-size:14px;line-height:1.55;color:#bdbdbd">Enter this code back on Attacked.ai. It is valid for one hour and works once.</td></tr>
<tr><td align="center" style="padding:0 32px 26px"><div style="display:inline-block;padding:18px 28px;border:1px solid #3a3a3a;border-radius:12px;background:#0f0f0f;font-family:'JetBrains Mono','Courier New',monospace;font-size:38px;font-weight:700;letter-spacing:.32em;color:#F5B800">{c}</div></td></tr>
<tr><td style="padding:0 32px 30px;font-size:12px;line-height:1.55;color:#7a7a7a">Didn&rsquo;t request this? Someone may have typed your address by mistake &mdash; you can ignore this email.</td></tr>
</table></td></tr></table></body></html>"""


def _send(to: str, code: str) -> None:
    user, pw = settings.gmail_user, settings.gmail_app_password
    if not user or not pw:
        raise HTTPException(503, "code email is not configured on the API (GMAIL_USER / GMAIL_APP_PASSWORD)")
    sender = settings.email_from if settings.email_from and parseaddr(settings.email_from)[1] else formataddr(("Attacked.ai", user))
    msg = EmailMessage()
    msg["Subject"] = f"Your Attacked.ai sign-in code: {code}"
    msg["From"] = sender
    msg["To"] = to
    msg.set_content(f"Your Attacked.ai sign-in code is {code}. It is valid for one hour and works once.\n\nDidn't request this? You can ignore this email.")
    msg.add_alternative(_mail_html(code), subtype="html")
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=20) as s:
            s.login(user, pw)
            s.send_message(msg)
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(502, "the mail account refused the app password")
    except (smtplib.SMTPException, OSError) as e:
        raise HTTPException(502, f"could not send the code email: {e.__class__.__name__}")


@router.post("/send-code")
async def send_code(body: SendCodeBody):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "that does not look like an email address")
    if not settings.server_key:
        raise HTTPException(503, "SUPABASE_SECRET_KEY is required to issue codes")
    admin = {"apikey": settings.server_key, "Authorization": f"Bearer {settings.server_key}", "Content-Type": "application/json"}
    url = f"{settings.supabase_url}/auth/v1/admin/generate_link"
    async with httpx.AsyncClient(timeout=20) as c:
        # Existing address → a magic-link code (type "email" on verify).
        r = await c.post(url, headers=admin, json={"type": "magiclink", "email": email})
        created = False
        if r.status_code == 422 or (r.status_code >= 400 and "not found" in r.text.lower()):
            if not body.create:
                raise HTTPException(404, "no account for that address")
            # New address → create it with the sign-up form as metadata, then a signup code.
            payload = {"type": "signup", "email": email, "password": _throwaway_password()}
            if body.meta:
                payload["data"] = body.meta
            r = await c.post(url, headers=admin, json=payload)
            created = True
        if r.status_code >= 400:
            raise HTTPException(502, f"could not issue a code ({r.status_code}): {r.text[:160]}")
        j = r.json()
        code = j.get("email_otp") or (j.get("properties") or {}).get("email_otp")
    if not code:
        raise HTTPException(502, "Supabase returned no code")
    _send(email, code)
    return {"sent": True, "created": created, "length": len(code)}


def _throwaway_password() -> str:
    """generate_link(type=signup) insists on a password for a brand-new user; the
    reader never sees or uses it — they sign in with codes. 32 random chars."""
    import secrets
    return secrets.token_urlsafe(24)
