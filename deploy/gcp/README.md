# Attacked.ai on Google Cloud: runbook

Everything the product needs, on Google Cloud only. No Supabase service is used
after the move. This file is the operator's checklist; the "why" behind each
choice is in the production guide the team received with it.

## What runs where

| Piece | Google Cloud product | Name | Code |
|---|---|---|---|
| Website | Firebase Hosting (Google's CDN, free SSL) | `<project>.web.app` or your domain | `dist/` built by Vite, `firebase.json` |
| Data API (`/rest/v1`) | Cloud Run | `attacked-data` | `deploy/gcp/data/` (PostgREST 12 + nginx) |
| Backend API (`/api`) | Cloud Run | `attacked-api` | `api/` (FastAPI, `BACKEND=gcp`) |
| Email + scheduled functions | Cloud Run (private) | `fn-daily-digest`, `fn-incident-deliver`, `fn-welcome-email`, `fn-incident-images`, `fn-incident-report` | `supabase/functions/*`, `deploy/gcp/functions/` |
| Database | Cloud SQL, PostgreSQL 17 | `attacked-db`, database `attacked` | `deploy/gcp/db/` |
| Files | Cloud Storage | `<project>-avatars`, `-incident-media` (public read), `-reports`, `-sweep-archive` (private) | |
| Timers | Cloud Scheduler | `attacked-outbox`, `-incident-deliver`, `-cleanup`, `-daily-digest`, `-incident-images` | `api/app/routers/gcp_jobs.py` |
| Secrets | Secret Manager | see the table below | |
| Build + deploy | Cloud Build + Artifact Registry | repo `attacked` | `deploy/gcp/cloudbuild.yaml` |
| Sign-in | WorkOS AuthKit (hosted page) in front of our API's sessions; fallback: our own Google + emailed code | `AUTH_PROVIDER` on `attacked-api` | `api/app/gcp/workos.py`, `api/app/routers/gcp_auth.py` |
| Email delivery | Resend | | `api/app/gcp/mailer.py`, `supabase/functions/_shared/mail.ts` |

WorkOS and Resend are the only services outside Google Cloud. WorkOS only
proves who someone is: the API then opens its own session (the `__session`
cookie, 30 days) and ends the one WorkOS opened, so the database, row-level
security, tiers and sign-out work exactly as with the emailed code.

Firebase Hosting forwards three paths to Cloud Run, so the site, the data API
and the backend share one origin (no CORS, and the sign-in cookie is
first-party):

    /api/**         -> attacked-api
    /rest/v1/**     -> attacked-data  (PostgREST)
    /storage/v1/**  -> attacked-data  (old picture links redirect to Cloud Storage)

## Before you start (one time, in a browser)

1. **Google Cloud project with billing** at console.cloud.google.com. Note the project id.
2. **Resend account** (resend.com): Domains → Add `attacked.ai` → add the DNS records it shows (SPF, DKIM) plus a DMARC record `_dmarc TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@attacked.ai"` → wait for Verified → API Keys → create one with **Sending access** only.
3. **Google sign-in** (in the same Google Cloud project): APIs & Services → OAuth consent screen → External; app name Attacked.ai, support email, logo, home page, **privacy policy URL and terms URL** (must be live, final pages on your domain), authorised domain. Then Credentials → Create credentials → OAuth client ID → Web application. Authorised redirect URIs: the one the WorkOS dashboard shows under Authentication → Google OAuth (WorkOS signs people in with this client), plus `https://<SITE>/api/auth/google/callback` if you keep our own Google sign-in as the fallback (add `http://localhost:5173/api/auth/google/callback` for local testing). Copy the client id and secret. Publishing the consent screen for everyone needs Google's brand verification (a few days).
4. **WorkOS** (dashboard.workos.com, the **Production** environment; Staging is for localhost, with `http://localhost:5173` in place of `https://<SITE>`, and is already set up apart from its sign-in methods: `deploy/gcp/WORKOS.md` has the IDs, the state and the full checklist):
   - Redirects: Redirect URI `https://<SITE>/api/auth/workos/callback` (make it the default), Sign-in endpoint `https://<SITE>/api/auth/workos/start`, Sign-out redirect `https://<SITE>/?home`.
   - Authentication: **Magic Auth** on (the emailed 6-digit code); **Password** off; **Google OAuth** on with the client from step 3; **Microsoft OAuth** on with your own Entra app (Azure portal → App registrations; WorkOS shows the redirect URI). WorkOS's shared demo keys work in Staging only.
   - Radar (bot protection): on.
   - Branding: copy Staging's (already set). Every value, the brand-panel HTML/CSS and what WorkOS cannot do are in `deploy/gcp/WORKOS.md`. Upload the logo and favicon in the dashboard. Custom domains: `auth.attacked.ai` for the sign-in page and attacked.ai for the code emails (each needs DNS records WorkOS shows).
   - Sessions: nothing to set. The API ends WorkOS's session right after sign-in; ours lasts `SESSION_DAYS` (30).
   - Webhooks: endpoint `https://<SITE>/api/webhooks/workos`, events `user.updated` and `user.deleted`. Copy its signing secret.
   - API Keys: copy the **Client ID** (`client_…`) into `WORKOS_CLIENT_ID` in config.env and keep the **API key** (`sk_live_…`) for Secret Manager below.
5. **Firebase**: console.firebase.google.com → Add project → pick the existing Google Cloud project → Hosting → Get started.
6. **Make the GitHub repo private** before connecting Cloud Build to it (the old ingest token is in its history).

## Set up (Cloud Shell, from the repo root)

    cp deploy/gcp/config.env.example deploy/gcp/config.env    # fill it in
    bash deploy/gcp/setup.sh --dry-run                         # read what it will do
    bash deploy/gcp/setup.sh apis registry accounts secrets sql buckets

Add the secrets only a person can supply (setup prints the ones still missing):

    printf '%s' 'sk_live_…'       | gcloud secrets versions add workos-api-key --data-file=-
    printf '%s' '<signing secret>' | gcloud secrets versions add workos-webhook-secret --data-file=-
    printf '%s' 're_…'            | gcloud secrets versions add resend-api-key --data-file=-
    # Only for our own Google sign-in (the fallback):
    printf '%s' '<client id>'     | gcloud secrets versions add google-client-id --data-file=-
    printf '%s' '<client secret>' | gcloud secrets versions add google-client-secret --data-file=-

Upload the reports (they are on the owner's PC, not in git):

    gcloud storage cp public/reports/*.html public/reports/manifest.json gs://<project>-reports/

Then:

    bash deploy/gcp/setup.sh build          # images
    bash deploy/gcp/setup.sh migrate        # rehearsal copy of the database (see below)
    bash deploy/gcp/setup.sh deploy scheduler hosting monitoring

## Secrets

| Secret | What it is | Made by | Read by |
|---|---|---|---|
| `jwt-secret` | signs every access token; shared with PostgREST | setup.sh | api, data |
| `anon-key` | public JWT, role anon (like Supabase's anon key) | setup.sh | api, build (baked into the site) |
| `service-role-key` | JWT that bypasses row-level security | setup.sh | api, functions, GUARD pipeline |
| `pgrst-db-uri` | PostgREST's database login (`authenticator`) | setup.sh | data |
| `database-url` | the API's database login (`attacked_api`) | setup.sh | api |
| `db-admin-password` | Cloud SQL `postgres` user | setup.sh | migrate job |
| `db-authenticator-password`, `db-api-password` | the two logins above | setup.sh | migrate job |
| `internal-token` | API → functions, and manual job runs | setup.sh | api, functions |
| `ingest-token` | `/api/ingest` for the sweeper | setup.sh | api |
| `workos-api-key` | WorkOS API key (`sk_live_…`): exchanges sign-in codes, ends WorkOS sessions | **you** | api |
| `workos-webhook-secret` | checks the signature on WorkOS's webhooks (optional until webhooks are on) | **you** | api |
| `google-client-id`, `google-client-secret` | our own Google sign-in (`AUTH_PROVIDER=own`, the fallback) | **you** | api |
| `resend-api-key` | sending email | **you** | api, functions |
| `supabase-db-url`, `supabase-service-key` | only for the move | **you** | migrate job, copy_storage.sh |
| `twilio-*` | WhatsApp in incident-deliver (optional) | **you** | functions |

Rotate one: add a new version (`gcloud secrets versions add <name> …`), then
redeploy the services that read it (`gcloud run services update <svc> --region=<r>`
picks up `:latest`). Rotating `jwt-secret` signs everyone out and needs new
`anon-key` / `service-role-key` values (delete their versions and rerun
`setup.sh secrets`), then a site rebuild (the anon key is in the bundle).

## Database migration

The move is a rehearsal first, then the real copy.

1. Supabase dashboard → Project Settings → Database → Connection string → **Session pooler** (port 5432). Store it:
   `printf '%s' 'postgresql://postgres.<ref>:<db password>@<host>:5432/postgres' | gcloud secrets versions add supabase-db-url --data-file=-`
2. `bash deploy/gcp/setup.sh migrate` restores into a scratch database `attacked_rehearsal`, applies the fixes, and prints every table's row count, source vs target. Read the "unexpected errors" list and the counts in the job's log (Cloud Run → Jobs → attacked-migrate → Logs).
3. Real move: stop the GUARD pipeline pushes, then `MIGRATE_MODE=apply bash deploy/gcp/setup.sh migrate`.
4. Files: `bash deploy/gcp/db/copy_storage.sh` (see its header for the three env vars). Old picture links in rows were already rewritten by the migration; `/storage/v1/object/public/…` links in old emails redirect.
5. Everyone signs in again once (sessions are not copied). Accounts, tiers, profiles and ids are.

What the move keeps working, unchanged: every table, view, SQL function, trigger
and row-level-security policy (`deploy/gcp/db/01_supabase_compat.sql` recreates
Supabase's roles, `auth.uid()`, and replaces pg_net with an outbox that
`attacked-outbox` drains every minute). Tested on PostgreSQL 17 locally.

## Point the GUARD pipeline at Google Cloud

No code change: the pipeline speaks PostgREST, and so does `attacked-data`. In
`GUARD_Pipeline/scraper/.env`:

    GUARD_SUPABASE_URL=https://attacked-data-<hash>.a.run.app     # the data service URL
    GUARD_SUPABASE_KEY=<anon-key>                                  # gcloud secrets versions access latest --secret=anon-key
    GUARD_UPLOAD_KEY=<unchanged>                                   # copied into Cloud SQL's vault by the migration

Run `node scraper/smoke-test.js` before the next push.

## Cutover checklist

- [ ] Rehearsal counts all match; the unexpected-errors list is empty or understood
- [ ] Site works on `<project>.web.app`: sign in through WorkOS by emailed code, by Google, by Microsoft; a new account gets the "One last step" profile form once (and the welcome email); an account copied from Supabase keeps its tier; sign out; map, hub, dashboard, admin, reports (locked for free readers), profile picture upload
- [ ] WorkOS → Webhooks → "Send test event" reaches `/api/webhooks/workos` (200 in Cloud Logging)
- [ ] Freeze pipeline pushes → `MIGRATE_MODE=apply` → copy_storage.sh → repoint the pipeline
- [ ] Connect the custom domain in Firebase Hosting; update `SITE_URL` in config.env; rerun `setup.sh deploy`; in WorkOS add the domain's redirect URI, sign-in endpoint and sign-out redirect (and in the Google OAuth client, if our own Google sign-in is kept)
- [ ] Resume `attacked-daily-digest` only when you want the subscriber brief to go out (`gcloud scheduler jobs resume attacked-daily-digest --location=<region>`)
- [ ] Keep Supabase read-only for two weeks as a fallback, then pause the project

## Every day

| Task | How |
|---|---|
| Deploy | push to `main` (Cloud Build trigger: Cloud Build → Triggers → Connect repository → config `deploy/gcp/cloudbuild.yaml`, service account `attacked-build`, substitution `_SITE_URL`) |
| Roll back | Cloud Run → service → Revisions → pick the previous one → Manage traffic 100% (or `gcloud run services update-traffic <svc> --to-revisions=<rev>=100`). Site: Firebase Hosting → Release history → Roll back |
| Logs | Cloud Logging, filter `resource.labels.service_name="attacked-api"` |
| Run a job now | `curl -X POST -H "x-internal-token: $(gcloud secrets versions access latest --secret=internal-token)" https://<api-url>/api/jobs/run/incident-deliver` |
| Backups | automatic daily + point-in-time (7 days of logs, 14 backups). Restore: Cloud SQL → Backups → Restore, or clone to a time |
| Sign someone out everywhere | `update auth.sessions set revoked_at = now() where user_id = '<id>'` (Cloud SQL Studio), or delete the user in the WorkOS dashboard (the `user.deleted` webhook does the same) |
| Switch sign-in to WorkOS on a running service | `gcloud run services update attacked-api --region=<r> --update-env-vars=AUTH_PROVIDER=workos,WORKOS_CLIENT_ID=client_… --update-secrets=WORKOS_API_KEY=workos-api-key:latest,WORKOS_WEBHOOK_SECRET=workos-webhook-secret:latest` (`setup.sh secrets` first, so the API may read them) |
| Switch sign-in back (rollback) | `gcloud run services update attacked-api --region=<r> --update-env-vars=AUTH_PROVIDER=own`. Open pages offer the emailed code on their next sign-in; no rebuild. Our Google button needs the `google-client-*` secrets on the service |
| Make someone admin | Admin dashboard → Users → tier `admin` (or `update identity.profiles set tier = 'admin' where email = …`) |

## Local development against the GCP backend

    cd api && python -m pytest -q        # 32 tests; needs a local PostgreSQL 17 (tests/conftest.py)
    BACKEND=gcp ENV=local DEV_DIRECT_SIGNIN=true … uvicorn app.main:app --port 8000
    VITE_BACKEND=gcp npm run dev         # Vite forwards /api and /rest/v1 (vite.config.js)

To try the real WorkOS page locally, give the API the Staging environment's
keys (`AUTH_PROVIDER=workos`, `WORKOS_API_KEY=sk_test_…`, `WORKOS_CLIENT_ID=…`
in `api/.env`) and start Vite with `VITE_DIRECT_SIGNIN=0`; otherwise testing
mode signs you straight in.
