# WorkOS sign-in on the live site (Supabase / Vercel)

Status: 2026-10-08. Branch `workos-live` (from the live commit `dc7953a`), not committed yet.

## What the reader sees

One window, two screens:

- **Create an account**: email, first and last name, job title, company, industry,
  email opt-in. Then either *Create your account* (a 6-digit code by email) or
  *Continue with Google / Microsoft / GitHub / LinkedIn*. Choosing a provider asks
  for job title, company and industry first, on this same page; the name and email
  come from the provider. After the code or the provider, the reader lands on the
  dashboard. **No second page.**
- **Sign in**: email (code) or a provider. A brand-new person who uses *Sign in*
  instead of *Create an account* gets the same questions once ("One last step"),
  since nothing was asked before.

No passwords. The code email is ours (Attacked.ai template, light, gold), sent
through the same Gmail account as the welcome email.

## How it works

```
page ──POST /email/start──▶ workos-auth ──▶ WorkOS Magic Auth makes the code ──▶ Gmail sends it
page ──POST /email/verify─▶ workos-auth ──▶ WorkOS checks the code
                                        └─▶ Supabase admin: create account if new, one-time token
page ◀── token ── verifyOtp ──▶ normal Supabase session (profiles, tiers, RLS unchanged)

page ──GET /start?provider=…──▶ workos-auth (signed cookie) ──▶ WorkOS ──▶ Google/Microsoft/…
     ◀── /callback ◀── WorkOS ── token in #wos_token ── verifyOtp ──▶ session
```

- Supabase Edge Function `workos-auth` (project `ovenyjguhkgiceddzwna`, verify_jwt off).
  Only these sites can use it: attackedmap.vercel.app, its Vercel previews,
  localhost:5173 and localhost:5180.
- WorkOS Staging client `client_01M4APWJ40K0B75B3ZYZJ6B0DW`. Redirect URI
  registered: `https://ovenyjguhkgiceddzwna.supabase.co/functions/v1/workos-auth/callback`.
- The site build is switched with `VITE_AUTH_PROVIDER=workos`. Without it the site
  signs in exactly as before (Supabase codes and Supabase OAuth).
- Buttons appear only for providers WorkOS has switched on (`GET /providers`,
  rechecked every 5 minutes). LinkedIn shows up by itself once it is set up in WorkOS.

## Files

| File | What |
|---|---|
| `supabase/functions/workos-auth/index.ts` | the function (deployed, version 2) |
| `src/lib/workos.js` | browser side: code, providers, return trip |
| `src/auth/AuthProvider.jsx` | WorkOS branch in signIn / verifyCode / signInWithProvider; return trip handled once |
| `src/auth/AuthModal.jsx` | provider buttons, sign-up answers kept across the provider trip |
| `src/auth/CompleteProfile.jsx` | "One last step" (only for a new person who used *Sign in*) |
| `src/main.jsx` | shows that step; friendly message when a provider trip fails |

## To switch on (owner)

1. **WorkOS API key in Supabase**: Dashboard → Edge Functions → Secrets → add
   `WORKOS_API_KEY` = the Staging key (`sk_test_…`). Until then the window says
   "Sign-in is not switched on yet."
2. **LinkedIn** (optional): LinkedIn developer app with *Sign In with LinkedIn using
   OpenID Connect*; redirect URL = the one WorkOS shows on its LinkedIn page; put
   the Client ID / Secret into WorkOS → Authentication → Providers → LinkedIn.
3. **Microsoft for work accounts** (optional): WorkOS's built-in Staging Microsoft
   credentials accept personal Microsoft accounts only (outlook.com, hotmail).
   For company Microsoft 365 accounts, register an Azure app (multi-tenant) and put
   its Client ID / Secret into WorkOS → Providers → Microsoft.

## How to test

| Where | Address |
|---|---|
| Local | http://localhost:5180 (run: `VITE_AUTH_PROVIDER=workos VITE_API_URL= npx vite --port 5180`) |
| Vercel preview | https://attackedmap-pis0ao20p-mohiawrai2609s-projects.vercel.app (open while signed in to Vercel) |

1. **New account by code**: *Sign up free* → fill everything → *Create your account*
   → code arrives from Attacked.ai → enter it → dashboard. Profile shows company and industry.
2. **New account by Google**: new browser profile or another Google account →
   *Sign up free* → job title, company, industry → *Continue with Google* → dashboard,
   nothing more to fill.
3. **Existing account by code**: *Sign in* → email → code → dashboard.
4. **Existing account by Google / GitHub / Microsoft**: *Sign in* → provider → dashboard.
5. **Cancel**: start Google, press back or cancel → site says "Sign-in was cancelled."
6. **Wrong code**: type 000000 → "That code didn't match…"; *Resend code* works.

## Going live and rolling back

- Live today: `attackedmap-cdwkvd778` (commit `dc7953a`, branch `cards-responsive`).
- Go live: promote the tested preview (or `vercel deploy --prod` from `workos-live`
  with `VITE_AUTH_PROVIDER=workos`). Only on the owner's go-ahead.
- Roll back: `vercel promote attackedmap-cdwkvd778-mohiawrai2609s-projects.vercel.app`
  (sign-in goes back to Supabase codes at once; the function can stay deployed).

## Later

- WorkOS **Production** environment (needs the WorkOS admin): new client ID and
  key, same redirect URI, then set `WORKOS_CLIENT_ID` and `WORKOS_API_KEY` secrets.
- Rotate the Staging key that was pasted in chat.
- Remove the temporary `http://localhost:5180/...` redirect URI in WorkOS once the
  GCP-mode testing is finished.
- Same flow for the GCP backend (branch `workos-auth`).
