# Responsiveness on the live version (branch `cards-responsive`)

The responsive fixes from `responsive-wip` (main checkout, commit d119959) were ported onto the
live version (`cards-only-on-live`, c0013eb). Only the responsive fixes came along: the live
design, wording, cookie behaviour and sign-in stay exactly as they are (no brand restyle, no
cookie-policy rewrite). 21 merge conflicts were resolved by keeping the live code and
re-applying each fix.

## Measured (2026-10-08, 29 page states × 23 screen sizes, live before → live with the port)

| Problem | Before | After |
|---|---|---|
| Page scrolls sideways | 31 | 0 |
| Text cut off | 53 | 0 |
| Text drawn over other text | 50 | 20 (all: the floating "Reading now" report pill over the text it floats above) |
| Tap targets under 24px (touch) | 2656 | 32 (all: the two sign-in checkboxes inside full-width labels) |

Laptop and desktop screenshots match the live design. Data: `D:/attacked-dev/resp/live-base`
(before), `D:/attacked-dev/resp/live-port` (after), comparison `live-port/_compare.txt`.

## Before deploying this branch

1. `vite.config.js` and `scripts/dev-direct-signin.local.mjs` in the test copy
   (`D:/attacked-dev/wt-live-resp`) are a LOCAL test sign-in only. They are not committed; never
   deploy from a copy that has them.
2. `public/reports/` is gitignored: run `node scripts/apply-report-responsive.mjs --write`, then
   `node scripts/verify-report-responsive.mjs`, on the reports folder that gets deployed.
3. Deploy only when the owner says "deploy".

## Separate issue found (not caused by the port)

The live dashboard asks image.pollinations.ai for a generated picture when an incident has no
stored one; that service now answers 402 (payment required), so those pictures fail on the live
version today. `main` already uses the stored incident pictures instead (commit a2acd01).
