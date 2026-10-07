# Responsiveness pass — handoff (2026-10-07 15:50: RESUMED a fourth time in the Claude desktop app; latest safe backup = commit 90b3844 on responsive-wip, local only)

## Latest state (4th resume, 2026-10-07 afternoon) — read this first

- Re-measure (step 3 below) WAS done by the VS Code session: `D:/attacked-dev/resp/wip-check/` (13:07-13:39).
  Versus main-base: sideways scroll 31 -> 12 (all 12 on admin pages), cut text 63 -> 12, tap targets <24px 2626 -> 82.
  Attack Map shows a few more text overlaps (guided-tour card over the top-right panel); not yet judged.
- Commit 90b3844 (local, not pushed) adds three Attack Map tap-target edits made in the VS Code session.
- IMPORTANT: `public/reports/` is gitignored. The reports fixer already injected a `<style id="attacked-resp">`
  block into all 310 baked reports (script: `D:/attacked-dev/resp/fix/reports/apply-baked.mjs`). Untouched
  originals: `D:/attacked-dev/dist-check/reports/` (only difference = that block).
- New: `D:/attacked-dev/rtools/sweep-q.mjs` = queue wrapper for sweep.mjs (max 2 sweeps at once; this PC has
  <1 GB free RAM and C: is full). Agents must use it instead of sweep.mjs.
- Running now: read-only workflow wf_d58c8c80-e17 (script copy `D:/attacked-dev/resp/resp_triage_wf.js`):
  per-area triage of every finding -> `D:/attacked-dev/resp/triage/<area>.json`, and the first Attack Map
  review (phones / tablets+desktops, then a verifier) -> `D:/attacked-dev/resp/findings/map.json`.
- DONE (17:31): triage of all 7 areas -> `D:/attacked-dev/resp/triage/<area>.json` (+ `_workflow_result.json`).
  chrome 10/11 fixed, landing 15/16, hub 13/16, reports 9/13, account-legal 10/10, dashboard 16/17 (+13 new minor/1 critical:
  SubscribeModal unstyled), admin 0/13. The dev server died at ~15:50 (VS Code session), so the map review was code-only:
  `D:/attacked-dev/resp/mapreview/_first_attempt_code_only.json` (19 findings, unverified).
- Dev server now runs from the Claude desktop app (preview "attackedmap-dev", port 5173).
- RUNNING (from ~17:50): fix workflow wf_f710a4b6-176, script copy `D:/attacked-dev/resp/resp_fix2_wf.js` (args = the
  8 areas, see the script's call in this session). Map: live verify -> `findings/map-small.json`, `map-large.json`, then
  2 fix passes. Every area: fix -> independent check -> up to 2 refixes; reports in `D:/attacked-dev/resp/fix2/<area>/report.json`
  and `check2/<area>-rN/report.json`. Then cross-area integrator.
- After it: one full sweep vs main-base and a visual pass, then hand to the owner for testing (no deploy).

Owner's request (2026-10-06): before deploying, check EVERY page and section on every
phone, tablet and laptop size, and fix responsiveness properly (landing, Attack Hub,
reports, dashboard, Attack Map, pricing, legal, profile, admin — everything).

## Where things are

| What | Where |
|---|---|
| Work in progress (partial fixes, NOT verified) | git branch `responsive-wip` in this repo (commit "WIP responsiveness"), also pushed to GitHub. `main` = 49be760, untouched. |
| Same changes as a patch file | `D:/attacked-dev/resp/responsive-wip.patch` |
| Sweep tool (headless Chrome, 23 devices x 29 page states) | `D:/attacked-dev/rtools/` — `sweep.mjs`, `audit-in-page.js`, `pages-main.mjs` |
| Baseline measurements + screenshots BEFORE any fix (main @49be760) | `D:/attacked-dev/resp/main-base/<page>/<device>.json` and `<device>_NN.jpg`, `summary.json` |
| Problems found by the review (96: 22 critical, 32 major, 42 minor) | `D:/attacked-dev/resp/findings/<area>.json` — areas: chrome (nav/menu/footer/sign-in modal), landing, hub, reports, account-legal, dashboard, admin |
| Attack Map | NOT reviewed yet (review was cut off) |
| Fix workflow script (for a new session to re-run) | `D:/attacked-dev/resp/resp_fix_wf.js` (copy of the scratchpad script) |
| Card-only version waiting to go live (live site 6c98277 + Hub card fix) | branch `cards-only-on-live`, worktree `D:/attacked-dev/wt-cards` (commits bcb80be, c0013eb) |

## Latest state (2nd stop)

The fix step was re-run once (workflow wf_8f473606-fdb) and stopped again by the owner. Six fixers had started (chrome, landing, hub, reports, account-legal, dashboard), none finished or was checked; their extra edits are in the second WIP commit. Admin and Map were never started. Every change on responsive-wip is UNVERIFIED: step 3 below (re-measure) comes first.

## What was done

1. Hub card pictures fixed and verified (main 9f88794, 2d84bf5, 49be760; also on cards-only-on-live).
2. Sweep tool built; full baseline run on main (660 measurements, all 29 page states, 23 sizes).
3. Review of 7 of 8 areas -> findings files above (only the landing findings were independently double-checked: 11/11 real).
4. Fix step started (one agent per area, each editing only its own files) and was STOPPED mid-way.
   Files it had changed (now on branch responsive-wip): AttackHub.jsx, AuthModal.jsx, Globe.jsx,
   LandingPage.jsx, ProfilePage.jsx, SiteFooter.jsx, SubscribePage.jsx, UnsubscribePage.jsx,
   Dashboard.jsx, dashboard.css, reportLock.js, reportTemplate.js, responsive.css, site-nav.css
   (+ possibly some public/reports/*.html). No area was finished or checked. Admin and Map fixes never started.

## How to continue (new session)

1. `cd C:/Users/mohin/OneDrive/Documents/Desktop/ATTACKEDMAP && git checkout responsive-wip`
2. Start the dev server (`npm run dev`, port 5173).
3. Re-measure what the partial fixes already achieved:
   `cd D:/attacked-dev/rtools && node sweep.mjs --base http://localhost:5173 --out D:/attacked-dev/resp/wip-check --conc 3 --resume`
   and compare `D:/attacked-dev/resp/wip-check/summary.json` with `D:/attacked-dev/resp/main-base/summary.json`.
4. Finish each area from its findings file (critical + major first), re-run the sweep on that area's pages
   (`--only <page ids>`), look at the screenshots (320, 390, 844 landscape, 768, 1024, 1366, 1920).
   Or re-run the fix workflow: `D:/attacked-dev/resp/resp_fix_wf.js` with the same `areas` args
   (each area: key, findingsFile, files it owns, pages). The map area needs a review first.
5. Full sweep again on all pages; nothing may be worse than main-base at any size. Commit to main.
6. Port the fixes to `cards-only-on-live` (worktree D:/attacked-dev/wt-cards; dev server on port 5174 via
   launch config `attackedmap-live-dev`), re-sweep it, then ask the owner before deploying.

## Rules to keep

- Do NOT deploy until the owner says "deploy". A full `vercel --prod` from main would also ship the
  brand restyle and the cookie-policy rewrite the owner objected to; deploy the card-only branch instead.
- Legal page WORDING is the owner's: layout fixes only.
- The app reads a live Supabase project with an egress quota: keep sweeps small (`--only`, `--devices`).
- Admin pages in the sweep use the dev-server testing sign-in (scripts/dev-direct-signin.mjs) for
  mohiniawari201@gmail.com; the sweep signs that test session out (scope local) at the end.
- Page ids: landing, hub, hub-article, hub-report, report-static, subscribe, legal-privacy, legal-terms,
  legal-cookies, legal-accessibility, legal-scam, legal-faq, subscriptions, unsubscribe, dashboard-free,
  dashboard-sub, map, nav-menu, signin-modal, landing-signed-in, dashboard-real, map-real, profile,
  admin-reports, admin-inbox, admin-briefings, admin-users, admin-stats, admin-feedback.
