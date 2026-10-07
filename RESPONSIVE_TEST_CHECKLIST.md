# Responsiveness — owner test checklist (branch `responsive-wip`)

Run the app locally (`npm run dev`, then open http://localhost:5173), open Chrome DevTools
(F12), turn on the device toolbar (Ctrl+Shift+M) and try each page at these sizes:

| Kind | Sizes (width × height) |
|---|---|
| Phones | 280 × 653 (Galaxy Fold), 320 × 568, 375 × 667, 390 × 844, 430 × 932 |
| Phones sideways | 667 × 375, 844 × 390, 915 × 412 |
| Tablets | 768 × 1024, 820 × 1180, 1024 × 768, 1366 × 1024 |
| Laptops / desktops | 1280 × 800, 1366 × 768, 1440 × 900, 1920 × 1080 |

On every page check: nothing scrolls sideways, no text is cut off or drawn on top of
other text, every button is easy to tap, every menu/panel/pop-up opens AND closes.

## Pages

| Page | Address | What changed / what to try |
|---|---|---|
| Landing | `/?home` | Hero, "Live sample" card, card grids at 280-360; the welcome pop-up fits a sideways phone |
| Menu (phones) | `/?home`, tap ☰ | Signed in: the whole account menu scrolls, Sign out reachable on a sideways phone |
| Sign in / sign up | `/?home`, Sign in | Google/Microsoft buttons fit, close (×) is big, page behind does not scroll |
| Attack Hub | `/?hub` | Filter bar (no iPhone zoom), stats band at 280, top stories on tablets, red LIVE always visible |
| Hub article | open any story | Pictures whole, text width |
| Hub report | open a report from the Hub | Back button does not cover Download PDF; sideways phone has more reading room |
| Report page | `/reports/ATK-2026-0622-UKP.html` | "Reading now" button, 1081-1279 px layout, cause cards and vendor cards on phones |
| Subscribe / pricing | `/?subscribe` | Plan cards never wider than the screen; fine print readable |
| Legal (6) | `/?legal=privacy` (terms, cookies, accessibility, scam, faq) | Layout only; wording untouched |
| Unsubscribe | `/?unsubscribe=test` | Card and e-mail address fit at 280-320 |
| Dashboard | `/?dashboard&preview=free`, `&preview=subscriber`, signed in `/?dashboard` | Cards at 320-360, side drawer (with backdrop), profile menu, open a briefing (report view, "Reading now" visible sideways) |
| Subscribe pop-up | Attack Map → any Subscribe gate | Centred, scrolls inside on short screens, closes on outside tap |
| Attack Map | `/?map&preview=subscriber`, signed in `/?map` | Phones: deck, filters, timeline, every panel closes; tablets/laptops: guided-tour card does not cover the panels, zoom buttons and bottom strip visible |
| Profile | `/?profile` (signed in) | Nav stays at the top; Save row on phones |
| Admin (6 tabs) | `/?admin` (admin account) | No sideways scroll at 280-347; Users as cards on phones; report editor stacks below 1200; Stats severity row |

Measured before/after (23 sizes × 29 page states): see `D:/attacked-dev/resp/final/summary.json`
vs `D:/attacked-dev/resp/main-base/summary.json`, screenshots in the same folders.
