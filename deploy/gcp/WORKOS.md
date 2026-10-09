# WorkOS sign-in for Attacked.ai: status, checks and tests

Last updated 8 October 2026. Changes were made by Claude through its WorkOS
connector, signed in as mohini.awari@attacked.ai.

## In one minute

1. **Done and checked.** WorkOS's test copy (Staging) has its return addresses and the
   new light sign-in page (white, yellow and black, from the brand pack). Our code
   passes 32 automated tests.
2. **Not yet proven: one full real sign-in.** It needs one quick thing from you
   (to-do item 3 below: the test key on this computer).
3. **Not started: the live WorkOS (Production).** Only the WorkOS Admin, **Samarth
   Pujari (samarth@attacked.ai)**, can change it. The Google Cloud site is not running yet.
4. **Not saved yet.** The code changes sit in a separate working copy on this computer
   (`D:\attacked-dev\wt-workos`) and are not committed. **Your live site is unchanged.**

## Your to-do list, in order

1. ~~Turn on the right sign-in methods~~ **Done by Claude on 8 October, at your request,
   and checked in WorkOS.** On: Magic Auth ("email me a 6-digit code"), Google,
   Microsoft, SSO (company sign-in). Off: Password, Apple, GitHub and the rest.
2. **Upload the logo and favicon** (WorkOS → Staging → Branding). The connector cannot upload files.
   - Logo: `D:\attacked-dev\wt-workos\public\brand\attacked-ai-mark-black.svg`
   - Favicon: `D:\attacked-dev\wt-workos\public\favicon.svg`
   - If WorkOS also asks for a dark-mode logo: `D:\attacked-dev\wt-workos\public\brand\attacked-ai-mark-white.svg`
3. **Put the Staging key on this computer, then say "run the WorkOS test"** (section 3B).
4. **During that test, read the two legal pages** that now mention WorkOS (3B step 6).
5. **Confirm the brand.** Your saved brand note for Claude still says gold `#F5B800` and
   the Cormorant Garamond font. The brand pack you gave (`Downloads\Attacked.AI Brand
   Assets.zip`) uses gold `#FCBD00` and Inter, so the sign-in page follows the pack.
   If the pack is right, the saved note should be updated.
6. **Ask Samarth to set up Production** (section 4), or to make mohini.awari@attacked.ai
   an Admin. Claude can then do the addresses, branding and webhooks. A person still
   does the sign-in methods, the logo upload, the live key and the Google and Microsoft apps.

Claude's own to-do: remove the temporary `localhost:5180` return address after your
test, commit the code when you say so, and help deploy to Google Cloud.

---

## 1. What Claude changed in WorkOS, and what it left alone

**Changed in Staging:**
- **Return addresses:** `http://localhost:5173/api/auth/workos/callback` (the default),
  and a temporary `http://localhost:5180/api/auth/workos/callback` for the test run.
- **Start and end pages:** the sign-in start page `http://localhost:5173/api/auth/workos/start`,
  and the sign-out page `http://localhost:5173/?home`.
- **Everything under Branding:**
  - light theme, colours, corners, font and display name;
  - the sign-in and sign-up headings, with name fields on sign-up;
  - the black brand panel on both pages;
  - the Terms and Privacy links and the support email.

- **Sign-in methods**, at your request: Magic Auth, Google, Microsoft and SSO on;
  Password, Apple and GitHub off.

**Left as WorkOS set them (Staging):** Radar bot protection, the WorkOS emails, and the API key (created by WorkOS on 7 October when the
account was made). Staging's *Events* list also has WorkOS's own setup entries, plus one
started-then-timed-out company sign-in from Claude's earlier check with a test address.

**Production:** nothing changed. The connector account can only read it.

### Status, item by item

| Staging | Status |
|---|---|
| Return addresses, start page, sign-out page | **Done and checked** |
| Colours, text and brand panel | **Done and checked** in a browser, computer and phone sizes |
| Logo and favicon | **Your turn** (to-do 2) |
| Sign-in methods | **Done and checked**: email code (Magic Auth), Google, Microsoft, SSO on; Password, Apple, GitHub off |
| Bot protection (Radar) | Rules set by WorkOS: suspicious sign-ins get an extra check, and rapid repeated attempts are blocked. Mode is **Log** (watch only), which is fine for testing. Turn on **Enforce** in Production |
| WorkOS emails (sign-in code, verification, invitations) | On (WorkOS default) |
| Webhooks | **Not needed on Staging** (WorkOS cannot reach this computer). Set up on Production |

| Production | Status |
|---|---|
| Everything | **Waiting on Samarth.** Not set up: only SSO is on (email code, password and every social login off). There is no API key, no return addresses, no branding (WorkOS defaults) and no webhooks, and there are 0 users. Radar rules are the defaults in **Log** mode, the emails are on, and the sign-in page is at `diverse-fantasy-22.authkit.app` |
| Google sign-in app (made in Google Cloud) | **To do**, by whoever owns the Google Cloud project. Needed for "Continue with Google" in Production |
| Microsoft sign-in app (made in Microsoft Entra) | **To do**, by whoever owns the Microsoft account. Needed for "Continue with Microsoft" in Production |

| Our code (in `D:\attacked-dev\wt-workos`) | Status |
|---|---|
| WorkOS sign-in and return, ending WorkOS's own session, the 30-day sign-in | **Done and checked**: 15 WorkOS tests pass, part of the 32-test API suite |
| Existing accounts found by verified email (they keep their id, and with it their tier and profile) | **Done and checked** with a local account; not yet with a copy of a Supabase account |
| WorkOS telling our site a user was deleted or changed email (webhooks) | **Done and checked** with signed test messages |
| Switch back to the old sign-in (`AUTH_PROVIDER=own`) | **Done and checked** |
| "Sign in" button hands over to WorkOS's page | **Done and checked** against the real WorkOS Staging |
| "One last step" form after the first sign-in | **Done, checked only with a stand-in for WorkOS** |
| Welcome email after "One last step" | Our part (marking the account as onboarded) **done**. The email itself is sent by the live database, so it can only be checked on Google Cloud |
| Message when a sign-in fails | **Done and checked** |
| Privacy and cookie pages mention WorkOS (Google Cloud site only) | **Your turn: read them** (3B step 6) |
| Deploy scripts and runbook | **Written**; their first real run is the deployment |
| Live on Google Cloud | **Not started**; you decide when (`attacked-ai-prod.web.app` says "Site Not Found" today) |

---

## 2. How to check the WorkOS changes yourself

Open **dashboard.workos.com** and sign in. At the top left, switch to **Staging**
(Production looks empty). Menu names may differ slightly:

1. **Redirects:**
   - the two return addresses (5173 is the default);
   - the start page `http://localhost:5173/api/auth/workos/start`;
   - the sign-out page `http://localhost:5173/?home`.
2. **Branding:**
   - **Colours:** theme **Light**; page **#FFFFFF**; button **#FCBD00** with **#0E1116** text; links **#8A6D00**.
   - **Look:** corners **Small**, font **Inter**, name **Attacked.ai**.
   - **Sign-in and sign-up pages:**
     - layout **Two column**, panel on the **left**, hidden on phones, text in the panel boxes (no need to read it);
     - Terms link: `https://attackedmap.vercel.app/?legal=terms`;
     - Privacy link: `https://attackedmap.vercel.app/?legal=privacy`.
   - This is also where you upload the logo and favicon (to-do 2).
3. **Authentication:** Magic Auth, Google, Microsoft and SSO on; Password, Apple and GitHub off.
4. **Radar:** the rules and the Log mode described in section 1.
5. **API Keys:** one key, "WorkOS API key". You copy it in 3B.
6. **Users** and the list of sent emails: empty until someone signs in. Afterwards
   *Users* shows your name, *Events* shows a "user created" entry, and the sent emails
   show your code email. If you can't find a list, ask Claude to "show the WorkOS sent emails".

**Look at the sign-in page now** (look only; don't sign up from here). The last step
tries to open a test site on this computer that is not running, so the browser would
say "This site can't be reached".

- Sign-in: `https://api.workos.com/user_management/authorize?client_id=client_01M4APWJ40K0B75B3ZYZJ6B0DW&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fapi%2Fauth%2Fworkos%2Fcallback&response_type=code&provider=authkit&screen_hint=sign-in`
- Sign-up: the same link with `screen_hint=sign-up` at the end.

You should see:
- **The page:** white.
- **The sign-in card (right side):** white, with a gold button and dark-gold links.
- **The brand panel (left side, computers only):** ink black. It shows the white shield,
  "Attacked" with a gold ".ai", and "Every incident. Every **blast radius**. Mapped." with
  "blast radius" in gold. A gold band at the bottom says "Built for clarity under pressure."
  on sign-in and "Bring us your worst day." on sign-up. It is the only black on the page,
  because gold text can only be read on black. If you want no black at all, say so and
  the panel can be switched off.
- **On phones:** the panel hides and only the white card shows.
- **Until the logo is uploaded (to-do 2)**, the card has no logo above the heading.
  That is expected.

---

## 3. How to test

### A. Already tested by Claude

- **Automated tests:** 32 API tests pass against a local database.
  - 15 are for WorkOS (`api/tests/test_workos.py`): sign-in start and return, account linking, email change, suspended account, unverified email refused, webhook signatures, user deleted, the email opt-in, and the switch.
  - 17 are the existing sign-in, session and job tests (`api/tests/test_gcp_auth.py`).
- **Against the real WorkOS Staging, in a browser:**
  - "Sign in" on our site opened the WorkOS page on the right screen, and WorkOS accepted our return address.
  - A company address (`@example.com`) went to WorkOS's test company sign-in.
  - Our server could reach WorkOS. With no key configured yet, it was refused, and our site showed its "Sign-in didn't finish" message.
  - A sign-in using the real Staging key has **not** happened yet; that is test B.
- **The full round trip, with a stand-in for WorkOS and the database:**
  - Sign in → "One last step" → saved → the dashboard opens with the chosen industry.
  - The email opt-in is saved, and the "onboarded" mark is set only once.
  - Checked at computer and phone sizes.

### B. The full real test (about 5 minutes of your time)

1. (Sign-in methods: already done.)
2. In WorkOS (Staging → API Keys), copy the key. It starts with `sk_test_`.
   - Open **Notepad**, type `WORKOS_API_KEY=` and paste the key straight after the `=` (no spaces, no quotes).
   - Choose **File → Save As** and go to the folder `D:\attacked-dev\wt-workos\api`.
   - Set **Save as type** to **All files (\*.\*)**, type the file name `.env` (not `.env.txt`), and save.
   - That is the only line you add. Git ignores this file, and the key must **never** be pasted into the chat.
3. Tell Claude **"run the WorkOS test"**. Claude starts the test site at
   `http://localhost:5180` in the app's browser pane, with all the other settings.
4. In that browser pane:
   - **Create the account.** Press **Sign in**, then **Sign up** on the WorkOS page. Enter your first name, last name and an email that has **no account in the local test database yet** (Claude can check). Press **Continue**.
   - **Enter the code.** Type the 6-digit code WorkOS emails you.
   - **Finish the profile.** You come back to our site and see **"One last step"**. Fill it in and save.
   - **Check the dashboard** opens with your industry.
   - No welcome email arrives in this local test (it uses a stand-in database). The real one is checked on Google Cloud.
5. Then try each of these:
   - **Sign out**, then **Sign in** with the same email. "One last step" should not appear again.
   - **Continue with Google**, then **Continue with Microsoft**, using the same email if you can. You should land in the same account with no "One last step". A different email creates a new account, so the form appears again; that is correct.
   - **Refuse on Google's screen:** press **Continue with Google**, then **Cancel** on Google's page. If WorkOS sends you back to our site, it should say "Sign-in was cancelled. You can try again any time." If WorkOS shows its own page instead, note it; that is WorkOS's behaviour. Leaving the WorkOS page with Back shows no message, and that is expected.
6. **Read the legal pages:** `http://localhost:5180/?legal=privacy` and
   `http://localhost:5180/?legal=cookies`. Tell Claude about any wording changes.
7. Tell Claude **"test done"**. Claude removes the temporary 5180 address, so WorkOS →
   Redirects then shows only the 5173 one.

**What "working" means:** you land back on our site signed in, "One last step" appears
once, the dashboard opens, and signing out and back in works. If something fails, copy
the message at the bottom of our site into the chat:
- "cancelled", "took too long", "couldn't confirm that email", "suspended" and
  "unavailable" each say why;
- anything else shows "Sign-in didn't finish. Please try again." Claude can then read
  the reason in the test server's log.

### C. On Google Cloud, after the site is deployed

Whoever deploys runs the cutover checklist in `deploy/gcp/README.md`. Your part: repeat
test B on `https://attacked-ai-prod.web.app` (email code, Google, Microsoft). Check that
an existing subscriber still has their access, and that a new account gets the welcome email.

---

## 4. Production checklist (for Samarth, the WorkOS Admin)

`<SITE>` means the live web address: `attacked-ai-prod.web.app` for now. When the custom
domain is connected, add its addresses too.

1. **Redirects:**
   - return address (the default): `https://<SITE>/api/auth/workos/callback`;
   - start page: `https://<SITE>/api/auth/workos/start`;
   - sign-out page: `https://<SITE>/?home`.
2. **Authentication:**
   - **On:** Magic Auth, Google, Microsoft, SSO. **Off:** everything else.
   - Google needs the Google Cloud OAuth client (add the redirect address WorkOS shows). Microsoft needs your own Entra app registration.
3. **Branding:** copy section 5, with three changes, because on Staging all three point at `attackedmap.vercel.app`, today's live site:
   - in both panel HTML boxes, the picture address becomes `https://<SITE>/attacked-ai-logo.svg`;
   - the Privacy link becomes `https://<SITE>/?legal=privacy`;
   - the Terms link becomes `https://<SITE>/?legal=terms`.
   - Then upload the logo and favicon (the files in to-do 2).
4. **Radar:** set the mode to **Enforce** (it is Log). The rules are already right.
5. **API key:** create one. This step is for whoever runs the deployment, not in WorkOS.
   After `bash deploy/gcp/setup.sh secrets` has run (it creates the empty secret), in Cloud Shell run:
   `printf '%s' 'sk_live_…' | gcloud secrets versions add workos-api-key --project=attacked-ai-prod --data-file=-`
   (`WORKOS_CLIENT_ID` is already filled in `deploy/gcp/config.env.example`.)
6. **Webhooks**, once the site answers:
   - Add the endpoint `https://<SITE>/api/webhooks/workos` with the events `user.updated` and `user.deleted`.
   - Store its signing secret: `printf '%s' '<secret>' | gcloud secrets versions add workos-webhook-secret --project=attacked-ai-prod --data-file=-`
   - Then give it to the running API: `gcloud run services update attacked-api --region=asia-south1 --project=attacked-ai-prod --update-secrets=WORKOS_WEBHOOK_SECRET=workos-webhook-secret:latest`. Until then the webhook answers 503.
   - **To check it:** use "Send test event" if Production offers it. If not, edit a test user's name in WorkOS → Users and check that the delivery shows 200.
7. **Domains** (optional, needs DNS): `auth.attacked.ai` for the sign-in page, and
   attacked.ai as the email sender so codes come from your own domain.
8. **Sessions:** nothing to set (our API ends WorkOS's session at sign-in; ours lasts 30 days).

---

## 5. Branding (for whoever sets up Production)

You don't need to read the code below; the preview link in section 2 shows the result.

It follows the brand pack (`Attacked.AI Brand Assets.zip`: the guidelines PDF, the brand page and the logo files):
- **Gold `#FCBD00`** is the only accent: the main button and small markers. Gold *text*
  goes only on black, because on white it is unreadable.
- **Other colours:** ink `#0E1116` and white `#FFFFFF`. Links on white are `#8A6D00`.
- **Font:** Inter.
- **Logo:** the black shield on white and the white shield on black. The wordmark is "Attacked" with a gold ".ai".
- **Don't use the coloured JPEG logo.** It has a gold-filled shield and "Attacked.Ai", and it breaks the guideline rules.

**WorkOS settings:**
- **Theme and light colours:** theme **Light**; page `#FFFFFF`; button `#FCBD00` with `#0E1116` text; links `#8A6D00`.
- **Dark fallback** (used only if the theme is ever set to System): page `#0E1116`, button `#FCBD00` with `#0E1116` text, links `#FCBD00`.
- **Corners and font:** corners **Small**; font **Inter** with variant `wght@400;500;600;700`. Without the variant, WorkOS loads only the regular weight.
- **Names and text:**
  - display name **Attacked.ai**; Radar support email `hello@attacked.ai`;
  - sign-in heading "Sign in to Attacked.ai";
  - sign-up heading "Create your Attacked.ai account", with name fields on (they fill in our "One last step" form).
- **Layout (both pages):** Two column, panel on the left, hidden on phones.

**What WorkOS's page cannot do:**
- **Only one font.** It strips extra fonts, so the panel's small label uses the system monospace instead of JetBrains Mono.
- **The card can't be restyled.** It takes only the colours above.
- **Attributes get reordered.** WorkOS stores the picture's attributes in the order alt, src, class; otherwise the HTML is identical.

Panel CSS (the same on both pages):

```css
.aai-panel{box-sizing:border-box;height:100%;display:flex;flex-direction:column;background:#0E1116;color:#FFFFFF}
.aai-top{display:flex;align-items:center;gap:10px;padding:40px 48px 0}
.aai-logo{width:28px;height:28px;display:block}
.aai-mark{font-weight:600;font-size:20px;letter-spacing:-.02em;color:#FFFFFF}
.aai-mark span{color:#FCBD00}
.aai-body{flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 48px}
.aai-eyebrow{margin:0;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#A6A8AD}
.aai-title{margin:14px 0 0;font-weight:700;font-size:44px;line-height:1.05;letter-spacing:-.03em;color:#FFFFFF}
.aai-title span{color:#FCBD00}
.aai-copy{margin:20px 0 0;max-width:420px;font-size:15px;line-height:1.6;color:#A6A8AD}
.aai-strip{padding:18px 48px;background:#FCBD00;color:#111111;font-weight:700;font-size:14px;letter-spacing:-.01em}
```

Sign-in panel HTML (for Production, change the picture address as in section 4 step 3):

```html
<div class="aai-panel"><div class="aai-top"><img alt="" src="https://attackedmap.vercel.app/attacked-ai-logo.svg" class="aai-logo"><span class="aai-mark">Attacked<span>.ai</span></span></div><div class="aai-body"><p class="aai-eyebrow">Global risk intelligence · live daily</p><h2 class="aai-title">Every incident.<br>Every <span>blast radius</span>.<br>Mapped.</h2><p class="aai-copy">Cyber, supply-chain, financial, geopolitical and physical incidents, classified through GUARD, with the blast radius traced to named companies.</p></div><div class="aai-strip">Built for clarity under pressure.</div></div>
```

Sign-up panel HTML:

```html
<div class="aai-panel"><div class="aai-top"><img alt="" src="https://attackedmap.vercel.app/attacked-ai-logo.svg" class="aai-logo"><span class="aai-mark">Attacked<span>.ai</span></span></div><div class="aai-body"><p class="aai-eyebrow">Create your free account</p><h2 class="aai-title">Every incident.<br>Every <span>blast radius</span>.<br>Mapped.</h2><p class="aai-copy">Open the live Attack Map and your industry dashboard, and get the daily brief: what happened, who else is exposed, and what to do about it.</p></div><div class="aai-strip">Bring us your worst day.</div></div>
```

---

## 6. Words used here

- **Staging:** WorkOS's test copy, used with this computer.
- **Production:** the live WorkOS that the real site will use.
- **Return address (redirect URI):** where WorkOS sends people after they sign in.
- **Start page (sign-in endpoint):** the page on our site that starts a sign-in.
- **Connector:** Claude's link to your WorkOS account.
- **Webhooks:** WorkOS telling our site that a user was deleted or changed email.
- **Radar:** WorkOS's bot protection.
- **`AUTH_PROVIDER`:** the switch that goes back to the old sign-in if ever needed.
- **SSO:** company sign-in, through a customer's own login system.

## 7. Developer reference (you can skip this)

WorkOS team **Attacked.ai**. Admin: Samarth Pujari (samarth@attacked.ai). The connector
account mohini.awari@attacked.ai has the role `MEMBER_SANDBOX`: it can write Staging and
only read Production. Project: **Attacked.ai's Project**.

| | Staging | Production |
|---|---|---|
| Environment ID | `environment_01M4APWHQ6DNZ79KMWG79P9ST8` | `environment_01M4APWM40DZZKDB3WF4NYW28N` |
| Client ID (`WORKOS_CLIENT_ID`) | `client_01M4APWJ40K0B75B3ZYZJ6B0DW` | `client_01M4APWMDPZ0XA5DFQDWCVZWW5` |
| Sign-in page domain | `progressive-camp-95-staging.authkit.app` | `diverse-fantasy-22.authkit.app` until `auth.attacked.ai` |
| API key | exists ("WorkOS API key", never used yet) | none yet |

| Connection | Direction | Code |
|---|---|---|
| Sign-in page (AuthKit, with PKCE) | browser → WorkOS → back to `/api/auth/workos/callback` | `api/app/routers/gcp_auth.py` |
| Code exchange | API → `api.workos.com/user_management/authenticate` | `api/app/gcp/workos.py` `authenticate_code` |
| End WorkOS's session | API → `api.workos.com/user_management/sessions/revoke` | `workos.py` `revoke_session` |
| Webhooks | WorkOS → `/api/webhooks/workos` (`WorkOS-Signature` checked) | `api/app/routers/gcp_webhooks.py` |
| Google, Microsoft, SSO, code emails, Radar | inside WorkOS | WorkOS dashboard |
| Secrets | Secret Manager `workos-api-key`, `workos-webhook-secret` | `deploy/gcp/setup.sh` |

The local test (3B) runs:
- the API with `BACKEND=gcp ENV=local AUTH_PROVIDER=workos WORKOS_CLIENT_ID=client_01M4APWJ40K0B75B3ZYZJ6B0DW PUBLIC_URL=http://localhost:5180`, against the local test database and a stand-in data API;
- Vite with `VITE_BACKEND=gcp VITE_DIRECT_SIGNIN=0` on port 5180. Without `VITE_DIRECT_SIGNIN=0`, "Sign in" opens the old testing form instead of WorkOS.
